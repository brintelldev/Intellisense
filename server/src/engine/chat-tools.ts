// server/src/engine/chat-tools.ts
//
// As 12 tools que o chatbot do IntelliSense pode chamar.
// Todas são READ-ONLY e recebem `tenantId` do contexto — o LLM NUNCA vê o tenantId.
//
// Cada tool tem:
//   - definition: schema no formato esperado pela API da OpenAI (compatível com OpenRouter)
//   - input: Zod schema para validar runtime o que o LLM enviou
//   - handle: função que recebe input validado + contexto (tenantId) e retorna dados

import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { db } from "../db.js";
import {
  customers,
  retainPredictions,
  retainChurnCauses,
  retainAnalytics,
  leads,
  obtainScores,
  obtainIcpClusters,
  obtainCampaigns,
  obtainCampaignRoi,
  obtainFunnelMetrics,
} from "../../../shared/schema.js";

// ────────────────────────────────────────────────────────────────────────────
// Context injetado pelo chat-engine (NUNCA vem do LLM)
// ────────────────────────────────────────────────────────────────────────────
export interface ToolContext {
  tenantId: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Util: formata dinheiro em BRL para strings consumíveis pelo LLM
// ────────────────────────────────────────────────────────────────────────────
const fmtBRL = (v: number | null | undefined) =>
  v == null
    ? null
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ────────────────────────────────────────────────────────────────────────────
// Tipo genérico de uma tool
// ────────────────────────────────────────────────────────────────────────────
interface Tool<I = unknown, O = unknown> {
  definition: ChatCompletionTool;
  input: z.ZodType<I>;
  handle: (input: I, ctx: ToolContext) => Promise<O>;
}

function tool<I, O>(t: Tool<I, O>): Tool<I, O> {
  return t;
}

// ============================================================================
// TOOL 1 — get_overview_metrics
// ============================================================================
const getOverviewMetrics = tool({
  definition: {
    type: "function",
    function: {
      name: "get_overview_metrics",
      description:
        "Retorna KPIs gerais da base: total de clientes ativos, em risco, churnados, MRR, receita em risco, health score médio e NPS. Use para responder perguntas resumo como 'como está minha base?' ou 'qual meu health médio?'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  input: z.object({}),
  async handle(_input, { tenantId }) {
    // Agregados em uma única query
    const [row] = await db
      .select({
        // "active" no contexto analítico = status IN ('active','at_risk') (não churnados)
        total: sql<number>`count(*) filter (where ${customers.status} != 'churned')::int`,
        active: sql<number>`count(*) filter (where ${customers.status} in ('active','at_risk'))::int`,
        atRisk: sql<number>`count(*) filter (where ${customers.status} = 'at_risk')::int`,
        churned: sql<number>`count(*) filter (where ${customers.status} = 'churned')::int`,
        critical: sql<number>`count(*) filter (where ${customers.riskLevel} = 'critical')::int`,
        mrr: sql<number>`coalesce(sum(${customers.dimRevenue}) filter (where ${customers.status} in ('active','at_risk')), 0)::float`,
        revenueAtRisk: sql<number>`coalesce(sum(${customers.dimRevenue}) filter (where ${customers.riskLevel} in ('high','critical') and ${customers.status} in ('active','at_risk')), 0)::float`,
        avgHealth: sql<number>`coalesce(avg(${customers.healthScore}) filter (where ${customers.status} in ('active','at_risk')), 0)::float`,
        avgSatisfaction: sql<number>`coalesce(avg(${customers.dimSatisfaction}) filter (where ${customers.status} in ('active','at_risk')), 0)::float`,
        promoters: sql<number>`count(*) filter (where ${customers.dimSatisfaction} >= 90 and ${customers.status} in ('active','at_risk'))::int`,
        detractors: sql<number>`count(*) filter (where ${customers.dimSatisfaction} < 70 and ${customers.dimSatisfaction} is not null and ${customers.status} in ('active','at_risk'))::int`,
      })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    const npsTotal = row.total > 0 ? row.total : 1;
    const nps = Math.round(((row.promoters - row.detractors) / npsTotal) * 100);

    return {
      totalCustomers: row.total,
      activeCustomers: row.active,
      churnedCustomers: row.churned,
      atRiskCustomers: row.atRisk,
      criticalCustomers: row.critical,
      mrr: row.mrr,
      mrrFormatted: fmtBRL(row.mrr),
      revenueAtRisk: row.revenueAtRisk,
      revenueAtRiskFormatted: fmtBRL(row.revenueAtRisk),
      avgHealthScore: Math.round(row.avgHealth),
      avgSatisfaction: Math.round(row.avgSatisfaction),
      nps,
    };
  },
});

// ============================================================================
// TOOL 2 — list_customers_at_risk
// ============================================================================
const listCustomersAtRisk = tool({
  definition: {
    type: "function",
    function: {
      name: "list_customers_at_risk",
      description:
        "Lista os top N clientes ativos ordenados por probabilidade de churn. Filtros opcionais: riskLevel ('high' ou 'critical'), receita mínima, limit (padrão 10, máx 50).",
      parameters: {
        type: "object",
        properties: {
          riskLevel: {
            type: "string",
            enum: ["high", "critical", "any"],
            description: "Filtrar por nível de risco. 'any' = high + critical.",
          },
          minRevenue: {
            type: "number",
            description: "Receita mensal mínima em reais.",
          },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  input: z.object({
    riskLevel: z.enum(["high", "critical", "any"]).optional().default("any"),
    minRevenue: z.number().nonnegative().optional(),
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
  async handle(input, { tenantId }) {
    const conditions = [
      eq(customers.tenantId, tenantId),
      // Inclui status 'active' e 'at_risk' (ambos são clientes ativos, não churnados)
      sql`${customers.status} in ('active','at_risk')`,
    ];

    if (input.riskLevel === "high") {
      conditions.push(eq(customers.riskLevel, "high"));
    } else if (input.riskLevel === "critical") {
      conditions.push(eq(customers.riskLevel, "critical"));
    } else {
      conditions.push(sql`${customers.riskLevel} in ('high','critical')`);
    }

    if (input.minRevenue != null) {
      conditions.push(gte(customers.dimRevenue, input.minRevenue));
    }

    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        segment: customers.segment,
        revenue: customers.dimRevenue,
        healthScore: customers.healthScore,
        churnProbability: customers.churnProbability,
        riskLevel: customers.riskLevel,
        contractRemainingDays: customers.dimContractRemainingDays,
      })
      .from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.churnProbability))
      .limit(input.limit ?? 10);

    return {
      count: rows.length,
      customers: rows.map((r) => ({
        id: r.id,
        name: r.name,
        segment: r.segment,
        revenue: r.revenue,
        revenueFormatted: fmtBRL(r.revenue),
        healthScore: r.healthScore,
        churnProbabilityPct: r.churnProbability != null ? Math.round(r.churnProbability * 100) : null,
        riskLevel: r.riskLevel,
        contractRemainingDays: r.contractRemainingDays,
      })),
    };
  },
});

// ============================================================================
// TOOL 3 — get_customer_detail
// ============================================================================
const getCustomerDetail = tool({
  definition: {
    type: "function",
    function: {
      name: "get_customer_detail",
      description:
        "Retorna detalhes de UM cliente específico por id ou por nome aproximado (ILIKE): dimensões, health score, churn probability, SHAP waterfall (fatores que mais impactaram o score) e ação recomendada.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string", description: "UUID do cliente (se conhecido)." },
          name: { type: "string", description: "Nome ou parte do nome (busca parcial case-insensitive)." },
        },
        additionalProperties: false,
      },
    },
  },
  input: z
    .object({
      customerId: z.string().uuid().optional(),
      name: z.string().min(2).optional(),
    })
    .refine((d) => d.customerId || d.name, {
      message: "É necessário informar customerId ou name.",
    }),
  async handle(input, { tenantId }) {
    const conditions = [eq(customers.tenantId, tenantId)];
    if (input.customerId) {
      conditions.push(eq(customers.id, input.customerId));
    } else if (input.name) {
      conditions.push(
        sql`unaccent(${customers.name}) ilike unaccent(${"%" + input.name + "%"})`,
      );
    }

    const [customer] = await db
      .select()
      .from(customers)
      .where(and(...conditions))
      .limit(1);

    if (!customer) {
      return { found: false, message: "Cliente não encontrado no tenant." };
    }

    const [prediction] = await db
      .select()
      .from(retainPredictions)
      .where(
        and(
          eq(retainPredictions.tenantId, tenantId),
          eq(retainPredictions.customerId, customer.id),
          eq(retainPredictions.isActive, true),
        ),
      )
      .orderBy(desc(retainPredictions.predictedAt))
      .limit(1);

    return {
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        segment: customer.segment,
        city: customer.city,
        state: customer.state,
        revenue: customer.dimRevenue,
        revenueFormatted: fmtBRL(customer.dimRevenue),
        healthScore: customer.healthScore,
        churnProbabilityPct: customer.churnProbability != null ? Math.round(customer.churnProbability * 100) : null,
        riskLevel: customer.riskLevel,
        status: customer.status,
        dimensions: {
          satisfaction: customer.dimSatisfaction,
          paymentRegularity: customer.dimPaymentRegularity,
          tenureDays: customer.dimTenureDays,
          interactionFrequency: customer.dimInteractionFrequency,
          supportVolume: customer.dimSupportVolume,
          contractRemainingDays: customer.dimContractRemainingDays,
          usageIntensity: customer.dimUsageIntensity,
          recencyDays: customer.dimRecencyDays,
        },
      },
      prediction: prediction
        ? {
            churnProbabilityPct: Math.round(prediction.churnProbability * 100),
            riskLevel: prediction.riskLevel,
            confidencePct: prediction.confidence != null ? Math.round(prediction.confidence * 100) : null,
            shapValues: prediction.shapValues ?? [],
            recommendedAction: prediction.recommendedAction,
          }
        : null,
    };
  },
});

// ============================================================================
// TOOL 4 — get_churn_root_causes
// ============================================================================
const getChurnRootCauses = tool({
  definition: {
    type: "function",
    function: {
      name: "get_churn_root_causes",
      description:
        "Retorna as causas raiz agregadas do churn na base do tenant: categoria, % de impacto, clientes afetados e receita em risco por causa. Responde perguntas como 'o que mais causa churn?'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  input: z.object({}),
  async handle(_input, { tenantId }) {
    const rows = await db
      .select()
      .from(retainChurnCauses)
      .where(eq(retainChurnCauses.tenantId, tenantId))
      .orderBy(desc(retainChurnCauses.impactPct));

    return {
      count: rows.length,
      causes: rows.map((r) => ({
        cause: r.cause,
        category: r.category,
        impactPct: r.impactPct,
        affectedCustomers: r.affectedCustomers,
        revenueAtRisk: r.revenueAtRisk,
        revenueAtRiskFormatted: fmtBRL(r.revenueAtRisk),
        trend: r.trend,
      })),
    };
  },
});

// ============================================================================
// TOOL 5 — get_revenue_at_risk_breakdown
// ============================================================================
const getRevenueAtRiskBreakdown = tool({
  definition: {
    type: "function",
    function: {
      name: "get_revenue_at_risk_breakdown",
      description:
        "Quebra a receita em risco por segmento/categoria do cliente. Útil para identificar onde a dor se concentra.",
      parameters: {
        type: "object",
        properties: {
          groupBy: {
            type: "string",
            enum: ["segment", "riskLevel", "state"],
            default: "segment",
            description: "Dimensão de agrupamento.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  input: z.object({
    groupBy: z.enum(["segment", "riskLevel", "state"]).optional().default("segment"),
  }),
  async handle(input, { tenantId }) {
    const groupCol =
      input.groupBy === "segment"
        ? customers.segment
        : input.groupBy === "state"
          ? customers.state
          : customers.riskLevel;

    const rows = await db
      .select({
        group: groupCol,
        customers: sql<number>`count(*)::int`,
        revenueAtRisk: sql<number>`coalesce(sum(${customers.dimRevenue}), 0)::float`,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          sql`${customers.status} in ('active','at_risk')`,
          sql`${customers.riskLevel} in ('high','critical')`,
        ),
      )
      .groupBy(groupCol)
      .orderBy(sql`sum(${customers.dimRevenue}) desc nulls last`);

    return {
      groupBy: input.groupBy,
      breakdown: rows.map((r) => ({
        group: r.group ?? "(não informado)",
        customersCount: r.customers,
        revenueAtRisk: r.revenueAtRisk,
        revenueAtRiskFormatted: fmtBRL(r.revenueAtRisk),
      })),
    };
  },
});

// ============================================================================
// TOOL 6 — get_nps_breakdown
// ============================================================================
const getNpsBreakdown = tool({
  definition: {
    type: "function",
    function: {
      name: "get_nps_breakdown",
      description:
        "Retorna NPS atual (calculado a partir de dimSatisfaction), quantidades de promotores/neutros/detratores e lista top detratores ordenada por receita. Escala interna: dimSatisfaction está em 0-100, onde >=90 é promotor, 70-89 neutro, <70 detrator.",
      parameters: {
        type: "object",
        properties: {
          topDetractors: { type: "integer", minimum: 0, maximum: 20, default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  input: z.object({
    topDetractors: z.number().int().min(0).max(20).optional().default(10),
  }),
  async handle(input, { tenantId }) {
    const [agg] = await db
      .select({
        total: sql<number>`count(*) filter (where ${customers.dimSatisfaction} is not null)::int`,
        promoters: sql<number>`count(*) filter (where ${customers.dimSatisfaction} >= 90)::int`,
        passives: sql<number>`count(*) filter (where ${customers.dimSatisfaction} between 70 and 89)::int`,
        detractors: sql<number>`count(*) filter (where ${customers.dimSatisfaction} < 70 and ${customers.dimSatisfaction} is not null)::int`,
        revenueAtRisk: sql<number>`coalesce(sum(${customers.dimRevenue}) filter (where ${customers.dimSatisfaction} < 70 and ${customers.dimSatisfaction} is not null), 0)::float`,
      })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), sql`${customers.status} in ('active','at_risk')`));

    const total = agg.total > 0 ? agg.total : 1;
    const nps = Math.round(((agg.promoters - agg.detractors) / total) * 100);

    const topN = input.topDetractors ?? 5;
    const detractors = topN > 0
      ? await db
          .select({
            id: customers.id,
            name: customers.name,
            revenue: customers.dimRevenue,
            satisfaction: customers.dimSatisfaction,
            supportVolume: customers.dimSupportVolume,
          })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              sql`${customers.status} in ('active','at_risk')`,
              sql`${customers.dimSatisfaction} < 70 and ${customers.dimSatisfaction} is not null`,
            ),
          )
          .orderBy(desc(customers.dimRevenue))
          .limit(topN)
      : [];

    return {
      nps,
      total: agg.total,
      distribution: {
        promoters: agg.promoters,
        passives: agg.passives,
        detractors: agg.detractors,
      },
      revenueAtRisk: agg.revenueAtRisk,
      revenueAtRiskFormatted: fmtBRL(agg.revenueAtRisk),
      topDetractors: detractors.map((d) => ({
        id: d.id,
        name: d.name,
        revenue: d.revenue,
        revenueFormatted: fmtBRL(d.revenue),
        satisfaction: d.satisfaction,
        supportVolume: d.supportVolume,
      })),
    };
  },
});

// ============================================================================
// TOOL 7 — list_leads_by_score
// ============================================================================
const listLeadsByScore = tool({
  definition: {
    type: "function",
    function: {
      name: "list_leads_by_score",
      description:
        "Lista leads do Obtain Sense ordenados por score/probabilidade de conversão, filtrando por tier (hot/warm/cold/disqualified).",
      parameters: {
        type: "object",
        properties: {
          tier: {
            type: "string",
            enum: ["hot", "warm", "cold", "disqualified", "any"],
            default: "any",
          },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  input: z.object({
    tier: z.enum(["hot", "warm", "cold", "disqualified", "any"]).optional().default("any"),
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
  async handle(input, { tenantId }) {
    const conditions = [eq(obtainScores.tenantId, tenantId)];
    const tier = input.tier ?? "any";
    if (tier !== "any") {
      conditions.push(eq(obtainScores.riskTier, tier));
    }

    const rows = await db
      .select({
        leadId: leads.id,
        name: leads.name,
        company: leads.company,
        source: leads.source,
        revenueEst: leads.monthlyRevenueEstimate,
        score: obtainScores.score,
        conversionProbability: obtainScores.conversionProbability,
        tier: obtainScores.riskTier,
        ltvPrediction: obtainScores.ltvPrediction,
      })
      .from(obtainScores)
      .innerJoin(leads, eq(leads.id, obtainScores.leadId))
      .where(and(...conditions))
      .orderBy(desc(obtainScores.score))
      .limit(input.limit ?? 10);

    return {
      count: rows.length,
      leads: rows.map((r) => ({
        id: r.leadId,
        name: r.name,
        company: r.company,
        source: r.source,
        monthlyRevenueEstimate: r.revenueEst,
        monthlyRevenueEstimateFormatted: fmtBRL(r.revenueEst),
        score: r.score,
        conversionProbabilityPct: Math.round(r.conversionProbability * 100),
        tier: r.tier,
        ltvPrediction: r.ltvPrediction,
        ltvPredictionFormatted: fmtBRL(r.ltvPrediction),
      })),
    };
  },
});

// ============================================================================
// TOOL 8 — get_lead_detail
// ============================================================================
const getLeadDetail = tool({
  definition: {
    type: "function",
    function: {
      name: "get_lead_detail",
      description:
        "Detalhes de UM lead por id ou nome/empresa aproximada: score, tier, probabilidade de conversão, LTV previsto, SHAP e ação recomendada.",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string", description: "UUID do lead." },
          query: {
            type: "string",
            description: "Nome, empresa ou email parcial do lead (ILIKE).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  input: z
    .object({
      leadId: z.string().uuid().optional(),
      query: z.string().min(2).optional(),
    })
    .refine((d) => d.leadId || d.query, {
      message: "É necessário informar leadId ou query.",
    }),
  async handle(input, { tenantId }) {
    const conditions = [eq(leads.tenantId, tenantId)];
    if (input.leadId) {
      conditions.push(eq(leads.id, input.leadId));
    } else if (input.query) {
      conditions.push(
        sql`(unaccent(${leads.name}) ilike unaccent(${"%" + input.query + "%"}) or unaccent(${leads.company}) ilike unaccent(${"%" + input.query + "%"}) or ${leads.email} ilike ${"%" + input.query + "%"})`,
      );
    }

    const [lead] = await db.select().from(leads).where(and(...conditions)).limit(1);
    if (!lead) return { found: false, message: "Lead não encontrado no tenant." };

    const [score] = await db
      .select()
      .from(obtainScores)
      .where(and(eq(obtainScores.tenantId, tenantId), eq(obtainScores.leadId, lead.id)))
      .orderBy(desc(obtainScores.scoredAt))
      .limit(1);

    return {
      found: true,
      lead: {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        industry: lead.industry,
        companySize: lead.companySize,
        source: lead.source,
        status: lead.status,
        monthlyRevenueEstimate: lead.monthlyRevenueEstimate,
        monthlyRevenueEstimateFormatted: fmtBRL(lead.monthlyRevenueEstimate),
        city: lead.city,
        state: lead.state,
      },
      score: score
        ? {
            score: score.score,
            tier: score.riskTier,
            conversionProbabilityPct: Math.round(score.conversionProbability * 100),
            ltvPrediction: score.ltvPrediction,
            ltvPredictionFormatted: fmtBRL(score.ltvPrediction),
            shapValues: score.shapValues ?? [],
            recommendedAction: score.recommendedAction,
            recommendedOffer: score.recommendedOffer,
          }
        : null,
    };
  },
});

// ============================================================================
// TOOL 9 — get_icp_clusters
// ============================================================================
const getIcpClusters = tool({
  definition: {
    type: "function",
    function: {
      name: "get_icp_clusters",
      description:
        "Retorna os clusters ICP (Ideal Customer Profile) do tenant, com LTV médio, CAC médio, taxa de conversão e características agregadas. Use para perguntas como 'qual meu perfil ideal de cliente?' ou 'quais clusters tenho?'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  input: z.object({}),
  async handle(_input, { tenantId }) {
    const rows = await db
      .select()
      .from(obtainIcpClusters)
      .where(eq(obtainIcpClusters.tenantId, tenantId))
      .orderBy(desc(obtainIcpClusters.averageLtv));

    return {
      count: rows.length,
      clusters: rows.map((r) => ({
        id: r.id,
        clusterId: r.clusterId,
        name: r.clusterName,
        description: r.description,
        isIdeal: r.isIdeal,
        averageLtv: r.averageLtv,
        averageLtvFormatted: fmtBRL(r.averageLtv),
        averageCac: r.averageCac,
        averageCacFormatted: fmtBRL(r.averageCac),
        averageTenureDays: r.averageTenureDays,
        averageConversionRatePct:
          r.averageConversionRate != null ? Math.round(r.averageConversionRate * 100) : null,
        churnRate30dPct: r.churnRate30d != null ? Math.round(r.churnRate30d * 100) : null,
        churnRate90dPct: r.churnRate90d != null ? Math.round(r.churnRate90d * 100) : null,
        characteristics: r.characteristics,
      })),
    };
  },
});

// ============================================================================
// TOOL 10 — compare_acquisition_channels
// ============================================================================
const compareAcquisitionChannels = tool({
  definition: {
    type: "function",
    function: {
      name: "compare_acquisition_channels",
      description:
        "Compara canais de aquisição (campanhas) por CAC, LTV previsto, ROI projetado e número de leads. Útil para decidir onde investir/cortar orçamento.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  input: z.object({}),
  async handle(_input, { tenantId }) {
    const rows = await db
      .select({
        channel: obtainCampaigns.channel,
        name: obtainCampaigns.name,
        totalLeads: obtainCampaignRoi.totalLeads,
        qualifiedLeads: obtainCampaignRoi.qualifiedLeads,
        totalCac: obtainCampaignRoi.totalCac,
        avgLtvPrediction: obtainCampaignRoi.averageLtvPrediction,
        projectedRoi: obtainCampaignRoi.projectedRoi,
        roiStatus: obtainCampaignRoi.roiStatus,
      })
      .from(obtainCampaigns)
      .leftJoin(
        obtainCampaignRoi,
        and(
          eq(obtainCampaignRoi.campaignId, obtainCampaigns.id),
          eq(obtainCampaignRoi.tenantId, tenantId),
        ),
      )
      .where(eq(obtainCampaigns.tenantId, tenantId))
      .orderBy(desc(obtainCampaignRoi.projectedRoi));

    return {
      count: rows.length,
      channels: rows.map((r) => ({
        channel: r.channel,
        campaignName: r.name,
        totalLeads: r.totalLeads,
        qualifiedLeads: r.qualifiedLeads,
        cac: r.totalCac,
        cacFormatted: fmtBRL(r.totalCac),
        avgLtvPrediction: r.avgLtvPrediction,
        avgLtvFormatted: fmtBRL(r.avgLtvPrediction),
        projectedRoi: r.projectedRoi,
        projectedRoiPct: r.projectedRoi != null ? Math.round(r.projectedRoi * 100) : null,
        roiStatus: r.roiStatus,
      })),
    };
  },
});

// ============================================================================
// TOOL 11 — get_funnel_analysis
// ============================================================================
const getFunnelAnalysis = tool({
  definition: {
    type: "function",
    function: {
      name: "get_funnel_analysis",
      description:
        "Análise do funil de aquisição por etapa: número de leads em cada etapa, tempo médio, taxa de drop-off e receita em risco. Identifica gargalos.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  input: z.object({}),
  async handle(_input, { tenantId }) {
    const rows = await db
      .select()
      .from(obtainFunnelMetrics)
      .where(eq(obtainFunnelMetrics.tenantId, tenantId))
      .orderBy(obtainFunnelMetrics.stageOrder);

    return {
      count: rows.length,
      stages: rows.map((r) => ({
        name: r.stageName,
        order: r.stageOrder,
        leadsCount: r.leadsCount,
        avgTimeDays: r.avgTimeDays,
        dropOffRatePct: r.dropOffRate != null ? Math.round(r.dropOffRate * 100) : null,
        revenueAtRisk: r.revenueAtRisk,
        revenueAtRiskFormatted: fmtBRL(r.revenueAtRisk),
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
      })),
    };
  },
});

// ============================================================================
// TOOL 12 — get_temporal_trend
// ============================================================================
const getTemporalTrend = tool({
  definition: {
    type: "function",
    function: {
      name: "get_temporal_trend",
      description:
        "Evolução temporal de KPIs da base (snapshots). Retorna série temporal de totalCustomers, atRiskCustomers, mrr, revenueAtRisk e avgHealthScore nos últimos N dias.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "integer", minimum: 1, maximum: 365, default: 90 },
        },
        additionalProperties: false,
      },
    },
  },
  input: z.object({
    days: z.number().int().min(1).max(365).optional().default(90),
  }),
  async handle(input, { tenantId }) {
    const rows = await db
      .select()
      .from(retainAnalytics)
      .where(
        and(
          eq(retainAnalytics.tenantId, tenantId),
          sql`${retainAnalytics.snapshotDate} >= current_date - ${sql.raw(String(input.days))} * interval '1 day'`,
        ),
      )
      .orderBy(retainAnalytics.snapshotDate);

    return {
      count: rows.length,
      periodDays: input.days,
      snapshots: rows.map((r) => ({
        date: r.snapshotDate,
        totalCustomers: r.totalCustomers,
        activeCustomers: r.activeCustomers,
        atRiskCustomers: r.atRiskCustomers,
        churnedCustomers: r.churnedCustomers,
        churnRate: r.churnRate,
        mrr: r.mrr,
        mrrFormatted: fmtBRL(r.mrr),
        revenueAtRisk: r.revenueAtRisk,
        revenueAtRiskFormatted: fmtBRL(r.revenueAtRisk),
        avgHealthScore: r.avgHealthScore,
      })),
    };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────────────
export const ALL_TOOLS = {
  get_overview_metrics: getOverviewMetrics,
  list_customers_at_risk: listCustomersAtRisk,
  get_customer_detail: getCustomerDetail,
  get_churn_root_causes: getChurnRootCauses,
  get_revenue_at_risk_breakdown: getRevenueAtRiskBreakdown,
  get_nps_breakdown: getNpsBreakdown,
  list_leads_by_score: listLeadsByScore,
  get_lead_detail: getLeadDetail,
  get_icp_clusters: getIcpClusters,
  compare_acquisition_channels: compareAcquisitionChannels,
  get_funnel_analysis: getFunnelAnalysis,
  get_temporal_trend: getTemporalTrend,
} as const;

export type ToolName = keyof typeof ALL_TOOLS;

/** Retorna as definições no formato que o OpenRouter/OpenAI espera. */
export function getToolDefinitions(): ChatCompletionTool[] {
  return Object.values(ALL_TOOLS).map((t) => t.definition);
}

/**
 * Executa uma tool por nome, validando o input com Zod.
 * `tenantId` vem do contexto server-side — JAMAIS vem do LLM.
 */
export async function executeTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const tool = (ALL_TOOLS as Record<string, Tool<unknown, unknown>>)[name];
  if (!tool) {
    return { ok: false, error: `Tool desconhecida: ${name}` };
  }

  const parsed = tool.input.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Argumentos inválidos: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    };
  }

  try {
    const result = await tool.handle(parsed.data, ctx);
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Erro ao executar ${name}: ${message}` };
  }
}
