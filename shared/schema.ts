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
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum("user_role", ["admin", "operator", "viewer"]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high", "critical"]);
export const customerStatusEnum = pgEnum("customer_status", ["active", "at_risk", "churned"]);
export const uploadStatusEnum = pgEnum("upload_status", ["pending", "processing", "completed", "failed"]);
export const leadSourceEnum = pgEnum("lead_source", [
  "manual", "csv", "hubspot", "salesforce", "rdstation",
  "organic", "paid_search", "paid_social", "email", "referral", "event", "outbound", "other",
]);
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
export const alertSeverityEnum = pgEnum("alert_severity", ["critical", "high", "medium"]);
export const retainAlertTypeEnum = pgEnum("retain_alert_type", [
  "health_drop", "churn_risk", "contract_expiring", "payment_delayed", "score_drop",
]);
export const obtainAlertTypeEnum = pgEnum("obtain_alert_type", [
  "score_change", "hot_lead", "stale_lead",
]);
export const noteTypeEnum = pgEnum("note_type", ["note", "call", "email", "meeting", "action"]);
export const scoringModuleEnum = pgEnum("scoring_module", ["retain", "obtain"]);
export const dimensionDataTypeEnum = pgEnum("dimension_data_type", ["number", "text", "boolean"]);

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
  sourceUploadId: uuid("source_upload_id").references(() => retainUploads.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tenantIdx: index("customers_tenant_idx").on(t.tenantId),
  tenantRiskIdx: index("customers_tenant_risk_idx").on(t.tenantId, t.riskLevel),
  tenantSegmentIdx: index("customers_tenant_segment_idx").on(t.tenantId, t.segment),
  tenantCodeUniq: uniqueIndex("customers_tenant_code_uniq").on(t.tenantId, t.customerCode),
  sourceUploadIdx: index("customers_source_upload_idx").on(t.sourceUploadId),
}));

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
  isActive: boolean("is_active").notNull().default(true),
  sourceUploadId: uuid("source_upload_id").references(() => retainUploads.id),
  predictedAt: timestamp("predicted_at").defaultNow().notNull(),
}, (t) => ({
  tenantIdx: index("retain_predictions_tenant_idx").on(t.tenantId),
  customerIdx: index("retain_predictions_customer_idx").on(t.customerId),
  sourceUploadIdx: index("retain_predictions_source_upload_idx").on(t.sourceUploadId),
}));

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
}, (t) => ({
  tenantDateIdx: index("retain_analytics_tenant_date_idx").on(t.tenantId, t.snapshotDate),
}));

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
  rowsCreated: integer("rows_created"),
  rowsUpdated: integer("rows_updated"),
  rowsSkipped: integer("rows_skipped"),
  columnMapping: jsonb("column_mapping").$type<Record<string, string>>(),
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
  customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
  status: leadStatusEnum("status").default("new"),
  campaignId: uuid("campaign_id").references(() => obtainCampaigns.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  sourceUploadId: uuid("source_upload_id").references(() => obtainUploads.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tenantIdx: index("leads_tenant_idx").on(t.tenantId),
  tenantStatusIdx: index("leads_tenant_status_idx").on(t.tenantId, t.status),
  sourceUploadIdx: index("leads_source_upload_idx").on(t.sourceUploadId),
}));

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
  sourceUploadId: uuid("source_upload_id").references(() => obtainUploads.id),
  scoredAt: timestamp("scored_at").defaultNow().notNull(),
}, (t) => ({
  tenantIdx: index("obtain_scores_tenant_idx").on(t.tenantId),
  leadIdx: index("obtain_scores_lead_idx").on(t.leadId),
  tenantTierIdx: index("obtain_scores_tenant_tier_idx").on(t.tenantId, t.riskTier),
  sourceUploadIdx: index("obtain_scores_source_upload_idx").on(t.sourceUploadId),
}));

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
  rowsCreated: integer("rows_created"),
  rowsUpdated: integer("rows_updated"),
  rowsSkipped: integer("rows_skipped"),
  columnMapping: jsonb("column_mapping").$type<Record<string, string>>(),
  status: uploadStatusEnum("status").default("pending"),
  errorMessage: text("error_message"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

// ============================================================
// RETAIN ALERTS & SCORE HISTORY
// ============================================================

export const retainAlerts = pgTable("retain_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  type: retainAlertTypeEnum("type").notNull(),
  message: text("message").notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  sourceUploadId: uuid("source_upload_id").references(() => retainUploads.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  tenantIdx: index("retain_alerts_tenant_idx").on(t.tenantId),
  tenantUnreadIdx: index("retain_alerts_tenant_unread_idx").on(t.tenantId, t.isRead),
  sourceUploadIdx: index("retain_alerts_source_upload_idx").on(t.sourceUploadId),
}));

export const customerScoreHistory = pgTable("customer_score_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  healthScore: real("health_score").notNull(),
  churnProbability: real("churn_probability").notNull(),
  riskLevel: riskLevelEnum("risk_level").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
}, (t) => ({
  customerDateIdx: index("csh_customer_date_idx").on(t.customerId, t.snapshotDate),
  tenantDateIdx: index("csh_tenant_date_idx").on(t.tenantId, t.snapshotDate),
}));

export const customerNotes = pgTable("customer_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  type: noteTypeEnum("type").notNull().default("note"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  customerIdx: index("customer_notes_customer_idx").on(t.customerId),
}));

// ============================================================
// OBTAIN ALERTS & SCORE HISTORY
// ============================================================

export const obtainAlerts = pgTable("obtain_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  leadId: uuid("lead_id").references(() => leads.id).notNull(),
  type: obtainAlertTypeEnum("type").notNull(),
  message: text("message").notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  tenantIdx: index("obtain_alerts_tenant_idx").on(t.tenantId),
  tenantUnreadIdx: index("obtain_alerts_tenant_unread_idx").on(t.tenantId, t.isRead),
}));

export const leadScoreHistory = pgTable("lead_score_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  leadId: uuid("lead_id").references(() => leads.id).notNull(),
  score: integer("score").notNull(),
  scoreTier: scoreTierEnum("score_tier").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
}, (t) => ({
  leadDateIdx: index("lsh_lead_date_idx").on(t.leadId, t.snapshotDate),
  tenantDateIdx: index("lsh_tenant_date_idx").on(t.tenantId, t.snapshotDate),
}));

// ============================================================
// SCORING CONFIGURATION & CUSTOM DIMENSIONS
// ============================================================

export const scoringConfigs = pgTable("scoring_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  module: scoringModuleEnum("module").notNull(),
  configType: varchar("config_type", { length: 50 }).notNull(),
  weights: jsonb("weights").$type<Record<string, number>>().notNull(),
  thresholds: jsonb("thresholds").$type<Record<string, number>>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  tenantModuleIdx: index("scoring_configs_tenant_module_idx").on(t.tenantId, t.module),
}));

export const customDimensions = pgTable("custom_dimensions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  module: scoringModuleEnum("module").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  dataType: dimensionDataTypeEnum("data_type").notNull().default("number"),
  weight: real("weight").notNull().default(0),
  invertScale: boolean("invert_scale").notNull().default(false),
  minValue: real("min_value"),
  maxValue: real("max_value"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  tenantModuleIdx: index("custom_dims_tenant_module_idx").on(t.tenantId, t.module),
}));

export const columnMappingTemplates = pgTable("column_mapping_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  module: scoringModuleEnum("module").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  mapping: jsonb("mapping").$type<Record<string, string>>().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  value?: number | string;
  impact: number;
  direction: "positive" | "negative";
  label: string;
}
