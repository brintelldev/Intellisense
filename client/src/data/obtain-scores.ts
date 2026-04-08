import { LeadScore } from "./types";

export const leadScores: LeadScore[] = [
  {
    leadId: "l1",
    score: 94,
    scoreTier: "hot",
    conversionProbability: 0.87,
    ltvPrediction: 1200000,
    baseProbability: 0.24,
    recommendedOffer: "Diagnóstico Executivo de Frota — R$ 35.000 a R$ 55.000",
    recommendedAction: "Apresentar proposta personalizada. Clientes do ICP Cluster 1 que recebem esta oferta convertem 72% mais que a média.",
    icpMatch: 0.94,
    icpCluster: "Mineradoras Mid-Market Centro-Oeste",
    shapValues: [
      { feature: "sector_icp", label: "Setor alinhado ao ICP Cluster 1 (Mineração)", impact: 0.22, direction: "positive" },
      { feature: "company_size", label: "Empresa com +800 funcionários", impact: 0.15, direction: "positive" },
      { feature: "source_referral", label: "Veio de indicação de cliente ativo", impact: 0.12, direction: "positive" },
      { feature: "region", label: "Região Centro-Oeste (GO)", impact: 0.08, direction: "positive" },
      { feature: "demo_scheduled", label: "Já agendou demo", impact: 0.10, direction: "positive" },
      { feature: "last_contact_days", label: "Tempo sem contato (5 dias)", impact: -0.04, direction: "negative" },
    ],
  },
  {
    leadId: "l2",
    score: 88,
    scoreTier: "hot",
    conversionProbability: 0.80,
    ltvPrediction: 890000,
    baseProbability: 0.24,
    recommendedOffer: "Locação de Frota Integrada — R$ 45.000/mês",
    recommendedAction: "Demonstração técnica especializada. Alto potencial de fechamento neste mês.",
    icpMatch: 0.88,
    icpCluster: "Mineradoras Mid-Market Centro-Oeste",
    shapValues: [
      { feature: "sector_icp", label: "Setor de Construção Civil alinhado ao ICP", impact: 0.18, direction: "positive" },
      { feature: "company_size", label: "Grande empresa (+500 funcionários)", impact: 0.14, direction: "positive" },
      { feature: "event_source", label: "Captado em Feira do setor", impact: 0.10, direction: "positive" },
      { feature: "region", label: "Região Centro-Oeste (DF)", impact: 0.08, direction: "positive" },
      { feature: "last_contact_days", label: "8 dias sem contato", impact: -0.06, direction: "negative" },
    ],
  },
  {
    leadId: "l17",
    score: 91,
    scoreTier: "hot",
    conversionProbability: 0.84,
    ltvPrediction: 1100000,
    baseProbability: 0.24,
    recommendedOffer: "Diagnóstico Executivo de Frota + Contrato de Manutenção",
    recommendedAction: "Proposta técnica detalhada. Lead com alto perfil de fechamento.",
    icpMatch: 0.91,
    icpCluster: "Mineradoras Mid-Market Centro-Oeste",
    shapValues: [
      { feature: "sector_icp", label: "Mineração — perfil ICP ideal", impact: 0.24, direction: "positive" },
      { feature: "referral", label: "Indicação de cliente ativo", impact: 0.16, direction: "positive" },
      { feature: "company_size", label: "Grande empresa", impact: 0.12, direction: "positive" },
      { feature: "region", label: "DF — mercado prioritário", impact: 0.08, direction: "positive" },
      { feature: "last_contact_days", label: "1 dia sem contato (recente)", impact: 0.02, direction: "positive" },
    ],
  },
];

// Generic scores for remaining leads
export const allLeadScores: LeadScore[] = [
  ...leadScores,
  ...["l3","l4","l5","l6","l7","l8","l9","l10","l11","l12","l13","l14","l15","l16","l18","l19","l20"].map((id) => ({
    leadId: id,
    score: 50,
    scoreTier: "warm" as const,
    conversionProbability: 0.40,
    ltvPrediction: 300000,
    baseProbability: 0.24,
    recommendedOffer: "Apresentação geral dos serviços DCCO",
    recommendedAction: "Qualificar necessidades e avaliar fit com ICP.",
    icpMatch: 0.60,
    icpCluster: "Construtoras Regionais em Expansão",
    shapValues: [
      { feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" as const },
      { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" as const },
    ],
  })),
];
