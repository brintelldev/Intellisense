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
  obtainAlerts, leadScoreHistory,
} from "../../../../shared/schema.js";
import { runObtainScoring, generateObtainAlerts } from "../../engine/obtain-scoring.js";
import { generateIcpClusters } from "../../engine/icp-clustering.js";
import { suggestMapping } from "../../engine/column-mapper.js";

export const obtainRouter = Router();
const upload = multer({ storage: multer.diskStorage({ destination: os.tmpdir() }), limits: { fileSize: 50 * 1024 * 1024 } });

const VALID_ACTION_TYPES = ["call", "email", "demo", "proposal", "follow_up", "whatsapp"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /dashboard ──────────────────────────────────────────────────────────
obtainRouter.get("/dashboard", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const [[leadCount], [hotCount], campaignRows, funnel, [ltvSum]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(leads).where(eq(leads.tenantId, tenantId)),
      db.select({ count: sql<number>`count(*)::int` })
        .from(obtainScores)
        .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.riskTier, "hot"))),
      db.select({ campaign: obtainCampaigns, roi: obtainCampaignRoi })
        .from(obtainCampaigns)
        .innerJoin(obtainCampaignRoi, eq(obtainCampaigns.id, obtainCampaignRoi.campaignId))
        .where(eq(obtainCampaigns.tenantId, tenantId)),
      db.select().from(obtainFunnelMetrics)
        .where(eq(obtainFunnelMetrics.tenantId, tenantId))
        .orderBy(asc(obtainFunnelMetrics.stageOrder)),
      db.select({ total: sql<number>`coalesce(sum(${obtainScores.ltvPrediction}), 0)::bigint` })
        .from(obtainScores).where(eq(obtainScores.tenantId, tenantId)),
    ]);

    let totalCac = 0, totalLtv = 0, totalLeadsFromCampaigns = 0;
    campaignRows.forEach(r => {
      totalCac += (r.roi.totalCac ?? 0);
      totalLtv += (r.roi.averageLtvPrediction ?? 0) * (r.roi.totalLeads ?? 0);
      totalLeadsFromCampaigns += (r.roi.totalLeads ?? 0);
    });
    const avgCac = totalLeadsFromCampaigns > 0 ? Math.round(totalCac / totalLeadsFromCampaigns) : 0;
    const avgLtv = totalLeadsFromCampaigns > 0 ? Math.round(totalLtv / totalLeadsFromCampaigns) : 0;

    const closedStage = funnel.find(s => s.stageName === "Fechado");
    const prospectStage = funnel.find(s => s.stageOrder === 1);
    const conversionRate = prospectStage?.leadsCount
      ? Math.round(((closedStage?.leadsCount ?? 0) / prospectStage.leadsCount) * 100) / 100
      : 0;

    res.json({
      kpis: {
        totalLeads: leadCount.count,
        hotLeads: hotCount.count,
        cac: avgCac,
        // TODO: compute from period comparison once historical campaign data is available
        cacChange: -8,
        avgLtv: avgLtv,
        avgLtvChange: 5,
        conversionRate,
        conversionRateChange: 2.1,
        revenueInFunnel: Number(ltvSum.total),
        revenueInFunnelChange: 15,
        avgAcquisitionDays: 43,
        avgAcquisitionDaysChange: -3,
      },
    });
  } catch (err) {
    console.error("Obtain dashboard error:", err);
    res.status(500).json({ error: "Erro ao buscar dashboard" });
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
    const [row] = await db.select({
      lead: leads,
      score: obtainScores,
      campaign: obtainCampaigns,
    }).from(leads)
      .leftJoin(obtainScores, eq(leads.id, obtainScores.leadId))
      .leftJoin(obtainCampaigns, eq(leads.campaignId, obtainCampaigns.id))
      .where(and(eq(leads.tenantId, req.tenantId!), eq(leads.id, req.params.id)))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Lead não encontrado" });

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
      shapValues: row.score?.shapValues ?? [],
      baseProbability: 0.24,
      recommendedAction: row.score?.recommendedAction ?? "",
      recommendedOffer: row.score?.recommendedOffer ?? "",
      campaign: row.campaign?.name ?? "",
      enteredAt: row.lead.createdAt?.toISOString() ?? "",
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

    const data = rows.map(r => ({
      id: r.id,
      name: r.clusterName,
      description: r.description,
      type: r.isIdeal ? (r.clusterId === 1 ? "ideal" : "good") : "anti",
      avgLtv: r.averageLtv,
      avgCac: r.averageCac,
      avgConversionRate: r.averageConversionRate,
      avgTenureDays: r.averageTenureDays,
      churnRate: r.churnRate30d,
      characteristics: r.characteristics,
    }));
    res.json(data);
  } catch (err) {
    console.error("Obtain ICP clusters error:", err);
    res.status(500).json({ error: "Erro ao buscar ICP clusters" });
  }
});

// ─── GET /funnel ─────────────────────────────────────────────────────────────
obtainRouter.get("/funnel", async (req, res) => {
  try {
    const rows = await db.select().from(obtainFunnelMetrics)
      .where(eq(obtainFunnelMetrics.tenantId, req.tenantId!))
      .orderBy(asc(obtainFunnelMetrics.stageOrder));

    const data = rows.map(r => ({
      id: r.id,
      name: r.stageName,
      order: r.stageOrder,
      leadsCount: r.leadsCount,
      avgTimeDays: r.avgTimeDays,
      dropOffRate: r.dropOffRate,
      revenueAtRisk: r.revenueAtRisk,
      isBottleneck: r.stageName === "Proposta",
    }));
    res.json(data);
  } catch (err) {
    console.error("Obtain funnel error:", err);
    res.status(500).json({ error: "Erro ao buscar funil" });
  }
});

// ─── GET /campaigns ──────────────────────────────────────────────────────────
obtainRouter.get("/campaigns", async (req, res) => {
  try {
    const rows = await db.select({
      campaign: obtainCampaigns,
      roi: obtainCampaignRoi,
    }).from(obtainCampaigns)
      .leftJoin(obtainCampaignRoi, eq(obtainCampaigns.id, obtainCampaignRoi.campaignId))
      .where(eq(obtainCampaigns.tenantId, req.tenantId!));

    const data = rows.map(r => ({
      id: r.campaign.id,
      name: r.campaign.name,
      channel: r.campaign.channel,
      totalLeads: r.campaign.totalLeads,
      budget: r.campaign.budget,
      cac: r.roi ? Math.round((r.roi.totalCac ?? 0) / Math.max(r.roi.totalLeads ?? 1, 1)) : 0,
      avgLtv: r.roi?.averageLtvPrediction ?? 0,
      projectedRoi: r.roi?.projectedRoi ?? 0,
      roiStatus: r.roi?.roiStatus ?? "neutral",
    }));
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

    // Read and parse CSV
    const csvText = fs.readFileSync(file.path, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: "",
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      await db.update(obtainUploads)
        .set({ status: "failed", errorMessage: parsed.errors[0].message })
        .where(eq(obtainUploads.id, uploadRow.id));
      return res.status(400).json({ error: "CSV inválido: " + parsed.errors[0].message });
    }

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

    // Group by date
    const byDate = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const date = String(r.snapshotDate);
      if (!byDate.has(date)) byDate.set(date, { hot: 0, warm: 0, cold: 0, disqualified: 0 });
      byDate.get(date)![r.scoreTier] = r.count;
    }

    const data = Array.from(byDate.entries()).map(([date, tiers]) => ({
      date,
      ...tiers,
    }));

    res.json(data);
  } catch (err) {
    console.error("Lead quality trend error:", err);
    res.status(500).json({ error: "Erro ao buscar tendência" });
  }
});
