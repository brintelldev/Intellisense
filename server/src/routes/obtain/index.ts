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
} from "../../../../shared/schema.js";

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

    [uploadRow] = await db.insert(obtainUploads).values({
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
      .where(eq(obtainCampaigns.tenantId, req.tenantId!));
    const campaignByName = new Map(campaignRows.map(c => [c.name.toLowerCase(), c.id]));

    const leadRows = parsed.data.map((row) => {
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

      return {
        tenantId: req.tenantId!,
        name: get(row, "name") ?? row[Object.keys(row)[0]] ?? "Sem nome",
        company: get(row, "company") ?? undefined,
        industry: get(row, "industry") ?? undefined,
        companySize: companySize ?? undefined,
        city: get(row, "city") ?? undefined,
        state: get(row, "state") ?? undefined,
        email: get(row, "email") ?? undefined,
        phone: get(row, "phone") ?? undefined,
        source,
        status: "new" as const,
        campaignId: campaignId ?? undefined,
        rawData: row,
      };
    });

    if (leadRows.length > 0) {
      await db.insert(leads).values(leadRows);
    }

    const [done] = await db.update(obtainUploads)
      .set({ status: "completed", rowsCount: leadRows.length, processedAt: new Date() })
      .where(eq(obtainUploads.id, uploadRow.id))
      .returning();

    res.status(201).json(done);
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
