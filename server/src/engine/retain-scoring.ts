import { eq, and, sql, desc, lt, gt } from "drizzle-orm";
import { db } from "../db";
import {
  customers,
  retainPredictions,
  retainAnalytics,
  retainChurnCauses,
  retainAlerts,
  customerScoreHistory,
  scoringConfigs,
  customDimensions,
  type ShapValue,
} from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScoringWeights {
  dimSatisfaction: number;
  dimPaymentRegularity: number;
  dimUsageIntensity: number;
  dimInteractionFrequency: number;
  dimContractRemainingDays: number;
  dimSupportVolume: number;
  dimRecencyDays: number;
  dimTenureDays: number;
  [key: string]: number; // custom dimensions
}

export interface ChurnThresholds {
  critical: number;
  high: number;
  medium: number;
}

interface CustomerDims {
  dimSatisfaction: number | null;
  dimPaymentRegularity: number | null;
  dimUsageIntensity: number | null;
  dimInteractionFrequency: number | null;
  dimContractRemainingDays: number | null;
  dimSupportVolume: number | null;
  dimRecencyDays: number | null;
  dimTenureDays: number | null;
  dimRevenue: number | null;
  [key: string]: number | null | undefined;
}

// ─── Default Weights ────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: ScoringWeights = {
  dimSatisfaction: 20,
  dimPaymentRegularity: 18,
  dimUsageIntensity: 18,
  dimInteractionFrequency: 12,
  dimContractRemainingDays: 10,
  dimSupportVolume: 10,
  dimRecencyDays: 7,
  dimTenureDays: 5,
};

const DEFAULT_THRESHOLDS: ChurnThresholds = {
  critical: 0.75,
  high: 0.55,
  medium: 0.35,
};

// ─── Dimension Metadata ─────────────────────────────────────────────────────

interface DimMeta {
  key: string;
  label: string;
  invert: boolean;      // true = lower value is better
  maxRef: number;        // reference max for normalization
  useSigmoid: boolean;   // use sigmoid instead of linear
  sigmoidMid?: number;   // sigmoid midpoint
  sigmoidK?: number;     // sigmoid steepness
}

const DIM_META: DimMeta[] = [
  { key: "dimSatisfaction", label: "Satisfação do Cliente", invert: false, maxRef: 100, useSigmoid: false },
  { key: "dimPaymentRegularity", label: "Regularidade de Pagamento", invert: true, maxRef: 60, useSigmoid: true, sigmoidMid: 15, sigmoidK: 0.25 },
  { key: "dimUsageIntensity", label: "Intensidade de Uso", invert: false, maxRef: 100, useSigmoid: false },
  { key: "dimInteractionFrequency", label: "Frequência de Interação", invert: false, maxRef: 100, useSigmoid: false },
  { key: "dimContractRemainingDays", label: "Tempo Restante de Contrato", invert: false, maxRef: 365, useSigmoid: true, sigmoidMid: 90, sigmoidK: 0.04 },
  { key: "dimSupportVolume", label: "Volume de Chamados", invert: true, maxRef: 20, useSigmoid: true, sigmoidMid: 5, sigmoidK: 0.5 },
  { key: "dimRecencyDays", label: "Dias Sem Interação", invert: true, maxRef: 90, useSigmoid: true, sigmoidMid: 30, sigmoidK: 0.1 },
  { key: "dimTenureDays", label: "Tempo de Relacionamento", invert: false, maxRef: 1800, useSigmoid: true, sigmoidMid: 365, sigmoidK: 0.005 },
];

// ─── Normalization Functions ────────────────────────────────────────────────

function sigmoidNormalize(value: number, midpoint: number, k: number): number {
  // Returns 0-1 where midpoint maps to ~0.5
  return 1 / (1 + Math.exp(-k * (value - midpoint)));
}

function linearNormalize(value: number, max: number): number {
  return Math.min(Math.max(value / max, 0), 1);
}

function normalizeDimension(value: number | null, meta: DimMeta): number {
  if (value == null) return 0.5; // neutral if missing

  let normalized: number;
  if (meta.useSigmoid && meta.sigmoidMid != null && meta.sigmoidK != null) {
    normalized = sigmoidNormalize(value, meta.sigmoidMid, meta.sigmoidK);
  } else {
    normalized = linearNormalize(value, meta.maxRef);
  }

  return meta.invert ? 1 - normalized : normalized;
}

// ─── Core Scoring Functions ─────────────────────────────────────────────────

export function calcHealthScore(
  dims: CustomerDims,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const meta of DIM_META) {
    const weight = weights[meta.key] ?? 0;
    if (weight <= 0) continue;

    const normalized = normalizeDimension(dims[meta.key] ?? null, meta);
    weightedSum += normalized * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 50; // neutral if no dimensions

  const score = (weightedSum / totalWeight) * 100;
  return Math.round(Math.min(Math.max(score, 0), 100));
}

export function calcChurnProbability(
  healthScore: number,
  dims: CustomerDims,
): number {
  // Base: sigmoid inverse of health score (not simple subtraction)
  // At healthScore=50, baseProb ~0.5; at 80, ~0.12; at 20, ~0.88
  let baseProb = 1 / (1 + Math.exp(0.08 * (healthScore - 50)));

  // Trigger multipliers — compound when multiple signals are bad
  if (dims.dimContractRemainingDays != null && dims.dimContractRemainingDays < 30) {
    baseProb *= 1.25;
  }
  if (dims.dimPaymentRegularity != null && dims.dimPaymentRegularity > 15) {
    baseProb *= 1.15;
  }
  if (dims.dimSatisfaction != null && dims.dimSatisfaction < 25) {
    baseProb *= 1.20;
  }
  if (dims.dimUsageIntensity != null && dims.dimUsageIntensity < 20) {
    baseProb *= 1.10;
  }
  if (dims.dimRecencyDays != null && dims.dimRecencyDays > 60) {
    baseProb *= 1.15;
  }

  return Math.min(Math.max(baseProb, 0.01), 0.99);
}

export function classifyRiskLevel(
  churnProb: number,
  thresholds: ChurnThresholds = DEFAULT_THRESHOLDS,
): "critical" | "high" | "medium" | "low" {
  if (churnProb >= thresholds.critical) return "critical";
  if (churnProb >= thresholds.high) return "high";
  if (churnProb >= thresholds.medium) return "medium";
  return "low";
}

export function generateShapValues(
  dims: CustomerDims,
  healthScore: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ShapValue[] {
  const totalWeight = Object.values(weights).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (totalWeight === 0) return [];

  const shapValues: ShapValue[] = [];

  for (const meta of DIM_META) {
    const weight = weights[meta.key] ?? 0;
    if (weight <= 0) continue;

    const rawValue = dims[meta.key];
    const normalized = normalizeDimension(rawValue ?? null, meta);
    const neutral = 0.5;

    // Impact: how much this dimension pushes the score away from neutral
    // Positive impact = helps the score (dimension is performing well)
    // Negative impact = hurts the score (dimension is performing poorly)
    const impact = ((normalized - neutral) * weight / totalWeight) * 100;

    shapValues.push({
      feature: meta.key,
      value: rawValue ?? undefined,
      impact: Math.round(impact * 10) / 10,
      direction: impact >= 0 ? "positive" : "negative",
      label: meta.label,
    });
  }

  // Sort by absolute impact descending, take top 8
  shapValues.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return shapValues.slice(0, 8);
}

export function generateRecommendedAction(
  riskLevel: "critical" | "high" | "medium" | "low",
  topFactors: ShapValue[],
): string {
  const topNegative = topFactors.find((f) => f.direction === "negative");
  const factorKey = topNegative?.feature ?? "";

  if (riskLevel === "critical") {
    if (factorKey === "dimContractRemainingDays") {
      return "URGENTE: Agendar reunião de renovação com decisor. Preparar proposta de retenção com condições especiais.";
    }
    if (factorKey === "dimPaymentRegularity") {
      return "URGENTE: Acionar financeiro para renegociação. Contatar decisor para entender situação e oferecer plano de pagamento.";
    }
    if (factorKey === "dimSatisfaction") {
      return "URGENTE: Visita presencial do gestor de conta. Coletar feedback detalhado e montar plano de ação em 48h.";
    }
    if (factorKey === "dimUsageIntensity") {
      return "URGENTE: Agendar sessão de reativação. Demonstrar funcionalidades não utilizadas e propor treinamento.";
    }
    return "URGENTE: Acionar equipe de CS para intervenção imediata. Reunião com decisor em até 48h.";
  }

  if (riskLevel === "high") {
    if (factorKey === "dimUsageIntensity" || factorKey === "dimInteractionFrequency") {
      return "Agendar treinamento do produto. Demonstrar features de alto valor e criar plano de adoção.";
    }
    if (factorKey === "dimSatisfaction") {
      return "Visita presencial do CS. Coletar feedback detalhado e criar plano de ação personalizado.";
    }
    if (factorKey === "dimPaymentRegularity") {
      return "Contatar financeiro do cliente. Verificar possíveis problemas de fluxo de caixa e oferecer alternativas.";
    }
    if (factorKey === "dimRecencyDays") {
      return "Reengajar o cliente com conteúdo de valor. Agendar reunião de check-in para entender mudanças.";
    }
    return "Monitorar semanalmente. Agendar reunião de check-in e revisar indicadores críticos.";
  }

  if (riskLevel === "medium") {
    return "Monitorar quinzenalmente. Enviar conteúdo de engajamento e agendar check-in mensal.";
  }

  return "Cliente saudável. Manter cadência regular de contato e identificar oportunidades de expansão.";
}

// ─── Orchestration Functions ────────────────────────────────────────────────

export async function runRetainPredictions(tenantId: string, snapshotDate?: string): Promise<{
  predictionsGenerated: number;
}> {
  // Load tenant-specific weights if configured
  const configRows = await db
    .select()
    .from(scoringConfigs)
    .where(
      and(
        eq(scoringConfigs.tenantId, tenantId),
        eq(scoringConfigs.module, "retain"),
        eq(scoringConfigs.configType, "health_score"),
        eq(scoringConfigs.isActive, true),
      ),
    )
    .limit(1);

  const weights: ScoringWeights = configRows.length > 0
    ? { ...DEFAULT_WEIGHTS, ...(configRows[0].weights as Record<string, number>) }
    : DEFAULT_WEIGHTS;

  // Load all customers for this tenant
  const allCustomers = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  if (allCustomers.length === 0) return { predictionsGenerated: 0 };

  // Mark all existing predictions as inactive
  await db
    .update(retainPredictions)
    .set({ isActive: false })
    .where(
      and(
        eq(retainPredictions.tenantId, tenantId),
        eq(retainPredictions.isActive, true),
      ),
    );

  const today = snapshotDate ?? new Date().toISOString().split("T")[0];
  let predictionsGenerated = 0;

  for (const customer of allCustomers) {
    const dims: CustomerDims = {
      dimSatisfaction: customer.dimSatisfaction,
      dimPaymentRegularity: customer.dimPaymentRegularity,
      dimUsageIntensity: customer.dimUsageIntensity,
      dimInteractionFrequency: customer.dimInteractionFrequency,
      dimContractRemainingDays: customer.dimContractRemainingDays,
      dimSupportVolume: customer.dimSupportVolume,
      dimRecencyDays: customer.dimRecencyDays,
      dimTenureDays: customer.dimTenureDays,
      dimRevenue: customer.dimRevenue,
    };

    const healthScore = calcHealthScore(dims, weights);
    const churnProb = calcChurnProbability(healthScore, dims);
    const riskLevel = classifyRiskLevel(churnProb);
    const shapValues = generateShapValues(dims, healthScore, weights);
    const recommendedAction = generateRecommendedAction(riskLevel, shapValues);

    // Determine customer status
    const status = customer.churnDate
      ? "churned" as const
      : riskLevel === "high" || riskLevel === "critical"
        ? "at_risk" as const
        : "active" as const;

    // Update customer record with calculated scores
    await db
      .update(customers)
      .set({
        healthScore,
        churnProbability: churnProb,
        riskLevel,
        status,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id));

    // Insert new active prediction
    await db.insert(retainPredictions).values({
      tenantId,
      customerId: customer.id,
      churnProbability: churnProb,
      riskLevel,
      confidence: 0.85, // heuristic confidence
      shapValues,
      recommendedAction,
      isActive: true,
    });

    // Save score history snapshot
    await db.insert(customerScoreHistory).values({
      tenantId,
      customerId: customer.id,
      healthScore,
      churnProbability: churnProb,
      riskLevel,
      snapshotDate: today,
    });

    predictionsGenerated++;
  }

  return { predictionsGenerated };
}

export async function generateAnalyticsSnapshot(tenantId: string, snapshotDate?: string): Promise<void> {
  const allCustomers = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  if (allCustomers.length === 0) return;

  const total = allCustomers.length;
  const active = allCustomers.filter((c) => c.status === "active").length;
  const churned = allCustomers.filter((c) => c.status === "churned").length;
  const atRisk = allCustomers.filter((c) => c.status === "at_risk").length;

  const mrr = allCustomers
    .filter((c) => c.status !== "churned")
    .reduce((sum, c) => sum + (c.dimRevenue ?? 0), 0);

  const revenueAtRisk = allCustomers
    .filter((c) => c.riskLevel === "high" || c.riskLevel === "critical")
    .reduce((sum, c) => sum + (c.dimRevenue ?? 0), 0);

  const avgHealthScore = allCustomers
    .filter((c) => c.healthScore != null)
    .reduce((sum, c, _, arr) => sum + (c.healthScore ?? 0) / arr.length, 0);

  const churnRate = total > 0 ? (churned / total) * 100 : 0;
  const today = snapshotDate ?? new Date().toISOString().split("T")[0];

  await db.insert(retainAnalytics).values({
    tenantId,
    snapshotDate: today,
    totalCustomers: total,
    activeCustomers: active,
    churnedCustomers: churned,
    atRiskCustomers: atRisk,
    churnRate: Math.round(churnRate * 100) / 100,
    mrr: Math.round(mrr * 100) / 100,
    revenueAtRisk: Math.round(revenueAtRisk * 100) / 100,
    avgHealthScore: Math.round(avgHealthScore * 100) / 100,
  });
}

export async function generateChurnCauses(tenantId: string): Promise<void> {
  // Get all at-risk/critical customers with their predictions
  const atRiskCustomers = await db
    .select({
      customer: customers,
      prediction: retainPredictions,
    })
    .from(customers)
    .innerJoin(
      retainPredictions,
      and(
        eq(retainPredictions.customerId, customers.id),
        eq(retainPredictions.isActive, true),
      ),
    )
    .where(
      and(
        eq(customers.tenantId, tenantId),
        sql`${customers.riskLevel} IN ('high', 'critical')`,
      ),
    );

  if (atRiskCustomers.length === 0) return;

  // Aggregate: for each dimension, count how many at-risk customers have it as top negative factor
  const causeCounts: Record<string, {
    cause: string;
    category: string;
    count: number;
    totalRevenue: number;
  }> = {};

  for (const { customer, prediction } of atRiskCustomers) {
    const shapValues = prediction.shapValues ?? [];
    // Take top 2 negative factors per customer
    const negatives = shapValues
      .filter((s) => s.direction === "negative")
      .slice(0, 2);

    for (const neg of negatives) {
      if (!causeCounts[neg.feature]) {
        causeCounts[neg.feature] = {
          cause: neg.label,
          category: getCauseCategory(neg.feature),
          count: 0,
          totalRevenue: 0,
        };
      }
      causeCounts[neg.feature].count++;
      causeCounts[neg.feature].totalRevenue += customer.dimRevenue ?? 0;
    }
  }

  // Delete old causes for tenant and insert new ones
  await db
    .delete(retainChurnCauses)
    .where(eq(retainChurnCauses.tenantId, tenantId));

  const totalAtRisk = atRiskCustomers.length;
  const causeEntries = Object.values(causeCounts)
    .sort((a, b) => b.count - a.count);

  for (const entry of causeEntries) {
    await db.insert(retainChurnCauses).values({
      tenantId,
      cause: entry.cause,
      category: entry.category,
      impactPct: Math.round((entry.count / totalAtRisk) * 100),
      affectedCustomers: entry.count,
      revenueAtRisk: Math.round(entry.totalRevenue * 100) / 100,
      trend: "stable",
    });
  }
}

function getCauseCategory(dimKey: string): string {
  const categoryMap: Record<string, string> = {
    dimSatisfaction: "Experiência",
    dimPaymentRegularity: "Financeiro",
    dimUsageIntensity: "Engajamento",
    dimInteractionFrequency: "Engajamento",
    dimContractRemainingDays: "Contrato",
    dimSupportVolume: "Suporte",
    dimRecencyDays: "Engajamento",
    dimTenureDays: "Relacionamento",
  };
  return categoryMap[dimKey] ?? "Outros";
}

export async function generateAlerts(tenantId: string): Promise<{
  alertsGenerated: number;
}> {
  const allCustomers = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  let alertsGenerated = 0;

  for (const customer of allCustomers) {
    const alerts: Array<{
      type: "health_drop" | "churn_risk" | "contract_expiring" | "payment_delayed" | "score_drop";
      message: string;
      severity: "critical" | "high" | "medium";
    }> = [];

    // Health score critical
    if (customer.healthScore != null && customer.healthScore < 25) {
      alerts.push({
        type: "health_drop",
        message: `${customer.name} está com saúde crítica (score ${customer.healthScore}). Intervenção imediata necessária.`,
        severity: "critical",
      });
    } else if (customer.healthScore != null && customer.healthScore < 40) {
      alerts.push({
        type: "health_drop",
        message: `${customer.name} está com saúde em declínio (score ${customer.healthScore}). Monitoramento intensivo recomendado.`,
        severity: "high",
      });
    }

    // Churn probability high
    if (customer.churnProbability != null && customer.churnProbability > 0.70) {
      alerts.push({
        type: "churn_risk",
        message: `Risco elevado de churn para ${customer.name} (${Math.round(customer.churnProbability * 100)}%). Ação urgente recomendada.`,
        severity: customer.churnProbability > 0.85 ? "critical" : "high",
      });
    }

    // Contract expiring soon
    if (
      customer.dimContractRemainingDays != null &&
      customer.dimContractRemainingDays < 30 &&
      customer.riskLevel !== "low"
    ) {
      alerts.push({
        type: "contract_expiring",
        message: `Contrato de ${customer.name} expira em ${customer.dimContractRemainingDays} dias. Risco atual: ${customer.riskLevel}.`,
        severity: customer.dimContractRemainingDays < 15 ? "critical" : "high",
      });
    }

    // Payment delayed
    if (customer.dimPaymentRegularity != null && customer.dimPaymentRegularity > 15) {
      alerts.push({
        type: "payment_delayed",
        message: `${customer.name} com atraso médio de pagamento de ${Math.round(customer.dimPaymentRegularity)} dias.`,
        severity: customer.dimPaymentRegularity > 30 ? "critical" : "high",
      });
    }

    // Score drop (compare with previous snapshot)
    const previousSnapshots = await db
      .select()
      .from(customerScoreHistory)
      .where(
        and(
          eq(customerScoreHistory.customerId, customer.id),
          eq(customerScoreHistory.tenantId, tenantId),
        ),
      )
      .orderBy(desc(customerScoreHistory.snapshotDate))
      .limit(2);

    if (previousSnapshots.length >= 2) {
      const current = previousSnapshots[0].healthScore;
      const previous = previousSnapshots[1].healthScore;
      const drop = previous - current;

      if (drop > 15) {
        alerts.push({
          type: "score_drop",
          message: `Health score de ${customer.name} caiu ${Math.round(drop)} pontos (de ${Math.round(previous)} para ${Math.round(current)}).`,
          severity: drop > 25 ? "critical" : "high",
        });
      }
    }

    // Insert alerts (avoiding duplicates for the same day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const alert of alerts) {
      await db.insert(retainAlerts).values({
        tenantId,
        customerId: customer.id,
        type: alert.type,
        message: alert.message,
        severity: alert.severity,
      });
      alertsGenerated++;
    }
  }

  return { alertsGenerated };
}
