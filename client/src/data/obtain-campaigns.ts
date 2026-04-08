import { Campaign } from "./types";

export const campaigns: Campaign[] = [
  { id: "camp1", name: "Indicação de Clientes", channel: "referral", totalLeads: 156, cac: 2100, avgLtv: 890000, projectedRoi: 42300, roiStatus: "excellent", budget: 15000 },
  { id: "camp2", name: "Feira AgroBrasília 2025", channel: "event", totalLeads: 87, cac: 8500, avgLtv: 720000, projectedRoi: 8470, roiStatus: "good", budget: 85000 },
  { id: "camp3", name: "LinkedIn Ads - Mineração", channel: "paid_social", totalLeads: 134, cac: 5200, avgLtv: 540000, projectedRoi: 10380, roiStatus: "good", budget: 78000 },
  { id: "camp4", name: "Google Ads - Equipamentos", channel: "paid_search", totalLeads: 245, cac: 3800, avgLtv: 180000, projectedRoi: 4736, roiStatus: "neutral", budget: 92000 },
  { id: "camp5", name: "Prospecção Outbound", channel: "outbound", totalLeads: 178, cac: 12000, avgLtv: 150000, projectedRoi: 1250, roiStatus: "poor", budget: 120000 },
];

export const obtainDashboardKPIs = {
  cac: 5200,
  cacChange: -8,
  avgLtv: 540000,
  avgLtvChange: 5,
  conversionRate: 0.24,
  conversionRateChange: 2.1,
  avgAcquisitionDays: 43,
  avgAcquisitionDaysChange: -3,
  revenueInFunnel: 38200000,
  revenueInFunnelChange: 15,
  totalLeads: 287,
  hotLeads: 34,
};

export const leadQualityTrend = [
  { month: "Out/25", hot: 18, warm: 42, cold: 28 },
  { month: "Nov/25", hot: 20, warm: 45, cold: 25 },
  { month: "Dez/25", hot: 22, warm: 48, cold: 22 },
  { month: "Jan/26", hot: 25, warm: 50, cold: 20 },
  { month: "Fev/26", hot: 28, warm: 52, cold: 18 },
  { month: "Mar/26", hot: 34, warm: 58, cold: 15 },
];
