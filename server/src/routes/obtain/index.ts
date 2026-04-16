import { Router } from "express";
import multer from "multer";
import os from "os";
import fs from "fs";
import Papa from "papaparse";
import { db } from "../../db.js";
import { eq, and, desc, asc, ilike, sql, SQL } from "drizzle-orm";
import {
  leads, obtainScores, obtainCampaigns, obtainCampaignRoi,
  obtainIcpClusters, obtainFunnelMetrics, obtainLeadActions, obtainUploads,
  obtainAlerts, leadScoreHistory, customers,
} from "../../../../shared/schema.js";
import { runObtainScoring, generateObtainAlerts, generateLeadNarrative, generateRecommendedOffer, generateSalesCadence } from "../../engine/obtain-scoring.js";
import { generateIcpClusters } from "../../engine/icp-clustering.js";
import { suggestMapping } from "../../engine/column-mapper.js";
import { readCsvFile } from "../../lib/csv-reader.js";
import { parseNumber } from "../../lib/value-normalizer.js";
import { formatTimeAgo } from "../../lib/time-utils.js";

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
    const [avgFunnelTime] = await db.select({
      avgDays: sql<number>`EXTRACT(EPOCH FROM (now() - avg(${leads.createdAt}))) / 86400`,
    }).from(leads).where(and(eq(leads.tenantId, tenantId), sql`${leads.status} != 'won'`));
    const avgDays = Math.max(0, avgFunnelTime?.avgDays ?? 30);
    const velocityScore = Math.max(0, (1 - avgDays / 90)) * 20;

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

    const priorities = topRows.map(r => {
      const shapValues = (r.score.shapValues as any[]) ?? [];
      const topFactor = shapValues.find((s: any) => s.direction === "positive") ?? shapValues[0];
      const daysSinceCreated = r.lead.createdAt
        ? Math.floor((Date.now() - new Date(r.lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

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
      };
    });

    res.json({
      priorities,
      totalLtvAtStake: Math.round(ltvRow?.totalLtv ?? 0),
      hotCount: hotCount?.count ?? 0,
      warmCount: warmCount?.count ?? 0,
      topSource,
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
    const rows = await db.select().from(obtainIcpClusters)
      .where(eq(obtainIcpClusters.tenantId, req.tenantId!))
      .orderBy(asc(obtainIcpClusters.clusterId));

    // Compute budgetShare (fraction of total customers in this cluster)
    const totalCustomers = rows.reduce((sum, r) => sum + ((r.characteristics as any)?.customerCount ?? 0), 0);
    const data = rows.map(r => {
      const chars = (r.characteristics as any) ?? {};
      const customerCount = chars.customerCount ?? 0;
      const budgetShare = totalCustomers > 0 ? customerCount / totalCustomers : 0;
      return {
        id: r.id,
        name: r.clusterName,
        description: r.description,
        type: chars.type ?? (r.isIdeal ? "ideal" : "anti"),
        avgLtv: r.averageLtv,
        avgCac: r.averageCac ?? 0,
        avgConversionRate: r.averageConversionRate ?? 0,
        avgTenureDays: r.averageTenureDays,
        churnRate: r.churnRate30d ?? 0,
        leadsInFunnel: chars.leadCount ?? 0,
        budgetShare,
        characteristics: r.characteristics,
      };
    });
    res.json(data);
  } catch (err) {
    console.error("Obtain ICP clusters error:", err);
    res.status(500).json({ error: "Erro ao buscar ICP clusters" });
  }
});

// ─── GET /funnel ─────────────────────────────────────────────────────────────
// Calculated dynamically from real lead statuses — no hardcoded data
obtainRouter.get("/funnel", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    // Count leads per status
    const statusCounts = await db.select({
      status: leads.status,
      count: sql<number>`count(*)::int`,
    })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .groupBy(leads.status);

    const byStatus = Object.fromEntries(statusCounts.map(r => [r.status, r.count]));

    // Average LTV per stage from scores
    const ltvByStatus = await db.select({
      status: leads.status,
      avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
    })
      .from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(eq(leads.tenantId, tenantId))
      .groupBy(leads.status);

    const ltvMap = Object.fromEntries(ltvByStatus.map(r => [r.status, r.avgLtv]));

    // Hot leads stuck in each stage > 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    const hotStuckRows = await db.select({
      status: leads.status,
      count: sql<number>`count(*)::int`,
    }).from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(and(
        eq(leads.tenantId, tenantId),
        eq(obtainScores.riskTier, "hot"),
        sql`${leads.updatedAt} < ${sevenDaysAgoStr}::timestamp`,
      ))
      .groupBy(leads.status);

    const hotStuckMap = Object.fromEntries(hotStuckRows.map(r => [r.status, r.count]));

    // Average time in funnel per status (days since created_at)
    const avgTimeRows = await db.select({
      status: leads.status,
      avgDays: sql<number>`EXTRACT(EPOCH FROM (now() - avg(${leads.createdAt}))) / 86400`,
    }).from(leads)
      .where(and(eq(leads.tenantId, tenantId), sql`${leads.status} != 'won'`))
      .groupBy(leads.status);

    const avgTimeMap = Object.fromEntries(avgTimeRows.map(r => [r.status, Math.round(r.avgDays ?? 0)]));

    const STAGES = [
      { key: "new",        name: "Prospecção",   order: 1 },
      { key: "qualifying", name: "Qualificação",  order: 2 },
      { key: "contacted",  name: "Demo",          order: 3 },
      { key: "proposal",   name: "Proposta",      order: 4 },
      { key: "won",        name: "Fechado",       order: 5 },
    ];

    const counts = STAGES.map(s => byStatus[s.key] ?? 0);
    const prospect = counts[0] || 1; // avoid division by zero

    const data = STAGES.map((s, i) => {
      const count = counts[i];
      const prev = i > 0 ? counts[i - 1] : null;
      // dropOffRate as decimal 0-1 (frontend multiplies by 100 to display)
      const dropOffRate = prev != null && prev > 0
        ? Math.round((1 - count / prev) * 1000) / 1000
        : 0;
      const revenueAtRisk = Math.round((ltvMap[s.key] ?? 0) * count);

      return {
        id: s.key,
        name: s.name,
        order: s.order,
        leadsCount: count,
        hotLeadsStuck: hotStuckMap[s.key] ?? 0,
        avgTimeDays: avgTimeMap[s.key] ?? 0,
        dropOffRate,
        conversionFromTop: Math.round((count / prospect) * 100),
        revenueAtRisk,
        isBottleneck: false,
      };
    });

    // Mark highest drop-off as bottleneck (excluding first stage)
    let maxDrop = 0;
    let bottleneckIdx = -1;
    data.forEach((s, i) => {
      if (i > 0 && s.dropOffRate > maxDrop) {
        maxDrop = s.dropOffRate;
        bottleneckIdx = i;
      }
    });
    data.forEach((s, i) => { s.isBottleneck = i === bottleneckIdx; });

    res.json(data);
  } catch (err) {
    console.error("Obtain funnel error:", err);
    res.status(500).json({ error: "Erro ao buscar funil" });
  }
});

// ─── GET /campaigns ──────────────────────────────────────────────────────────
// Calculated dynamically from real lead sources + ML scores — no hardcoded data
obtainRouter.get("/campaigns", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const rows = await db.select({
      source: leads.source,
      totalLeads: sql<number>`count(${leads.id})::int`,
      wonLeads: sql<number>`count(case when ${leads.status} = 'won' then 1 end)::int`,
      avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
      maxLtv: sql<number>`coalesce(max(${obtainScores.ltvPrediction}), 0)::real`,
    })
      .from(leads)
      .leftJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(eq(leads.tenantId, tenantId))
      .groupBy(leads.source)
      .orderBy(sql`avg(${obtainScores.ltvPrediction}) DESC NULLS LAST`);

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

    // Estimate CAC: without real budget data, use LTV-based heuristic
    // (LTV / expected ROI multiple per channel type)
    const CAC_MULTIPLIER: Record<string, number> = {
      referral: 0.002, event: 0.012, paid_social: 0.007,
      paid_search: 0.005, outbound: 0.015, organic: 0.001,
      email: 0.002, csv: 0, manual: 0, other: 0.01,
    };

    const data = rows.map(r => {
      const source = r.source ?? "other";
      const avgLtv = Math.round(r.avgLtv ?? 0);
      const cac = Math.round(avgLtv * (CAC_MULTIPLIER[source] ?? 0.01));
      const conversionRate = r.totalLeads > 0
        ? Math.round((r.wonLeads / r.totalLeads) * 1000) / 10
        : 0;
      const projectedRoi = cac > 0
        ? Math.round(((avgLtv - cac) / cac) * 100 * 10) / 10
        : 0;

      const roiStatus = projectedRoi > 500 ? "excellent"
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
        avgLtv,
        cac,
        projectedRoi,
        roiStatus,
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
            .values({ ...leadData, status: "new" as const })
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

    // Intelligence summary
    const [hotLeadsRows, warmLeadsRows, allLtvRow] = await Promise.all([
      db.select({ lead: leads, score: obtainScores })
        .from(leads).innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
        .where(and(eq(leads.tenantId, tenantId), eq(obtainScores.riskTier, "hot")))
        .orderBy(desc(obtainScores.score)).limit(3),
      db.select({ count: sql<number>`count(*)::int` })
        .from(obtainScores)
        .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "warm"))),
      db.select({ totalLtv: sql<number>`coalesce(sum(${obtainScores.ltvPrediction}), 0)::real` })
        .from(obtainScores).where(eq(obtainScores.tenantId, tenantId)),
    ]);

    const topSourceRows = await db.select({
      source: leads.source,
      avgLtv: sql<number>`coalesce(avg(${obtainScores.ltvPrediction}), 0)::real`,
      count: sql<number>`count(*)::int`,
    }).from(leads)
      .innerJoin(obtainScores, eq(obtainScores.leadId, leads.id))
      .where(and(eq(leads.tenantId, tenantId), eq(obtainScores.riskTier, "hot")))
      .groupBy(leads.source)
      .orderBy(sql`avg(${obtainScores.ltvPrediction}) DESC`)
      .limit(1);

    const CHANNEL_LABELS_UPLOAD: Record<string, string> = {
      referral: "Indicação de Clientes", event: "Feira/Evento",
      paid_social: "LinkedIn Ads", paid_search: "Google Ads",
      outbound: "Prospecção Outbound", organic: "Orgânico/SEO",
      email: "Email Marketing", csv: "CSV Import", manual: "Manual", other: "Outros",
    };

    const intelligenceSummary = {
      hotLeadsCount: hotLeadsRows.length,
      warmLeadsCount: warmLeadsRows[0]?.count ?? 0,
      totalLtvPipeline: Math.round(allLtvRow[0]?.totalLtv ?? 0),
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
      .orderBy(desc(obtainUploads.processedAt))
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
