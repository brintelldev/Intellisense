import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  real,
  timestamp,
  date,
  jsonb,
  pgEnum,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum("user_role", ["admin", "operator", "viewer"]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high", "critical"]);
export const customerStatusEnum = pgEnum("customer_status", ["active", "at_risk", "churned"]);
export const uploadStatusEnum = pgEnum("upload_status", ["pending", "processing", "completed", "failed"]);
export const leadSourceEnum = pgEnum("lead_source", ["manual", "csv", "hubspot", "salesforce", "rdstation"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "qualifying", "contacted", "proposal", "won", "lost"]);
export const companySizeEnum = pgEnum("company_size", ["micro", "small", "medium", "large", "enterprise"]);
export const scoreTierEnum = pgEnum("score_tier", ["hot", "warm", "cold", "disqualified"]);
export const campaignChannelEnum = pgEnum("campaign_channel", [
  "organic", "paid_search", "paid_social", "email", "referral", "event", "outbound", "other",
]);
export const roiStatusEnum = pgEnum("roi_status", ["excellent", "good", "neutral", "poor", "negative"]);
export const actionTypeEnum = pgEnum("action_type", ["call", "email", "demo", "proposal", "follow_up", "whatsapp"]);
export const actionOutcomeEnum = pgEnum("action_outcome", ["positive", "neutral", "negative", "no_contact"]);
export const retainActionStatusEnum = pgEnum("retain_action_status", ["pending", "in_progress", "completed", "cancelled"]);

// ============================================================
// SHARED TABLES (Shell / Intelli Sense)
// ============================================================

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  sector: varchar("sector", { length: 100 }).notNull().default("other"),
  sectorConfig: jsonb("sector_config").$type<SectorConfig>().notNull().default({
    customerLabel: "Cliente",
    customersLabel: "Clientes",
    revenueLabel: "Receita Mensal",
    engagementLabel: "Engajamento",
    ticketLabel: "Tickets de Suporte",
    tenureLabel: "Tempo de Relacionamento",
    segments: [],
    currency: "BRL",
  }),
  plan: varchar("plan", { length: 50 }).notNull().default("trial"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("operator"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  sid: varchar("sid", { length: 255 }).primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// ============================================================
// RETAIN SENSE TABLES
// ============================================================

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  customerCode: varchar("customer_code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  segment: varchar("segment", { length: 100 }),

  // 9 Universal Dimensions
  dimRevenue: real("dim_revenue"),
  dimPaymentRegularity: real("dim_payment_regularity"),
  dimTenureDays: integer("dim_tenure_days"),
  dimInteractionFrequency: real("dim_interaction_frequency"),
  dimSupportVolume: real("dim_support_volume"),
  dimSatisfaction: real("dim_satisfaction"),
  dimContractRemainingDays: integer("dim_contract_remaining_days"),
  dimUsageIntensity: real("dim_usage_intensity"),
  dimRecencyDays: integer("dim_recency_days"),

  // Flexible fields
  customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>(),

  // Calculated scores
  healthScore: real("health_score"),
  churnProbability: real("churn_probability"),
  riskLevel: riskLevelEnum("risk_level").default("low"),
  status: customerStatusEnum("status").default("active"),

  // Contract info
  contractType: varchar("contract_type", { length: 50 }),
  contractEndDate: date("contract_end_date"),
  servicesCount: integer("services_count"),

  churnDate: date("churn_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const retainPredictions = pgTable("retain_predictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  churnProbability: real("churn_probability").notNull(),
  riskLevel: riskLevelEnum("risk_level").notNull(),
  confidence: real("confidence"),
  shapValues: jsonb("shap_values").$type<ShapValue[]>(),
  recommendedAction: text("recommended_action"),
  modelId: uuid("model_id"),
  predictedAt: timestamp("predicted_at").defaultNow().notNull(),
});

export const retainChurnCauses = pgTable("retain_churn_causes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  cause: varchar("cause", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  impactPct: real("impact_pct").notNull(),
  affectedCustomers: integer("affected_customers").notNull(),
  revenueAtRisk: real("revenue_at_risk").notNull(),
  trend: varchar("trend", { length: 20 }).default("stable"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const retainActions = pgTable("retain_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  status: retainActionStatusEnum("status").default("pending"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  dueDate: date("due_date"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const retainAnalytics = pgTable("retain_analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  totalCustomers: integer("total_customers").notNull(),
  activeCustomers: integer("active_customers"),
  churnedCustomers: integer("churned_customers"),
  atRiskCustomers: integer("at_risk_customers"),
  churnRate: real("churn_rate"),
  mrr: real("mrr"),
  revenueAtRisk: real("revenue_at_risk"),
  avgHealthScore: real("avg_health_score"),
});

export const retainMlModels = pgTable("retain_ml_models", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  algorithm: varchar("algorithm", { length: 50 }).notNull(),
  modelPath: varchar("model_path", { length: 500 }),
  metrics: jsonb("metrics").$type<Record<string, number>>(),
  isActive: boolean("is_active").default(false),
  trainedAt: timestamp("trained_at").defaultNow().notNull(),
});

export const retainUploads = pgTable("retain_uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  rowsCount: integer("rows_count"),
  status: uploadStatusEnum("status").default("pending"),
  errorMessage: text("error_message"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

// ============================================================
// OBTAIN SENSE TABLES
// ============================================================

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  source: leadSourceEnum("source").default("manual"),
  sourceId: varchar("source_id", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  industry: varchar("industry", { length: 100 }),
  companySize: companySizeEnum("company_size"),
  monthlyRevenueEstimate: real("monthly_revenue_estimate"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  status: leadStatusEnum("status").default("new"),
  campaignId: uuid("campaign_id").references(() => obtainCampaigns.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const obtainScores = pgTable("obtain_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  leadId: uuid("lead_id").references(() => leads.id).notNull(),
  conversionProbability: real("conversion_probability").notNull(),
  score: integer("score").notNull(),
  riskTier: scoreTierEnum("risk_tier").notNull(),
  ltvPrediction: real("ltv_prediction"),
  shapValues: jsonb("shap_values").$type<ShapValue[]>(),
  recommendedAction: text("recommended_action"),
  recommendedOffer: text("recommended_offer"),
  modelVersion: varchar("model_version", { length: 50 }),
  scoredAt: timestamp("scored_at").defaultNow().notNull(),
});

export const obtainIcpClusters = pgTable("obtain_icp_clusters", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  clusterId: integer("cluster_id").notNull(),
  clusterName: varchar("cluster_name", { length: 255 }).notNull(),
  description: text("description"),
  characteristics: jsonb("characteristics").$type<Record<string, unknown>>(),
  averageLtv: real("average_ltv"),
  averageTenureDays: integer("average_tenure_days"),
  averageConversionRate: real("average_conversion_rate"),
  averageCac: real("average_cac"),
  churnRate30d: real("churn_rate_30d"),
  churnRate90d: real("churn_rate_90d"),
  isIdeal: boolean("is_ideal").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const obtainCampaigns = pgTable("obtain_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  channel: campaignChannelEnum("channel").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  budget: real("budget"),
  totalLeads: integer("total_leads").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const obtainCampaignRoi = pgTable("obtain_campaign_roi", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  campaignId: uuid("campaign_id").references(() => obtainCampaigns.id).notNull(),
  totalLeads: integer("total_leads"),
  qualifiedLeads: integer("qualified_leads"),
  totalCac: real("total_cac"),
  averageLtvPrediction: real("average_ltv_prediction"),
  projectedRoi: real("projected_roi"),
  roiStatus: roiStatusEnum("roi_status"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});

export const obtainFunnelMetrics = pgTable("obtain_funnel_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  stageName: varchar("stage_name", { length: 100 }).notNull(),
  stageOrder: integer("stage_order").notNull(),
  avgTimeDays: real("avg_time_days"),
  dropOffRate: real("drop_off_rate"),
  leadsCount: integer("leads_count"),
  revenueAtRisk: real("revenue_at_risk"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
});

export const obtainLeadActions = pgTable("obtain_lead_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  leadId: uuid("lead_id").references(() => leads.id).notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  actionType: actionTypeEnum("action_type").notNull(),
  actionDate: timestamp("action_date").defaultNow().notNull(),
  outcome: actionOutcomeEnum("outcome"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const obtainMlModels = pgTable("obtain_ml_models", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  algorithm: varchar("algorithm", { length: 50 }).notNull(),
  modelPath: varchar("model_path", { length: 500 }),
  metrics: jsonb("metrics").$type<Record<string, number>>(),
  isActive: boolean("is_active").default(false),
  trainedAt: timestamp("trained_at").defaultNow().notNull(),
});

export const obtainUploads = pgTable("obtain_uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  rowsCount: integer("rows_count"),
  status: uploadStatusEnum("status").default("pending"),
  errorMessage: text("error_message"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

// ============================================================
// TYPES
// ============================================================

export interface SectorConfig {
  customerLabel: string;
  customersLabel: string;
  revenueLabel: string;
  engagementLabel: string;
  ticketLabel: string;
  tenureLabel: string;
  segments: string[];
  currency: string;
}

export interface ShapValue {
  feature: string;
  value: number | string;
  impact: number;
  direction: "positive" | "negative";
  label: string;
}
