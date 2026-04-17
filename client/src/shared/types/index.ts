export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ScoreTier = "hot" | "warm" | "cold" | "disqualified";
export type CustomerStatus = "active" | "at_risk" | "churned";
export type LeadStatus = "new" | "qualifying" | "contacted" | "proposal" | "won" | "lost";
export type CampaignChannel = "organic" | "paid_search" | "paid_social" | "email" | "referral" | "event" | "outbound" | "other";

export interface ShapValue {
  feature: string;
  label: string;
  value?: number | string;
  impact: number;
  direction: "positive" | "negative";
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  segment: string;
  city: string;
  state: string;
  revenue: number;
  healthScore: number;
  churnProbability: number;
  riskLevel: RiskLevel;
  status: CustomerStatus;
  tenureDays: number;
  usageIntensity: number;
  supportVolume: number;
  satisfaction: number;
  paymentRegularity: number;
  contractRemainingDays: number;
  lastContact: string;
  contractType: string;
  servicesCount: number;
  nps: number;
  trend: "up" | "down";
}

export interface Prediction {
  customerId: string;
  churnProbability: number;
  riskLevel: RiskLevel;
  confidence: number;
  shapValues: ShapValue[];
  baseProbability: number;
  recommendedAction: string;
}

export interface ChurnCause {
  id: string;
  cause: string;
  category: string;
  impactPct: number;
  affectedCustomers: number;
  revenueAtRisk: number;
  trend: "up" | "down" | "stable";
}

export interface MonthlyAnalytics {
  month: string;
  totalCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  atRiskCustomers: number;
  churnRate: number;
  mrr: number;
  revenueAtRisk: number;
  avgHealthScore: number;
}

export interface Alert {
  id: string;
  customerId: string;
  customerName: string;
  message: string;
  severity: "critical" | "high" | "medium";
  timeAgo: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  industry: string;
  companySize: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  source: CampaignChannel;
  status: LeadStatus;
  score: number;
  scoreTier: ScoreTier;
  ltvPrediction: number;
  conversionProbability: number;
  icpCluster: string;
  campaign: string;
  assignedTo: string;
  enteredAt: string;
  lastAction: string;
  lastActionType: string;
}

export interface LeadScore {
  leadId: string;
  score: number;
  scoreTier: ScoreTier;
  conversionProbability: number;
  ltvPrediction: number;
  shapValues: ShapValue[];
  baseProbability: number;
  recommendedAction: string;
  recommendedOffer: string;
  icpMatch: number;
  icpCluster: string;
}

export interface ICPCluster {
  id: string;
  name: string;
  description: string;
  type: "ideal" | "good" | "anti";
  avgLtv: number;
  avgCac: number;
  avgConversionRate: number;
  avgTenureDays: number;
  churnRate: number;
  leadsInFunnel: number;
  budgetShare: number;
  revenueShare: number;
  characteristics: {
    ltv: number;
    cac: number;
    conversion: number;
    tenure: number;
    churn: number;
  };
}

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  totalLeads: number;
  wonLeads: number;
  conversionRate: number;
  // LTV
  avgLtv: number;           // effective (verified if sample ≥ 3, else predicted)
  avgLtvPredicted: number;
  avgLtvVerified: number | null;
  verifiedSampleSize: number;
  // CAC — null when no budget data imported
  cac: number | null;
  budgetSource: "imported" | null;
  // ROI — null when no real CAC
  projectedRoi: number | null;
  paybackDays: number | null;
  roiStatus: "excellent" | "good" | "neutral" | "poor" | null;
  // Retain bridge
  wonCustomersHealthy: number;
  wonCustomersAtRisk: number;
  wonCustomersChurned: number;
  postSaleChurnRate: number;
  ltvChurnAdjusted: number | null;
}

export interface FunnelStage {
  id: string;
  name: string;
  order: number;
  leadsCount: number;
  hotLeadsStuck: number;
  avgTimeDays: number;
  dropOffRate: number;
  revenueAtRisk: number;
  isBottleneck: boolean;
  // New enriched fields (optional for backward compat)
  timeP50?: number;
  timeP75?: number;
  timeP95?: number;
  severityScore?: number;
  isStuck?: boolean;
  bySource?: { source: string; count: number; dropOffRate: number }[];
}

export interface FunnelRetainFeedback {
  wonLeadsMatched: number;
  becameHealthy: number;
  becameAtRisk: number;
  churnedAfterWon: number;
  avgTenureDays: number;
  topChurningSegment: string | null;
}

export interface FunnelBottleneck {
  stage: string;
  stageName: string;
  source: string | null;
  severityScore: number;
  rationale: string;
}

export interface FunnelResponse {
  stages: FunnelStage[];
  sourceStageMatrix: {
    rows: string[];
    cols: string[];
    cells: number[][];
  };
  paretoLeads: {
    top: {
      id: string; name: string; company: string | null;
      status: string; source: string | null; daysInStage: number;
      ltvPrediction: number | null;
    }[];
    others: { count: number; sumLtv: number };
  };
  postWonRetainFeedback: FunnelRetainFeedback;
  biggestBottleneck: FunnelBottleneck | null;
}
