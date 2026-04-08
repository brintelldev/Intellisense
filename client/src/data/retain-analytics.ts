import { MonthlyAnalytics } from "./types";

export const monthlyAnalytics: MonthlyAnalytics[] = [
  { month: "Abr/25", totalCustomers: 468, activeCustomers: 432, churnedCustomers: 20, atRiskCustomers: 16, churnRate: 4.3, mrr: 20800000, revenueAtRisk: 620000, avgHealthScore: 68 },
  { month: "Mai/25", totalCustomers: 471, activeCustomers: 435, churnedCustomers: 18, atRiskCustomers: 18, churnRate: 3.8, mrr: 20950000, revenueAtRisk: 640000, avgHealthScore: 69 },
  { month: "Jun/25", totalCustomers: 475, activeCustomers: 438, churnedCustomers: 21, atRiskCustomers: 16, churnRate: 4.4, mrr: 21100000, revenueAtRisk: 700000, avgHealthScore: 67 },
  { month: "Jul/25", totalCustomers: 478, activeCustomers: 440, churnedCustomers: 19, atRiskCustomers: 19, churnRate: 4.0, mrr: 21200000, revenueAtRisk: 710000, avgHealthScore: 70 },
  { month: "Ago/25", totalCustomers: 476, activeCustomers: 438, churnedCustomers: 23, atRiskCustomers: 15, churnRate: 4.8, mrr: 21150000, revenueAtRisk: 750000, avgHealthScore: 68 },
  { month: "Set/25", totalCustomers: 479, activeCustomers: 441, churnedCustomers: 20, atRiskCustomers: 18, churnRate: 4.2, mrr: 21300000, revenueAtRisk: 720000, avgHealthScore: 69 },
  { month: "Out/25", totalCustomers: 481, activeCustomers: 443, churnedCustomers: 22, atRiskCustomers: 16, churnRate: 4.6, mrr: 21400000, revenueAtRisk: 760000, avgHealthScore: 70 },
  { month: "Nov/25", totalCustomers: 483, activeCustomers: 446, churnedCustomers: 24, atRiskCustomers: 13, churnRate: 5.0, mrr: 21500000, revenueAtRisk: 800000, avgHealthScore: 70 },
  { month: "Dez/25", totalCustomers: 480, activeCustomers: 445, churnedCustomers: 25, atRiskCustomers: 10, churnRate: 5.2, mrr: 21450000, revenueAtRisk: 830000, avgHealthScore: 71 },
  { month: "Jan/26", totalCustomers: 482, activeCustomers: 447, churnedCustomers: 18, atRiskCustomers: 17, churnRate: 3.7, mrr: 21600000, revenueAtRisk: 810000, avgHealthScore: 72 },
  { month: "Fev/26", totalCustomers: 483, activeCustomers: 448, churnedCustomers: 17, atRiskCustomers: 18, churnRate: 3.5, mrr: 21650000, revenueAtRisk: 825000, avgHealthScore: 72 },
  { month: "Mar/26", totalCustomers: 482, activeCustomers: 448, churnedCustomers: 18, atRiskCustomers: 16, churnRate: 3.7, mrr: 21700000, revenueAtRisk: 847000, avgHealthScore: 72 },
];

export const revenueBySegment = [
  { segment: "Mineração", revenue: 8200000 },
  { segment: "Construção Civil", revenue: 7100000 },
  { segment: "Agropecuária", revenue: 4300000 },
  { segment: "Industrial", revenue: 2100000 },
];

export const dashboardKPIs = {
  totalCustomers: 482,
  totalCustomersChange: 2.3,
  churnRate: 3.8,
  churnRateChange: -0.5,
  mrr: 21700000,
  mrrChange: 1.2,
  revenueAtRisk: 847000,
  revenueAtRiskChange: 12.4,
  avgHealthScore: 72,
  riskDistribution: { low: 312, medium: 98, high: 52, critical: 20 },
};
