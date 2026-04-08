import { Router } from "express";
import multer from "multer";
import os from "os";
import fs from "fs";
import Papa from "papaparse";
import { db } from "../../db.js";
import { eq, and, desc, asc, ilike, sql, SQL } from "drizzle-orm";
import {
  customers, retainPredictions, retainChurnCauses, retainAnalytics,
  retainActions, retainUploads,
} from "../../../../shared/schema.js";

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
      timeAgo: "recente",
    }));

    const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    riskRows.forEach(r => { if (r.riskLevel) riskDistribution[r.riskLevel] = r.count; });

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
        mrr: latest?.mrr ?? 0,
        mrrChange: calcChange(latest?.mrr ?? null, previous?.mrr ?? null),
        revenueAtRisk: latest?.revenueAtRisk ?? 0,
        revenueAtRiskChange: calcChange(latest?.revenueAtRisk ?? null, previous?.revenueAtRisk ?? null),
        avgHealthScore: latest?.avgHealthScore ?? 0,
        riskDistribution,
      },
      alerts,
    });
  } catch (err) {
    console.error("Retain dashboard error:", err);
    res.status(500).json({ error: "Erro ao buscar dashboard" });
  }
});

// ─── GET /predictions ────────────────────────────────────────────────────────
retainRouter.get("/predictions", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const { riskLevel, segment, search, sortBy, sortDir } = req.query;

    const conditions: SQL[] = [eq(retainPredictions.tenantId, tenantId)];
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
      )).limit(1);

    if (!row) return res.status(404).json({ error: "Predição não encontrada" });

    res.json({
      ...mapCustomerToDto(row.customer),
      churnProbability: row.prediction.churnProbability,
      riskLevel: row.prediction.riskLevel,
      confidence: row.prediction.confidence,
      shapValues: row.prediction.shapValues,
      baseProbability: 0.15,
      recommendedAction: row.prediction.recommendedAction,
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
    res.json(rows);
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

// ─── POST /uploads ───────────────────────────────────────────────────────────
const RETAIN_FIELD_MAP: Record<string, string> = {
  id: "customerCode",
  name: "name",
  revenue: "dimRevenue",
  paymentRegularity: "dimPaymentRegularity",
  tenureDays: "dimTenureDays",
  interactionFrequency: "dimInteractionFrequency",
  supportVolume: "dimSupportVolume",
  satisfaction: "dimSatisfaction",
  contractRemainingDays: "dimContractRemainingDays",
  usageIntensity: "dimUsageIntensity",
  recencyDays: "dimRecencyDays",
};

function calcHealthScore(dims: Record<string, number | null>): number {
  const w = (key: string, weight: number, invert = false) => {
    const v = dims[key];
    if (v == null) return weight * 0.5; // neutral if unmapped
    const norm = Math.min(Math.max(v / 100, 0), 1);
    return weight * (invert ? 1 - norm : norm);
  };
  const score =
    w("dimSatisfaction", 25) +
    w("dimPaymentRegularity", 20) +
    w("dimUsageIntensity", 20) +
    w("dimInteractionFrequency", 15) +
    w("dimContractRemainingDays", 10) +
    (10 * (1 - Math.min((dims["dimSupportVolume"] ?? 5) / 20, 1)));
  return Math.round(Math.min(Math.max(score, 0), 100));
}

retainRouter.post("/uploads", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Arquivo não enviado" });

  let uploadRow: typeof retainUploads.$inferSelect | undefined;
  try {
    // Parse mapping sent as JSON string in form field
    let mapping: Record<string, string> = {};
    try { mapping = JSON.parse(req.body.mapping ?? "{}"); } catch { /* no mapping */ }

    [uploadRow] = await db.insert(retainUploads).values({
      tenantId: req.tenantId!,
      filename: file.originalname,
      status: "processing",
      uploadedBy: req.session.userId,
    }).returning();

    // Read and parse CSV
    const csvText = fs.readFileSync(file.path, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: "",  // auto-detect comma vs semicolon
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      await db.update(retainUploads)
        .set({ status: "failed", errorMessage: parsed.errors[0].message })
        .where(eq(retainUploads.id, uploadRow.id));
      return res.status(400).json({ error: "CSV inválido: " + parsed.errors[0].message });
    }

    // Build customer rows applying mapping
    const customerRows = parsed.data.map((row) => {
      const dims: Record<string, number | null> = {};

      // Helper: get CSV value for a system field key via user mapping
      const get = (key: string) => {
        const csvCol = mapping[key];
        return csvCol ? row[csvCol] : undefined;
      };

      const toFloat = (v: string | undefined) => {
        if (!v) return null;
        const n = parseFloat(v.replace(",", "."));
        return isNaN(n) ? null : n;
      };
      const toInt = (v: string | undefined) => {
        if (!v) return null;
        const n = parseInt(v, 10);
        return isNaN(n) ? null : n;
      };

      dims["dimRevenue"] = toFloat(get("revenue"));
      dims["dimPaymentRegularity"] = toFloat(get("paymentRegularity"));
      dims["dimTenureDays"] = toInt(get("tenureDays"));
      dims["dimInteractionFrequency"] = toFloat(get("interactionFrequency"));
      dims["dimSupportVolume"] = toFloat(get("supportVolume"));
      dims["dimSatisfaction"] = toFloat(get("satisfaction"));
      dims["dimContractRemainingDays"] = toInt(get("contractRemainingDays"));
      dims["dimUsageIntensity"] = toFloat(get("usageIntensity"));
      dims["dimRecencyDays"] = toInt(get("recencyDays"));

      const healthScore = calcHealthScore(dims);
      const churnProbability = Math.round((100 - healthScore)) / 100;
      const riskLevel =
        healthScore < 30 ? "critical" :
        healthScore < 50 ? "high" :
        healthScore < 65 ? "medium" : "low";

      return {
        tenantId: req.tenantId!,
        customerCode: get("id") ?? undefined,
        name: get("name") ?? row[Object.keys(row)[0]] ?? "Sem nome",
        dimRevenue: dims["dimRevenue"],
        dimPaymentRegularity: dims["dimPaymentRegularity"],
        dimTenureDays: dims["dimTenureDays"],
        dimInteractionFrequency: dims["dimInteractionFrequency"],
        dimSupportVolume: dims["dimSupportVolume"],
        dimSatisfaction: dims["dimSatisfaction"],
        dimContractRemainingDays: dims["dimContractRemainingDays"],
        dimUsageIntensity: dims["dimUsageIntensity"],
        dimRecencyDays: dims["dimRecencyDays"],
        healthScore,
        churnProbability,
        riskLevel: riskLevel as "low" | "medium" | "high" | "critical",
        status: "active" as const,
        rawData: row,
      };
    });

    // Batch insert
    if (customerRows.length > 0) {
      await db.insert(customers).values(customerRows);
    }

    // Update upload record
    const [done] = await db.update(retainUploads)
      .set({ status: "completed", rowsCount: customerRows.length, processedAt: new Date() })
      .where(eq(retainUploads.id, uploadRow.id))
      .returning();

    res.status(201).json(done);
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
