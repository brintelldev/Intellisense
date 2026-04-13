import { Router } from "express";
import { db } from "../db.js";
import { eq, and } from "drizzle-orm";
import { scoringConfigs } from "../../../shared/schema.js";
import {
  runRetainPredictions,
  generateAnalyticsSnapshot,
  generateAlerts,
} from "../engine/retain-scoring.js";
import {
  runObtainScoring,
  generateObtainAlerts,
} from "../engine/obtain-scoring.js";

export const scoringRouter = Router();

const RETAIN_DEFAULT_WEIGHTS: Record<string, number> = {
  dimSatisfaction: 20,
  dimPaymentRegularity: 18,
  dimUsageIntensity: 18,
  dimInteractionFrequency: 12,
  dimContractRemainingDays: 10,
  dimSupportVolume: 10,
  dimRecencyDays: 7,
  dimTenureDays: 5,
};

const OBTAIN_DEFAULT_WEIGHTS: Record<string, number> = {
  industryFit: 25,
  companySizeFit: 20,
  revenuePotential: 20,
  sourceQuality: 15,
  engagementLevel: 10,
  geographicFit: 10,
};

scoringRouter.get("/scoring-config", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const module = (req.query.module as string) || "retain";
    const configType = module === "retain" ? "health_score" : "lead_score";

    const rows = await db
      .select()
      .from(scoringConfigs)
      .where(
        and(
          eq(scoringConfigs.tenantId, tenantId),
          eq(scoringConfigs.module, module as "retain" | "obtain"),
          eq(scoringConfigs.configType, configType),
          eq(scoringConfigs.isActive, true),
        ),
      )
      .limit(1);

    const defaults = module === "retain" ? RETAIN_DEFAULT_WEIGHTS : OBTAIN_DEFAULT_WEIGHTS;
    const weights = rows.length > 0
      ? { ...defaults, ...(rows[0].weights as Record<string, number>) }
      : defaults;

    res.json({ module, configType, weights });
  } catch (err) {
    console.error("Get scoring config error:", err);
    res.status(500).json({ error: "Erro ao buscar configuração de scoring" });
  }
});

scoringRouter.put("/scoring-config", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { module, configType, weights } = req.body;

    if (!module || !configType || !weights) {
      return res.status(400).json({ error: "module, configType e weights são obrigatórios" });
    }

    const existing = await db
      .select()
      .from(scoringConfigs)
      .where(
        and(
          eq(scoringConfigs.tenantId, tenantId),
          eq(scoringConfigs.module, module),
          eq(scoringConfigs.configType, configType),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(scoringConfigs)
        .set({ weights, isActive: true, updatedAt: new Date() })
        .where(eq(scoringConfigs.id, existing[0].id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(scoringConfigs)
        .values({ tenantId, module, configType, weights, isActive: true })
        .returning();
      res.json(created);
    }
  } catch (err) {
    console.error("Put scoring config error:", err);
    res.status(500).json({ error: "Erro ao salvar configuração de scoring" });
  }
});

scoringRouter.post("/retain/recalculate", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { predictionsGenerated } = await runRetainPredictions(tenantId);
    await generateAnalyticsSnapshot(tenantId);
    const { alertsGenerated } = await generateAlerts(tenantId);
    res.json({ message: "Recalculated", predictionsGenerated, alertsGenerated });
  } catch (err) {
    console.error("Retain recalculate error:", err);
    res.status(500).json({ error: "Erro ao recalcular retain" });
  }
});

scoringRouter.post("/obtain/recalculate", async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { scoresGenerated } = await runObtainScoring(tenantId);
    const { alertsGenerated } = await generateObtainAlerts(tenantId);
    res.json({ message: "Recalculated", scoresGenerated, alertsGenerated });
  } catch (err) {
    console.error("Obtain recalculate error:", err);
    res.status(500).json({ error: "Erro ao recalcular obtain" });
  }
});
