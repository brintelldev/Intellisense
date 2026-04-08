import { FunnelStage } from "./types";

export const funnelStages: FunnelStage[] = [
  { id: "fs1", name: "Prospecção", order: 1, leadsCount: 287, hotLeadsStuck: 12, avgTimeDays: 0, dropOffRate: 0, revenueAtRisk: 14400000, isBottleneck: false },
  { id: "fs2", name: "Qualificação", order: 2, leadsCount: 198, hotLeadsStuck: 8, avgTimeDays: 5, dropOffRate: 0.31, revenueAtRisk: 9600000, isBottleneck: false },
  { id: "fs3", name: "Demo", order: 3, leadsCount: 89, hotLeadsStuck: 6, avgTimeDays: 8, dropOffRate: 0.55, revenueAtRisk: 7200000, isBottleneck: false },
  { id: "fs4", name: "Proposta", order: 4, leadsCount: 45, hotLeadsStuck: 4, avgTimeDays: 18, dropOffRate: 0.49, revenueAtRisk: 4800000, isBottleneck: true },
  { id: "fs5", name: "Fechado", order: 5, leadsCount: 12, hotLeadsStuck: 0, avgTimeDays: 12, dropOffRate: 0.73, revenueAtRisk: 0, isBottleneck: false },
];

export const funnelAlerts = [
  { id: "fa1", message: "23 leads Hot parados em Proposta há mais de 7 dias — R$ 12,4M em LTV em risco", severity: "critical" as const },
  { id: "fa2", message: "Leads de Indicação passam por Demo → Proposta 2,3x mais rápido que Outbound", severity: "info" as const },
  { id: "fa3", message: "34 leads Cold em Prospecção há mais de 30 dias — considerar desqualificação", severity: "warning" as const },
];
