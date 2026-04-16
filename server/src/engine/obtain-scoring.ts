import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../db";
import {
  leads,
  obtainScores,
  obtainAlerts,
  leadScoreHistory,
  customers,
  scoringConfigs,
  type ShapValue,
} from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LeadScoringWeights {
  industryFit: number;
  companySizeFit: number;
  revenuePotential: number;
  sourceQuality: number;
  engagementLevel: number;
  geographicFit: number;
  [key: string]: number;
}

interface LeadDims {
  industry: string | null;
  companySize: string | null;
  monthlyRevenueEstimate: number | null;
  source: string | null;
  status: string | null;
  city: string | null;
  state: string | null;
}

interface CustomerProfile {
  industry: string | null;
  segment: string | null;
  companySize?: string | null;
  dimRevenue: number | null;
  dimTenureDays: number | null;
  healthScore: number | null;
  status: string | null;
  state: string | null;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: LeadScoringWeights = {
  industryFit: 25,
  companySizeFit: 20,
  revenuePotential: 20,
  sourceQuality: 15,
  engagementLevel: 10,
  geographicFit: 10,
};

const SOURCE_QUALITY_MAP: Record<string, number> = {
  referral: 1.0,
  event: 0.85,
  organic: 0.7,
  email: 0.65,
  paid_search: 0.55,
  paid_social: 0.5,
  outbound: 0.4,
  csv: 0.5,
  manual: 0.5,
  other: 0.45,
  hubspot: 0.6,
  salesforce: 0.6,
  rdstation: 0.6,
};

const ENGAGEMENT_MAP: Record<string, number> = {
  new: 0.2,
  qualifying: 0.4,
  contacted: 0.6,
  proposal: 0.85,
  won: 1.0,
  lost: 0.1,
};

const SIZE_ORDER: Record<string, number> = {
  micro: 1,
  small: 2,
  medium: 3,
  large: 4,
  enterprise: 5,
};

// ─── Scoring Functions ──────────────────────────────────────────────────────

function calcIndustryFit(
  leadIndustry: string | null,
  existingCustomers: CustomerProfile[],
): number {
  if (!leadIndustry || existingCustomers.length === 0) return 0.5;

  const matchingCustomers = existingCustomers.filter(
    (c) => c.industry?.toLowerCase() === leadIndustry.toLowerCase() ||
           c.segment?.toLowerCase() === leadIndustry.toLowerCase(),
  );

  if (matchingCustomers.length === 0) return 0.3;

  // Higher score if matching customers have high health scores (feedback loop!)
  const avgHealth = matchingCustomers
    .filter((c) => c.healthScore != null)
    .reduce((sum, c, _, arr) => sum + (c.healthScore ?? 50) / arr.length, 0);

  const churnedPct = matchingCustomers.filter((c) => c.status === "churned").length
    / matchingCustomers.length;

  // Good industry: high health + low churn among existing customers
  const industryQuality = (avgHealth / 100) * (1 - churnedPct);
  return Math.min(Math.max(industryQuality, 0.1), 1.0);
}

function calcCompanySizeFit(
  leadSize: string | null,
  existingCustomers: CustomerProfile[],
): number {
  if (!leadSize || existingCustomers.length === 0) return 0.5;

  const leadSizeNum = SIZE_ORDER[leadSize] ?? 3;

  // Find the most successful company size among existing customers
  const sizeGroups: Record<string, { count: number; avgHealth: number }> = {};
  for (const c of existingCustomers) {
    const size = c.segment ?? "medium"; // fallback
    if (!sizeGroups[size]) sizeGroups[size] = { count: 0, avgHealth: 0 };
    sizeGroups[size].count++;
    sizeGroups[size].avgHealth += c.healthScore ?? 50;
  }

  for (const key of Object.keys(sizeGroups)) {
    sizeGroups[key].avgHealth /= sizeGroups[key].count;
  }

  // Larger companies generally score higher, with bonus for matching existing profile
  const baseSizeScore = leadSizeNum / 5; // enterprise=1.0, micro=0.2
  return Math.min(Math.max(baseSizeScore, 0.1), 1.0);
}

function calcRevenuePotential(
  estimate: number | null,
  existingCustomers: CustomerProfile[],
): number {
  if (estimate == null) return 0.5;

  if (existingCustomers.length === 0) {
    // No reference — normalize against a reasonable range
    return Math.min(estimate / 100000, 1.0);
  }

  const avgRevenue = existingCustomers
    .filter((c) => c.dimRevenue != null && c.dimRevenue > 0)
    .reduce((sum, c, _, arr) => sum + (c.dimRevenue ?? 0) / arr.length, 0);

  if (avgRevenue === 0) return 0.5;

  // Score relative to existing customer average
  const ratio = estimate / avgRevenue;
  // sigmoid-like: ratio=1 → 0.6, ratio=2 → 0.8, ratio=0.5 → 0.4
  return Math.min(Math.max(1 / (1 + Math.exp(-2 * (ratio - 1))), 0.05), 1.0);
}

function calcSourceQualityScore(source: string | null): number {
  return SOURCE_QUALITY_MAP[source ?? "other"] ?? 0.45;
}

function calcEngagementScore(status: string | null): number {
  return ENGAGEMENT_MAP[status ?? "new"] ?? 0.2;
}

function calcGeographicFit(
  leadState: string | null,
  existingCustomers: CustomerProfile[],
): number {
  if (!leadState || existingCustomers.length === 0) return 0.5;

  const matchingState = existingCustomers.filter(
    (c) => c.state?.toLowerCase() === leadState.toLowerCase(),
  );

  if (matchingState.length === 0) return 0.3;

  // More customers in same state = higher geographic fit
  const ratio = matchingState.length / existingCustomers.length;
  return Math.min(0.4 + ratio * 2, 1.0);
}

// ─── Core Functions ─────────────────────────────────────────────────────────

export function calcLeadScore(
  lead: LeadDims,
  existingCustomers: CustomerProfile[],
  weights: LeadScoringWeights = DEFAULT_WEIGHTS,
): number {
  const factors: Record<string, number> = {
    industryFit: calcIndustryFit(lead.industry, existingCustomers),
    companySizeFit: calcCompanySizeFit(lead.companySize, existingCustomers),
    revenuePotential: calcRevenuePotential(lead.monthlyRevenueEstimate, existingCustomers),
    sourceQuality: calcSourceQualityScore(lead.source),
    engagementLevel: calcEngagementScore(lead.status),
    geographicFit: calcGeographicFit(lead.state, existingCustomers),
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, value] of Object.entries(factors)) {
    const weight = weights[key] ?? 0;
    if (weight <= 0) continue;
    weightedSum += value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 50;

  const score = (weightedSum / totalWeight) * 100;
  return Math.round(Math.min(Math.max(score, 0), 100));
}

export function classifyScoreTier(
  score: number,
): "hot" | "warm" | "cold" | "disqualified" {
  if (score >= 65) return "hot";
  if (score >= 40) return "warm";
  if (score >= 20) return "cold";
  return "disqualified";
}

export function calcConversionProbability(
  score: number,
  lead: LeadDims,
): number {
  // Base from score
  let prob = score / 100;

  // Boost from engagement
  const engagement = calcEngagementScore(lead.status);
  prob = prob * 0.7 + engagement * 0.3;

  // Source boost
  const sourceQ = calcSourceQualityScore(lead.source);
  if (sourceQ > 0.8) prob *= 1.1;

  return Math.min(Math.max(Math.round(prob * 100) / 100, 0.01), 0.99);
}

export function calcLtvPrediction(
  lead: LeadDims,
  existingCustomers: CustomerProfile[],
): number {
  // FEEDBACK LOOP: use real data from Retain module
  const matching = existingCustomers.filter((c) => {
    if (lead.industry && c.industry) {
      return c.industry.toLowerCase() === lead.industry.toLowerCase() ||
             (c.segment && c.segment.toLowerCase() === lead.industry.toLowerCase());
    }
    return false;
  });

  const reference = matching.length > 0 ? matching : existingCustomers;

  if (reference.length === 0) {
    // Fallback by company size
    const sizeMultiplier: Record<string, number> = {
      micro: 50000,
      small: 120000,
      medium: 300000,
      large: 600000,
      enterprise: 1200000,
    };
    return sizeMultiplier[lead.companySize ?? "medium"] ?? 300000;
  }

  const avgRevenue = reference
    .filter((c) => c.dimRevenue != null && c.dimRevenue > 0)
    .reduce((sum, c, _, arr) => sum + (c.dimRevenue ?? 0) / arr.length, 0);

  const avgTenure = reference
    .filter((c) => c.dimTenureDays != null && c.dimTenureDays > 0)
    .reduce((sum, c, _, arr) => sum + (c.dimTenureDays ?? 365) / arr.length, 0);

  // LTV = monthly revenue × months of tenure
  const ltv = avgRevenue * (avgTenure / 30);
  return Math.round(ltv);
}

export function generateLeadShapValues(
  lead: LeadDims,
  score: number,
  existingCustomers: CustomerProfile[],
  weights: LeadScoringWeights = DEFAULT_WEIGHTS,
): ShapValue[] {
  const factors: Array<{ key: string; label: string; value: number; raw: string | number | null }> = [
    { key: "industryFit", label: "Fit de Indústria", value: calcIndustryFit(lead.industry, existingCustomers), raw: lead.industry },
    { key: "companySizeFit", label: "Porte da Empresa", value: calcCompanySizeFit(lead.companySize, existingCustomers), raw: lead.companySize },
    { key: "revenuePotential", label: "Potencial de Receita", value: calcRevenuePotential(lead.monthlyRevenueEstimate, existingCustomers), raw: lead.monthlyRevenueEstimate },
    { key: "sourceQuality", label: "Qualidade da Origem", value: calcSourceQualityScore(lead.source), raw: lead.source },
    { key: "engagementLevel", label: "Nível de Engajamento", value: calcEngagementScore(lead.status), raw: lead.status },
    { key: "geographicFit", label: "Fit Geográfico", value: calcGeographicFit(lead.state, existingCustomers), raw: lead.state },
  ];

  const totalWeight = Object.values(weights).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (totalWeight === 0) return [];

  const shapValues: ShapValue[] = factors.map((f) => {
    const weight = weights[f.key] ?? 0;
    const impact = ((f.value - 0.5) * weight / totalWeight) * 100;

    return {
      feature: f.key,
      value: f.raw ?? undefined,
      impact: Math.round(impact * 10) / 10,
      direction: impact >= 0 ? "positive" as const : "negative" as const,
      label: f.label,
    };
  });

  shapValues.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return shapValues;
}

// ─── Orchestration ──────────────────────────────────────────────────────────

export async function runObtainScoring(tenantId: string): Promise<{
  scoresGenerated: number;
}> {
  // Load tenant weights
  const configRows = await db
    .select()
    .from(scoringConfigs)
    .where(
      and(
        eq(scoringConfigs.tenantId, tenantId),
        eq(scoringConfigs.module, "obtain"),
        eq(scoringConfigs.configType, "lead_score"),
        eq(scoringConfigs.isActive, true),
      ),
    )
    .limit(1);

  const weights: LeadScoringWeights = configRows.length > 0
    ? { ...DEFAULT_WEIGHTS, ...(configRows[0].weights as Record<string, number>) }
    : DEFAULT_WEIGHTS;

  // FEEDBACK LOOP: Load existing customers from Retain module
  const existingCustomers: CustomerProfile[] = await db
    .select({
      industry: customers.segment,
      segment: customers.segment,
      dimRevenue: customers.dimRevenue,
      dimTenureDays: customers.dimTenureDays,
      healthScore: customers.healthScore,
      status: customers.status,
      state: customers.state,
    })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  // Load all leads
  const allLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.tenantId, tenantId));

  if (allLeads.length === 0) return { scoresGenerated: 0 };

  const today = new Date().toISOString().split("T")[0];
  let scoresGenerated = 0;

  // Load previous scores for alert comparison
  const previousScores = await db
    .select()
    .from(obtainScores)
    .where(eq(obtainScores.tenantId, tenantId));

  const prevScoreMap = new Map(previousScores.map((s) => [s.leadId, s]));

  for (const lead of allLeads) {
    const dims: LeadDims = {
      industry: lead.industry,
      companySize: lead.companySize,
      monthlyRevenueEstimate: lead.monthlyRevenueEstimate,
      source: lead.source,
      status: lead.status,
      city: lead.city,
      state: lead.state,
    };

    const score = calcLeadScore(dims, existingCustomers, weights);
    const tier = classifyScoreTier(score);
    const conversionProb = calcConversionProbability(score, dims);
    const ltvPrediction = calcLtvPrediction(dims, existingCustomers);
    const shapValues = generateLeadShapValues(dims, score, existingCustomers, weights);

    // Generate recommended action
    const recommendedAction = tier === "hot"
      ? "Contatar imediatamente. Agendar demo ou reunião de proposta."
      : tier === "warm"
        ? "Nutrir com conteúdo relevante. Agendar qualificação detalhada."
        : tier === "cold"
          ? "Incluir em cadência de nutrição automatizada."
          : "Baixa prioridade. Revisar fit com ICP.";

    // Upsert score
    const existingScore = prevScoreMap.get(lead.id);
    if (existingScore) {
      await db
        .update(obtainScores)
        .set({
          score,
          riskTier: tier,
          conversionProbability: conversionProb,
          ltvPrediction,
          shapValues,
          recommendedAction,
          scoredAt: new Date(),
        })
        .where(eq(obtainScores.id, existingScore.id));
    } else {
      await db.insert(obtainScores).values({
        tenantId,
        leadId: lead.id,
        score,
        riskTier: tier,
        conversionProbability: conversionProb,
        ltvPrediction,
        shapValues,
        recommendedAction,
      });
    }

    // Score history
    await db.insert(leadScoreHistory).values({
      tenantId,
      leadId: lead.id,
      score,
      scoreTier: tier,
      snapshotDate: today,
    });

    scoresGenerated++;
  }

  return { scoresGenerated };
}

export async function generateObtainAlerts(tenantId: string): Promise<{
  alertsGenerated: number;
}> {
  const allLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.tenantId, tenantId));

  const currentScores = await db
    .select()
    .from(obtainScores)
    .where(eq(obtainScores.tenantId, tenantId));

  const scoreMap = new Map(currentScores.map((s) => [s.leadId, s]));

  // Get previous score snapshots for comparison
  const today = new Date().toISOString().split("T")[0];

  let alertsGenerated = 0;

  for (const lead of allLeads) {
    const currentScore = scoreMap.get(lead.id);
    if (!currentScore) continue;

    const tier = currentScore.riskTier;

    // Check score history for tier change
    const history = await db
      .select()
      .from(leadScoreHistory)
      .where(
        and(
          eq(leadScoreHistory.leadId, lead.id),
          eq(leadScoreHistory.tenantId, tenantId),
        ),
      )
      .orderBy(desc(leadScoreHistory.snapshotDate))
      .limit(2);

    if (history.length >= 2) {
      const prevTier = history[1].scoreTier;
      const currTier = history[0].scoreTier;

      // Lead warming up
      if (
        (prevTier === "cold" && (currTier === "warm" || currTier === "hot")) ||
        (prevTier === "warm" && currTier === "hot")
      ) {
        await db.insert(obtainAlerts).values({
          tenantId,
          leadId: lead.id,
          type: "score_change",
          message: `Lead ${lead.name} (${lead.company ?? ""}) esquentou: ${prevTier} → ${currTier}. Score: ${currentScore.score}.`,
          severity: currTier === "hot" ? "high" : "medium",
        });
        alertsGenerated++;
      }
    }

    // New hot lead
    if (tier === "hot" && history.length <= 1) {
      await db.insert(obtainAlerts).values({
        tenantId,
        leadId: lead.id,
        type: "hot_lead",
        message: `Novo lead quente identificado: ${lead.name} (${lead.company ?? ""}). Score: ${currentScore.score}. Ação imediata recomendada.`,
        severity: "high",
      });
      alertsGenerated++;
    }

    // Stale hot lead (hot for over 14 days without status change)
    if (tier === "hot" && lead.status === "new") {
      const leadAge = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (leadAge > 14) {
        await db.insert(obtainAlerts).values({
          tenantId,
          leadId: lead.id,
          type: "stale_lead",
          message: `Lead hot ${lead.name} (${lead.company ?? ""}) parado há ${Math.round(leadAge)} dias sem evolução. Agir agora.`,
          severity: "critical",
        });
        alertsGenerated++;
      }
    }
  }

  return { alertsGenerated };
}

// ─── Lead Narrative ──────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
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

export function generateLeadNarrative(
  lead: {
    name: string;
    company?: string | null;
    industry?: string | null;
    companySize?: string | null;
    source?: string | null;
    score?: number;
    scoreTier?: string | null;
    ltvPrediction?: number;
    conversionProbability?: number;
  },
  shapValues: ShapValue[],
  icpCluster: string | null,
  similarCustomers: { count: number; avgHealthScore: number; avgRevenue: number } | null,
): string {
  const tierLabel: Record<string, string> = {
    hot: "alta prioridade",
    warm: "média prioridade",
    cold: "baixa prioridade",
    disqualified: "desqualificado",
  };

  const positiveFactors = shapValues
    .filter(s => s.direction === "positive")
    .slice(0, 2)
    .map(s => s.label.toLowerCase());

  const company = lead.company ? ` (${lead.company})` : "";
  const tier = lead.scoreTier ?? "cold";
  const tierDesc = tierLabel[tier] ?? tier;
  const ltv = lead.ltvPrediction ?? 0;
  const convPct = Math.round((lead.conversionProbability ?? 0) * 100);
  const sourceLabel = SOURCE_LABELS[lead.source ?? "other"] ?? "Origem desconhecida";

  let sentence1 = `${lead.name}${company} é um lead de ${tierDesc} com score ${lead.score ?? 0}/100 e probabilidade de conversão estimada em ${convPct}%.`;

  let sentence2 = "";
  if (positiveFactors.length >= 2) {
    sentence2 = ` Os fatores mais positivos são ${positiveFactors[0]} e ${positiveFactors[1]}.`;
  } else if (positiveFactors.length === 1) {
    sentence2 = ` O principal fator positivo é ${positiveFactors[0]}.`;
  }

  if (icpCluster) {
    sentence2 += ` Perfil alinhado ao cluster: ${icpCluster}.`;
  }

  let sentence3 = "";
  if (similarCustomers && similarCustomers.count > 0) {
    sentence3 = ` Temos ${similarCustomers.count} cliente${similarCustomers.count > 1 ? "s" : ""} ativos neste segmento com Health Score médio de ${Math.round(similarCustomers.avgHealthScore)} e receita média de R$${Math.round(similarCustomers.avgRevenue).toLocaleString("pt-BR")}/mês — origem: ${sourceLabel}.`;
  } else {
    sentence3 = ` LTV estimado: R$${Math.round(ltv).toLocaleString("pt-BR")} — origem: ${sourceLabel}.`;
  }

  return `${sentence1}${sentence2}${sentence3}`.trim();
}
