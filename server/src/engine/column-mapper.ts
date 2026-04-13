// ─── Intelligent Column Mapper ──────────────────────────────────────────────
// Auto-detects mappings from CSV headers to IntelliSense dimensions
// using synonyms (pt-BR + en), value analysis, and confidence scoring.

export interface SuggestedMapping {
  csvColumn: string;
  suggestedDimension: string | null; // null = no suggestion
  confidence: "high" | "medium" | "low";
  confidenceScore: number; // 0-1
  reason: string;
}

type Module = "retain" | "obtain";

// ─── Synonym Dictionaries ───────────────────────────────────────────────────

const RETAIN_SYNONYMS: Record<string, string[]> = {
  // System fields
  customerCode: [
    "id", "codigo", "código", "code", "customer_code", "cod_cliente",
    "codigo_cliente", "id_cliente", "customer_id", "client_id",
  ],
  name: [
    "name", "nome", "razao_social", "razão_social", "empresa", "company",
    "nome_empresa", "company_name", "cliente", "customer",
  ],
  email: ["email", "e-mail", "e_mail", "mail", "email_contato"],
  phone: ["phone", "telefone", "fone", "tel", "celular", "whatsapp"],
  city: ["city", "cidade", "municipio", "município"],
  state: ["state", "estado", "uf", "sigla_uf"],
  segment: ["segment", "segmento", "setor", "sector", "industry", "ramo"],

  // 9 Universal Dimensions
  dimRevenue: [
    "revenue", "receita", "faturamento", "faturamento_mensal", "mrr",
    "monthly_revenue", "valor_contrato", "contrato_mensal", "mensalidade",
    "dim_revenue", "receita_mensal", "valor_mensal",
  ],
  dimPaymentRegularity: [
    "payment_regularity", "regularidade_pagamento", "dias_atraso",
    "dias_atraso_pgto", "payment_delay", "payment_delay_days",
    "atraso_medio", "atraso_pagamento", "dim_payment_regularity",
    "inadimplencia", "days_overdue",
  ],
  dimTenureDays: [
    "tenure", "tenure_days", "tempo_relacionamento", "meses_contrato",
    "months_active", "dias_cliente", "tempo_cliente", "dim_tenure_days",
    "antiguidade", "meses_ativo",
  ],
  dimInteractionFrequency: [
    "interaction_frequency", "frequencia_interacao", "frequência_interação",
    "contatos_mes", "frequencia_contato", "interactions", "touchpoints",
    "dim_interaction_frequency", "reunioes_mes",
  ],
  dimSupportVolume: [
    "support_volume", "chamados", "tickets", "tickets_abertos",
    "chamados_abertos", "support_tickets", "tickets_open",
    "dim_support_volume", "qtd_chamados", "suporte",
  ],
  dimSatisfaction: [
    "satisfaction", "satisfacao", "satisfação", "nps", "csat",
    "nota_satisfacao", "nota_nps", "customer_satisfaction",
    "dim_satisfaction", "nota", "avaliacao", "avaliação",
    "csat_score", "score_satisfacao",
  ],
  dimContractRemainingDays: [
    "contract_remaining", "dias_restantes_contrato", "contract_days_left",
    "contract_remaining_days", "vigencia_restante", "dim_contract_remaining_days",
    "dias_contrato", "vencimento", "prazo_contrato",
  ],
  dimUsageIntensity: [
    "usage_intensity", "intensidade_uso", "uso", "usage",
    "horas_uso", "horas_maquina", "horas_maquina_mes",
    "feature_adoption", "feature_adoption_pct", "logins_per_month",
    "logins_mes", "dim_usage_intensity", "utilizacao", "utilização",
  ],
  dimRecencyDays: [
    "recency", "recencia", "recência", "dias_sem_compra",
    "dias_sem_interacao", "days_since_last", "last_activity_days",
    "dim_recency_days", "dias_sem_pedido", "days_since_last_login",
    "ultima_compra", "último_contato",
  ],
};

const OBTAIN_SYNONYMS: Record<string, string[]> = {
  name: [
    "name", "nome", "nome_contato", "contact_name", "lead_name",
    "nome_lead", "responsavel", "responsável",
  ],
  email: ["email", "e-mail", "e_mail", "mail", "email_comercial", "email_contato"],
  phone: ["phone", "telefone", "fone", "tel", "celular", "whatsapp"],
  company: [
    "company", "empresa", "razao_social", "razão_social", "company_name",
    "nome_empresa", "organizacao", "organização",
  ],
  industry: [
    "industry", "setor", "segmento", "sector", "ramo", "industria",
    "indústria", "vertical",
  ],
  companySize: [
    "company_size", "porte", "tamanho", "size", "porte_empresa",
    "tamanho_empresa",
  ],
  city: ["city", "cidade", "municipio", "município"],
  state: ["state", "estado", "uf", "sigla_uf"],
  source: [
    "source", "origem", "canal", "channel", "fonte", "lead_source",
    "origem_lead",
  ],
  campaign: [
    "campaign", "campanha", "campaign_name", "nome_campanha",
    "campanha_origem",
  ],
  monthlyRevenueEstimate: [
    "revenue_estimate", "receita_estimada", "valor_estimado",
    "monthly_revenue", "faturamento_estimado",
  ],
};

// ─── Value Analysis ─────────────────────────────────────────────────────────

function analyzeValues(values: string[]): {
  isNumeric: boolean;
  isMonetary: boolean;
  isPercentage: boolean;
  isDate: boolean;
  isEmail: boolean;
  avgNumeric: number | null;
  minNumeric: number | null;
  maxNumeric: number | null;
} {
  const clean = values.filter((v) => v != null && v.trim() !== "");
  if (clean.length === 0) {
    return { isNumeric: false, isMonetary: false, isPercentage: false, isDate: false, isEmail: false, avgNumeric: null, minNumeric: null, maxNumeric: null };
  }

  const numericValues: number[] = [];
  let monetaryCount = 0;
  let percentCount = 0;
  let dateCount = 0;
  let emailCount = 0;

  for (const v of clean) {
    const trimmed = v.trim();

    // Check email
    if (/@/.test(trimmed) && /\.\w{2,}$/.test(trimmed)) emailCount++;

    // Check monetary
    if (/R\$|USD|\$/.test(trimmed)) monetaryCount++;

    // Check percentage
    if (/%/.test(trimmed)) percentCount++;

    // Check date
    if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(trimmed)) dateCount++;

    // Extract numeric
    const numStr = trimmed.replace(/[R$%,.\s]/g, "").replace(",", ".");
    const num = parseFloat(numStr);
    if (!isNaN(num)) numericValues.push(num);
  }

  const isNumeric = numericValues.length >= clean.length * 0.7;
  const avg = numericValues.length > 0
    ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
    : null;

  return {
    isNumeric,
    isMonetary: monetaryCount >= clean.length * 0.5,
    isPercentage: percentCount >= clean.length * 0.5,
    isDate: dateCount >= clean.length * 0.5,
    isEmail: emailCount >= clean.length * 0.5,
    avgNumeric: avg,
    minNumeric: numericValues.length > 0 ? Math.min(...numericValues) : null,
    maxNumeric: numericValues.length > 0 ? Math.max(...numericValues) : null,
  };
}

function inferDimensionFromValues(
  header: string,
  values: string[],
  module: Module,
): { dimension: string; confidence: number; reason: string } | null {
  const analysis = analyzeValues(values);

  if (analysis.isEmail) {
    return { dimension: "email", confidence: 0.9, reason: "Valores contêm formato de email" };
  }

  if (analysis.isDate) {
    if (module === "retain") {
      return { dimension: "dimContractRemainingDays", confidence: 0.4, reason: "Valores parecem datas (possível vencimento de contrato)" };
    }
    return null;
  }

  if (analysis.isMonetary || (analysis.isNumeric && analysis.avgNumeric != null && analysis.avgNumeric > 1000)) {
    const dim = module === "retain" ? "dimRevenue" : "monthlyRevenueEstimate";
    return { dimension: dim, confidence: 0.5, reason: "Valores numéricos altos sugerem receita/faturamento" };
  }

  if (analysis.isNumeric && analysis.avgNumeric != null) {
    // Score-like values (0-100)
    if (analysis.minNumeric != null && analysis.maxNumeric != null) {
      if (analysis.minNumeric >= 0 && analysis.maxNumeric <= 100 && analysis.avgNumeric > 10) {
        const headerLower = header.toLowerCase();
        if (headerLower.includes("nota") || headerLower.includes("score") || headerLower.includes("nps")) {
          return { dimension: "dimSatisfaction", confidence: 0.6, reason: "Valores 0-100 com header sugestivo de avaliação" };
        }
      }
      // Small numbers (0-30) could be tickets or days
      if (analysis.maxNumeric <= 30 && analysis.avgNumeric < 10) {
        return { dimension: "dimSupportVolume", confidence: 0.3, reason: "Valores baixos podem representar volume de chamados" };
      }
    }
  }

  return null;
}

// ─── Main Function ──────────────────────────────────────────────────────────

export function suggestMapping(
  headers: string[],
  sampleRows: Record<string, string>[],
  module: Module,
): SuggestedMapping[] {
  const synonyms = module === "retain" ? RETAIN_SYNONYMS : OBTAIN_SYNONYMS;
  const usedDimensions = new Set<string>();
  const results: SuggestedMapping[] = [];

  // First pass: exact and synonym matches
  for (const header of headers) {
    const headerLower = header.toLowerCase().trim().replace(/\s+/g, "_");
    let bestMatch: { dimension: string; score: number; reason: string } | null = null;

    for (const [dimension, aliases] of Object.entries(synonyms)) {
      // Exact match
      if (aliases.includes(headerLower)) {
        bestMatch = { dimension, score: 0.95, reason: `Match exato com "${headerLower}"` };
        break;
      }

      // Partial match (header contains alias or alias contains header)
      for (const alias of aliases) {
        if (headerLower.includes(alias) || alias.includes(headerLower)) {
          const score = Math.max(
            alias.length / headerLower.length,
            headerLower.length / alias.length,
          ) * 0.7;

          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { dimension, score: Math.min(score, 0.8), reason: `Semelhança com "${alias}"` };
          }
        }
      }
    }

    if (bestMatch && !usedDimensions.has(bestMatch.dimension)) {
      usedDimensions.add(bestMatch.dimension);
      results.push({
        csvColumn: header,
        suggestedDimension: bestMatch.dimension,
        confidenceScore: bestMatch.score,
        confidence: bestMatch.score >= 0.8 ? "high" : bestMatch.score >= 0.5 ? "medium" : "low",
        reason: bestMatch.reason,
      });
    } else if (!bestMatch) {
      // Try value analysis
      const values = sampleRows.map((row) => row[header] ?? "");
      const valueInference = inferDimensionFromValues(header, values, module);

      if (valueInference && !usedDimensions.has(valueInference.dimension)) {
        usedDimensions.add(valueInference.dimension);
        results.push({
          csvColumn: header,
          suggestedDimension: valueInference.dimension,
          confidenceScore: valueInference.confidence,
          confidence: valueInference.confidence >= 0.8 ? "high" : valueInference.confidence >= 0.5 ? "medium" : "low",
          reason: valueInference.reason,
        });
      } else {
        results.push({
          csvColumn: header,
          suggestedDimension: null,
          confidenceScore: 0,
          confidence: "low",
          reason: "Nenhuma correspondência encontrada",
        });
      }
    } else {
      // Dimension already used by another column
      results.push({
        csvColumn: header,
        suggestedDimension: null,
        confidenceScore: 0,
        confidence: "low",
        reason: `Dimensão "${bestMatch.dimension}" já mapeada por outra coluna`,
      });
    }
  }

  return results;
}
