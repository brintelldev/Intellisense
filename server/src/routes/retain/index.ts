import { Router } from "express";
import multer from "multer";
import os from "os";
import fs from "fs";
import Papa from "papaparse";
import { db } from "../../db.js";
import { eq, and, desc, asc, ilike, sql, SQL } from "drizzle-orm";
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
} from "../../engine/retain-scoring.js";
import { generateIcpClusters } from "../../engine/icp-clustering.js";
import { suggestMapping } from "../../engine/column-mapper.js";

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

retainRouter.post("/uploads", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Arquivo não enviado" });

  let uploadRow: typeof retainUploads.$inferSelect | undefined;
  try {
    // Parse mapping sent as JSON string in form field
    let mapping: Record<string, string> = {};
    try { mapping = JSON.parse(req.body.mapping ?? "{}"); } catch { /* no mapping */ }

    const tenantId = req.tenantId!;

    [uploadRow] = await db.insert(retainUploads).values({
      tenantId,
      filename: file.originalname,
      status: "processing",
      columnMapping: mapping,
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

    // Helper functions
    const get = (row: Record<string, string>, key: string) => {
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

    // Load existing customers for upsert check
    const existingCustomers = await db
      .select({ id: customers.id, customerCode: customers.customerCode })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));
    const existingByCode = new Map(
      existingCustomers
        .filter((c) => c.customerCode)
        .map((c) => [c.customerCode!, c.id]),
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
          dimSatisfaction: toFloat(get(row, "satisfaction")),
          dimContractRemainingDays: toInt(get(row, "contractRemainingDays")),
          dimUsageIntensity: toFloat(get(row, "usageIntensity")),
          dimRecencyDays: toInt(get(row, "recencyDays")),
          rawData: row,
          updatedAt: new Date(),
        };

        // Upsert: check if customer exists by code
        const existingId = customerCode ? existingByCode.get(customerCode) : undefined;

        if (existingId) {
          await db.update(customers)
            .set(customerData)
            .where(eq(customers.id, existingId));
          rowsUpdated++;
        } else {
          const [inserted] = await db.insert(customers)
            .values({ ...customerData, status: "active" as const })
            .returning({ id: customers.id });
          if (customerCode) {
            existingByCode.set(customerCode, inserted.id);
          }
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
      errors: errors.slice(0, 20), // limit error details
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
    const suggestions = suggestMapping(headers, sampleRows ?? [], "retain");
    res.json(suggestions);
  } catch (err) {
    console.error("Suggest mapping error:", err);
    res.status(500).json({ error: "Erro ao sugerir mapeamento" });
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
      .orderBy(desc(retainUploads.processedAt))
      .limit(1);

    const [countRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

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
