import { Router } from "express";
import multer from "multer";
import os from "os";
import fs from "fs";
import Papa from "papaparse";
import { db } from "../../db.js";
import { eq, and, desc, asc, ilike, sql, inArray, SQL } from "drizzle-orm";
import {
  customers, retainPredictions, retainChurnCauses, retainAnalytics,
  retainActions, retainUploads, retainAlerts, customerScoreHistory,
  customerNotes,
} from "../../../../shared/schema.js";
import {
  runRetainPredictions,
  generateAnalyticsSnapshot,
  generateChurnCauses,
  generateAlerts,
  generateCustomerNarrative,
  generateRetentionPlaybook,
} from "../../engine/retain-scoring.js";
import { formatTimeAgo } from "../../lib/time-utils.js";
import { generateIcpClusters } from "../../engine/icp-clustering.js";
import { suggestMapping } from "../../engine/column-mapper.js";
import { readCsvFile, readCsvSample } from "../../lib/csv-reader.js";
import {
  parseNumber,
  buildSatisfactionNormalizer,
  parseDate,
  daysFromToday,
  type NpsScale,
} from "../../lib/value-normalizer.js";

export const retainRouter = Router();
// Use diskStorage to avoid loading CSV files into Node heap memory
const upload = multer({ storage: multer.diskStorage({ destination: os.tmpdir() }), limits: { fileSize: 50 * 1024 * 1024 } });

const VALID_ACTION_TYPES = ["call", "email", "demo", "proposal", "follow_up", "whatsapp"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapCustomerToDto(c: typeof customers.$inferSelect) {
  return {
    id: c.id,
    customerCode: c.customerCode,
    name: c.name,
    segment: c.segment,
    city: c.city,
    state: c.state,
    revenue: c.dimRevenue,
    healthScore: c.healthScore,
    churnProbability: c.churnProbability,
    riskLevel: c.riskLevel,
    status: c.status,
    tenureDays: c.dimTenureDays,
    usageIntensity: c.dimUsageIntensity,
    supportVolume: c.dimSupportVolume,
    satisfaction: c.dimSatisfaction,
    paymentRegularity: c.dimPaymentRegularity,
    contractRemainingDays: c.dimContractRemainingDays,
    contractType: c.contractType,
    servicesCount: c.servicesCount,
  };
}

// ─── GET /dashboard ──────────────────────────────────────────────────────────
retainRouter.get("/dashboard", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const [snapshots, alertCustomers, riskRows] = await Promise.all([
      db.select().from(retainAnalytics)
        .where(eq(retainAnalytics.tenantId, tenantId))
        .orderBy(desc(retainAnalytics.snapshotDate)).limit(2),
      db.select().from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          sql`${customers.riskLevel} IN ('high', 'critical')`
        ))
        .orderBy(desc(customers.churnProbability)).limit(5),
      db.select({
        riskLevel: customers.riskLevel,
        count: sql<number>`count(*)::int`,
      }).from(customers)
        .where(eq(customers.tenantId, tenantId))
        .groupBy(customers.riskLevel),
    ]);

    const latest = snapshots[0];
    const previous = snapshots[1];

    const alerts = alertCustomers.map(c => ({
      id: c.id,
      customerId: c.id,
      customerName: c.name,
      message: c.riskLevel === "critical"
        ? `Churn probability em ${Math.round((c.churnProbability ?? 0) * 100)}%`
        : `Health score baixo (${c.healthScore})`,
      severity: c.riskLevel === "critical" ? "critical" : "high",
      timeAgo: formatTimeAgo(c.createdAt),
    }));

    const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    riskRows.forEach(r => { if (r.riskLevel) riskDistribution[r.riskLevel] = r.count; });

    const mrr = latest?.mrr ?? 0;
    const churnRateDecimal = (latest?.churnRate ?? 0) / 100;
    // 3 monthly projection scenarios
    const months = [1, 2, 3];
    const revenueProjection = {
      current: mrr,
      months: months.map(m => ({
        month: m * 30,
        pessimistic: Math.round(mrr * Math.pow(1 - churnRateDecimal, m)),
        withRetention: Math.round(mrr * Math.pow(1 - churnRateDecimal * 0.4, m)),
        optimistic: 0, // will compute below
      })),
    };
    // Optimistic: with-retention + expansion potential
    // Use revenueAtRisk * 0.05 as monthly expansion proxy
    const expansionMonthly = (latest?.revenueAtRisk ?? 0) * 0.05;
    revenueProjection.months = revenueProjection.months.map(p => ({
      ...p,
      optimistic: Math.round(p.withRetention + expansionMonthly * p.month / 30),
    }));

    const calcChange = (curr: number | null, prev: number | null) => {
      if (!curr || !prev || prev === 0) return 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    res.json({
      kpis: {
        totalCustomers: latest?.totalCustomers ?? 0,
        totalCustomersChange: calcChange(latest?.totalCustomers ?? null, previous?.totalCustomers ?? null),
        churnRate: latest?.churnRate ?? 0,
        churnRateChange: calcChange(latest?.churnRate ?? null, previous?.churnRate ?? null),
        mrr,
        mrrChange: calcChange(latest?.mrr ?? null, previous?.mrr ?? null),
        revenueAtRisk: latest?.revenueAtRisk ?? 0,
        revenueAtRiskChange: calcChange(latest?.revenueAtRisk ?? null, previous?.revenueAtRisk ?? null),
        avgHealthScore: latest?.avgHealthScore ?? 0,
        riskDistribution,
      },
      alerts,
      revenueProjection,
    });
  } catch (err) {
    console.error("Retain dashboard error:", err);
    res.status(500).json({ error: "Erro ao buscar dashboard" });
  }
});

// ─── GET /action-priorities ──────────────────────────────────────────────────
retainRouter.get("/action-priorities", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    // Top 5 customers by revenue × churnProbability (expected revenue loss)
    const topCustomers = await db.select({
      customer: customers,
      prediction: retainPredictions,
    }).from(customers)
      .innerJoin(retainPredictions, and(
        eq(retainPredictions.customerId, customers.id),
        eq(retainPredictions.isActive, true),
      ))
      .where(and(
        eq(customers.tenantId, tenantId),
        sql`${customers.riskLevel} IN ('critical', 'high')`,
      ))
      .orderBy(sql`${customers.dimRevenue} * ${customers.churnProbability} DESC NULLS LAST`)
      .limit(5);

    // Score trends (last 4 weeks) for each
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const dateStr = fourWeeksAgo.toISOString().split("T")[0];

    const priorities = await Promise.all(topCustomers.map(async (r) => {
      const history = await db.select()
        .from(customerScoreHistory)
        .where(and(
          eq(customerScoreHistory.tenantId, tenantId),
          eq(customerScoreHistory.customerId, r.customer.id),
          sql`${customerScoreHistory.snapshotDate} >= ${dateStr}`,
        ))
        .orderBy(asc(customerScoreHistory.snapshotDate))
        .limit(28);

      let scoreTrend: { direction: "declining" | "stable" | "improving"; delta: number } = { direction: "stable", delta: 0 };
      if (history.length >= 2) {
        const delta = (history[history.length - 1].healthScore ?? 0) - (history[0].healthScore ?? 0);
        scoreTrend = {
          direction: delta <= -5 ? "declining" : delta >= 5 ? "improving" : "stable",
          delta: Math.round(delta),
        };
      }

      const shapValues = (r.prediction.shapValues as any[]) ?? [];
      const topFactor = shapValues.find((s: any) => s.direction === "negative");

      return {
        customerId: r.customer.id,
        name: r.customer.name,
        segment: r.customer.segment,
        revenue: r.customer.dimRevenue ?? 0,
        healthScore: r.customer.healthScore ?? 0,
        churnProbability: r.prediction.churnProbability ?? 0,
        riskLevel: r.prediction.riskLevel,
        contractRemainingDays: r.customer.dimContractRemainingDays,
        topFactor: topFactor ? { label: topFactor.label, impact: topFactor.impact } : null,
        recommendedAction: r.prediction.recommendedAction,
        scoreTrend,
        scoreDelta: scoreTrend.delta,
      };
    }));

    // Aggregate stats
    const totalRevenueAtStake = priorities.reduce((sum, p) => sum + p.revenue * p.churnProbability, 0);

    const [contractsRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        sql`${customers.dimContractRemainingDays} < 30`,
        sql`${customers.dimContractRemainingDays} > 0`,
        sql`${customers.riskLevel} != 'low'`,
      ));

    const riskRows = await db.select({
      riskLevel: customers.riskLevel,
      count: sql<number>`count(*)::int`,
    }).from(customers)
      .where(eq(customers.tenantId, tenantId))
      .groupBy(customers.riskLevel);

    const riskMap = Object.fromEntries(riskRows.map(r => [r.riskLevel, r.count]));

    res.json({
      priorities,
      totalRevenueAtStake: Math.round(totalRevenueAtStake),
      contractsExpiring30d: contractsRow?.count ?? 0,
      criticalCount: riskMap["critical"] ?? 0,
      highCount: riskMap["high"] ?? 0,
    });
  } catch (err) {
    console.error("Retain action priorities error:", err);
    res.status(500).json({ error: "Erro ao buscar prioridades" });
  }
});

// ─── GET /predictions ────────────────────────────────────────────────────────
retainRouter.get("/predictions", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const { riskLevel, segment, search, sortBy, sortDir } = req.query;

    const conditions: SQL[] = [
      eq(retainPredictions.tenantId, tenantId),
      eq(retainPredictions.isActive, true),
    ];
    if (riskLevel) conditions.push(eq(retainPredictions.riskLevel, riskLevel as any));
    if (segment) conditions.push(eq(customers.segment, segment as string));
    if (search) conditions.push(ilike(customers.name, `%${search}%`));

    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(retainPredictions)
      .innerJoin(customers, eq(retainPredictions.customerId, customers.id))
      .where(and(...conditions));
    const total = countResult[0]?.count ?? 0;

    const sortColumn = sortBy === "healthScore" ? customers.healthScore
      : sortBy === "name" ? customers.name
      : retainPredictions.churnProbability;
    const sortOrder = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    const rows = await db.select({
      prediction: retainPredictions,
      customer: customers,
    }).from(retainPredictions)
      .innerJoin(customers, eq(retainPredictions.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(sortOrder)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const data = rows.map(r => ({
      ...mapCustomerToDto(r.customer),
      churnProbability: r.prediction.churnProbability,
      riskLevel: r.prediction.riskLevel,
      confidence: r.prediction.confidence,
      shapValues: r.prediction.shapValues,
      recommendedAction: r.prediction.recommendedAction,
    }));

    res.json({ data, total, page, pageSize });
  } catch (err) {
    console.error("Retain predictions error:", err);
    res.status(500).json({ error: "Erro ao buscar predições" });
  }
});

// ─── GET /predictions/:customerId ────────────────────────────────────────────
retainRouter.get("/predictions/:customerId", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { customerId } = req.params;

    const [row] = await db.select({
      prediction: retainPredictions,
      customer: customers,
    }).from(retainPredictions)
      .innerJoin(customers, eq(retainPredictions.customerId, customers.id))
      .where(and(
        eq(retainPredictions.tenantId, tenantId),
        eq(retainPredictions.customerId, customerId),
        eq(retainPredictions.isActive, true),
      )).limit(1);

    if (!row) return res.status(404).json({ error: "Predição não encontrada" });

    // ── Score trend (last 4 weeks) ──
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const scoreHistory = await db.select()
      .from(customerScoreHistory)
      .where(and(
        eq(customerScoreHistory.tenantId, tenantId),
        eq(customerScoreHistory.customerId, customerId),
        sql`${customerScoreHistory.snapshotDate} >= ${fourWeeksAgo.toISOString().split("T")[0]}`,
      ))
      .orderBy(asc(customerScoreHistory.snapshotDate))
      .limit(28);

    let scoreTrend: { direction: "declining" | "stable" | "improving"; delta: number; weeksAnalyzed: number } = { direction: "stable", delta: 0, weeksAnalyzed: 0 };
    if (scoreHistory.length >= 2) {
      const oldest = scoreHistory[0].healthScore ?? 0;
      const newest = scoreHistory[scoreHistory.length - 1].healthScore ?? 0;
      const delta = newest - oldest;
      scoreTrend = {
        direction: delta <= -5 ? "declining" : delta >= 5 ? "improving" : "stable",
        delta: Math.round(delta),
        weeksAnalyzed: Math.ceil(scoreHistory.length / 7),
      };
    }

    // ── Segment benchmark ──
    const segment = row.customer.segment;
    let segmentBenchmark = null;
    if (segment) {
      const [segAvg] = await db.select({
        segmentAvgHealth: sql<number>`coalesce(avg(${customers.healthScore}), 50)::real`,
        segmentCount: sql<number>`count(*)::int`,
      }).from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.segment, segment)));

      const customerHealth = row.customer.healthScore ?? 0;
      const segAvgHealth = Math.round(segAvg?.segmentAvgHealth ?? 50);
      const percentDiff = segAvgHealth > 0
        ? Math.round(((customerHealth - segAvgHealth) / segAvgHealth) * 100)
        : 0;

      segmentBenchmark = { segmentName: segment, segmentAvgHealth: segAvgHealth, customerHealth, percentDiff };
    }

    // ── Peer risk count ──
    const [peerRisk] = await db.select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        segment ? eq(customers.segment, segment) : sql`1=1`,
        sql`${customers.riskLevel} IN ('high', 'critical')`,
        sql`${customers.id} != ${customerId}`,
      ));
    const peerRiskCount = peerRisk?.count ?? 0;

    // ── Narrative ──
    const shapValues = (row.prediction.shapValues as any[]) ?? [];
    const narrative = generateCustomerNarrative(
      {
        name: row.customer.name,
        segment: row.customer.segment,
        dimRevenue: row.customer.dimRevenue,
        healthScore: row.customer.healthScore,
        churnProbability: row.prediction.churnProbability,
        riskLevel: row.prediction.riskLevel,
        dimContractRemainingDays: row.customer.dimContractRemainingDays,
      },
      shapValues,
      scoreTrend,
    );

    const shapValuesForPlaybook = (row.prediction.shapValues as any[]) ?? [];
    const topNegativeFactor = shapValuesForPlaybook.find((s: any) => s.direction === "negative");
    const retentionPlaybook = generateRetentionPlaybook(
      row.prediction.riskLevel ?? "medium",
      topNegativeFactor?.feature ?? null,
      row.customer.dimContractRemainingDays,
      row.customer.dimRevenue,
    );

    res.json({
      ...mapCustomerToDto(row.customer),
      churnProbability: row.prediction.churnProbability,
      riskLevel: row.prediction.riskLevel,
      confidence: row.prediction.confidence,
      shapValues,
      baseProbability: 0.15,
      recommendedAction: row.prediction.recommendedAction,
      narrative,
      segmentBenchmark,
      scoreTrend,
      peerRiskCount,
      retentionPlaybook,
    });
  } catch (err) {
    console.error("Retain prediction detail error:", err);
    res.status(500).json({ error: "Erro ao buscar predição" });
  }
});

// ─── GET /customers ──────────────────────────────────────────────────────────
retainRouter.get("/customers", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const { riskLevel, segment, search, sortBy, sortDir } = req.query;

    const conditions: SQL[] = [eq(customers.tenantId, tenantId)];
    if (riskLevel) conditions.push(eq(customers.riskLevel, riskLevel as any));
    if (segment) conditions.push(eq(customers.segment, segment as string));
    if (search) conditions.push(ilike(customers.name, `%${search}%`));

    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(customers).where(and(...conditions));
    const total = countResult[0]?.count ?? 0;

    const sortColumn = sortBy === "revenue" ? customers.dimRevenue
      : sortBy === "healthScore" ? customers.healthScore
      : sortBy === "name" ? customers.name
      : customers.churnProbability;
    const sortOrder = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    const rows = await db.select().from(customers)
      .where(and(...conditions))
      .orderBy(sortOrder)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const data = rows.map(mapCustomerToDto);

    res.json({ data, total, page, pageSize });
  } catch (err) {
    console.error("Retain customers error:", err);
    res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

// ─── GET /customers/:id ──────────────────────────────────────────────────────
retainRouter.get("/customers/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(customers)
      .where(and(eq(customers.tenantId, req.tenantId!), eq(customers.id, req.params.id)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(mapCustomerToDto(row));
  } catch (err) {
    console.error("Retain customer detail error:", err);
    res.status(500).json({ error: "Erro ao buscar cliente" });
  }
});

// ─── GET /churn-causes ───────────────────────────────────────────────────────
retainRouter.get("/churn-causes", async (req, res) => {
  try {
    const rows = await db.select().from(retainChurnCauses)
      .where(eq(retainChurnCauses.tenantId, req.tenantId!))
      .orderBy(desc(retainChurnCauses.impactPct));

    const [atRiskRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(
        eq(customers.tenantId, req.tenantId!),
        sql`${customers.riskLevel} IN ('high', 'critical')`,
      ));

    const analyticsSnaps = await db.select({ revenueAtRisk: retainAnalytics.revenueAtRisk })
      .from(retainAnalytics)
      .where(eq(retainAnalytics.tenantId, req.tenantId!))
      .orderBy(desc(retainAnalytics.snapshotDate))
      .limit(2);

    const latestRisk = analyticsSnaps[0]?.revenueAtRisk ?? 0;
    const prevRisk = analyticsSnaps[1]?.revenueAtRisk ?? 0;
    const revenueAtRiskChange = prevRisk > 0
      ? Math.round(((latestRisk - prevRisk) / prevRisk) * 1000) / 10
      : 0;

    res.json({
      causes: rows,
      summary: {
        totalAtRisk: atRiskRow?.count ?? 0,
        revenueAtRiskChange,
      },
    });
  } catch (err) {
    console.error("Retain churn causes error:", err);
    res.status(500).json({ error: "Erro ao buscar causas de churn" });
  }
});

// ─── GET /analytics/trend ────────────────────────────────────────────────────
retainRouter.get("/analytics/trend", async (req, res) => {
  try {
    const rows = await db.select().from(retainAnalytics)
      .where(eq(retainAnalytics.tenantId, req.tenantId!))
      .orderBy(asc(retainAnalytics.snapshotDate));

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const data = rows.map(r => {
      const d = new Date(r.snapshotDate);
      const month = `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      return {
        month,
        totalCustomers: r.totalCustomers,
        activeCustomers: r.activeCustomers,
        churnedCustomers: r.churnedCustomers,
        atRiskCustomers: r.atRiskCustomers,
        churnRate: r.churnRate,
        mrr: r.mrr,
        revenueAtRisk: r.revenueAtRisk,
        avgHealthScore: r.avgHealthScore,
      };
    });
    res.json(data);
  } catch (err) {
    console.error("Retain analytics trend error:", err);
    res.status(500).json({ error: "Erro ao buscar tendência" });
  }
});

// ─── POST /actions ───────────────────────────────────────────────────────────
retainRouter.post("/actions", async (req, res) => {
  try {
    const { customerId, type, description, priority, dueDate } = req.body;
    if (!customerId || !UUID_RE.test(customerId))
      return res.status(400).json({ error: "customerId inválido" });
    if (!type || !VALID_ACTION_TYPES.includes(type))
      return res.status(400).json({ error: `type deve ser um de: ${VALID_ACTION_TYPES.join(", ")}` });
    const [action] = await db.insert(retainActions).values({
      tenantId: req.tenantId!,
      customerId,
      type,
      description,
      priority: priority || "medium",
      dueDate,
      assignedTo: req.session.userId,
    }).returning();
    res.status(201).json(action);
  } catch (err) {
    console.error("Retain create action error:", err);
    res.status(500).json({ error: "Erro ao criar ação" });
  }
});

// ─── GET /uploads ────────────────────────────────────────────────────────────
retainRouter.get("/uploads", async (req, res) => {
  try {
    const rows = await db.select().from(retainUploads)
      .where(eq(retainUploads.tenantId, req.tenantId!))
      .orderBy(desc(retainUploads.uploadedAt));
    res.json(rows);
  } catch (err) {
    console.error("Retain uploads error:", err);
    res.status(500).json({ error: "Erro ao buscar uploads" });
  }
});

// ─── DELETE /uploads/:id ─────────────────────────────────────────────────────
// Removes the upload audit row plus every customer/prediction/alert stamped
// with sourceUploadId = :id. Rows with NULL sourceUploadId (pre-migration or
// created by other uploads) are untouched.
retainRouter.delete("/uploads/:id", async (req, res) => {
  const tenantId = req.tenantId!;
  const uploadId = req.params.id;
  if (!UUID_RE.test(uploadId)) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const [existing] = await db.select({ id: retainUploads.id })
      .from(retainUploads)
      .where(and(eq(retainUploads.id, uploadId), eq(retainUploads.tenantId, tenantId)))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Upload não encontrado" });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Identify customers that will be removed so we can clean their history
      const toRemove = await tx.select({ id: customers.id })
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.sourceUploadId, uploadId),
        ));
      const customerIds = toRemove.map((c) => c.id);

      const delAlerts = await tx.delete(retainAlerts)
        .where(and(eq(retainAlerts.tenantId, tenantId), eq(retainAlerts.sourceUploadId, uploadId)))
        .returning({ id: retainAlerts.id });
      const delPreds = await tx.delete(retainPredictions)
        .where(and(eq(retainPredictions.tenantId, tenantId), eq(retainPredictions.sourceUploadId, uploadId)))
        .returning({ id: retainPredictions.id });

      // Clean downstream references tied to the customers being removed.
      // These tables don't carry sourceUploadId but would block deletion via FK.
      if (customerIds.length > 0) {
        await tx.delete(retainAlerts)
          .where(and(
            eq(retainAlerts.tenantId, tenantId),
            inArray(retainAlerts.customerId, customerIds),
          ));
        await tx.delete(retainPredictions)
          .where(and(
            eq(retainPredictions.tenantId, tenantId),
            inArray(retainPredictions.customerId, customerIds),
          ));
        await tx.delete(customerScoreHistory)
          .where(and(
            eq(customerScoreHistory.tenantId, tenantId),
            inArray(customerScoreHistory.customerId, customerIds),
          ));
        await tx.delete(customerNotes)
          .where(inArray(customerNotes.customerId, customerIds));
        await tx.delete(retainActions)
          .where(and(
            eq(retainActions.tenantId, tenantId),
            inArray(retainActions.customerId, customerIds),
          ));
      }

      const delCustomers = await tx.delete(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.sourceUploadId, uploadId)))
        .returning({ id: customers.id });

      await tx.delete(retainUploads)
        .where(and(eq(retainUploads.id, uploadId), eq(retainUploads.tenantId, tenantId)));

      return {
        alerts: delAlerts.length,
        predictions: delPreds.length,
        customers: delCustomers.length,
      };
    });

    res.json({
      deleted: {
        customers: result.customers,
        predictions: result.predictions,
        alerts: result.alerts,
        upload: true,
      },
    });
  } catch (err: any) {
    console.error("Retain delete upload error:", err);
    res.status(500).json({ error: "Erro ao remover upload" });
  }
});

// ─── POST /uploads ───────────────────────────────────────────────────────────

retainRouter.post("/uploads", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Arquivo não enviado" });

  let uploadRow: typeof retainUploads.$inferSelect | undefined;
  try {
    // Parse mapping sent as JSON string in form field
    let rawMapping: Record<string, string> = {};
    try { rawMapping = JSON.parse(req.body.mapping ?? "{}"); } catch { /* no mapping */ }

    // Normalize mapping keys: the column mapper returns "dim"-prefixed keys
    // (dimRevenue, dimSatisfaction, etc.) and "customerCode", but the handler
    // uses bare keys (revenue, satisfaction, id). Normalize both.
    const MAPPER_KEY_ALIASES: Record<string, string> = { customerCode: "id" };
    const mapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawMapping)) {
      let normalized = k.startsWith("dim") ? k.charAt(3).toLowerCase() + k.slice(4) : k;
      normalized = MAPPER_KEY_ALIASES[normalized] ?? normalized;
      mapping[normalized] = v;
    }

    const tenantId = req.tenantId!;

    [uploadRow] = await db.insert(retainUploads).values({
      tenantId,
      filename: file.originalname,
      status: "processing",
      columnMapping: rawMapping,
      uploadedBy: req.session.userId,
    }).returning();

    // Read and parse CSV (encoding-aware: UTF-8, Latin-1, Windows-1252)
    const csvResult = readCsvFile(file.path);

    if (csvResult.errors.length > 0 && csvResult.data.length === 0) {
      await db.update(retainUploads)
        .set({ status: "failed", errorMessage: csvResult.errors[0].message })
        .where(eq(retainUploads.id, uploadRow.id));
      return res.status(400).json({ error: "CSV inválido: " + csvResult.errors[0].message });
    }

    const parsed = { data: csvResult.data };

    // Helper functions
    const get = (row: Record<string, string>, key: string) => {
      const csvCol = mapping[key];
      return csvCol ? row[csvCol] : undefined;
    };
    // toFloat now handles BR format (R$ 1.234,56 → 1234.56)
    const toFloat = (v: string | undefined) => parseNumber(v);
    const toInt = (v: string | undefined) => {
      const n = parseNumber(v);
      return n != null ? Math.round(n) : null;
    };

    // Detect NPS scale from the satisfaction column before processing rows
    const satisfactionColName = mapping["satisfaction"];
    const rawSatisfactionValues = satisfactionColName
      ? csvResult.data.map((row) => row[satisfactionColName])
      : [];
    const { scale: satisfactionScale, normalize: normalizeSatisfaction } =
      buildSatisfactionNormalizer(rawSatisfactionValues);

    // Detect if there's a date column for contractRemainingDays
    const contractDateColName = mapping["contractRemainingDays"];
    const hasDateValues = contractDateColName
      ? csvResult.data.some((row) => {
          const v = row[contractDateColName];
          return v != null && /\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(v.trim());
        })
      : false;

    // Load existing customers for upsert check (match by code or email)
    const existingCustomers = await db
      .select({ id: customers.id, customerCode: customers.customerCode, email: customers.email })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));
    const existingByCode = new Map(
      existingCustomers
        .filter((c) => c.customerCode)
        .map((c) => [c.customerCode!, c.id]),
    );
    const existingByEmail = new Map(
      existingCustomers
        .filter((c) => c.email)
        .map((c) => [c.email!.toLowerCase(), c.id]),
    );

    let rowsCreated = 0;
    let rowsUpdated = 0;
    let rowsSkipped = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    // Process each row
    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      try {
        const name = get(row, "name") ?? row[Object.keys(row)[0]] ?? "";
        if (!name || name.trim() === "") {
          rowsSkipped++;
          errors.push({ row: i + 1, reason: "Nome vazio" });
          continue;
        }

        const customerCode = get(row, "id") ?? undefined;

        // Normalize satisfaction to 0-100 (handles NPS 0-10, Likert 1-5, percent 0-100)
        const rawSatisfactionVal = toFloat(get(row, "satisfaction"));
        const normalizedSatisfaction = rawSatisfactionVal != null
          ? normalizeSatisfaction(rawSatisfactionVal)
          : null;

        // Handle contractRemainingDays: may be a date (DD/MM/YYYY) or a number
        let contractRemainingDays: number | null = null;
        const rawContractVal = get(row, "contractRemainingDays");
        if (rawContractVal) {
          if (hasDateValues) {
            const d = parseDate(rawContractVal);
            contractRemainingDays = d ? daysFromToday(d) : null;
          } else {
            contractRemainingDays = toInt(rawContractVal);
          }
        }

        const customerData = {
          tenantId,
          customerCode,
          name: name.trim(),
          email: get(row, "email") ?? undefined,
          phone: get(row, "phone") ?? undefined,
          city: get(row, "city") ?? undefined,
          state: get(row, "state") ?? undefined,
          segment: get(row, "segment") ?? undefined,
          dimRevenue: toFloat(get(row, "revenue")),
          dimPaymentRegularity: toFloat(get(row, "paymentRegularity")),
          dimTenureDays: toInt(get(row, "tenureDays")),
          dimInteractionFrequency: toFloat(get(row, "interactionFrequency")),
          dimSupportVolume: toFloat(get(row, "supportVolume")),
          dimSatisfaction: normalizedSatisfaction,
          dimContractRemainingDays: contractRemainingDays,
          dimUsageIntensity: toFloat(get(row, "usageIntensity")),
          dimRecencyDays: toInt(get(row, "recencyDays")),
          rawData: row,
          updatedAt: new Date(),
        };

        // Upsert: match by customer code first, then email as fallback
        const customerEmailLower = get(row, "email")?.toLowerCase();
        const existingId =
          (customerCode ? existingByCode.get(customerCode) : undefined) ??
          (customerEmailLower ? existingByEmail.get(customerEmailLower) : undefined);

        if (existingId) {
          await db.update(customers)
            .set(customerData)
            .where(eq(customers.id, existingId));
          rowsUpdated++;
        } else {
          const [inserted] = await db.insert(customers)
            .values({ ...customerData, status: "active" as const, sourceUploadId: uploadRow!.id })
            .returning({ id: customers.id });
          if (customerCode) existingByCode.set(customerCode, inserted.id);
          if (customerEmailLower) existingByEmail.set(customerEmailLower, inserted.id);
          rowsCreated++;
        }
      } catch (rowErr: any) {
        rowsSkipped++;
        errors.push({ row: i + 1, reason: rowErr?.message ?? "Erro desconhecido" });
      }
    }

    // ── Post-processing pipeline ─────────────────────────────────────────
    const { predictionsGenerated } = await runRetainPredictions(tenantId);
    await generateAnalyticsSnapshot(tenantId);
    await generateChurnCauses(tenantId);
    const { alertsGenerated } = await generateAlerts(tenantId);
    await generateIcpClusters(tenantId); // feedback loop!

    // ── Compute intelligence summary ──────────────────────────────────────
    const [criticalCustomers, analyticsRows, scoreDropData] = await Promise.all([
      db.select().from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          sql`${customers.riskLevel} IN ('critical', 'high')`,
        ))
        .orderBy(desc(customers.dimRevenue))
        .limit(3),
      db.select().from(retainAnalytics)
        .where(eq(retainAnalytics.tenantId, tenantId))
        .orderBy(desc(retainAnalytics.snapshotDate))
        .limit(2),
      db.select({
        customerId: customerScoreHistory.customerId,
        score: customerScoreHistory.healthScore,
        date: customerScoreHistory.snapshotDate,
      }).from(customerScoreHistory)
        .where(eq(customerScoreHistory.tenantId, tenantId))
        .orderBy(desc(customerScoreHistory.snapshotDate))
        .limit(500),
    ]);

    // Top priority: highest revenue × churnProbability
    let topPriority = null;
    const topCustomerRows = await db.select({
      customer: customers,
      prediction: retainPredictions,
    }).from(customers)
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
      .limit(1);

    if (topCustomerRows.length > 0) {
      const tp = topCustomerRows[0];
      const shapVals = (tp.prediction.shapValues as any[]) ?? [];
      const topFactor = shapVals.find((s: any) => s.direction === "negative");
      topPriority = {
        customerId: tp.customer.id,
        name: tp.customer.name,
        segment: tp.customer.segment,
        revenue: tp.customer.dimRevenue ?? 0,
        churnProbability: tp.prediction.churnProbability ?? 0,
        riskLevel: tp.prediction.riskLevel,
        topFactor: topFactor ? { label: topFactor.label, impact: topFactor.impact } : null,
        recommendedAction: tp.prediction.recommendedAction,
      };
    }

    // Delta revenue at risk
    const deltaRevenueAtRisk = analyticsRows.length >= 2
      ? (analyticsRows[0].revenueAtRisk ?? 0) - (analyticsRows[1].revenueAtRisk ?? 0)
      : 0;

    // Score drops > 15 pts (compare latest vs previous snapshot per customer)
    const byCustomer = new Map<string, number[]>();
    for (const row of scoreDropData) {
      if (!byCustomer.has(row.customerId)) byCustomer.set(row.customerId, []);
      byCustomer.get(row.customerId)!.push(row.score ?? 0);
    }
    let scoreDrops = 0;
    for (const scores of byCustomer.values()) {
      if (scores.length >= 2 && scores[0] - scores[1] < -15) scoreDrops++;
    }

    // Contracts expiring in 30d
    const [contractsRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        sql`${customers.dimContractRemainingDays} < 30`,
        sql`${customers.dimContractRemainingDays} > 0`,
        sql`${customers.riskLevel} != 'low'`,
      ));

    const intelligenceSummary = {
      newCriticalCustomers: criticalCustomers.map(c => ({
        id: c.id,
        name: c.name,
        segment: c.segment,
        revenue: c.dimRevenue ?? 0,
        riskLevel: c.riskLevel,
        churnProbability: c.churnProbability ?? 0,
        healthScore: c.healthScore ?? 0,
      })),
      deltaRevenueAtRisk: Math.round(deltaRevenueAtRisk),
      topPriority,
      contractsExpiring30d: contractsRow?.count ?? 0,
      scoreDrops,
      totalRevenueAtRisk: analyticsRows[0]?.revenueAtRisk ?? 0,
    };

    // Update upload record with final stats
    const [done] = await db.update(retainUploads)
      .set({
        status: "completed",
        rowsCount: parsed.data.length,
        rowsCreated,
        rowsUpdated,
        rowsSkipped,
        processedAt: new Date(),
      })
      .where(eq(retainUploads.id, uploadRow.id))
      .returning();

    res.status(201).json({
      ...done,
      predictionsGenerated,
      alertsGenerated,
      intelligenceSummary,
      errors: errors.slice(0, 20),
      detectedEncoding: csvResult.detectedEncoding,
      detectedDelimiter: csvResult.detectedDelimiter,
      satisfactionScale: satisfactionScale ?? "percent-100",
    });
  } catch (err: any) {
    console.error("Retain upload error:", err);
    if (uploadRow) {
      await db.update(retainUploads)
        .set({ status: "failed", errorMessage: String(err?.message ?? err) })
        .where(eq(retainUploads.id, uploadRow.id))
        .catch(() => {});
    }
    res.status(500).json({ error: "Erro ao processar upload" });
  } finally {
    if (file?.path) fs.unlink(file.path, () => {});
  }
});

// ─── POST /upload/suggest-mapping ───────────────────────────────────────────
retainRouter.post("/upload/suggest-mapping", async (req, res) => {
  try {
    const { headers, sampleRows } = req.body;
    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({ error: "headers é obrigatório (array de strings)" });
    }

    const tenantId = req.tenantId!;

    // Mapping memory: look up the most recent accepted mapping for this tenant
    const [lastUpload] = await db.select({ columnMapping: retainUploads.columnMapping })
      .from(retainUploads)
      .where(and(eq(retainUploads.tenantId, tenantId), eq(retainUploads.status, "completed")))
      .orderBy(desc(retainUploads.uploadedAt))
      .limit(1);

    const historicalMapping = (lastUpload?.columnMapping ?? {}) as Record<string, string>;
    // Invert: { dimKey → csvColumn } → { csvColumn → dimKey }
    const csvColToDim: Record<string, string> = {};
    for (const [dimKey, csvCol] of Object.entries(historicalMapping)) {
      if (csvCol) csvColToDim[csvCol] = dimKey;
    }

    const suggestions = suggestMapping(headers, sampleRows ?? [], "retain");

    // Overlay historical memory: if we've seen this exact CSV column before,
    // upgrade to high confidence with source = "historical"
    const enriched = suggestions.map((s) => {
      const historicalDim = csvColToDim[s.csvColumn];
      if (historicalDim && (s.suggestedDimension === null || s.confidenceScore < 0.95)) {
        return {
          ...s,
          suggestedDimension: historicalDim,
          confidenceScore: 0.97,
          confidence: "high" as const,
          reason: `Reconhecido por memória do tenant (último upload aceito)`,
          source: "historical",
        };
      }
      return { ...s, source: "inference" };
    });

    res.json(enriched);
  } catch (err) {
    console.error("Suggest mapping error:", err);
    res.status(500).json({ error: "Erro ao sugerir mapeamento" });
  }
});

// ─── POST /upload/preview ────────────────────────────────────────────────────
// Receives { mapping, sampleRows } — returns N interpreted rows for human review
// before the user commits the upload.
retainRouter.post("/upload/preview", async (req, res) => {
  try {
    const { mapping, sampleRows } = req.body as {
      mapping: Record<string, string>;
      sampleRows: Record<string, string>[];
    };
    if (!mapping || !sampleRows || !Array.isArray(sampleRows)) {
      return res.status(400).json({ error: "mapping e sampleRows são obrigatórios" });
    }

    const get = (row: Record<string, string>, key: string) => {
      const col = mapping[key];
      return col ? row[col] : undefined;
    };

    // Detect satisfaction scale from the sample
    const satisfactionColName = mapping["satisfaction"];
    const rawSatValues = satisfactionColName
      ? sampleRows.map((r) => r[satisfactionColName])
      : [];
    const { scale: satisfactionScale, normalize: normalizeSatisfaction } =
      buildSatisfactionNormalizer(rawSatValues);

    // Detect if contractRemainingDays column has date values
    const contractColName = mapping["contractRemainingDays"];
    const hasDateValues = contractColName
      ? sampleRows.some((r) => {
          const v = r[contractColName];
          return v != null && /\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(v.trim());
        })
      : false;

    // 9 standard dimensions
    const ALL_DIMS = [
      "revenue", "paymentRegularity", "tenureDays", "interactionFrequency",
      "supportVolume", "satisfaction", "contractRemainingDays", "usageIntensity", "recencyDays",
    ];
    const mappedDims = ALL_DIMS.filter((d) => mapping[d]);
    const missingDimensions = ALL_DIMS.filter((d) => !mapping[d]);

    const previewRows = sampleRows.slice(0, 5).map((row) => {
      // Satisfaction
      const rawSat = parseNumber(get(row, "satisfaction"));
      const normalizedSat = rawSat != null ? normalizeSatisfaction(rawSat) : null;
      const satLabel = normalizedSat != null
        ? normalizedSat >= 70 ? `${rawSat} (promotor)` : normalizedSat >= 50 ? `${rawSat} (neutro)` : `${rawSat} (detrator)`
        : null;

      // Contract remaining days
      const rawContract = get(row, "contractRemainingDays");
      let contractDays: number | null = null;
      let contractLabel: string | null = null;
      if (rawContract) {
        if (hasDateValues) {
          const d = parseDate(rawContract);
          contractDays = d ? daysFromToday(d) : null;
          contractLabel = contractDays != null ? `${contractDays} dias (de ${rawContract})` : null;
        } else {
          contractDays = parseNumber(rawContract) != null ? Math.round(parseNumber(rawContract)!) : null;
          contractLabel = contractDays != null ? `${contractDays} dias` : null;
        }
      }

      // Revenue
      const rawRevenue = get(row, "revenue");
      const revenueVal = parseNumber(rawRevenue);
      const revenueLabel = revenueVal != null
        ? `R$ ${revenueVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : null;

      return {
        name: get(row, "name") ?? Object.values(row)[0] ?? "",
        email: get(row, "email") ?? null,
        revenue: revenueLabel,
        satisfaction: satLabel,
        contractRemainingDays: contractLabel,
        paymentRegularity: parseNumber(get(row, "paymentRegularity")),
        supportVolume: parseNumber(get(row, "supportVolume")),
        usageIntensity: parseNumber(get(row, "usageIntensity")),
        missingDimensions,
      };
    });

    res.json({
      previewRows,
      satisfactionScale: satisfactionScale ?? "percent-100",
      dateFormatDetected: hasDateValues,
      mappedDimensions: mappedDims.length,
      totalDimensions: ALL_DIMS.length,
      missingDimensions,
    });
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: "Erro ao gerar preview" });
  }
});

// ─── GET /alerts ────────────────────────────────────────────────────────────
retainRouter.get("/alerts", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const severity = req.query.severity as string | undefined;
    const isRead = req.query.isRead as string | undefined;

    const conditions: SQL[] = [eq(retainAlerts.tenantId, tenantId)];
    if (severity) conditions.push(eq(retainAlerts.severity, severity as any));
    if (isRead === "true") conditions.push(eq(retainAlerts.isRead, true));
    if (isRead === "false") conditions.push(eq(retainAlerts.isRead, false));

    const rows = await db
      .select({
        alert: retainAlerts,
        customerName: customers.name,
      })
      .from(retainAlerts)
      .innerJoin(customers, eq(retainAlerts.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(retainAlerts.createdAt))
      .limit(50);

    const data = rows.map((r) => ({
      id: r.alert.id,
      customerId: r.alert.customerId,
      customerName: r.customerName,
      type: r.alert.type,
      message: r.alert.message,
      severity: r.alert.severity,
      isRead: r.alert.isRead,
      createdAt: r.alert.createdAt,
      timeAgo: formatTimeAgo(r.alert.createdAt),
    }));

    res.json(data);
  } catch (err) {
    console.error("Retain alerts error:", err);
    res.status(500).json({ error: "Erro ao buscar alertas" });
  }
});

// ─── PATCH /alerts/:id/read ─────────────────────────────────────────────────
retainRouter.patch("/alerts/:id/read", async (req, res) => {
  try {
    const [updated] = await db.update(retainAlerts)
      .set({ isRead: true })
      .where(and(eq(retainAlerts.id, req.params.id), eq(retainAlerts.tenantId, req.tenantId!)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Alerta não encontrado" });
    res.json(updated);
  } catch (err) {
    console.error("Mark alert read error:", err);
    res.status(500).json({ error: "Erro ao atualizar alerta" });
  }
});

// ─── GET /data-freshness ────────────────────────────────────────────────────
retainRouter.get("/data-freshness", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const [lastUpload] = await db.select()
      .from(retainUploads)
      .where(and(eq(retainUploads.tenantId, tenantId), eq(retainUploads.status, "completed")))
      .orderBy(sql`${retainUploads.processedAt} DESC NULLS LAST`)
      .limit(1);

    const [countRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    res.json({
      lastUploadAt: lastUpload?.processedAt ?? lastUpload?.uploadedAt ?? null,
      lastUploadFilename: lastUpload?.filename ?? null,
      totalRecords: countRow?.count ?? 0,
    });
  } catch (err) {
    console.error("Data freshness error:", err);
    res.status(500).json({ error: "Erro ao buscar freshness" });
  }
});

// ─── GET /revenue-by-segment ────────────────────────────────────────────────
retainRouter.get("/revenue-by-segment", async (req, res) => {
  try {
    const rows = await db.select({
      segment: customers.segment,
      totalRevenue: sql<number>`coalesce(sum(${customers.dimRevenue}), 0)::real`,
      count: sql<number>`count(*)::int`,
    })
      .from(customers)
      .where(and(eq(customers.tenantId, req.tenantId!), sql`${customers.status} != 'churned'`))
      .groupBy(customers.segment);

    res.json(rows.map((r) => ({
      segment: r.segment ?? "Sem segmento",
      totalRevenue: r.totalRevenue,
      count: r.count,
    })));
  } catch (err) {
    console.error("Revenue by segment error:", err);
    res.status(500).json({ error: "Erro ao buscar receita por segmento" });
  }
});

// ─── GET /customers/:id/score-history ───────────────────────────────────────
retainRouter.get("/customers/:id/score-history", async (req, res) => {
  try {
    const rows = await db.select()
      .from(customerScoreHistory)
      .where(and(
        eq(customerScoreHistory.customerId, req.params.id),
        eq(customerScoreHistory.tenantId, req.tenantId!),
      ))
      .orderBy(asc(customerScoreHistory.snapshotDate));
    res.json(rows);
  } catch (err) {
    console.error("Score history error:", err);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

// ─── GET /customers/:id/notes ───────────────────────────────────────────────
retainRouter.get("/customers/:id/notes", async (req, res) => {
  try {
    const rows = await db.select()
      .from(customerNotes)
      .where(and(
        eq(customerNotes.customerId, req.params.id),
        eq(customerNotes.tenantId, req.tenantId!),
      ))
      .orderBy(desc(customerNotes.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("Customer notes error:", err);
    res.status(500).json({ error: "Erro ao buscar notas" });
  }
});

// ─── POST /customers/:id/notes ──────────────────────────────────────────────
retainRouter.post("/customers/:id/notes", async (req, res) => {
  try {
    const { type, content } = req.body;
    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Conteúdo é obrigatório" });
    }
    const [note] = await db.insert(customerNotes).values({
      tenantId: req.tenantId!,
      customerId: req.params.id,
      userId: req.session.userId,
      type: type ?? "note",
      content: content.trim(),
    }).returning();
    res.status(201).json(note);
  } catch (err) {
    console.error("Create note error:", err);
    res.status(500).json({ error: "Erro ao criar nota" });
  }
});

// ─── GET /revenue-analytics ─────────────────────────────────────────────────
retainRouter.get("/revenue-analytics", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const snapshots = await db.select().from(retainAnalytics)
      .where(eq(retainAnalytics.tenantId, tenantId))
      .orderBy(desc(retainAnalytics.snapshotDate)).limit(2);

    const latest = snapshots[0];
    const previous = snapshots[1];

    const mrrResult = await db.select({
      total: sql<number>`coalesce(sum(${customers.dimRevenue}), 0)::real`,
    }).from(customers).where(and(
      eq(customers.tenantId, tenantId),
      sql`${customers.status} != 'churned'`,
    ));
    const mrr = mrrResult[0]?.total ?? 0;

    const mrrPrevious = previous?.mrr ?? 0;
    const mrrGrowth = mrrPrevious > 0 ? Math.round(((mrr - mrrPrevious) / mrrPrevious) * 1000) / 10 : 0;
    const nrr = mrrPrevious > 0 ? Math.round((mrr / mrrPrevious) * 1000) / 10 : 0;

    const previousDate = previous?.snapshotDate ?? "1970-01-01";
    const newCustomerRevenueResult = await db.select({
      total: sql<number>`coalesce(sum(${customers.dimRevenue}), 0)::real`,
    }).from(customers).where(and(
      eq(customers.tenantId, tenantId),
      sql`${customers.status} != 'churned'`,
      sql`${customers.createdAt} > ${previousDate}::timestamp`,
    ));
    const newCustomerRevenue = newCustomerRevenueResult[0]?.total ?? 0;

    const grr = mrrPrevious > 0 ? Math.round(((mrr - newCustomerRevenue) / mrrPrevious) * 1000) / 10 : 0;

    const churnedRevenueResult = await db.select({
      total: sql<number>`coalesce(sum(${customers.dimRevenue}), 0)::real`,
    }).from(customers).where(and(
      eq(customers.tenantId, tenantId),
      eq(customers.status, "churned"),
      sql`${customers.churnDate} > ${previousDate}`,
    ));
    const churnRevenue = churnedRevenueResult[0]?.total ?? 0;

    const existingRevenuePrevious = mrrPrevious - newCustomerRevenue;
    const existingRevenueCurrent = mrr - newCustomerRevenue;
    const revenueDiff = existingRevenueCurrent - existingRevenuePrevious + churnRevenue;
    const expansion = Math.max(revenueDiff, 0);
    const contraction = Math.min(revenueDiff, 0);

    const waterfall = [
      { category: "MRR Início", value: mrrPrevious },
      { category: "Novos", value: newCustomerRevenue },
      { category: "Expansão", value: expansion },
      { category: "Contração", value: contraction },
      { category: "Churn", value: -churnRevenue },
      { category: "MRR Fim", value: mrr },
    ];

    const revenueByRiskRows = await db.select({
      riskLevel: customers.riskLevel,
      revenue: sql<number>`coalesce(sum(${customers.dimRevenue}), 0)::real`,
      count: sql<number>`count(*)::int`,
    }).from(customers).where(and(
      eq(customers.tenantId, tenantId),
      sql`${customers.status} != 'churned'`,
    )).groupBy(customers.riskLevel);

    const revenueByRisk = revenueByRiskRows.map(r => ({
      riskLevel: r.riskLevel ?? "low",
      revenue: r.revenue,
      count: r.count,
    }));

    res.json({ mrr, mrrPrevious, mrrGrowth, nrr, grr, waterfall, revenueByRisk });
  } catch (err) {
    console.error("Revenue analytics error:", err);
    res.status(500).json({ error: "Erro ao buscar revenue analytics" });
  }
});

// ─── GET /expansion-opportunities ────────────────────────────────────────────
retainRouter.get("/expansion-opportunities", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    // Healthy customers (health > 65) whose revenue is below their segment's median
    const rows = await db.execute(sql`
      WITH segment_medians AS (
        SELECT segment,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dim_revenue) AS median_revenue,
               AVG(dim_revenue) AS avg_revenue
        FROM customers
        WHERE tenant_id = ${tenantId}
          AND status != 'churned'
          AND dim_revenue IS NOT NULL
        GROUP BY segment
      )
      SELECT
        c.id, c.name, c.segment, c.health_score, c.dim_revenue, c.risk_level,
        sm.median_revenue,
        GREATEST(0, sm.median_revenue - c.dim_revenue) AS gap,
        GREATEST(0, sm.median_revenue - c.dim_revenue) * 12 AS annual_potential
      FROM customers c
      JOIN segment_medians sm ON sm.segment = c.segment
      WHERE c.tenant_id = ${tenantId}
        AND c.status != 'churned'
        AND c.health_score > 55
        AND c.dim_revenue < sm.median_revenue * 0.92
      ORDER BY annual_potential DESC
      LIMIT 20
    `);

    const opportunities = (rows.rows as any[]).map(r => ({
      id: r.id,
      name: r.name,
      segment: r.segment,
      healthScore: parseFloat(r.health_score) || 0,
      revenue: parseFloat(r.dim_revenue) || 0,
      segmentMedian: parseFloat(r.median_revenue) || 0,
      gap: parseFloat(r.gap) || 0,
      annualPotential: parseFloat(r.annual_potential) || 0,
      riskLevel: r.risk_level,
    }));

    const totalPotential = opportunities.reduce((sum, o) => sum + o.annualPotential, 0);

    res.json({ opportunities, totalCount: opportunities.length, totalAnnualPotential: totalPotential });
  } catch (err) {
    console.error("Expansion opportunities error:", err);
    res.status(500).json({ error: "Erro ao buscar oportunidades de expansão" });
  }
});

// ─── GET /analytics-history ───────────────────────────────────────────────────
retainRouter.get("/analytics-history", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const rows = await db.select({
      snapshotDate: retainAnalytics.snapshotDate,
      mrr: retainAnalytics.mrr,
      churnRate: retainAnalytics.churnRate,
      avgHealthScore: retainAnalytics.avgHealthScore,
      revenueAtRisk: retainAnalytics.revenueAtRisk,
    })
      .from(retainAnalytics)
      .where(eq(retainAnalytics.tenantId, tenantId))
      .orderBy(asc(retainAnalytics.snapshotDate))
      .limit(13);

    // Compute NRR for each month vs previous
    const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const data = rows.map((r, i) => {
      const d = new Date(String(r.snapshotDate) + "T12:00:00Z");
      const prev = rows[i - 1];
      const nrr = prev?.mrr && prev.mrr > 0 ? Math.round(((r.mrr ?? 0) / prev.mrr) * 1000) / 10 : null;
      return {
        month: `${PT_MONTHS[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`,
        mrr: r.mrr,
        churnRate: r.churnRate,
        avgHealthScore: r.avgHealthScore,
        revenueAtRisk: r.revenueAtRisk,
        nrr,
      };
    });

    res.json(data);
  } catch (err) {
    console.error("Analytics history error:", err);
    res.status(500).json({ error: "Erro ao buscar histórico analítico" });
  }
});

// ─── GET /renewals ──────────────────────────────────────────────────────────
retainRouter.get("/renewals", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const rows = await db.select().from(customers).where(and(
      eq(customers.tenantId, tenantId),
      sql`${customers.dimContractRemainingDays} IS NOT NULL`,
      sql`${customers.dimContractRemainingDays} < 90`,
    )).orderBy(asc(customers.dimContractRemainingDays));

    const data = rows.map(c => ({
      id: c.id,
      name: c.name,
      segment: c.segment,
      dimRevenue: c.dimRevenue,
      healthScore: c.healthScore,
      riskLevel: c.riskLevel,
      contractRemainingDays: c.dimContractRemainingDays,
    }));

    res.json(data);
  } catch (err) {
    console.error("Renewals error:", err);
    res.status(500).json({ error: "Erro ao buscar renovações" });
  }
});

// ─── POST /customers/:id/churn ──────────────────────────────────────────────
retainRouter.post("/customers/:id/churn", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const [updated] = await db.update(customers)
      .set({
        status: "churned",
        churnDate: new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
      })
      .where(and(eq(customers.id, req.params.id), eq(customers.tenantId, tenantId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Cliente não encontrado" });

    // Recalculate ICP clusters (feedback loop)
    await generateIcpClusters(tenantId);

    res.json({ ...mapCustomerToDto(updated), message: "Cliente marcado como churned. ICP recalculado." });
  } catch (err) {
    console.error("Mark churn error:", err);
    res.status(500).json({ error: "Erro ao marcar churn" });
  }
});

// ─── GET /voc — Voz do Cliente ───────────────────────────────────────────────
// Aggregates CX-focused metrics from existing customer data:
//   - NPS score derived from dimSatisfaction (0-100 scale)
//   - NPS distribution (promoters ≥70, neutrals 50-69, detractors <50)
//   - Detractors ordered by revenue (biggest revenue risk first)
//   - Ticket theme frequency (from rawData.tickets_tema / ticket_tema fields)
//   - Open actions for detractor customers
retainRouter.get("/voc", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const allCustomers = await db.select().from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        sql`${customers.status} IN ('active', 'at_risk')`,
      ));

    if (allCustomers.length === 0) {
      return res.json({
        nps: null,
        npsDistribution: { promoters: 0, neutrals: 0, detractors: 0, total: 0 },
        detractorsByRevenue: [],
        ticketThemes: [],
        detractorActions: [],
      });
    }

    // ── NPS from dimSatisfaction (0-100 scale) ────────────────────────────
    // Promoters: ≥ 70 (maps to NPS 7-10), Neutrals: 50-69, Detractors: < 50
    const withSatisfaction = allCustomers.filter((c) => c.dimSatisfaction != null);
    const promoters = withSatisfaction.filter((c) => c.dimSatisfaction! >= 70);
    const neutrals = withSatisfaction.filter((c) => c.dimSatisfaction! >= 50 && c.dimSatisfaction! < 70);
    const detractors = withSatisfaction.filter((c) => c.dimSatisfaction! < 50);

    const total = withSatisfaction.length;
    const nps = total > 0
      ? Math.round(((promoters.length - detractors.length) / total) * 100)
      : null;

    // ── Detractors ordered by revenue ─────────────────────────────────────
    const detractorsByRevenue = detractors
      .sort((a, b) => (b.dimRevenue ?? 0) - (a.dimRevenue ?? 0))
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        revenue: c.dimRevenue,
        satisfaction: c.dimSatisfaction,
        satisfactionLabel: c.dimSatisfaction != null
          ? `${Math.round(c.dimSatisfaction / 10)} / 10`
          : null,
        segment: c.segment,
      }));

    const totalDetractorRevenue = detractors.reduce((sum, c) => sum + (c.dimRevenue ?? 0), 0);

    // ── Ticket theme frequency ─────────────────────────────────────────────
    // Look in rawData for common ticket theme field names
    const themeFieldCandidates = [
      "tickets_tema", "ticket_tema", "tema_ticket", "tema_chamado",
      "categoria_ticket", "Categoria do Ticket", "Tema do chamado",
      "ticket_category", "ticket_theme",
    ];
    const themeCounts: Record<string, number> = {};
    for (const c of allCustomers) {
      const raw = c.rawData as Record<string, string> | null;
      if (!raw) continue;
      for (const field of themeFieldCandidates) {
        const val = raw[field];
        if (val && val.trim() !== "") {
          const theme = val.trim();
          themeCounts[theme] = (themeCounts[theme] ?? 0) + 1;
          break; // only count once per customer
        }
      }
    }
    const ticketThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, count }));

    // ── Verbatims (NPS comments) ───────────────────────────────────────────
    const verbatimFieldCandidates = [
      "nps_verbatim", "verbatim", "comentario_nps", "Comentário NPS",
      "feedback_aberto", "Feedback Aberto", "nps_comment",
    ];
    // Show verbatims from non-promoters (detractors + neutrals), fall back to any customer with a comment
    const verbatimCandidates = [
      ...detractors,
      ...neutrals,
      ...promoters,
    ].slice(0, 20);
    const verbatims: Array<{ name: string; text: string; satisfaction: number | null }> = [];
    for (const c of verbatimCandidates) {
      if (verbatims.length >= 8) break;
      const raw = c.rawData as Record<string, string> | null;
      if (!raw) continue;
      for (const field of verbatimFieldCandidates) {
        const val = raw[field];
        if (val && val.trim() !== "") {
          verbatims.push({ name: c.name, text: val.trim(), satisfaction: c.dimSatisfaction });
          break;
        }
      }
    }

    // ── Detractor actions (pending/in_progress actions for detractor customers) ──
    const detractorIds = detractors.map((c) => c.id);
    let detractorActions: any[] = [];
    if (detractorIds.length > 0) {
      const rawActions = await db.select({
          id: retainActions.id,
          customerId: retainActions.customerId,
          type: retainActions.type,
          description: retainActions.description,
          priority: retainActions.priority,
          dueDate: retainActions.dueDate,
          customerName: customers.name,
          customerRevenue: customers.dimRevenue,
        })
        .from(retainActions)
        .innerJoin(customers, eq(retainActions.customerId, customers.id))
        .where(
          and(
            eq(retainActions.tenantId, tenantId),
            sql`${retainActions.status} IN ('pending', 'in_progress')`,
          ),
        )
        .orderBy(desc(customers.dimRevenue))
        .limit(50);

      // Filter to detractor customers in JS (avoids complex SQL array)
      const detractorIdSet = new Set(detractorIds);
      detractorActions = rawActions
        .filter((a) => detractorIdSet.has(a.customerId))
        .slice(0, 10);
    }

    res.json({
      nps,
      npsDistribution: {
        promoters: promoters.length,
        neutrals: neutrals.length,
        detractors: detractors.length,
        total,
        promotersPct: total > 0 ? Math.round((promoters.length / total) * 100) : 0,
        neutralsPct: total > 0 ? Math.round((neutrals.length / total) * 100) : 0,
        detractorsPct: total > 0 ? Math.round((detractors.length / total) * 100) : 0,
      },
      detractorsByRevenue,
      totalDetractorRevenue,
      ticketThemes,
      verbatims,
      detractorActions,
    });
  } catch (err) {
    console.error("VOC error:", err);
    res.status(500).json({ error: "Erro ao buscar Voz do Cliente" });
  }
});
