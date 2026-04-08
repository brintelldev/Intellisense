import { ChurnCause } from "./types";

export const churnCauses: ChurnCause[] = [
  { id: "cc1", cause: "Atraso recorrente no pagamento", category: "Financeiro", impactPct: 28, affectedCustomers: 34, revenueAtRisk: 412000, trend: "up" },
  { id: "cc2", cause: "Vencimento de contrato sem renovação", category: "Contratual", impactPct: 22, affectedCustomers: 28, revenueAtRisk: 367000, trend: "stable" },
  { id: "cc3", cause: "Baixa utilização de equipamentos", category: "Engajamento", impactPct: 18, affectedCustomers: 22, revenueAtRisk: 198000, trend: "up" },
  { id: "cc4", cause: "Volume alto de chamados técnicos", category: "Suporte", impactPct: 15, affectedCustomers: 19, revenueAtRisk: 156000, trend: "up" },
  { id: "cc5", cause: "NPS detrator (< 6)", category: "Satisfação", impactPct: 12, affectedCustomers: 15, revenueAtRisk: 134000, trend: "stable" },
  { id: "cc6", cause: "Redução de serviços contratados", category: "Uso", impactPct: 5, affectedCustomers: 6, revenueAtRisk: 67000, trend: "down" },
];

export const churnCausesTrend = [
  { month: "Out/25", Financeiro: 32, Contratual: 24, Engajamento: 15, Suporte: 12 },
  { month: "Nov/25", Financeiro: 30, Contratual: 22, Engajamento: 16, Suporte: 13 },
  { month: "Dez/25", Financeiro: 28, Contratual: 25, Engajamento: 17, Suporte: 14 },
  { month: "Jan/26", Financeiro: 31, Contratual: 23, Engajamento: 18, Suporte: 15 },
  { month: "Fev/26", Financeiro: 29, Contratual: 22, Engajamento: 17, Suporte: 14 },
  { month: "Mar/26", Financeiro: 28, Contratual: 22, Engajamento: 18, Suporte: 15 },
];
