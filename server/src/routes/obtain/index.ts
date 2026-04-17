import { Router } from "express";
import multer from "multer";
import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Papa from "papaparse";
import { db } from "../../db.js";
import { eq, and, desc, asc, ilike, sql, inArray, SQL } from "drizzle-orm";
import {
  leads, obtainScores, obtainCampaigns, obtainCampaignRoi,
  obtainIcpClusters, obtainFunnelMetrics, obtainLeadActions, obtainUploads,
  obtainAlerts, leadScoreHistory, customers,
} from "../../../../shared/schema.js";
import { runObtainScoring, generateObtainAlerts, generateLeadNarrative, generateRecommendedOffer, generateSalesCadence } from "../../engine/obtain-scoring.js";
import { generateIcpClusters } from "../../engine/icp-clustering.js";
import { resolveWonLeadCustomerLinks } from "../../lib/lead-customer-bridge.js";
import { computePareto } from "../../lib/pareto.js";
import { suggestMapping } from "../../engine/column-mapper.js";
import { readCsvFile } from "../../lib/csv-reader.js";
import { parseNumber } from "../../lib/value-normalizer.js";
import { formatTimeAgo } from "../../lib/time-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const obtainRouter = Router();
const upload = multer({ storage: multer.diskStorage({ destination: os.tmpdir() }), limits: { fileSize: 50 * 1024 * 1024 } });

const VALID_ACTION_TYPES = ["call", "email", "demo", "proposal", "follow_up", "whatsapp"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /dashboard ──────────────────────────────────────────────────────────
obtainRouter.get("/dashboard", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const [[leadCount], [hotCount], [ltvRow], statusCounts] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(leads).where(eq(leads.tenantId, tenantId)),
      db.select({ count: sql<number>`count(*)::int` })
        .from(obtainScores)
        .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "hot"))),
      db.select({
        avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
        totalLtv: sql<number>`coalesce(sum(${obtainScores.ltvPrediction}), 0)::bigint`,
      }).from(obtainScores).where(eq(obtainScores.tenantId, tenantId)),
      db.select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      }).from(leads).where(eq(leads.tenantId, tenantId)).groupBy(leads.status),
    ]);

    const byStatus = Object.fromEntries(statusCounts.map(r => [r.status, r.count]));
    const totalNew = byStatus["new"] ?? 0;
    const totalWon = byStatus["won"] ?? 0;
    const conversionRate = totalNew + totalWon > 0
      ? Math.round((totalWon / (totalNew + totalWon)) * 1000) / 1000
      : 0;

    // CAC heuristic: avg_ltv * 0.7% (typical blended acquisition cost ratio)
    const avgLtv = Math.round(ltvRow?.avgLtv ?? 0);
    const avgCac = Math.round(avgLtv * 0.007);

    // Pipeline Health Score (100 pts)
    const totalLeadsForHealth = leadCount.count;

    // Quality score: % hot+warm (40pts)
    const [warmCountForHealth] = await db.select({ count: sql<number>`count(*)::int` })
      .from(obtainScores)
      .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "warm")));
    const hotWarmCount = hotCount.count + (warmCountForHealth?.count ?? 0);
    const qualityScore = totalLeadsForHealth > 0
      ? (hotWarmCount / totalLeadsForHealth) * 40
      : 0;

    // Conversion score (25pts) - normalize 0-100% range
    const conversionScore = conversionRate * 25;

    // Velocity score (20pts) - inverse of avg days in funnel (normalize: 0 days=20pts, 90days=0pts)
    // Returns 0 when there are no leads — the SQL AVG of an empty set is NULL, and we must not
    // fall back to a hardcoded 30-day default that would produce a spurious non-zero score.
    const [avgFunnelTime] = await db.select({
      avgDays: sql<number>`avg(EXTRACT(EPOCH FROM (now() - ${leads.createdAt}))) / 86400`,
    }).from(leads).where(and(eq(leads.tenantId, tenantId), sql`${leads.status} != 'won'`));
    const velocityScore = totalLeadsForHealth > 0
      ? Math.max(0, (1 - Math.max(0, avgFunnelTime?.avgDays ?? 30) / 90)) * 20
      : 0;

    // Diversification score (15pts) - Shannon entropy of sources
    const sourceDiversityRows = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(leads)
      .where(eq(leads.tenantId, tenantId))
      .groupBy(leads.source);
    const totalForEntropy = sourceDiversityRows.reduce((s, r) => s + r.count, 0);
    let entropy = 0;
    for (const row of sourceDiversityRows) {
      const p = row.count / (totalForEntropy || 1);
      if (p > 0) entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(Math.max(sourceDiversityRows.length, 1));
    const diversityScore = maxEntropy > 0 ? (entropy / maxEntropy) * 15 : 0;

    const pipelineHealthScore = Math.round(qualityScore + conversionScore + velocityScore + diversityScore);

    // Identify weakest component
    const components = [
      { name: "Qualidade (hot%)", score: Math.round(qualityScore), max: 40 },
      { name: "Conversão", score: Math.round(conversionScore), max: 25 },
      { name: "Velocidade", score: Math.round(velocityScore), max: 20 },
      { name: "Diversificação", score: Math.round(diversityScore), max: 15 },
    ];
    const weakest = components.reduce((a, b) => (a.score / a.max) < (b.score / b.max) ? a : b);

    // Narrative based on weakest component
    const healthNarratives: Record<string, string> = {
      "Qualidade (hot%)": "Seu pipeline precisa de leads de maior qualidade. Foque em canais com maior taxa de conversão.",
      "Conversão": "Sua taxa de conversão pode melhorar. Revise leads parados no estágio Demo ou Proposta.",
      "Velocidade": "Leads estão demorando muito para avançar no funil. Priorize follow-ups nos leads hot parados.",
      "Diversificação": "Seu pipeline depende muito de um único canal. Diversifique as fontes de leads.",
    };
    const pipelineHealthNarrative = healthNarratives[weakest.name] ?? "Pipeline com boa saúde geral. Continue monitorando.";

    const pipelineHealth = {
      score: pipelineHealthScore,
      label: pipelineHealthScore >= 75 ? "Saudável" : pipelineHealthScore >= 50 ? "Atenção" : "Crítico",
      components,
      narrative: pipelineHealthNarrative,
      weakestComponent: weakest.name,
    };

    // Pipeline Projection (30/60/90 days)
    const projectionRows = await db.select({
      status: leads.status,
      count: sql<number>`count(*)::int`,
      totalLtv: sql<number>`coalesce(sum(${obtainScores.ltvPrediction}), 0)::real`,
      avgConversionProb: sql<number>`coalesce(avg(${obtainScores.conversionProbability}), 0)::real`,
    }).from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(and(
        eq(leads.tenantId, tenantId),
        sql`${leads.status} NOT IN ('won', 'lost')`,
      ))
      .groupBy(leads.status);

    const projMap = Object.fromEntries(projectionRows.map(r => [r.status, r]));

    // 30d: leads in "proposal" stage
    const proposal30 = projMap["proposal"];
    const proj30 = Math.round((proposal30?.totalLtv ?? 0) * (proposal30?.avgConversionProb ?? 0.3));

    // 60d: proposal + contacted
    const contacted60 = projMap["contacted"];
    const proj60 = proj30 + Math.round((contacted60?.totalLtv ?? 0) * (contacted60?.avgConversionProb ?? 0.2));

    // 90d: all active stages
    const proj90 = projectionRows.reduce((sum, r) => {
      return sum + Math.round(r.totalLtv * r.avgConversionProb);
    }, 0);

    const pipelineProjection = {
      totalPipeline: Math.round(Number(ltvRow?.totalLtv ?? 0)),
      projections: [
        { days: 30, value: proj30, description: `${proposal30?.count ?? 0} leads em Proposta` },
        { days: 60, value: proj60, description: `leads em Demo + Proposta` },
        { days: 90, value: proj90, description: "pipeline completo × prob. conversão" },
      ],
      topFocusAction: proposal30 && (proposal30.count ?? 0) > 0
        ? `Foco nos ${proposal30.count} leads hot em Proposta pode acelerar ${proj30 >= 1000000 ? `R$${(proj30/1000000).toFixed(1)}M` : `R$${Math.round(proj30/1000)}K`} em fechamento este mês`
        : "Mova leads qualificados para o estágio de Proposta para acelerar fechamentos",
    };

    // ── priorityImpact: Pareto comparison universe vs. priority subset ──
    let priorityImpact: {
      universe: { leads: number; totalLtv: number; avgConversionProb: number };
      priority: { leads: number; totalLtv: number; ltvShare: number; avgConversionProb: number; thresholdScore: number | null };
      insight: string;
    } | null = null;

    const allScoredRows = await db.select({
      ltvPrediction: obtainScores.ltvPrediction,
      conversionProbability: obtainScores.conversionProbability,
      score: obtainScores.score,
    }).from(obtainScores)
      .where(eq(obtainScores.tenantId, tenantId));

    if (allScoredRows.length >= 5) {
      const universeTotalLtv = allScoredRows.reduce((s, r) => s + (r.ltvPrediction ?? 0), 0);
      const universeAvgConv = allScoredRows.length > 0
        ? allScoredRows.reduce((s, r) => s + (r.conversionProbability ?? 0), 0) / allScoredRows.length
        : 0;

      const pareto = computePareto(allScoredRows, r => r.ltvPrediction ?? 0, 0.7);

      if (pareto) {
        const sorted = [...allScoredRows].sort((a, b) => (b.ltvPrediction ?? 0) - (a.ltvPrediction ?? 0));
        const topSlice = sorted.slice(0, pareto.topN);
        const priorityTotalLtv = topSlice.reduce((s, r) => s + (r.ltvPrediction ?? 0), 0);
        const priorityAvgConv = topSlice.length > 0
          ? topSlice.reduce((s, r) => s + (r.conversionProbability ?? 0), 0) / topSlice.length
          : 0;
        const thresholdScore = topSlice[topSlice.length - 1]?.score ?? null;
        const ltvShare = universeTotalLtv > 0 ? Math.round((priorityTotalLtv / universeTotalLtv) * 100) : 0;
        const ltvFmt = (v: number) => v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1)}M` : `R$${Math.round(v / 1_000)}K`;

        priorityImpact = {
          universe: {
            leads: allScoredRows.length,
            totalLtv: Math.round(universeTotalLtv),
            avgConversionProb: Math.round(universeAvgConv * 100) / 100,
          },
          priority: {
            leads: pareto.topN,
            totalLtv: Math.round(priorityTotalLtv),
            ltvShare,
            avgConversionProb: Math.round(priorityAvgConv * 100) / 100,
            thresholdScore,
          },
          insight: `Top ${pareto.topN} leads (${pareto.topPct}%) concentram ${ltvShare}% do potencial — ${ltvFmt(priorityTotalLtv)} de ${ltvFmt(universeTotalLtv)} total`,
        };
      }
    }

    // ── executiveInsights for dashboard (compact strip, no mapping/readiness context) — v2 ──
    const [dashHotRows, dashWarmRow, dashTopSourceRow] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(obtainScores)
        .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "hot"))),
      db.select({ count: sql<number>`count(*)::int` })
        .from(obtainScores)
        .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "warm"))),
      db.select({
        source: leads.source,
        avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
        avgConv: sql<number>`coalesce(avg(${obtainScores.conversionProbability}), 0)::real`,
        count: sql<number>`count(*)::int`,
      }).from(leads)
        .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(eq(leads.tenantId, tenantId), eq(obtainScores.riskTier, "hot")))
        .groupBy(leads.source)
        .orderBy(sql`avg(${obtainScores.ltvPrediction}) DESC`)
        .limit(1),
    ]);

    const DASH_CHANNEL_LABELS: Record<string, string> = {
      referral: "Indicação", event: "Feira/Evento", paid_social: "LinkedIn Ads",
      paid_search: "Google Ads", outbound: "Outbound", organic: "Orgânico/SEO",
      email: "Email Marketing", csv: "CSV", manual: "Manual", other: "Outros",
    };
    const dashHotCount = dashHotRows[0]?.count ?? 0;
    const dashWarmCount = dashWarmRow[0]?.count ?? 0;
    const totalLtvAll = Number(ltvRow?.totalLtv ?? 0);
    const fmtLtv = (v: number) => v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1)}M` : `R$${Math.round(v / 1_000)}K`;

    const dashExecutiveInsights: string[] = [];
    if (dashHotCount + dashWarmCount > 0) {
      dashExecutiveInsights.push(
        `${dashHotCount + dashWarmCount} leads prioritários — ${dashHotCount} hot e ${dashWarmCount} warm com ação recomendada.`
      );
    }
    if (priorityImpact) {
      dashExecutiveInsights.push(
        `Top ${priorityImpact.priority.leads} leads (${Math.round(priorityImpact.priority.leads / priorityImpact.universe.leads * 100)}%) concentram ${priorityImpact.priority.ltvShare}% do potencial — ${fmtLtv(priorityImpact.priority.totalLtv)} dos ${fmtLtv(priorityImpact.universe.totalLtv)} totais.`
      );
    }
    if (dashTopSourceRow[0]) {
      const ch = DASH_CHANNEL_LABELS[dashTopSourceRow[0].source ?? "other"] ?? dashTopSourceRow[0].source ?? "canal";
      dashExecutiveInsights.push(
        `Canal destaque: ${ch} — ${dashTopSourceRow[0].count} leads hot, LTV médio ${fmtLtv(dashTopSourceRow[0].avgLtv)}, ${Math.round((dashTopSourceRow[0].avgConv ?? 0) * 100)}% de conversão.`
      );
    }
    if (totalLtvAll > 0) {
      dashExecutiveInsights.push(`Pipeline total: ${fmtLtv(totalLtvAll)} em LTV identificado.`);
    }

    const dashPriorityConcentration = priorityImpact
      ? {
          topN: priorityImpact.priority.leads,
          topLeadsPct: Math.round((priorityImpact.priority.leads / priorityImpact.universe.leads) * 100),
          ltvPct: priorityImpact.priority.ltvShare,
          totalLeads: priorityImpact.universe.leads,
          totalLtv: priorityImpact.universe.totalLtv,
        }
      : null;

    res.json({
      kpis: {
        totalLeads: leadCount.count,
        hotLeads: hotCount.count,
        cac: avgCac,
        cacChange: null,
        avgLtv,
        avgLtvChange: null,
        conversionRate,
        conversionRateChange: null,
        revenueInFunnel: Number(ltvRow?.totalLtv ?? 0),
        revenueInFunnelChange: null,
        avgAcquisitionDays: null,
        avgAcquisitionDaysChange: null,
      },
      pipelineHealth,
      pipelineProjection,
      priorityImpact,
      executiveInsights: dashExecutiveInsights,
      priorityConcentration: dashPriorityConcentration,
    });
  } catch (err) {
    console.error("Obtain dashboard error:", err);
    res.status(500).json({ error: "Erro ao buscar dashboard" });
  }
});

// ─── GET /lead-priorities ────────────────────────────────────────────────────
obtainRouter.get("/lead-priorities", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    // Try hot leads first, fall back to warm
    const hotRows = await db.select({
      lead: leads,
      score: obtainScores,
    }).from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(obtainScores.riskTier, "hot"),
      ))
      .orderBy(desc(obtainScores.score))
      .limit(5);

    let topRows = hotRows;
    if (topRows.length < 5) {
      const warmRows = await db.select({
        lead: leads,
        score: obtainScores,
      }).from(leads)
        .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(obtainScores.riskTier, "warm"),
        ))
        .orderBy(desc(obtainScores.score))
        .limit(5 - topRows.length);
      topRows = [...topRows, ...warmRows];
    }

    // Aggregate stats
    const [hotCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(obtainScores)
      .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "hot")));

    const [warmCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(obtainScores)
      .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "warm")));

    const [ltvRow] = await db.select({
      totalLtv: sql<number>`coalesce(sum(${obtainScores.ltvPrediction}), 0)::real`,
    }).from(obtainScores)
      .innerJoin(leads, eq(leads.id, obtainScores.leadId))
      .where(and(
        eq(obtainScores.tenantId, tenantId),
        sql`${obtainScores.riskTier} IN ('hot', 'warm')`,
      ));

    // Top source (by count)
    const sourceCounts = await db.select({
      source: leads.source,
      count: sql<number>`count(*)::int`,
    }).from(leads)
      .where(eq(leads.tenantId, tenantId))
      .groupBy(leads.source)
      .orderBy(sql`count(*) DESC`)
      .limit(1);

    const CHANNEL_LABELS: Record<string, string> = {
      referral: "Indicação de Clientes",
      event: "Feira/Evento",
      paid_social: "LinkedIn Ads",
      paid_search: "Google Ads",
      outbound: "Prospecção Outbound",
      organic: "Orgânico/SEO",
      email: "Email Marketing",
      csv: "CSV Import",
      manual: "Manual",
      other: "Outros",
    };

    const topSource = sourceCounts.length > 0 ? {
      name: CHANNEL_LABELS[sourceCounts[0].source ?? "other"] ?? (sourceCounts[0].source ?? "Outros"),
      leadCount: sourceCounts[0].count,
    } : null;

    // Promising channels: top 3 by avg(score * ltvPrediction) among hot/warm
    const channelRows = await db.select({
      source: leads.source,
      avgValue: sql<number>`avg(${obtainScores.score}::real * ${obtainScores.ltvPrediction})`,
      count: sql<number>`count(*)::int`,
    }).from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(and(
        eq(leads.tenantId, tenantId),
        sql`${obtainScores.riskTier} IN ('hot', 'warm')`,
      ))
      .groupBy(leads.source)
      .orderBy(sql`avg(${obtainScores.score}::real * ${obtainScores.ltvPrediction}) DESC`)
      .limit(3);

    const promisingChannels = channelRows.map(r => ({
      name: CHANNEL_LABELS[r.source ?? "other"] ?? (r.source ?? "Outros"),
      count: r.count,
    }));

    const priorities = topRows.map(r => {
      const shapValues = (r.score.shapValues as any[]) ?? [];
      const topFactor = shapValues.find((s: any) => s.direction === "positive") ?? shapValues[0];
      const daysSinceCreated = r.lead.createdAt
        ? Math.floor((Date.now() - new Date(r.lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const daysWithoutAction = r.lead.updatedAt
        ? Math.floor((Date.now() - new Date(r.lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : daysSinceCreated;

      const estimatedImpact = Math.round((r.score.ltvPrediction ?? 0) * (r.score.conversionProbability ?? 0));
      const recommendedToday = r.score.riskTier === "hot" && daysWithoutAction <= 2;

      // Build human-readable priority reason
      const tierLabel = r.score.riskTier === "hot" ? "Lead hot" : "Lead warm";
      const factorPart = topFactor ? ` · ${topFactor.label}` : "";
      const actionPart = daysWithoutAction > 0 ? ` · ${daysWithoutAction}d sem contato` : " · contato recente";
      const priorityReason = `${tierLabel}${factorPart}${actionPart}`;

      return {
        leadId: r.lead.id,
        name: r.lead.name,
        company: r.lead.company,
        industry: r.lead.industry,
        companySize: r.lead.companySize,
        score: r.score.score ?? 0,
        scoreTier: r.score.riskTier ?? "cold",
        ltvPrediction: r.score.ltvPrediction ?? 0,
        conversionProbability: r.score.conversionProbability ?? 0,
        topFactor: topFactor ? { label: topFactor.label, impact: topFactor.impact } : null,
        recommendedAction: r.score.recommendedAction ?? "",
        source: r.lead.source,
        daysInFunnel: daysSinceCreated,
        daysWithoutAction,
        estimatedImpact,
        recommendedToday,
        priorityReason,
      };
    });

    const totalPotentialRevenue = priorities.reduce((s, p) => s + p.estimatedImpact, 0);
    const hotWithoutRecentAction = priorities.filter(p => p.scoreTier === "hot" && p.daysWithoutAction > 2).length;

    res.json({
      priorities,
      totalLtvAtStake: Math.round(ltvRow?.totalLtv ?? 0),
      hotCount: hotCount?.count ?? 0,
      warmCount: warmCount?.count ?? 0,
      topSource,
      totalPotentialRevenue,
      hotWithoutRecentAction,
      promisingChannels,
    });
  } catch (err) {
    console.error("Obtain lead priorities error:", err);
    res.status(500).json({ error: "Erro ao buscar prioridades de leads" });
  }
});

// ─── GET /leads ──────────────────────────────────────────────────────────────
obtainRouter.get("/leads", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const { scoreTier, status, source, search, sortBy, sortDir } = req.query;

    const conditions: SQL[] = [eq(leads.tenantId, tenantId)];
    if (status) conditions.push(eq(leads.status, status as any));
    if (source) conditions.push(eq(leads.source, source as any));
    if (search) conditions.push(sql`(${ilike(leads.name, `%${search}%`)} OR ${ilike(leads.company, `%${search}%`)})`);
    if (scoreTier) conditions.push(eq(obtainScores.riskTier, scoreTier as any));

    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .leftJoin(obtainScores, eq(leads.id, obtainScores.leadId))
      .where(and(...conditions));
    const total = countResult[0]?.count ?? 0;

    const sortColumn = sortBy === "name" ? leads.name
      : sortBy === "company" ? leads.company
      : sortBy === "ltvPrediction" ? obtainScores.ltvPrediction
      : obtainScores.score;
    const sortOrder = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    const rows = await db.select({
      lead: leads,
      score: obtainScores,
      campaign: obtainCampaigns,
    }).from(leads)
      .leftJoin(obtainScores, eq(leads.id, obtainScores.leadId))
      .leftJoin(obtainCampaigns, eq(leads.campaignId, obtainCampaigns.id))
      .where(and(...conditions))
      .orderBy(sortOrder)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const data = rows.map(r => ({
      id: r.lead.id,
      name: r.lead.name,
      company: r.lead.company,
      industry: r.lead.industry,
      companySize: r.lead.companySize,
      city: r.lead.city,
      state: r.lead.state,
      email: r.lead.email,
      phone: r.lead.phone,
      source: r.lead.source,
      status: r.lead.status,
      score: r.score?.score ?? 0,
      scoreTier: r.score?.riskTier ?? "cold",
      ltvPrediction: r.score?.ltvPrediction ?? 0,
      conversionProbability: r.score?.conversionProbability ?? 0,
      campaign: r.campaign?.name ?? "",
      enteredAt: r.lead.createdAt?.toISOString() ?? "",
    }));

    res.json({ data, total, page, pageSize });
  } catch (err) {
    console.error("Obtain leads error:", err);
    res.status(500).json({ error: "Erro ao buscar leads" });
  }
});

// ─── GET /leads/:id ──────────────────────────────────────────────────────────
obtainRouter.get("/leads/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const [row] = await db.select({
      lead: leads,
      score: obtainScores,
      campaign: obtainCampaigns,
    }).from(leads)
      .leftJoin(obtainScores, eq(leads.id, obtainScores.leadId))
      .leftJoin(obtainCampaigns, eq(leads.campaignId, obtainCampaigns.id))
      .where(and(eq(leads.tenantId, tenantId), eq(leads.id, req.params.id)))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Lead não encontrado" });

    const shapValues = (row.score?.shapValues as any[]) ?? [];

    // ── Similar customers (same industry/segment) ──
    let similarCustomers = null;
    if (row.lead.industry) {
      const [simRow] = await db.select({
        count: sql<number>`count(*)::int`,
        avgHealthScore: sql<number>`coalesce(avg(${customers.healthScore}), 0)::real`,
        avgRevenue: sql<number>`coalesce(avg(${customers.dimRevenue}), 0)::real`,
      }).from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          sql`lower(${customers.segment}) = lower(${row.lead.industry})`,
          sql`${customers.status} != 'churned'`,
        ));

      if (simRow && simRow.count > 0) {
        similarCustomers = {
          count: simRow.count,
          avgHealthScore: Math.round(simRow.avgHealthScore),
          avgRevenue: Math.round(simRow.avgRevenue),
        };
      }
    }

    // ── Channel performance ──
    let channelPerformance = null;
    if (row.lead.source) {
      const [chanRow] = await db.select({
        totalLeads: sql<number>`count(${leads.id})::int`,
        wonLeads: sql<number>`count(case when ${leads.status} = 'won' then 1 end)::int`,
        avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
      }).from(leads)
        .leftJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.source, row.lead.source),
        ));

      if (chanRow) {
        const conversionRate = chanRow.totalLeads > 0
          ? Math.round((chanRow.wonLeads / chanRow.totalLeads) * 1000) / 10
          : 0;
        channelPerformance = {
          conversionRate,
          avgLtv: Math.round(chanRow.avgLtv),
        };
      }
    }

    // ── ICP match % (from icp clusters if available) ──
    let icpCluster: string | null = null;
    if (row.lead.industry) {
      const [cluster] = await db.select()
        .from(obtainIcpClusters)
        .where(and(
          eq(obtainIcpClusters.tenantId, tenantId),
          sql`lower(${obtainIcpClusters.clusterName}) like lower(${"%" + row.lead.industry + "%"})`,
        ))
        .limit(1);
      if (cluster) icpCluster = cluster.clusterName;
    }

    // ── Narrative ──
    const narrative = generateLeadNarrative(
      {
        name: row.lead.name,
        company: row.lead.company,
        industry: row.lead.industry,
        companySize: row.lead.companySize,
        source: row.lead.source,
        score: row.score?.score ?? 0,
        scoreTier: row.score?.riskTier,
        ltvPrediction: row.score?.ltvPrediction ?? 0,
        conversionProbability: row.score?.conversionProbability ?? 0,
      },
      shapValues,
      icpCluster,
      similarCustomers,
    );

    // Sales cadence
    const shapValuesForCadence = (row.score?.shapValues as any[]) ?? [];
    const topPositiveFactor = shapValuesForCadence.find((s: any) => s.direction === "positive");
    const salesCadence = generateSalesCadence(
      row.score?.riskTier ?? "cold",
      row.lead.companySize ?? null,
      row.lead.industry ?? null,
      topPositiveFactor?.label ?? null,
      row.lead.source ?? null,
    );

    // Fix recommendedOffer: use generateRecommendedOffer if empty
    const recommendedOffer = (row.score?.recommendedOffer && row.score.recommendedOffer.trim() !== "")
      ? row.score.recommendedOffer
      : generateRecommendedOffer(
          row.score?.riskTier ?? "cold",
          row.lead.companySize ?? null,
          row.lead.industry ?? null,
        );

    res.json({
      id: row.lead.id,
      name: row.lead.name,
      company: row.lead.company,
      industry: row.lead.industry,
      companySize: row.lead.companySize,
      city: row.lead.city,
      state: row.lead.state,
      email: row.lead.email,
      phone: row.lead.phone,
      source: row.lead.source,
      status: row.lead.status,
      score: row.score?.score ?? 0,
      scoreTier: row.score?.riskTier ?? "cold",
      ltvPrediction: row.score?.ltvPrediction ?? 0,
      conversionProbability: row.score?.conversionProbability ?? 0,
      shapValues,
      baseProbability: 0.24,
      recommendedAction: row.score?.recommendedAction ?? "",
      recommendedOffer,
      campaign: row.campaign?.name ?? "",
      enteredAt: row.lead.createdAt?.toISOString() ?? "",
      narrative,
      icpCluster,
      similarCustomers,
      channelPerformance,
      salesCadence,
    });
  } catch (err) {
    console.error("Obtain lead detail error:", err);
    res.status(500).json({ error: "Erro ao buscar lead" });
  }
});

// ─── GET /icp-clusters ───────────────────────────────────────────────────────
obtainRouter.get("/icp-clusters", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const rows = await db.select().from(obtainIcpClusters)
      .where(eq(obtainIcpClusters.tenantId, tenantId))
      .orderBy(asc(obtainIcpClusters.clusterId));

    // Compute budgetShare (fraction of total customers in this cluster)
    const totalCustomersCount = rows.reduce((sum, r) => sum + ((r.characteristics as any)?.customerCount ?? 0), 0);

    // Rank by composite score
    const sorted = [...rows].sort((a, b) => {
      const ca = (a.characteristics as any)?.composite ?? 0;
      const cb = (b.characteristics as any)?.composite ?? 0;
      return cb - ca;
    });
    const rankMap = new Map(sorted.map((r, i) => [r.id, i + 1]));

    const CHANNEL_LABELS_ICP: Record<string, string> = {
      referral: "Indicação", event: "Feira/Evento", paid_social: "LinkedIn Ads",
      paid_search: "Google Ads", outbound: "Outbound", organic: "Orgânico",
      email: "Email", csv: "CSV", manual: "Manual", other: "Outros",
    };

    const data = await Promise.all(rows.map(async (r) => {
      const chars = (r.characteristics as any) ?? {};
      const industry = chars.industry as string | undefined;
      const customerCount = chars.customerCount ?? 0;
      const budgetShare = totalCustomersCount > 0 ? customerCount / totalCustomersCount : 0;
      const rank = rankMap.get(r.id) ?? 99;
      const type = chars.type ?? (r.isIdeal ? "ideal" : "anti");

      // ── Top 3 leads from this industry ──────────────────────────────────
      let topLeads: any[] = [];
      let dominantSource: string | null = null;
      if (industry) {
        const leadRows = await db.select({
          id: leads.id,
          name: leads.name,
          company: leads.company,
          score: obtainScores.score,
          ltvPrediction: obtainScores.ltvPrediction,
        }).from(leads)
          .leftJoin(obtainScores, eq(obtainScores.leadId, leads.id))
          .where(and(
            eq(leads.tenantId, tenantId),
            sql`lower(${leads.industry}) = lower(${industry})`,
          ))
          .orderBy(desc(obtainScores.score))
          .limit(3);

        topLeads = leadRows.map(l => ({
          id: l.id,
          name: l.name,
          company: l.company,
          score: l.score ?? 0,
          ltvPrediction: l.ltvPrediction ?? 0,
        }));

        // Dominant source
        const [sourceRow] = await db.select({
          source: leads.source,
          count: sql<number>`count(*)::int`,
        }).from(leads)
          .where(and(
            eq(leads.tenantId, tenantId),
            sql`lower(${leads.industry}) = lower(${industry})`,
          ))
          .groupBy(leads.source)
          .orderBy(sql`count(*) DESC`)
          .limit(1);

        if (sourceRow?.source) {
          dominantSource = CHANNEL_LABELS_ICP[sourceRow.source] ?? sourceRow.source;
        }
      }

      // ── Top 3 customers + avgTicket ─────────────────────────────────────
      let topCustomers: any[] = [];
      let avgTicket = 0;
      if (industry) {
        const custRows = await db.select({
          id: customers.id,
          name: customers.name,
          mrr: customers.dimRevenue,
          healthScore: customers.healthScore,
        }).from(customers)
          .where(and(
            eq(customers.tenantId, tenantId),
            sql`lower(${customers.segment}) = lower(${industry})`,
            sql`${customers.status} != 'churned'`,
          ))
          .orderBy(desc(customers.healthScore))
          .limit(3);

        topCustomers = custRows.map(c => ({
          id: c.id,
          name: c.name,
          mrr: c.mrr ?? 0,
          healthScore: c.healthScore ?? 0,
        }));

        const [ticketRow] = await db.select({
          avg: sql<number>`coalesce(avg(${customers.dimRevenue}), 0)::real`,
        }).from(customers)
          .where(and(
            eq(customers.tenantId, tenantId),
            sql`lower(${customers.segment}) = lower(${industry})`,
            sql`${customers.status} != 'churned'`,
          ));
        avgTicket = Math.round(ticketRow?.avg ?? 0);
      }

      // ── Insight text ────────────────────────────────────────────────────
      const ltvFmt = (v: number) => v >= 1_000_000 ? `R$${(v/1_000_000).toFixed(1)}M` : `R$${Math.round(v/1_000)}K`;
      let insight = "";
      const churnPct = ((r.churnRate30d ?? 0) * 100).toFixed(0);
      if (type === "ideal") {
        insight = `Maior retorno da base — LTV ${ltvFmt(r.averageLtv ?? 0)}, churn ${churnPct}%/mês. Escalar aquisição neste perfil.`;
      } else if (type === "good") {
        insight = `Bom potencial — LTV ${ltvFmt(r.averageLtv ?? 0)}, oportunidade de otimização em conversão e retenção.`;
      } else {
        insight = `Baixo retorno — churn ${churnPct}%/mês e LTV ${ltvFmt(r.averageLtv ?? 0)}. Reduzir orçamento neste perfil.`;
      }

      return {
        id: r.id,
        clusterId: r.clusterId,
        name: r.clusterName,
        description: r.description,
        type,
        rank,
        avgLtv: r.averageLtv,
        avgCac: r.averageCac ?? 0,
        avgConversionRate: r.averageConversionRate ?? 0,
        avgTenureDays: r.averageTenureDays,
        churnRate: r.churnRate30d ?? 0,
        leadsInFunnel: chars.leadCount ?? 0,
        budgetShare,
        characteristics: r.characteristics,
        // Enriched fields
        topLeads,
        topCustomers,
        dominantSource,
        avgTicket,
        insight,
      };
    }));

    // Return sorted by rank
    data.sort((a, b) => a.rank - b.rank);
    res.json(data);
  } catch (err) {
    console.error("Obtain ICP clusters error:", err);
    res.status(500).json({ error: "Erro ao buscar ICP clusters" });
  }
});

// ─── GET /funnel ─────────────────────────────────────────────────────────────
obtainRouter.get("/funnel", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const STAGES = [
      { key: "new",        name: "Prospecção",  order: 1 },
      { key: "qualifying", name: "Qualificação", order: 2 },
      { key: "contacted",  name: "Demo",         order: 3 },
      { key: "proposal",   name: "Proposta",     order: 4 },
      { key: "won",        name: "Fechado",      order: 5 },
    ];

    // ── 1. Count per status ───────────────────────────────────────────────────
    const statusCounts = await db.select({
      status: leads.status,
      count: sql<number>`count(*)::int`,
    }).from(leads).where(eq(leads.tenantId, tenantId)).groupBy(leads.status);

    const byStatus = Object.fromEntries(statusCounts.map(r => [r.status, r.count]));

    // ── 2. Average LTV per stage ──────────────────────────────────────────────
    const ltvByStatus = await db.select({
      status: leads.status,
      avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
    }).from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(eq(leads.tenantId, tenantId))
      .groupBy(leads.status);

    const ltvMap = Object.fromEntries(ltvByStatus.map(r => [r.status, r.avgLtv]));

    // ── 3. Time percentiles (P50/P75/P95) per stage via raw SQL ─────────────
    const percResult = await db.execute(sql`
      SELECT
        status,
        COALESCE(ROUND(CAST(percentile_cont(0.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (now() - created_at)) / 86400) AS numeric), 1), 0) AS p50,
        COALESCE(ROUND(CAST(percentile_cont(0.75) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (now() - created_at)) / 86400) AS numeric), 1), 0) AS p75,
        COALESCE(ROUND(CAST(percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (now() - created_at)) / 86400) AS numeric), 1), 0) AS p95,
        COALESCE(ROUND(CAST(avg(EXTRACT(EPOCH FROM (now() - created_at)) / 86400) AS numeric), 1), 0) AS avg_days
      FROM leads
      WHERE tenant_id = ${tenantId}
      GROUP BY status
    `);
    const percRows = (percResult.rows ?? []) as { status: string; p50: number; p75: number; p95: number; avg_days: number }[];
    const percMap = Object.fromEntries(percRows.map(r => [r.status, r]));

    // ── 4. Hot stuck using dynamic threshold: max(3, 1.5 × stageP50) days ───
    const hotLeadsRaw = await db.select({
      id:         leads.id,
      status:     leads.status,
      daysInStage: sql<number>`EXTRACT(EPOCH FROM (now() - ${leads.createdAt})) / 86400`,
    }).from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(and(eq(leads.tenantId, tenantId), eq(obtainScores.riskTier, "hot")));

    const hotStuckMap: Record<string, number> = {};
    for (const h of hotLeadsRaw) {
      const stk = h.status ?? "new";
      const stageP50 = Number(percMap[stk]?.p50 ?? 0);
      const threshold = Math.max(3, 1.5 * (stageP50 > 0 ? stageP50 : 7));
      if ((h.daysInStage ?? 0) > threshold) {
        hotStuckMap[stk] = (hotStuckMap[stk] ?? 0) + 1;
      }
    }

    // ── 5. Source × stage matrix ─────────────────────────────────────────────
    const sourceStageRows = await db.select({
      status: leads.status,
      source: leads.source,
      count:  sql<number>`count(*)::int`,
    }).from(leads).where(eq(leads.tenantId, tenantId)).groupBy(leads.status, leads.source);

    // Map source × stage counts for each stage's bySource
    const stageSourceMap: Record<string, Record<string, number>> = {};
    for (const r of sourceStageRows) {
      const stk = r.status ?? "new";
      const src = r.source ?? "other";
      if (!stageSourceMap[stk]) stageSourceMap[stk] = {};
      stageSourceMap[stk][src] = r.count;
    }

    // Build sourceStageMatrix
    const allSources = [...new Set(sourceStageRows.map(r => r.source ?? "other"))].sort();
    const stageKeys  = STAGES.map(s => s.key);
    const matrixCells: number[][] = allSources.map(src =>
      stageKeys.map(stk => stageSourceMap[stk]?.[src] ?? 0),
    );

    // Stage-level source breakdown with drop-off
    const stageBySource: Record<string, { source: string; count: number; dropOffRate: number }[]> = {};
    for (const stg of STAGES) {
      const srcCounts = stageSourceMap[stg.key] ?? {};
      const total = Object.values(srcCounts).reduce((a, b) => a + b, 0);
      stageBySource[stg.key] = Object.entries(srcCounts).map(([src, cnt]) => ({
        source: src,
        count: cnt,
        dropOffRate: total > 0 ? Math.round((1 - cnt / total) * 1000) / 1000 : 0,
      })).sort((a, b) => b.count - a.count);
    }

    // ── 6. Pareto: non-won leads with LTV (top N summing 70% of LTV at risk) ─
    const activeLtv = await db.select({
      id:            leads.id,
      name:          leads.name,
      company:       leads.company,
      status:        leads.status,
      source:        leads.source,
      daysInStage:   sql<number>`ROUND(CAST(EXTRACT(EPOCH FROM (now() - ${leads.createdAt})) / 86400 AS numeric), 0)`,
      ltvPrediction: obtainScores.ltvPrediction,
    }).from(leads)
      .leftJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(and(
        eq(leads.tenantId, tenantId),
        sql`${leads.status} NOT IN ('won', 'lost')`,
      ))
      .orderBy(desc(obtainScores.ltvPrediction));

    const paretoResult = computePareto(activeLtv, l => l.ltvPrediction ?? 0);
    const topN   = paretoResult?.topN ?? Math.min(5, activeLtv.length);
    const topLeads  = activeLtv.slice(0, topN);
    const others = activeLtv.slice(topN);

    // ── 7. Retain bridge (post-won feedback) ─────────────────────────────────
    const bridge = await resolveWonLeadCustomerLinks(tenantId);
    const postWonRetainFeedback = bridge.funnelFeedback;

    // ── 8. Build enriched stages ──────────────────────────────────────────────
    const counts  = STAGES.map(s => byStatus[s.key] ?? 0);
    const prospect = counts[0] || 1;

    const stageData = STAGES.map((s, i) => {
      const count    = counts[i];
      const prev     = i > 0 ? counts[i - 1] : null;
      const dropOffRate = prev != null && prev > 0
        ? Math.round((1 - count / prev) * 1000) / 1000 : 0;
      const perc     = percMap[s.key] ?? { p50: 0, p75: 0, p95: 0, avg_days: 0 };
      const revenueAtRisk = Math.round((ltvMap[s.key] ?? 0) * count);

      // Global baseline median (avg of all non-won stage medians)
      const globalMedian = percRows
        .filter(r => r.status !== "won")
        .reduce((s, r) => s + Number(r.p50), 0) / Math.max(1, percRows.filter(r => r.status !== "won").length);
      const isStuck = Number(perc.p50) > 1.5 * globalMedian && globalMedian > 0;
      const severityScore = revenueAtRisk > 0
        ? Math.round((revenueAtRisk / 1_000_000) * dropOffRate * Math.max(1, Number(perc.p75) / Math.max(1, globalMedian)) * 100) / 100
        : 0;

      return {
        id: s.key,
        name: s.name,
        order: s.order,
        leadsCount: count,
        hotLeadsStuck: hotStuckMap[s.key] ?? 0,
        avgTimeDays: Math.round(Number(perc.avg_days)),
        timeP50: Number(perc.p50),
        timeP75: Number(perc.p75),
        timeP95: Number(perc.p95),
        dropOffRate,
        conversionFromTop: Math.round((count / prospect) * 100),
        revenueAtRisk,
        isBottleneck: false,
        isStuck,
        severityScore,
        bySource: stageBySource[s.key] ?? [],
      };
    });

    // ── 9. Biggest bottleneck (severity-based, excluding first & last stage) ──
    let biggestBottleneck: {
      stage: string; stageName: string; source: string | null;
      severityScore: number; rationale: string;
    } | null = null;

    let maxSeverity = 0;
    for (const stage of stageData.slice(1, -1)) {
      if (stage.severityScore > maxSeverity) {
        maxSeverity = stage.severityScore;
        const topSource = stage.bySource[0];
        biggestBottleneck = {
          stage: stage.id,
          stageName: stage.name,
          source: topSource?.count > (stage.leadsCount * 0.4) ? topSource.source : null,
          severityScore: stage.severityScore,
          rationale: topSource?.count > (stage.leadsCount * 0.4)
            ? `Estágio ${stage.name} tem drop-off de ${Math.round(stage.dropOffRate * 100)}% — canal ${topSource.source} concentra ${Math.round((topSource.count / stage.leadsCount) * 100)}% dos leads parados. Receita em risco: R$${(stage.revenueAtRisk / 1_000_000).toFixed(1)}M.`
            : `Estágio ${stage.name} tem drop-off de ${Math.round(stage.dropOffRate * 100)}% e P50 de ${stage.timeP50}d (P75: ${stage.timeP75}d). Receita em risco: R$${(stage.revenueAtRisk / 1_000_000).toFixed(1)}M.`,
        };
      }
    }

    // Mark bottleneck stage
    stageData.forEach(s => { s.isBottleneck = biggestBottleneck?.stage === s.id; });

    res.json({
      stages: stageData,
      sourceStageMatrix: { rows: allSources, cols: stageKeys, cells: matrixCells },
      paretoLeads: {
        top: topLeads,
        others: {
          count: others.length,
          sumLtv: Math.round(others.reduce((s, l) => s + (l.ltvPrediction ?? 0), 0)),
        },
      },
      postWonRetainFeedback,
      biggestBottleneck,
    });
  } catch (err) {
    console.error("Obtain funnel error:", err);
    res.status(500).json({ error: "Erro ao buscar funil" });
  }
});

// ─── GET /campaigns ──────────────────────────────────────────────────────────
// CAC is only shown when real budget data exists in obtain_campaigns.budget.
// LTV is shown as "verified" (from real customers via bridge) when sample >= 3.
obtainRouter.get("/campaigns", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const CHANNEL_LABELS: Record<string, string> = {
      referral: "Indicação de Clientes",
      event: "Feira / Evento",
      paid_social: "LinkedIn Ads",
      paid_search: "Google Ads",
      outbound: "Prospecção Outbound",
      organic: "Orgânico / SEO",
      email: "Email Marketing",
      csv: "CSV Import",
      manual: "Manual",
      other: "Outros",
    };

    // ── 1. Lead counts + predicted LTV per source ─────────────────────────────
    const leadRows = await db.select({
      source:     leads.source,
      totalLeads: sql<number>`count(${leads.id})::int`,
      wonLeads:   sql<number>`count(case when ${leads.status} = 'won' then 1 end)::int`,
      avgLtvPredicted: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
    }).from(leads)
      .leftJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(eq(leads.tenantId, tenantId))
      .groupBy(leads.source)
      .orderBy(sql`avg(${obtainScores.ltvPrediction}) DESC NULLS LAST`);

    // ── 2. Real budget per channel from obtain_campaigns ─────────────────────
    const budgetRows = await db.select({
      channel:    obtainCampaigns.channel,
      totalBudget: sql<number>`coalesce(sum(${obtainCampaigns.budget}), 0)::real`,
      hasBudget:   sql<number>`count(case when ${obtainCampaigns.budget} is not null then 1 end)::int`,
    }).from(obtainCampaigns)
      .where(eq(obtainCampaigns.tenantId, tenantId))
      .groupBy(obtainCampaigns.channel);

    const budgetMap = Object.fromEntries(
      budgetRows.map(r => [r.channel, { totalBudget: r.totalBudget, hasBudget: r.hasBudget > 0 }]),
    );

    // ── 3. Retain bridge: verified LTV + post-sale churn per source ───────────
    const bridge = await resolveWonLeadCustomerLinks(tenantId);

    // ── 4. Assemble per-channel data ──────────────────────────────────────────
    const data = leadRows.map(r => {
      const source   = r.source ?? "other";
      const avgLtvPredicted = Math.round(r.avgLtvPredicted ?? 0);
      const conversionRate  = r.totalLeads > 0
        ? Math.round((r.wonLeads / r.totalLeads) * 1000) / 10 : 0;

      // Budget-based CAC (null when no budget imported)
      const budget   = budgetMap[source];
      const cac: number | null = budget?.hasBudget && r.wonLeads > 0
        ? Math.round(budget.totalBudget / r.wonLeads)
        : null;

      // Retain-verified LTV
      const srcBridge = bridge.bySource.get(source);
      const avgLtvVerified    = srcBridge?.avgLtvVerified    ?? null;
      const verifiedSampleSize = srcBridge?.verifiedSampleSize ?? 0;
      const avgTenureDays      = srcBridge?.avgTenureDays     ?? 0;
      const wonCustomersHealthy  = srcBridge?.healthyCount    ?? 0;
      const wonCustomersAtRisk   = srcBridge?.atRiskCount     ?? 0;
      const wonCustomersChurned  = srcBridge?.churnedCount    ?? 0;
      const postSaleChurnRate    = srcBridge?.postSaleChurnRate ?? 0;
      const ltvChurnAdjusted     = srcBridge?.ltvChurnAdjusted ?? null;

      // Effective LTV: verified (if enough sample) else predicted
      const effectiveLtv = verifiedSampleSize >= 3 ? (avgLtvVerified ?? avgLtvPredicted) : avgLtvPredicted;

      // ROI (null when no real CAC)
      const projectedRoi: number | null = cac && cac > 0
        ? Math.round(((effectiveLtv - cac) / cac) * 100 * 10) / 10 : null;

      const paybackDays: number | null = cac && avgTenureDays > 0 && effectiveLtv > 0
        ? Math.round(cac / (effectiveLtv / Math.max(avgTenureDays, 1)) )
        : null;

      const roiStatus = projectedRoi == null ? null
        : projectedRoi > 500 ? "excellent"
        : projectedRoi > 200 ? "good"
        : projectedRoi > 50  ? "neutral"
        : "poor";

      return {
        id: source,
        name: CHANNEL_LABELS[source] ?? source,
        channel: source,
        totalLeads: r.totalLeads,
        wonLeads: r.wonLeads,
        conversionRate,
        avgLtvPredicted,
        avgLtvVerified: verifiedSampleSize >= 3 ? avgLtvVerified : null,
        verifiedSampleSize,
        cac,
        budgetSource: budget?.hasBudget ? "imported" : null,
        projectedRoi,
        paybackDays,
        roiStatus,
        wonCustomersHealthy,
        wonCustomersAtRisk,
        wonCustomersChurned,
        postSaleChurnRate,
        ltvChurnAdjusted,
        // Legacy compat field (used by existing code)
        avgLtv: effectiveLtv,
      };
    });

    res.json(data);
  } catch (err) {
    console.error("Obtain campaigns error:", err);
    res.status(500).json({ error: "Erro ao buscar campanhas" });
  }
});

// ─── POST /lead-actions ──────────────────────────────────────────────────────
obtainRouter.post("/lead-actions", async (req, res) => {
  try {
    const { leadId, actionType, notes, outcome } = req.body;
    if (!leadId || !UUID_RE.test(leadId))
      return res.status(400).json({ error: "leadId inválido" });
    if (!actionType || !VALID_ACTION_TYPES.includes(actionType))
      return res.status(400).json({ error: `actionType deve ser um de: ${VALID_ACTION_TYPES.join(", ")}` });
    const [action] = await db.insert(obtainLeadActions).values({
      tenantId: req.tenantId!,
      leadId,
      actionType,
      notes,
      outcome,
      assignedTo: req.session.userId,
    }).returning();
    res.status(201).json(action);
  } catch (err) {
    console.error("Obtain lead action error:", err);
    res.status(500).json({ error: "Erro ao criar ação" });
  }
});

// ─── GET /templates/:sector ──────────────────────────────────────────────────
// Serves sample CSV templates for onboarding. Sector: mineracao | construcao | generico
const TEMPLATE_FILES: Record<string, string> = {
  mineracao:  "mineracao_clientes.csv",
  construcao: "construcao_leads.csv",
  generico:   "generico_leads.csv",
};

obtainRouter.get("/templates/:sector", (req, res) => {
  const sector = req.params.sector as string;
  const filename = TEMPLATE_FILES[sector] ?? TEMPLATE_FILES["generico"];
  // __dirname = server/src/routes/obtain → ../../seed = server/src/seed
  const templateDir = path.resolve(__dirname, "../../seed/csv-templates");
  const filePath = path.join(templateDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Template não encontrado" });
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

// ─── GET /uploads ────────────────────────────────────────────────────────────
obtainRouter.get("/uploads", async (req, res) => {
  try {
    const rows = await db.select().from(obtainUploads)
      .where(eq(obtainUploads.tenantId, req.tenantId!))
      .orderBy(desc(obtainUploads.uploadedAt));
    res.json(rows);
  } catch (err) {
    console.error("Obtain uploads error:", err);
    res.status(500).json({ error: "Erro ao buscar uploads" });
  }
});

// ─── GET /snapshots ───────────────────────────────────────────────────────────
// Returns per-upload KPI snapshots ordered by upload date — used by the
// "Evolução" timeline in the Obtain uploads page.
obtainRouter.get("/snapshots", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const uploads = await db.select().from(obtainUploads)
      .where(eq(obtainUploads.tenantId, tenantId))
      .orderBy(asc(obtainUploads.uploadedAt));

    if (uploads.length === 0) return res.json([]);

    const snapshots = await Promise.all(uploads.map(async (u) => {
      const [stats] = await db.select({
        total:       sql<number>`count(*)::int`,
        won:         sql<number>`count(*) filter (where ${leads.status} = 'won')::int`,
        hot:         sql<number>`count(*) filter (where ${obtainScores.riskTier} = 'hot')::int`,
        avgLtv:      sql<number>`round(avg(${obtainScores.ltvPrediction})::numeric, 0)`,
        avgScore:    sql<number>`round(avg(${obtainScores.score})::numeric, 1)`,
        avgConvProb: sql<number>`round(avg(${obtainScores.conversionProbability})::numeric, 3)`,
      }).from(leads)
        .leftJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.sourceUploadId, u.id),
        ));

      const total = stats?.total ?? 0;
      return {
        uploadId:        u.id,
        uploadedAt:      u.uploadedAt,
        filename:        u.filename,
        leadCount:       total,
        wonCount:        stats?.won ?? 0,
        conversionRate:  total > 0 ? Math.round(((stats?.won ?? 0) / total) * 1000) / 10 : 0,
        hotCount:        stats?.hot ?? 0,
        hotPct:          total > 0 ? Math.round(((stats?.hot ?? 0) / total) * 1000) / 10 : 0,
        avgLtvPrediction: stats?.avgLtv ?? 0,
        avgScore:        stats?.avgScore ?? 0,
        avgConversionProb: stats?.avgConvProb ?? 0,
      };
    }));

    res.json(snapshots);
  } catch (err) {
    console.error("Obtain snapshots error:", err);
    res.status(500).json({ error: "Erro ao buscar snapshots" });
  }
});

// ─── DELETE /uploads/:id ─────────────────────────────────────────────────────
// Removes upload audit row plus every lead/score stamped with this uploadId.
// Leads with NULL sourceUploadId (pre-migration) are untouched.
obtainRouter.delete("/uploads/:id", async (req, res) => {
  const tenantId = req.tenantId!;
  const uploadId = req.params.id;
  if (!UUID_RE.test(uploadId)) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const [existing] = await db.select({ id: obtainUploads.id })
      .from(obtainUploads)
      .where(and(eq(obtainUploads.id, uploadId), eq(obtainUploads.tenantId, tenantId)))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Upload não encontrado" });
    }

    const result = await db.transaction(async (tx) => {
      const toRemove = await tx.select({ id: leads.id })
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.sourceUploadId, uploadId),
        ));
      const leadIds = toRemove.map((l) => l.id);

      const delScores = await tx.delete(obtainScores)
        .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.sourceUploadId, uploadId)))
        .returning({ id: obtainScores.id });

      if (leadIds.length > 0) {
        // Clean up all FK references to the leads being deleted
        await tx.delete(obtainScores)
          .where(and(
            eq(obtainScores.tenantId, tenantId),
            inArray(obtainScores.leadId, leadIds),
          ));
        await tx.delete(obtainAlerts)
          .where(and(
            eq(obtainAlerts.tenantId, tenantId),
            inArray(obtainAlerts.leadId, leadIds),
          ));
        await tx.delete(obtainLeadActions)
          .where(and(
            eq(obtainLeadActions.tenantId, tenantId),
            inArray(obtainLeadActions.leadId, leadIds),
          ));
        await tx.delete(leadScoreHistory)
          .where(and(
            eq(leadScoreHistory.tenantId, tenantId),
            inArray(leadScoreHistory.leadId, leadIds),
          ));
      }

      const delLeads = await tx.delete(leads)
        .where(and(eq(leads.tenantId, tenantId), eq(leads.sourceUploadId, uploadId)))
        .returning({ id: leads.id });

      await tx.delete(obtainUploads)
        .where(and(eq(obtainUploads.id, uploadId), eq(obtainUploads.tenantId, tenantId)));

      // If no leads remain for this tenant, clear all derived/aggregate tables
      // that don't carry sourceUploadId and would otherwise show stale data.
      const [remaining] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(eq(leads.tenantId, tenantId));
      if ((remaining?.count ?? 0) === 0) {
        await tx.delete(obtainIcpClusters).where(eq(obtainIcpClusters.tenantId, tenantId));
        await tx.delete(obtainFunnelMetrics).where(eq(obtainFunnelMetrics.tenantId, tenantId));
        await tx.delete(obtainCampaignRoi).where(eq(obtainCampaignRoi.tenantId, tenantId));
      }

      return {
        scores: delScores.length,
        leads: delLeads.length,
      };
    });

    res.json({
      deleted: {
        leads: result.leads,
        scores: result.scores,
        upload: true,
      },
    });
  } catch (err: any) {
    console.error("Obtain delete upload error:", err);
    res.status(500).json({ error: "Erro ao remover upload" });
  }
});

// ─── POST /uploads ───────────────────────────────────────────────────────────
const VALID_COMPANY_SIZES = ["micro", "small", "medium", "large", "enterprise"] as const;
const VALID_LEAD_SOURCES = [
  "manual", "csv", "hubspot", "salesforce", "rdstation",
  "organic", "paid_search", "paid_social", "email", "referral", "event", "outbound", "other",
] as const;

obtainRouter.post("/uploads", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Arquivo não enviado" });

  let uploadRow: typeof obtainUploads.$inferSelect | undefined;
  try {
    let mapping: Record<string, string> = {};
    try { mapping = JSON.parse(req.body.mapping ?? "{}"); } catch { /* no mapping */ }

    const tenantId = req.tenantId!;

    [uploadRow] = await db.insert(obtainUploads).values({
      tenantId,
      filename: file.originalname,
      status: "processing",
      columnMapping: mapping,
      uploadedBy: req.session.userId,
    }).returning();

    // Read and parse CSV (encoding-aware: UTF-8, Latin-1, Windows-1252)
    const csvResult = readCsvFile(file.path);

    if (csvResult.errors.length > 0 && csvResult.data.length === 0) {
      await db.update(obtainUploads)
        .set({ status: "failed", errorMessage: csvResult.errors[0].message })
        .where(eq(obtainUploads.id, uploadRow.id));
      return res.status(400).json({ error: "CSV inválido: " + csvResult.errors[0].message });
    }

    const parsed = { data: csvResult.data };

    const get = (row: Record<string, string>, key: string) => {
      const csvCol = mapping[key];
      return csvCol ? row[csvCol] : undefined;
    };

    // Pre-fetch campaigns for lookup by name
    const campaignRows = await db.select({ id: obtainCampaigns.id, name: obtainCampaigns.name })
      .from(obtainCampaigns)
      .where(eq(obtainCampaigns.tenantId, tenantId));
    const campaignByName = new Map(campaignRows.map(c => [c.name.toLowerCase(), c.id]));

    // Pre-fetch existing leads for upsert
    const existingLeads = await db
      .select({ id: leads.id, email: leads.email })
      .from(leads)
      .where(eq(leads.tenantId, tenantId));
    const existingByEmail = new Map(
      existingLeads
        .filter((l) => l.email)
        .map((l) => [l.email!.toLowerCase(), l.id]),
    );

    let rowsCreated = 0;
    let rowsUpdated = 0;
    let rowsSkipped = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      try {
        const name = get(row, "name") ?? row[Object.keys(row)[0]] ?? "";
        if (!name || name.trim() === "") {
          rowsSkipped++;
          errors.push({ row: i + 1, reason: "Nome vazio" });
          continue;
        }

        const rawCompanySize = get(row, "companySize");
        const companySize = VALID_COMPANY_SIZES.includes(rawCompanySize as any)
          ? rawCompanySize as typeof VALID_COMPANY_SIZES[number]
          : null;

        const rawSource = get(row, "source");
        const source = VALID_LEAD_SOURCES.includes(rawSource as any)
          ? rawSource as typeof VALID_LEAD_SOURCES[number]
          : "csv" as const;

        const campaignName = get(row, "campaign");
        const campaignId = campaignName
          ? (campaignByName.get(campaignName.toLowerCase()) ?? null)
          : null;

        const email = get(row, "email")?.trim().toLowerCase();

        const leadData = {
          tenantId,
          name: name.trim(),
          company: get(row, "company") ?? undefined,
          industry: get(row, "industry") ?? undefined,
          companySize: companySize ?? undefined,
          city: get(row, "city") ?? undefined,
          state: get(row, "state") ?? undefined,
          email: email ?? undefined,
          phone: get(row, "phone") ?? undefined,
          source,
          campaignId: campaignId ?? undefined,
          rawData: row,
          updatedAt: new Date(),
        };

        // Upsert by email
        const existingId = email ? existingByEmail.get(email) : undefined;

        if (existingId) {
          await db.update(leads).set(leadData).where(eq(leads.id, existingId));
          rowsUpdated++;
        } else {
          const [inserted] = await db.insert(leads)
            .values({ ...leadData, status: "new" as const, sourceUploadId: uploadRow!.id })
            .returning({ id: leads.id });
          if (email) existingByEmail.set(email, inserted.id);
          rowsCreated++;
        }
      } catch (rowErr: any) {
        rowsSkipped++;
        errors.push({ row: i + 1, reason: rowErr?.message ?? "Erro desconhecido" });
      }
    }

    // ── Post-processing pipeline ─────────────────────────────────────────
    const { scoresGenerated } = await runObtainScoring(tenantId);
    await generateIcpClusters(tenantId);
    const { alertsGenerated } = await generateObtainAlerts(tenantId);

    // Intelligence summary — expanded for commercial attractiveness
    const [hotLeadsRows, warmLeadsRows, allLtvRow, allHotWarmRows] = await Promise.all([
      db.select({ lead: leads, score: obtainScores })
        .from(leads).innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(eq(leads.tenantId, tenantId), eq(obtainScores.riskTier, "hot")))
        .orderBy(desc(obtainScores.score)).limit(3),
      db.select({ count: sql<number>`count(*)::int` })
        .from(obtainScores)
        .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "warm"))),
      db.select({ totalLtv: sql<number>`coalesce(sum(${obtainScores.ltvPrediction}), 0)::real` })
        .from(obtainScores).where(eq(obtainScores.tenantId, tenantId)),
      // All hot leads for Pareto + bestProfile
      db.select({ lead: leads, score: obtainScores })
        .from(leads).innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(eq(leads.tenantId, tenantId), sql`${obtainScores.riskTier} IN ('hot', 'warm')`))
        .orderBy(desc(obtainScores.score)),
    ]);

    const topSourceRows = await db.select({
      source: leads.source,
      avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
      avgConv: sql<number>`coalesce(avg(${obtainScores.conversionProbability}), 0)::real`,
      count: sql<number>`count(*)::int`,
    }).from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(and(eq(leads.tenantId, tenantId), eq(obtainScores.riskTier, "hot")))
      .groupBy(leads.source)
      .orderBy(sql`avg(${obtainScores.ltvPrediction}) DESC`)
      .limit(3);

    const CHANNEL_LABELS_UPLOAD: Record<string, string> = {
      referral: "Indicação de Clientes", event: "Feira/Evento",
      paid_social: "LinkedIn Ads", paid_search: "Google Ads",
      outbound: "Prospecção Outbound", organic: "Orgânico/SEO",
      email: "Email Marketing", csv: "CSV Import", manual: "Manual", other: "Outros",
    };

    // ── priorityConcentration (Pareto) ──
    const paretoResult = computePareto(
      allHotWarmRows,
      r => r.score.ltvPrediction ?? 0,
      0.7,
    );
    const totalLtv = allLtvRow[0]?.totalLtv ?? 0;
    const priorityConcentration = paretoResult
      ? {
          topN: paretoResult.topN,
          topLeadsPct: paretoResult.topPct,
          ltvPct: paretoResult.valuePct,
          totalLeads: allHotWarmRows.length,
          totalLtv: Math.round(totalLtv),
        }
      : null;

    // ── bestProfile: industry+size combo most frequent in hot leads ──
    let bestProfile: { industry: string | null; companySize: string | null; matchedCluster: string | null; adherencePct: number; leadCount: number } | null = null;
    if (allHotWarmRows.length > 0) {
      const profileMap = new Map<string, { industry: string | null; companySize: string | null; count: number }>();
      for (const r of allHotWarmRows) {
        const key = `${r.lead.industry ?? ""}|${r.lead.companySize ?? ""}`;
        const existing = profileMap.get(key);
        if (existing) existing.count++;
        else profileMap.set(key, { industry: r.lead.industry ?? null, companySize: r.lead.companySize ?? null, count: 1 });
      }
      const topEntry = [...profileMap.values()].sort((a, b) => b.count - a.count)[0];

      // Fuzzy cluster match
      let matchedCluster: string | null = null;
      if (topEntry.industry) {
        const [cluster] = await db.select()
          .from(obtainIcpClusters)
          .where(and(
            eq(obtainIcpClusters.tenantId, tenantId),
            sql`lower(${obtainIcpClusters.clusterName}) like lower(${"%" + topEntry.industry + "%"})`,
          ))
          .limit(1);
        if (cluster) matchedCluster = cluster.clusterName;
      }

      bestProfile = {
        industry: topEntry.industry,
        companySize: topEntry.companySize,
        matchedCluster,
        adherencePct: Math.round((topEntry.count / allHotWarmRows.length) * 100),
        leadCount: topEntry.count,
      };
    }

    // ── dataReadinessSummary: coverage based on mapping ──
    const SCORING_FIELDS = ["name", "company", "industry", "companySize", "source"];
    const ICP_FIELDS = ["industry", "companySize"];
    const LTV_FIELDS = ["companySize", "industry"];
    const CADENCE_FIELDS = ["source", "industry"];
    const CONTACT_FIELDS = ["email", "phone"];
    const mappedKeys = new Set(Object.keys(mapping).filter(k => mapping[k]));
    const allSystemKeys = ["id", "name", "company", "industry", "companySize", "city", "state", "email", "phone", "source", "campaign"];
    const coveragePct = Math.round((mappedKeys.size / allSystemKeys.length) * 100);
    const readyFor: string[] = [];
    const missingFor: string[] = [];
    if (SCORING_FIELDS.filter(f => mappedKeys.has(f)).length >= 2) readyFor.push("Score");
    else missingFor.push("Score");
    if (ICP_FIELDS.every(f => mappedKeys.has(f))) readyFor.push("ICP");
    else missingFor.push("ICP");
    if (LTV_FIELDS.filter(f => mappedKeys.has(f)).length >= 1) readyFor.push("LTV aproximado");
    else missingFor.push("LTV");
    if (CADENCE_FIELDS.filter(f => mappedKeys.has(f)).length >= 1) readyFor.push("Cadência");
    else missingFor.push("Cadência");
    if (CONTACT_FIELDS.some(f => mappedKeys.has(f))) readyFor.push("Contato");
    const dataReadinessSummary = { coveragePct, readyFor, missing: missingFor };

    // ── executiveInsights (template-based PT-BR bullets) ──
    const hotCount = hotLeadsRows.length;
    const warmCount = warmLeadsRows[0]?.count ?? 0;
    const totalLtvFormatted = totalLtv >= 1_000_000
      ? `R$${(totalLtv / 1_000_000).toFixed(1)}M`
      : `R$${Math.round(totalLtv / 1_000)}K`;
    const executiveInsights: string[] = [];

    if (hotCount + warmCount > 0) {
      executiveInsights.push(
        `${hotCount + warmCount} leads prioritários identificados — ${hotCount} hot e ${warmCount} warm prontos para ação imediata.`
      );
    }
    if (priorityConcentration && priorityConcentration.ltvPct >= 50) {
      executiveInsights.push(
        `Os top ${priorityConcentration.topN} leads (${priorityConcentration.topLeadsPct}% do pipeline) concentram ${priorityConcentration.ltvPct}% do potencial de receita — ${totalLtvFormatted} total.`
      );
    } else if (totalLtv > 0) {
      executiveInsights.push(`Pipeline total estimado: ${totalLtvFormatted} em LTV identificado.`);
    }
    if (topSourceRows[0]) {
      const bestCh = CHANNEL_LABELS_UPLOAD[topSourceRows[0].source ?? "other"] ?? topSourceRows[0].source ?? "canal";
      const convPct = Math.round((topSourceRows[0].avgConv ?? 0) * 100);
      executiveInsights.push(
        `Canal de maior desempenho: ${bestCh} — ${topSourceRows[0].count} leads hot com LTV médio ${topSourceRows[0].avgLtv >= 1_000_000 ? `R$${(topSourceRows[0].avgLtv / 1_000_000).toFixed(1)}M` : `R$${Math.round(topSourceRows[0].avgLtv / 1_000)}K`}${convPct > 0 ? ` e ${convPct}% de prob. de conversão` : ""}.`
      );
    }
    if (bestProfile && bestProfile.adherencePct >= 30) {
      const sizeLabel: Record<string, string> = { micro: "micro", small: "pequeno", medium: "médio", large: "grande", enterprise: "enterprise" };
      const sizePart = bestProfile.companySize ? `, porte ${sizeLabel[bestProfile.companySize] ?? bestProfile.companySize}` : "";
      executiveInsights.push(
        `Perfil ICP predominante: ${bestProfile.industry ?? "indefinido"}${sizePart} — representa ${bestProfile.adherencePct}% dos leads qualificados.`
      );
    }
    if (dataReadinessSummary.coveragePct < 60) {
      executiveInsights.push(
        `Cobertura de diagnóstico em ${dataReadinessSummary.coveragePct}% — adicione ${missingFor.join(", ")} para análise completa.`
      );
    }

    const intelligenceSummary = {
      hotLeadsCount: hotCount,
      warmLeadsCount: warmCount,
      totalLtvPipeline: Math.round(totalLtv),
      bestChannel: topSourceRows[0]
        ? {
            name: CHANNEL_LABELS_UPLOAD[topSourceRows[0].source ?? "other"] ?? topSourceRows[0].source,
            avgLtv: Math.round(topSourceRows[0].avgLtv ?? 0),
            count: topSourceRows[0].count,
          }
        : null,
      topHotLeads: hotLeadsRows.slice(0, 3).map(r => ({
        id: r.lead.id,
        name: r.lead.name,
        company: r.lead.company,
        industry: r.lead.industry,
        score: r.score.score ?? 0,
        ltvPrediction: r.score.ltvPrediction ?? 0,
        recommendedAction: r.score.recommendedAction ?? "",
      })),
      executiveInsights,
      priorityConcentration,
      bestProfile,
      dataReadinessSummary,
    };

    const [done] = await db.update(obtainUploads)
      .set({
        status: "completed",
        rowsCount: parsed.data.length,
        rowsCreated,
        rowsUpdated,
        rowsSkipped,
        processedAt: new Date(),
      })
      .where(eq(obtainUploads.id, uploadRow.id))
      .returning();

    res.status(201).json({
      ...done,
      scoresGenerated,
      alertsGenerated,
      intelligenceSummary,
      errors: errors.slice(0, 20),
    });
  } catch (err: any) {
    console.error("Obtain upload error:", err);
    if (uploadRow) {
      await db.update(obtainUploads)
        .set({ status: "failed", errorMessage: String(err?.message ?? err) })
        .where(eq(obtainUploads.id, uploadRow.id))
        .catch(() => {});
    }
    res.status(500).json({ error: "Erro ao processar upload" });
  } finally {
    if (file?.path) fs.unlink(file.path, () => {});
  }
});

// ─── GET /win-patterns ──────────────────────────────────────────────────────
obtainRouter.get("/win-patterns", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const [wonLeads, allLeads] = await Promise.all([
      db.select({
        industry: leads.industry,
        companySize: leads.companySize,
        source: leads.source,
        score: obtainScores.score,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      }).from(leads)
        .leftJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, "won"),
        )),
      db.select({ count: sql<number>`count(*)::int` })
        .from(leads).where(eq(leads.tenantId, tenantId)),
    ]);

    const wonCount = wonLeads.length;
    const totalCount = allLeads[0]?.count ?? 1;

    if (wonCount === 0) {
      return res.json({ wonCount: 0, patterns: [], insight: null });
    }

    // Compute frequency for each dimension
    const industryCounts: Record<string, number> = {};
    const sizeCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    let totalScore = 0;
    let totalTimeDays = 0;
    let timeCount = 0;

    for (const lead of wonLeads) {
      if (lead.industry) industryCounts[lead.industry] = (industryCounts[lead.industry] ?? 0) + 1;
      if (lead.companySize) sizeCounts[lead.companySize] = (sizeCounts[lead.companySize] ?? 0) + 1;
      if (lead.source) sourceCounts[lead.source] = (sourceCounts[lead.source] ?? 0) + 1;
      if (lead.score) totalScore += lead.score;
      if (lead.createdAt && lead.updatedAt) {
        const days = (new Date(lead.updatedAt).getTime() - new Date(lead.createdAt).getTime()) / 86400000;
        if (days > 0 && days < 365) { totalTimeDays += days; timeCount++; }
      }
    }

    // Top industries (top 2)
    const topIndustries = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name, count]) => ({
        name,
        pct: Math.round((count / wonCount) * 100),
      }));

    // Top sizes (top 2)
    const SIZE_LABELS: Record<string, string> = {
      micro: "Micro", small: "Pequena", medium: "Média", large: "Grande", enterprise: "Enterprise",
    };
    const topSizes = Object.entries(sizeCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name, count]) => ({
        name: SIZE_LABELS[name] ?? name,
        pct: Math.round((count / wonCount) * 100),
      }));

    // Top source
    const CHANNEL_LABELS: Record<string, string> = {
      referral: "Indicação de Clientes", event: "Feira/Evento",
      paid_social: "LinkedIn Ads", paid_search: "Google Ads",
      outbound: "Prospecção Outbound", organic: "Orgânico/SEO",
      email: "Email Marketing", other: "Outros",
    };
    const topSource = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 1).map(([name, count]) => ({
        name: CHANNEL_LABELS[name] ?? name,
        pct: Math.round((count / wonCount) * 100),
      }))[0] ?? null;

    const avgScore = wonCount > 0 ? Math.round(totalScore / wonCount) : 0;
    const avgTimeDays = timeCount > 0 ? Math.round(totalTimeDays / timeCount) : null;

    // Conversion rate multiplier (won vs total for top industry + size combo)
    const overallConvRate = totalCount > 0 ? wonCount / totalCount : 0;
    const topCombo = topIndustries[0] && topSizes[0];
    let comboMultiple: number | null = null;
    if (topCombo) {
      const comboWon = wonLeads.filter(l =>
        l.industry === topIndustries[0].name &&
        (l.companySize === Object.keys(sizeCounts).sort((a, b) => sizeCounts[b]! - sizeCounts[a]!)[0])
      ).length;
      if (comboWon > 0 && overallConvRate > 0) {
        const comboTotal = wonLeads.length; // simplified
        comboMultiple = Math.round((comboWon / comboTotal / overallConvRate) * 10) / 10;
      }
    }

    // Build insight text
    let insight = `Analisando ${wonCount} leads convertidos: `;
    if (topIndustries.length >= 2) {
      insight += `${topIndustries[0].pct}% são do setor ${topIndustries[0].name} ou ${topIndustries[1].name}. `;
    } else if (topIndustries.length === 1) {
      insight += `${topIndustries[0].pct}% são do setor ${topIndustries[0].name}. `;
    }
    if (topSource) {
      insight += `${topSource.pct}% vieram por ${topSource.name}. `;
    }
    if (topIndustries[0] && topSizes[0] && topSource) {
      insight += `Leads que combinam ${topIndustries[0].name} + ${topSizes[0].name} + ${topSource.name} têm maior chance de converter.`;
    }

    res.json({
      wonCount,
      totalCount,
      patterns: [
        topIndustries.length > 0 ? {
          type: "industry",
          icon: "🏭",
          label: topIndustries.map(i => `${i.pct}% ${i.name}`).join(" ou "),
        } : null,
        topSizes.length > 0 ? {
          type: "size",
          icon: "📏",
          label: topSizes.map(s => `${s.pct}% porte ${s.name}`).join(" ou "),
        } : null,
        topSource ? {
          type: "source",
          icon: "🔗",
          label: `${topSource.pct}% via ${topSource.name}`,
        } : null,
        avgScore > 0 ? {
          type: "score",
          icon: "⚡",
          label: `Score médio na conversão: ${avgScore}/100`,
        } : null,
        avgTimeDays ? {
          type: "time",
          icon: "📅",
          label: `Tempo médio até fechar: ${avgTimeDays} dias`,
        } : null,
      ].filter(Boolean),
      insight,
      comboMultiple,
      topCombo: topIndustries[0] && topSizes[0] && topSource
        ? `${topIndustries[0].name} + ${topSizes[0].name} + ${topSource.name}`
        : null,
    });
  } catch (err) {
    console.error("Win patterns error:", err);
    res.status(500).json({ error: "Erro ao buscar padrões de sucesso" });
  }
});

// ─── GET /channel-churn-comparison ──────────────────────────────────────────
obtainRouter.get("/channel-churn-comparison", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    // JOIN leads to customers by email to find which channel their customers came from
    const channelData = await db.execute(sql`
      SELECT
        l.source,
        COUNT(c.id) AS customer_count,
        AVG(CASE WHEN c.status = 'churned' THEN 1.0 ELSE 0.0 END) AS churn_rate,
        AVG(c.dim_revenue) AS avg_revenue
      FROM leads l
      INNER JOIN customers c ON lower(l.email) = lower(c.email)
      WHERE l.tenant_id = ${tenantId}
        AND c.tenant_id = ${tenantId}
        AND l.source IS NOT NULL
        AND l.email IS NOT NULL
      GROUP BY l.source
      HAVING COUNT(c.id) >= 2
      ORDER BY churn_rate ASC
    `);

    const CHANNEL_LABELS: Record<string, string> = {
      referral: "Indicação de Clientes", event: "Feira/Evento",
      paid_social: "LinkedIn Ads", paid_search: "Google Ads",
      outbound: "Prospecção Outbound", organic: "Orgânico/SEO",
      email: "Email Marketing", other: "Outros",
    };

    const rows = (channelData.rows as any[]).map(r => ({
      source: r.source,
      sourceLabel: CHANNEL_LABELS[r.source] ?? r.source,
      customerCount: parseInt(r.customer_count),
      churnRate: Math.round(parseFloat(r.churn_rate) * 1000) / 10,
      avgRevenue: Math.round(parseFloat(r.avg_revenue) || 0),
    }));

    if (rows.length < 2) {
      return res.json({ rows: [], bestSource: null, worstSource: null, insight: null });
    }

    const bestSource = rows[0]; // lowest churn
    const worstSource = rows[rows.length - 1]; // highest churn

    const churnDiff = worstSource.churnRate > 0
      ? Math.round(((worstSource.churnRate - bestSource.churnRate) / worstSource.churnRate) * 100)
      : 0;

    const insight = churnDiff > 0
      ? `Clientes adquiridos por ${bestSource.sourceLabel} têm churn ${churnDiff}% menor que ${worstSource.sourceLabel}.`
      : null;

    res.json({ rows, bestSource, worstSource, insight });
  } catch (err) {
    console.error("Channel churn comparison error:", err);
    res.status(500).json({ error: "Erro ao buscar comparação de canais" });
  }
});

// ─── POST /upload/suggest-mapping ───────────────────────────────────────────
obtainRouter.post("/upload/suggest-mapping", async (req, res) => {
  try {
    const { headers, sampleRows } = req.body;
    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({ error: "headers é obrigatório (array de strings)" });
    }
    const suggestions = suggestMapping(headers, sampleRows ?? [], "obtain");
    res.json(suggestions);
  } catch (err) {
    console.error("Suggest mapping error:", err);
    res.status(500).json({ error: "Erro ao sugerir mapeamento" });
  }
});

// ─── GET /alerts ────────────────────────────────────────────────────────────
obtainRouter.get("/alerts", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const severity = req.query.severity as string | undefined;
    const isRead = req.query.isRead as string | undefined;

    const conditions: SQL[] = [eq(obtainAlerts.tenantId, tenantId)];
    if (severity) conditions.push(eq(obtainAlerts.severity, severity as any));
    if (isRead === "true") conditions.push(eq(obtainAlerts.isRead, true));
    if (isRead === "false") conditions.push(eq(obtainAlerts.isRead, false));

    const rows = await db
      .select({
        alert: obtainAlerts,
        leadName: leads.name,
        leadCompany: leads.company,
      })
      .from(obtainAlerts)
      .innerJoin(leads, eq(obtainAlerts.leadId, leads.id))
      .where(and(...conditions))
      .orderBy(desc(obtainAlerts.createdAt))
      .limit(50);

    const data = rows.map((r) => ({
      id: r.alert.id,
      leadId: r.alert.leadId,
      leadName: r.leadName,
      leadCompany: r.leadCompany,
      type: r.alert.type,
      message: r.alert.message,
      severity: r.alert.severity,
      isRead: r.alert.isRead,
      createdAt: r.alert.createdAt,
    }));

    res.json(data);
  } catch (err) {
    console.error("Obtain alerts error:", err);
    res.status(500).json({ error: "Erro ao buscar alertas" });
  }
});

// ─── PATCH /alerts/:id/read ─────────────────────────────────────────────────
obtainRouter.patch("/alerts/:id/read", async (req, res) => {
  try {
    const [updated] = await db.update(obtainAlerts)
      .set({ isRead: true })
      .where(and(eq(obtainAlerts.id, req.params.id), eq(obtainAlerts.tenantId, req.tenantId!)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Alerta não encontrado" });
    res.json(updated);
  } catch (err) {
    console.error("Mark alert read error:", err);
    res.status(500).json({ error: "Erro ao atualizar alerta" });
  }
});

// ─── GET /data-freshness ────────────────────────────────────────────────────
obtainRouter.get("/data-freshness", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const [lastUpload] = await db.select()
      .from(obtainUploads)
      .where(and(eq(obtainUploads.tenantId, tenantId), eq(obtainUploads.status, "completed")))
      .orderBy(sql`${obtainUploads.processedAt} DESC NULLS LAST`)
      .limit(1);

    const [countRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.tenantId, tenantId));

    res.json({
      lastUploadAt: lastUpload?.processedAt ?? null,
      lastUploadFilename: lastUpload?.filename ?? null,
      totalRecords: countRow?.count ?? 0,
    });
  } catch (err) {
    console.error("Data freshness error:", err);
    res.status(500).json({ error: "Erro ao buscar freshness" });
  }
});

// ─── GET /leads/:id/score-history ───────────────────────────────────────────
obtainRouter.get("/leads/:id/score-history", async (req, res) => {
  try {
    const rows = await db.select()
      .from(leadScoreHistory)
      .where(and(
        eq(leadScoreHistory.leadId, req.params.id),
        eq(leadScoreHistory.tenantId, req.tenantId!),
      ))
      .orderBy(asc(leadScoreHistory.snapshotDate));
    res.json(rows);
  } catch (err) {
    console.error("Lead score history error:", err);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

// ─── GET /lead-quality-trend ────────────────────────────────────────────────
obtainRouter.get("/lead-quality-trend", async (req, res) => {
  try {
    const rows = await db.select({
      snapshotDate: leadScoreHistory.snapshotDate,
      scoreTier: leadScoreHistory.scoreTier,
      count: sql<number>`count(*)::int`,
    })
      .from(leadScoreHistory)
      .where(eq(leadScoreHistory.tenantId, req.tenantId!))
      .groupBy(leadScoreHistory.snapshotDate, leadScoreHistory.scoreTier)
      .orderBy(asc(leadScoreHistory.snapshotDate));

    // Group by month label (e.g. "Nov/25")
    const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const byMonth = new Map<string, Record<string, number>>();
    const monthOrder: string[] = [];

    for (const r of rows) {
      const d = new Date(String(r.snapshotDate) + "T12:00:00Z");
      const label = `${PT_MONTHS[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
      if (!byMonth.has(label)) { byMonth.set(label, { hot: 0, warm: 0, cold: 0 }); monthOrder.push(label); }
      const bucket = byMonth.get(label)!;
      if (r.scoreTier === "hot") bucket.hot += r.count;
      else if (r.scoreTier === "warm") bucket.warm += r.count;
      else if (r.scoreTier === "cold") bucket.cold += r.count;
    }

    // De-duplicate month order while preserving insertion order
    const seen = new Set<string>();
    const data = monthOrder
      .filter(m => { if (seen.has(m)) return false; seen.add(m); return true; })
      .map(month => ({ month, ...byMonth.get(month)! }));

    res.json(data);
  } catch (err) {
    console.error("Lead quality trend error:", err);
    res.status(500).json({ error: "Erro ao buscar tendência" });
  }
});

// ─── GET /source-ltv ─────────────────────────────────────────────────────────
obtainRouter.get("/source-ltv", async (req, res) => {
  try {
    const rows = await db.select({
      source: leads.source,
      avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
      leadCount: sql<number>`count(${leads.id})::int`,
    })
      .from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(and(
        eq(leads.tenantId, req.tenantId!),
        sql`${obtainScores.ltvPrediction} > 0`,
        sql`${leads.source} NOT IN ('csv', 'manual', 'other')`,
      ))
      .groupBy(leads.source)
      .orderBy(sql`avg(${obtainScores.ltvPrediction}) DESC`)
      .limit(6);

    const CHANNEL_LABELS: Record<string, string> = {
      referral: "Indicação", event: "Evento", paid_social: "LinkedIn/Social",
      paid_search: "Google Ads", organic: "Orgânico", outbound: "Outbound",
      email: "Email", other: "Outro",
    };

    const data = rows.map(r => ({
      source: CHANNEL_LABELS[r.source ?? "other"] ?? r.source ?? "Outro",
      ltv: Math.round(r.avgLtv ?? 0),
      leadCount: r.leadCount,
    }));

    res.json(data);
  } catch (err) {
    console.error("Source LTV error:", err);
    res.status(500).json({ error: "Erro ao buscar source LTV" });
  }
});
