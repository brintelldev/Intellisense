import { Router } from "express";
import { db } from "../db.js";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import {
  customers, retainPredictions, retainAnalytics, leads, obtainScores,
  customerScoreHistory, retainChurnCauses,
} from "../../../shared/schema.js";

export const lifecycleRouter = Router();

// GET /lifecycle/executive-summary
lifecycleRouter.get("/executive-summary", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    // ── Retain data ──
    const [retainSnapshots, riskRows, topRetainCustomers, expansionRows, retainAnalyticsLatest] = await Promise.all([
      db.select().from(retainAnalytics)
        .where(eq(retainAnalytics.tenantId, tenantId))
        .orderBy(desc(retainAnalytics.snapshotDate)).limit(2),
      db.select({ riskLevel: customers.riskLevel, count: sql<number>`count(*)::int` })
        .from(customers).where(eq(customers.tenantId, tenantId))
        .groupBy(customers.riskLevel),
      db.select({ customer: customers, prediction: retainPredictions })
        .from(customers)
        .innerJoin(retainPredictions, and(
          eq(retainPredictions.customerId, customers.id),
          eq(retainPredictions.isActive, true),
          eq(retainPredictions.tenantId, tenantId),
        ))
        .where(and(
          eq(customers.tenantId, tenantId),
          sql`${customers.riskLevel} IN ('critical', 'high')`,
        ))
        .orderBy(sql`${customers.dimRevenue} * ${customers.churnProbability} DESC NULLS LAST`)
        .limit(2),
      db.execute(sql`
        SELECT c.id, c.name, c.dim_revenue, sm.median_revenue,
               GREATEST(0, sm.median_revenue - c.dim_revenue) * 12 AS annual_potential
        FROM customers c
        JOIN (
          SELECT segment, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dim_revenue) AS median_revenue
          FROM customers WHERE tenant_id = ${tenantId} AND status != 'churned' AND dim_revenue IS NOT NULL
          GROUP BY segment
        ) sm ON sm.segment = c.segment
        WHERE c.tenant_id = ${tenantId} AND c.status != 'churned'
          AND c.health_score > 55 AND c.dim_revenue < sm.median_revenue * 0.92
        ORDER BY annual_potential DESC LIMIT 3
      `),
      db.select().from(retainAnalytics)
        .where(eq(retainAnalytics.tenantId, tenantId))
        .orderBy(desc(retainAnalytics.snapshotDate)).limit(1),
    ]);

    const latestSnap = retainSnapshots[0];
    const prevSnap = retainSnapshots[1];
    const riskMap = Object.fromEntries(riskRows.map(r => [r.riskLevel, r.count]));
    const criticalCount = riskMap["critical"] ?? 0;
    const highCount = riskMap["high"] ?? 0;
    const mrr = latestSnap?.mrr ?? 0;
    const revenueAtRisk = latestSnap?.revenueAtRisk ?? 0;
    const prevRevenueAtRisk = prevSnap?.revenueAtRisk ?? 0;
    const revenueAtRiskDelta = revenueAtRisk - prevRevenueAtRisk;
    const nrr = mrr > 0 && prevSnap?.mrr && prevSnap.mrr > 0
      ? Math.round((mrr / prevSnap.mrr) * 1000) / 10
      : null;

    // Expansion total
    const expansionTotal = (expansionRows.rows as any[])
      .reduce((sum: number, r: any) => sum + (parseFloat(r.annual_potential) || 0), 0);
    const expansionCount = expansionRows.rows.length;

    // ── Obtain data ──
    const [hotLeadsCount, obtainLtvRow, topHotLead, sourceLtvRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(obtainScores)
        .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "hot"))),
      db.select({
        totalLtv: sql<number>`coalesce(sum(${obtainScores.ltvPrediction}), 0)::real`,
        avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
      }).from(obtainScores).where(eq(obtainScores.tenantId, tenantId)),
      db.select({ lead: leads, score: obtainScores })
        .from(leads)
        .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(eq(leads.tenantId, tenantId), eq(obtainScores.riskTier, "hot")))
        .orderBy(desc(obtainScores.score)).limit(1),
      db.select({
        source: leads.source,
        avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
        count: sql<number>`count(*)::int`,
      }).from(leads)
        .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(eq(leads.tenantId, tenantId), eq(obtainScores.riskTier, "hot")))
        .groupBy(leads.source)
        .orderBy(sql`avg(${obtainScores.ltvPrediction}) DESC`)
        .limit(1),
    ]);

    const hotCount = hotLeadsCount[0]?.count ?? 0;
    const totalLtv = obtainLtvRow[0]?.totalLtv ?? 0;
    const topLead = topHotLead[0] ?? null;

    // Best source by LTV (for feedback loop)
    const CHANNEL_LABELS: Record<string, string> = {
      referral: "Indicação de Clientes", event: "Feira/Evento",
      paid_social: "LinkedIn Ads", paid_search: "Google Ads",
      outbound: "Prospecção Outbound", organic: "Orgânico/SEO",
      email: "Email Marketing", csv: "CSV Import", manual: "Manual", other: "Outros",
    };

    const bestSource = sourceLtvRows[0];
    const bestSourceLabel = bestSource
      ? (CHANNEL_LABELS[bestSource.source ?? "other"] ?? bestSource.source ?? "Indicação")
      : null;

    // Overall avg LTV across all sources for comparison
    const [allSourceLtv] = await db.select({
      avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
    }).from(obtainScores).where(eq(obtainScores.tenantId, tenantId));
    const overallAvgLtv = allSourceLtv?.avgLtv ?? 0;
    const ltvMultiple = bestSource && overallAvgLtv > 0
      ? Math.round((bestSource.avgLtv / overallAvgLtv) * 10) / 10
      : null;

    // ── Contracts expiring ──
    const [contractsRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        sql`${customers.dimContractRemainingDays} < 30`,
        sql`${customers.dimContractRemainingDays} > 0`,
      ));
    const contractsExpiring30d = contractsRow?.count ?? 0;

    // ── Build narrative ──
    const totalCustomers = latestSnap?.totalCustomers ?? 0;
    const mrrFormatted = mrr >= 1000000
      ? `R$${(mrr / 1000000).toFixed(1)}M`
      : mrr >= 1000
        ? `R$${Math.round(mrr / 1000)}K`
        : `R$${Math.round(mrr)}`;
    const riskFormatted = revenueAtRisk >= 1000000
      ? `R$${(revenueAtRisk / 1000000).toFixed(1)}M`
      : revenueAtRisk >= 1000
        ? `R$${Math.round(revenueAtRisk / 1000)}K`
        : `R$${Math.round(revenueAtRisk)}`;
    const ltvFormatted = totalLtv >= 1000000
      ? `R$${(totalLtv / 1000000).toFixed(1)}M`
      : `R$${Math.round(totalLtv / 1000)}K`;

    let narrative = `Sua base tem ${totalCustomers} clientes ativos gerando ${mrrFormatted} de MRR.`;
    if (criticalCount + highCount > 0) {
      narrative += ` ${criticalCount + highCount} estão em zona crítica, representando ${riskFormatted} em receita sob risco.`;
    }
    if (nrr !== null && nrr >= 100) {
      narrative += ` A boa notícia: NRR está em ${nrr}%`;
      if (expansionCount > 0) {
        const expFormatted = expansionTotal >= 1000000
          ? `R$${(expansionTotal / 1000000).toFixed(1)}M`
          : `R$${Math.round(expansionTotal / 1000)}K`;
        narrative += ` e ${expansionCount} oportunidades de expansão totalizam ${expFormatted}/ano.`;
      } else {
        narrative += `.`;
      }
    }
    if (hotCount > 0) {
      narrative += ` No pipeline de aquisição, ${hotCount} leads hot com ${ltvFormatted} de LTV potencial aguardam ação`;
      if (bestSourceLabel && ltvMultiple && ltvMultiple > 1.5) {
        narrative += ` — o canal ${bestSourceLabel} gera ${ltvMultiple}x mais LTV que a média.`;
      } else {
        narrative += `.`;
      }
    }

    // ── Top 3 actions ──
    const actions: Array<{ type: "retain" | "obtain" | "renewal"; description: string; urgency: "critical" | "high" | "medium" }> = [];

    // Action 1: top critical customer
    if (topRetainCustomers[0]) {
      const c = topRetainCustomers[0];
      const churnPct = Math.round((c.prediction.churnProbability ?? 0) * 100);
      const revFormatted = c.customer.dimRevenue && c.customer.dimRevenue >= 1000
        ? `R$${Math.round(c.customer.dimRevenue / 1000)}K/mês`
        : `R$${Math.round(c.customer.dimRevenue ?? 0)}/mês`;
      actions.push({
        type: "retain",
        description: `Contatar ${c.customer.name} (${revFormatted}, churn ${churnPct}%)`,
        urgency: c.customer.riskLevel === "critical" ? "critical" : "high",
      });
    }

    // Action 2: renewal (if contracts expiring)
    if (topRetainCustomers[1]) {
      const c = topRetainCustomers[1];
      const days = c.customer.dimContractRemainingDays;
      if (days && days < 30) {
        actions.push({
          type: "renewal",
          description: `Renovar ${c.customer.name} (contrato vence em ${days} dias)`,
          urgency: days < 15 ? "critical" : "high",
        });
      } else {
        const churnPct = Math.round((c.prediction.churnProbability ?? 0) * 100);
        const revFormatted = c.customer.dimRevenue && c.customer.dimRevenue >= 1000
          ? `R$${Math.round(c.customer.dimRevenue / 1000)}K/mês`
          : `R$${Math.round(c.customer.dimRevenue ?? 0)}/mês`;
        actions.push({
          type: "retain",
          description: `Priorizar retenção de ${c.customer.name} (${revFormatted}, churn ${churnPct}%)`,
          urgency: "high",
        });
      }
    }

    // Action 3: top hot lead
    if (topLead) {
      actions.push({
        type: "obtain",
        description: `Agendar demo com ${topLead.lead.name} (score ${topLead.score.score}, ${topLead.lead.company ?? ""})`,
        urgency: "high",
      });
    }

    // ── Week-over-week comparison ──
    const weekComparison = prevSnap ? {
      revenueAtRisk: { current: Math.round(revenueAtRisk), delta: Math.round(revenueAtRiskDelta) },
      criticalCustomers: { current: criticalCount + highCount, delta: 0 }, // Can't easily compute delta
      hotLeads: { current: hotCount, delta: 0 },
    } : null;

    const today = new Date();
    const dateStr = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

    res.json({
      generatedAt: dateStr,
      narrative,
      actions: actions.slice(0, 3),
      weekComparison,
      stats: {
        totalCustomers,
        criticalCount,
        highCount,
        mrr,
        revenueAtRisk,
        nrr,
        hotLeads: hotCount,
        totalLtvPipeline: Math.round(totalLtv),
        expansionCount,
        expansionTotal: Math.round(expansionTotal),
        contractsExpiring30d,
        bestSourceLabel,
        ltvMultiple,
      },
    });
  } catch (err) {
    console.error("Executive summary error:", err);
    res.status(500).json({ error: "Erro ao buscar resumo executivo" });
  }
});
