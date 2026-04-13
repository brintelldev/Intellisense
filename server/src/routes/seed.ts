import { Router } from "express";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { db } from "../db.js";
import { eq, sql } from "drizzle-orm";
import {
  tenants, users, customers, retainPredictions, retainChurnCauses,
  retainAnalytics, retainUploads, obtainCampaigns, leads, obtainScores,
  obtainIcpClusters, obtainCampaignRoi, obtainFunnelMetrics, obtainUploads,
  obtainLeadActions, retainActions, retainAlerts, customerScoreHistory,
  obtainAlerts, leadScoreHistory, customerNotes, scoringConfigs,
  customDimensions, columnMappingTemplates,
} from "../../../shared/schema.js";
import { runRetainPredictions, generateAnalyticsSnapshot, generateChurnCauses, generateAlerts } from "../engine/retain-scoring.js";
import { runObtainScoring, generateObtainAlerts } from "../engine/obtain-scoring.js";
import { generateIcpClusters } from "../engine/icp-clustering.js";
import { suggestMapping } from "../engine/column-mapper.js";

export const seedRouter = Router();

// ─── POST /api/seed/dcco ─────────────────────────────────────────────────────
seedRouter.post("/dcco", async (_req, res) => {
  try {
    // ── Idempotência: limpar TUDO ──────────────────────────────────────────
    const existingTenants = await db.select({ id: tenants.id }).from(tenants)
      .where(eq(tenants.companyName, "DCCO Equipamentos"));

    for (const existing of existingTenants) {
      const tid = existing.id;
      await db.execute(sql`DELETE FROM obtain_lead_actions WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM obtain_scores WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM obtain_campaign_roi WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM obtain_funnel_metrics WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM obtain_uploads WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM leads WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM obtain_icp_clusters WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM obtain_campaigns WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM retain_actions WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM retain_predictions WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM retain_churn_causes WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM retain_analytics WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM retain_uploads WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM customers WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM users WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM tenants WHERE id = ${tid}`);
    }
    // Limpar user demo órfão
    await db.execute(sql`DELETE FROM users WHERE email = 'demo@dcco.com.br'`);

    // ── 1. Tenant ──────────────────────────────────────────────────────────
    const [tenant] = await db.insert(tenants).values({
      companyName: "DCCO Equipamentos",
      sector: "industrial_b2b",
      sectorConfig: {
        customerLabel: "Empresa",
        customersLabel: "Empresas",
        revenueLabel: "Valor do Contrato",
        engagementLabel: "Utilização de Equipamentos",
        ticketLabel: "Chamados Técnicos",
        tenureLabel: "Tempo de Parceria",
        segments: ["Mineração", "Construção Civil", "Agropecuária", "Industrial"],
        currency: "BRL",
      },
      plan: "enterprise",
    }).returning();
    const tenantId = tenant.id;

    // ── 2. User ────────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash("Demo@2026", 12);
    const [user] = await db.insert(users).values({
      tenantId,
      email: "demo@dcco.com.br",
      passwordHash,
      name: "Admin DCCO",
      role: "admin",
    }).returning();
    const userId = user.id;

    // ── 3. Customers (20) ──────────────────────────────────────────────────
    const customerMockData = [
      { code: "DCCO-001", name: "Mineradora Vale Norte Ltda", segment: "Mineração", city: "Goiânia", state: "GO", revenue: 156800, healthScore: 18, churnProb: 0.89, risk: "critical" as const, status: "at_risk" as const, tenure: 1080, usage: 35, support: 8, satisfaction: 28, payment: 22, contract: 15, contractType: "Anual", services: 4 },
      { code: "DCCO-002", name: "Terraplenagem Tocantins SA", segment: "Construção Civil", city: "Palmas", state: "TO", revenue: 45200, healthScore: 22, churnProb: 0.85, risk: "critical" as const, status: "at_risk" as const, tenure: 720, usage: 28, support: 6, satisfaction: 22, payment: 18, contract: 22, contractType: "Semestral", services: 2 },
      { code: "DCCO-003", name: "Irrigação Cerrado LTDA", segment: "Agropecuária", city: "Anápolis", state: "GO", revenue: 43200, healthScore: 15, churnProb: 0.91, risk: "critical" as const, status: "at_risk" as const, tenure: 540, usage: 20, support: 10, satisfaction: 18, payment: 30, contract: 8, contractType: "Mensal", services: 2 },
      { code: "DCCO-004", name: "Construtora Horizonte SA", segment: "Construção Civil", city: "Brasília", state: "DF", revenue: 89400, healthScore: 32, churnProb: 0.78, risk: "high" as const, status: "at_risk" as const, tenure: 900, usage: 42, support: 5, satisfaction: 35, payment: 12, contract: 7, contractType: "Anual", services: 3 },
      { code: "DCCO-005", name: "AgroPlan Mecanização", segment: "Agropecuária", city: "Rio Verde", state: "GO", revenue: 67200, healthScore: 38, churnProb: 0.72, risk: "high" as const, status: "at_risk" as const, tenure: 1440, usage: 50, support: 3, satisfaction: 42, payment: 8, contract: 45, contractType: "Anual", services: 3 },
      { code: "DCCO-006", name: "Silos Araguaia LTDA", segment: "Agropecuária", city: "Araguaína", state: "TO", revenue: 34600, healthScore: 29, churnProb: 0.76, risk: "high" as const, status: "at_risk" as const, tenure: 360, usage: 30, support: 7, satisfaction: 30, payment: 25, contract: 12, contractType: "Semestral", services: 2 },
      { code: "DCCO-007", name: "LogPetro Transportes", segment: "Industrial", city: "Goiânia", state: "GO", revenue: 56700, healthScore: 35, churnProb: 0.68, risk: "high" as const, status: "at_risk" as const, tenure: 810, usage: 45, support: 4, satisfaction: 38, payment: 15, contract: 30, contractType: "Anual", services: 3 },
      { code: "DCCO-008", name: "Pavimentação Nacional SA", segment: "Construção Civil", city: "Brasília", state: "DF", revenue: 78400, healthScore: 52, churnProb: 0.54, risk: "medium" as const, status: "at_risk" as const, tenure: 630, usage: 60, support: 2, satisfaction: 55, payment: 5, contract: 60, contractType: "Anual", services: 4 },
      { code: "DCCO-009", name: "Pedreira Goiás Central", segment: "Mineração", city: "Goiânia", state: "GO", revenue: 134500, healthScore: 55, churnProb: 0.48, risk: "medium" as const, status: "at_risk" as const, tenure: 1260, usage: 65, support: 3, satisfaction: 58, payment: 3, contract: 90, contractType: "Bienal", services: 5 },
      { code: "DCCO-010", name: "Mineração Rio Claro", segment: "Mineração", city: "Goiânia", state: "GO", revenue: 178900, healthScore: 64, churnProb: 0.42, risk: "medium" as const, status: "active" as const, tenure: 1620, usage: 72, support: 2, satisfaction: 65, payment: 2, contract: 120, contractType: "Bienal", services: 6 },
      { code: "DCCO-011", name: "Industrial Minas Gerais", segment: "Industrial", city: "Uberlândia", state: "MG", revenue: 198400, healthScore: 61, churnProb: 0.44, risk: "medium" as const, status: "active" as const, tenure: 900, usage: 68, support: 3, satisfaction: 62, payment: 4, contract: 75, contractType: "Anual", services: 5 },
      { code: "DCCO-012", name: "Construtora Aliança GO", segment: "Construção Civil", city: "Goiânia", state: "GO", revenue: 95600, healthScore: 73, churnProb: 0.28, risk: "low" as const, status: "active" as const, tenure: 1080, usage: 78, support: 1, satisfaction: 75, payment: 1, contract: 180, contractType: "Bienal", services: 4 },
      { code: "DCCO-013", name: "Concreteira Planalto", segment: "Construção Civil", city: "Brasília", state: "DF", revenue: 112300, healthScore: 76, churnProb: 0.22, risk: "low" as const, status: "active" as const, tenure: 1440, usage: 80, support: 1, satisfaction: 78, payment: 0, contract: 210, contractType: "Bienal", services: 5 },
      { code: "DCCO-014", name: "Usina Solar Goiás", segment: "Industrial", city: "Aparecida de Goiânia", state: "GO", revenue: 89100, healthScore: 79, churnProb: 0.18, risk: "low" as const, status: "active" as const, tenure: 720, usage: 85, support: 0, satisfaction: 82, payment: 0, contract: 240, contractType: "Bienal", services: 3 },
      { code: "DCCO-015", name: "Fazenda São Jorge Energia", segment: "Agropecuária", city: "Jataí", state: "GO", revenue: 78900, healthScore: 82, churnProb: 0.15, risk: "low" as const, status: "active" as const, tenure: 1800, usage: 88, support: 0, satisfaction: 85, payment: 0, contract: 300, contractType: "Trienal", services: 4 },
      { code: "DCCO-016", name: "Construtora Capital DF", segment: "Construção Civil", city: "Brasília", state: "DF", revenue: 167800, healthScore: 85, churnProb: 0.12, risk: "low" as const, status: "active" as const, tenure: 2160, usage: 90, support: 0, satisfaction: 88, payment: 0, contract: 365, contractType: "Trienal", services: 6 },
      { code: "DCCO-017", name: "BrasilAgro Máquinas", segment: "Agropecuária", city: "Rondonópolis", state: "MT", revenue: 145600, healthScore: 88, churnProb: 0.10, risk: "low" as const, status: "active" as const, tenure: 1620, usage: 92, support: 0, satisfaction: 90, payment: 0, contract: 400, contractType: "Trienal", services: 5 },
      { code: "DCCO-018", name: "Cimento Norte Tocantins", segment: "Industrial", city: "Palmas", state: "TO", revenue: 201300, healthScore: 91, churnProb: 0.07, risk: "low" as const, status: "active" as const, tenure: 1980, usage: 94, support: 0, satisfaction: 92, payment: 0, contract: 450, contractType: "Trienal", services: 7 },
      { code: "DCCO-019", name: "Siderúrgica Centro-Oeste", segment: "Industrial", city: "Goiânia", state: "GO", revenue: 312400, healthScore: 94, churnProb: 0.04, risk: "low" as const, status: "active" as const, tenure: 2520, usage: 96, support: 0, satisfaction: 95, payment: 0, contract: 540, contractType: "Trienal", services: 8 },
      { code: "DCCO-020", name: "Mineração Serra Dourada", segment: "Mineração", city: "Crixás", state: "GO", revenue: 223100, healthScore: 58, churnProb: 0.46, risk: "medium" as const, status: "at_risk" as const, tenure: 1350, usage: 62, support: 4, satisfaction: 56, payment: 6, contract: 55, contractType: "Anual", services: 5 },
    ];

    const customerRows = await db.insert(customers).values(
      customerMockData.map((c, i) => ({
        tenantId,
        customerCode: c.code,
        name: c.name,
        segment: c.segment,
        city: c.city,
        state: c.state,
        dimRevenue: c.revenue,
        dimPaymentRegularity: c.payment,
        dimTenureDays: c.tenure,
        dimInteractionFrequency: Math.round(c.usage * 0.8),
        dimSupportVolume: c.support,
        dimSatisfaction: c.satisfaction,
        dimContractRemainingDays: c.contract,
        dimUsageIntensity: c.usage,
        dimRecencyDays: Math.max(1, 30 - i * 2),
        healthScore: c.healthScore,
        churnProbability: c.churnProb,
        riskLevel: c.risk,
        status: c.status,
        contractType: c.contractType,
        servicesCount: c.services,
      }))
    ).returning();
    const customerIds: Record<string, string> = {};
    customerRows.forEach((row, i) => { customerIds[`c${i + 1}`] = row.id; });

    // ── 4. Retain Predictions (20) ─────────────────────────────────────────
    const predShapDetailed: Record<string, { confidence: number; action: string; shap: any[] }> = {
      c1: { confidence: 0.94, action: "Agendar reunião de renovação com desconto de 5-10% para contrato de 12 meses.", shap: [
        { feature: "dim_payment_regularity", label: "Atraso no pagamento (22 dias)", value: 22, impact: 0.28, direction: "positive" },
        { feature: "dim_contract_remaining_days", label: "Contrato vence em 15 dias", value: 15, impact: 0.22, direction: "positive" },
        { feature: "dim_usage_intensity", label: "Baixa utilização de equipamentos (35%)", value: 35, impact: 0.18, direction: "positive" },
        { feature: "dim_support_volume", label: "Alto volume de chamados (8)", value: 8, impact: 0.15, direction: "positive" },
        { feature: "dim_tenure_days", label: "Parceria longa (36 meses)", value: 1080, impact: -0.11, direction: "negative" },
        { feature: "dim_revenue", label: "Receita alta (R$ 156.800)", value: 156800, impact: -0.08, direction: "negative" },
      ]},
      c2: { confidence: 0.91, action: "Visita técnica urgente para resolver pendências. Oferecer plano de fidelidade.", shap: [
        { feature: "dim_payment_regularity", label: "Pagamentos atrasados (18 dias)", value: 18, impact: 0.24, direction: "positive" },
        { feature: "dim_contract_remaining_days", label: "Contrato vence em 22 dias", value: 22, impact: 0.20, direction: "positive" },
        { feature: "dim_usage_intensity", label: "Utilização abaixo do esperado (28%)", value: 28, impact: 0.20, direction: "positive" },
        { feature: "dim_support_volume", label: "6 chamados abertos", value: 6, impact: 0.12, direction: "positive" },
        { feature: "dim_satisfaction", label: "Satisfação baixa (22)", value: 22, impact: 0.10, direction: "positive" },
        { feature: "dim_tenure_days", label: "2 anos de parceria", value: 720, impact: -0.06, direction: "negative" },
      ]},
      c3: { confidence: 0.96, action: "Contato IMEDIATO do gerente de conta. Renegociação de contrato com condições especiais.", shap: [
        { feature: "dim_contract_remaining_days", label: "Contrato vence em 8 dias", value: 8, impact: 0.30, direction: "positive" },
        { feature: "dim_payment_regularity", label: "Atraso de 30 dias no pagamento", value: 30, impact: 0.25, direction: "positive" },
        { feature: "dim_usage_intensity", label: "Utilização crítica (20%)", value: 20, impact: 0.18, direction: "positive" },
        { feature: "dim_support_volume", label: "10 chamados técnicos", value: 10, impact: 0.10, direction: "positive" },
        { feature: "dim_satisfaction", label: "NPS detrator (2)", value: 2, impact: 0.08, direction: "positive" },
        { feature: "dim_revenue", label: "Contrato médio (R$ 43.200)", value: 43200, impact: -0.05, direction: "negative" },
      ]},
      c4: { confidence: 0.88, action: "Reunião de alinhamento de expectativas. Propor renovação antecipada com desconto de 8%.", shap: [
        { feature: "dim_contract_remaining_days", label: "Contrato vence em 7 dias", value: 7, impact: 0.28, direction: "positive" },
        { feature: "dim_payment_regularity", label: "Atraso de 12 dias", value: 12, impact: 0.18, direction: "positive" },
        { feature: "dim_usage_intensity", label: "Utilização moderada (42%)", value: 42, impact: 0.12, direction: "positive" },
        { feature: "dim_support_volume", label: "5 chamados técnicos", value: 5, impact: 0.08, direction: "positive" },
        { feature: "dim_tenure_days", label: "Parceria de 2,5 anos", value: 900, impact: -0.08, direction: "negative" },
      ]},
      c5: { confidence: 0.85, action: "Revisar acordo de nível de serviço. Propor upgrade de equipamentos com desconto especial.", shap: [
        { feature: "dim_payment_regularity", label: "Pequeno atraso de pagamento (8 dias)", value: 8, impact: 0.20, direction: "positive" },
        { feature: "dim_usage_intensity", label: "Utilização regular (50%)", value: 50, impact: 0.15, direction: "positive" },
        { feature: "dim_support_volume", label: "3 chamados técnicos", value: 3, impact: 0.10, direction: "positive" },
        { feature: "dim_tenure_days", label: "Parceria longa (4 anos)", value: 1440, impact: -0.12, direction: "negative" },
        { feature: "dim_satisfaction", label: "Satisfação razoável (42)", value: 42, impact: -0.06, direction: "negative" },
      ]},
    };

    await db.insert(retainPredictions).values(
      customerMockData.map((cm, i) => {
        const mockId = `c${i + 1}`;
        const detailed = predShapDetailed[mockId];
        return {
          tenantId,
          customerId: customerIds[mockId],
          churnProbability: cm.churnProb,
          riskLevel: cm.risk,
          confidence: detailed?.confidence ?? 0.82,
          recommendedAction: detailed?.action ?? "Monitorar indicadores. Manter contato regular com o cliente.",
          shapValues: detailed?.shap ?? [
            { feature: "dim_payment_regularity", label: "Regularidade de pagamento", value: cm.payment, impact: 0.12 + i * 0.01, direction: "positive" as const },
            { feature: "dim_usage_intensity", label: "Intensidade de uso", value: cm.usage, impact: 0.08, direction: "positive" as const },
            { feature: "dim_tenure_days", label: "Tempo de parceria", value: cm.tenure, impact: -0.05, direction: "negative" as const },
          ],
        };
      })
    );

    // ── 5. Churn Causes (6) ────────────────────────────────────────────────
    await db.insert(retainChurnCauses).values([
      { tenantId, cause: "Atraso recorrente no pagamento", category: "Financeiro", impactPct: 28, affectedCustomers: 34, revenueAtRisk: 412000, trend: "up" },
      { tenantId, cause: "Vencimento de contrato sem renovação", category: "Contratual", impactPct: 22, affectedCustomers: 28, revenueAtRisk: 367000, trend: "stable" },
      { tenantId, cause: "Baixa utilização de equipamentos", category: "Engajamento", impactPct: 18, affectedCustomers: 22, revenueAtRisk: 198000, trend: "up" },
      { tenantId, cause: "Volume alto de chamados técnicos", category: "Suporte", impactPct: 15, affectedCustomers: 19, revenueAtRisk: 156000, trend: "up" },
      { tenantId, cause: "NPS detrator (< 6)", category: "Satisfação", impactPct: 12, affectedCustomers: 15, revenueAtRisk: 134000, trend: "stable" },
      { tenantId, cause: "Redução de serviços contratados", category: "Uso", impactPct: 5, affectedCustomers: 6, revenueAtRisk: 67000, trend: "down" },
    ]);

    // ── 6. Analytics (12 months) ───────────────────────────────────────────
    const analyticsData = [
      { month: "2025-04-01", total: 468, active: 432, churned: 20, atRisk: 16, churn: 4.3, mrr: 20800000, risk: 620000, health: 68 },
      { month: "2025-05-01", total: 471, active: 435, churned: 18, atRisk: 18, churn: 3.8, mrr: 20950000, risk: 640000, health: 69 },
      { month: "2025-06-01", total: 475, active: 438, churned: 21, atRisk: 16, churn: 4.4, mrr: 21100000, risk: 700000, health: 67 },
      { month: "2025-07-01", total: 478, active: 440, churned: 19, atRisk: 19, churn: 4.0, mrr: 21200000, risk: 710000, health: 70 },
      { month: "2025-08-01", total: 476, active: 438, churned: 23, atRisk: 15, churn: 4.8, mrr: 21150000, risk: 750000, health: 68 },
      { month: "2025-09-01", total: 479, active: 441, churned: 20, atRisk: 18, churn: 4.2, mrr: 21300000, risk: 720000, health: 69 },
      { month: "2025-10-01", total: 481, active: 443, churned: 22, atRisk: 16, churn: 4.6, mrr: 21400000, risk: 760000, health: 70 },
      { month: "2025-11-01", total: 483, active: 446, churned: 24, atRisk: 13, churn: 5.0, mrr: 21500000, risk: 800000, health: 70 },
      { month: "2025-12-01", total: 480, active: 445, churned: 25, atRisk: 10, churn: 5.2, mrr: 21450000, risk: 830000, health: 71 },
      { month: "2026-01-01", total: 482, active: 447, churned: 18, atRisk: 17, churn: 3.7, mrr: 21600000, risk: 810000, health: 72 },
      { month: "2026-02-01", total: 483, active: 448, churned: 17, atRisk: 18, churn: 3.5, mrr: 21650000, risk: 825000, health: 72 },
      { month: "2026-03-01", total: 482, active: 448, churned: 18, atRisk: 16, churn: 3.7, mrr: 21700000, risk: 847000, health: 72 },
    ];
    await db.insert(retainAnalytics).values(analyticsData.map(a => ({
      tenantId,
      snapshotDate: a.month,
      totalCustomers: a.total,
      activeCustomers: a.active,
      churnedCustomers: a.churned,
      atRiskCustomers: a.atRisk,
      churnRate: a.churn,
      mrr: a.mrr,
      revenueAtRisk: a.risk,
      avgHealthScore: a.health,
    })));

    // ── 7. Retain Uploads (3) ──────────────────────────────────────────────
    await db.insert(retainUploads).values([
      { tenantId, filename: "clientes_mar2026.csv", rowsCount: 482, status: "completed" as const, uploadedBy: userId },
      { tenantId, filename: "clientes_fev2026.csv", rowsCount: 480, status: "completed" as const, uploadedBy: userId },
      { tenantId, filename: "clientes_jan2026.csv", rowsCount: 478, status: "completed" as const, uploadedBy: userId },
    ]);

    // ── 8. Campaigns (5) ───────────────────────────────────────────────────
    const campaignData = [
      { name: "Indicação de Clientes", channel: "referral" as const, totalLeads: 156, budget: 15000, cac: 2100, avgLtv: 890000, roi: 42300, roiStatus: "excellent" as const },
      { name: "Feira AgroBrasília 2025", channel: "event" as const, totalLeads: 87, budget: 85000, cac: 8500, avgLtv: 720000, roi: 8470, roiStatus: "good" as const },
      { name: "LinkedIn Ads - Mineração", channel: "paid_social" as const, totalLeads: 134, budget: 78000, cac: 5200, avgLtv: 540000, roi: 10380, roiStatus: "good" as const },
      { name: "Google Ads - Equipamentos", channel: "paid_search" as const, totalLeads: 245, budget: 92000, cac: 3800, avgLtv: 180000, roi: 4736, roiStatus: "neutral" as const },
      { name: "Prospecção Outbound", channel: "outbound" as const, totalLeads: 178, budget: 120000, cac: 12000, avgLtv: 150000, roi: 1250, roiStatus: "poor" as const },
    ];
    const campaignRows = await db.insert(obtainCampaigns).values(
      campaignData.map(camp => ({
        tenantId,
        name: camp.name,
        channel: camp.channel,
        budget: camp.budget,
        totalLeads: camp.totalLeads,
        startDate: "2025-01-01",
        endDate: "2026-06-30",
      }))
    ).returning();
    const campaignIds: Record<string, string> = {};
    campaignRows.forEach(row => { campaignIds[row.name] = row.id; });

    // ── 9. Leads (20) ──────────────────────────────────────────────────────
    const leadMockData = [
      { name: "Rafael Mendes", company: "Mineradora Cristalina LTDA", industry: "Mineração", size: "large" as const, city: "Goiânia", state: "GO", email: "rafael@cristalina.com.br", phone: "(62) 99001-2345", source: "referral" as const, status: "proposal" as const, campaign: "Indicação de Clientes" },
      { name: "Luciana Torres", company: "Terraplenagem Nacional SA", industry: "Construção Civil", size: "large" as const, city: "Brasília", state: "DF", email: "luciana@tnacional.com.br", phone: "(61) 98765-4321", source: "event" as const, status: "qualifying" as const, campaign: "Feira AgroBrasília 2025" },
      { name: "Carlos Andrade", company: "Construtora Progresso GO", industry: "Construção Civil", size: "medium" as const, city: "Goiânia", state: "GO", email: "carlos@progresso.com.br", phone: "(62) 98712-3456", source: "paid_social" as const, status: "qualifying" as const, campaign: "LinkedIn Ads - Mineração" },
      { name: "Marina Silva", company: "AgroPecus Máquinas LTDA", industry: "Agropecuária", size: "medium" as const, city: "Rio Verde", state: "GO", email: "marina@agropecus.com.br", phone: "(64) 99234-5678", source: "referral" as const, status: "contacted" as const, campaign: "Indicação de Clientes" },
      { name: "Pedro Henrique", company: "Mineração Araguaia", industry: "Mineração", size: "large" as const, city: "Araguaína", state: "TO", email: "pedro@araguaia.com.br", phone: "(63) 99345-6789", source: "event" as const, status: "qualifying" as const, campaign: "Feira AgroBrasília 2025" },
      { name: "Fernanda Lopes", company: "Pavimentadora Centro-Oeste", industry: "Construção Civil", size: "medium" as const, city: "Brasília", state: "DF", email: "fernanda@pco.com.br", phone: "(61) 99456-7890", source: "paid_social" as const, status: "qualifying" as const, campaign: "LinkedIn Ads - Mineração" },
      { name: "Jorge Almeida", company: "Britagem Serra Azul", industry: "Mineração", size: "medium" as const, city: "Goiânia", state: "GO", email: "jorge@serraaazul.com.br", phone: "(62) 99567-8901", source: "paid_search" as const, status: "new" as const, campaign: "Google Ads - Equipamentos" },
      { name: "Ana Beatriz", company: "Irrigação Planaltina", industry: "Agropecuária", size: "medium" as const, city: "Planaltina", state: "DF", email: "ana@irrigacao.com.br", phone: "(61) 99678-9012", source: "outbound" as const, status: "contacted" as const, campaign: "Prospecção Outbound" },
      { name: "Roberto Dias", company: "Siderúrgica Vale do Araguaia", industry: "Industrial", size: "large" as const, city: "Araguaína", state: "TO", email: "roberto@araguaia.com.br", phone: "(63) 99789-0123", source: "event" as const, status: "qualifying" as const, campaign: "Feira AgroBrasília 2025" },
      { name: "Thiago Costa", company: "Empreiteira Sol Nascente", industry: "Construção Civil", size: "small" as const, city: "Goiânia", state: "GO", email: "thiago@solnascente.com.br", phone: "(62) 99890-1234", source: "paid_search" as const, status: "new" as const, campaign: "Google Ads - Equipamentos" },
      { name: "Camila Ribeiro", company: "Transportes Rodoviários GO", industry: "Industrial", size: "small" as const, city: "Aparecida", state: "GO", email: "camila@trgo.com.br", phone: "(62) 99901-2345", source: "outbound" as const, status: "contacted" as const, campaign: "Prospecção Outbound" },
      { name: "Marcos Vinicius", company: "Cerâmica Tocantins", industry: "Industrial", size: "micro" as const, city: "Palmas", state: "TO", email: "marcos@ceramica.com.br", phone: "(63) 99012-3456", source: "paid_search" as const, status: "new" as const, campaign: "Google Ads - Equipamentos" },
      { name: "Juliana Moreira", company: "Borracharia Industrial ME", industry: "Industrial", size: "micro" as const, city: "Goiânia", state: "GO", email: "juliana@borracharia.com.br", phone: "(62) 99123-4567", source: "outbound" as const, status: "new" as const, campaign: "Prospecção Outbound" },
      { name: "Ricardo Prado", company: "Oficina Mecânica Goiânia", industry: "Industrial", size: "micro" as const, city: "Goiânia", state: "GO", email: "ricardo@oficina.com.br", phone: "(62) 99234-5678", source: "paid_search" as const, status: "new" as const, campaign: "Google Ads - Equipamentos" },
      { name: "Felipe Santos", company: "Serralheria Tocantins ME", industry: "Industrial", size: "micro" as const, city: "Palmas", state: "TO", email: "felipe@serralheria.com.br", phone: "(63) 99345-6789", source: "outbound" as const, status: "new" as const, campaign: "Prospecção Outbound" },
      { name: "Amanda Nunes", company: "Construtora Boa Vista SA", industry: "Construção Civil", size: "medium" as const, city: "Goiânia", state: "GO", email: "amanda@boavista.com.br", phone: "(62) 99456-7890", source: "paid_social" as const, status: "proposal" as const, campaign: "LinkedIn Ads - Mineração" },
      { name: "Lucas Ferreira", company: "Mineração Planalto Central", industry: "Mineração", size: "large" as const, city: "Brasília", state: "DF", email: "lucas@planalto.com.br", phone: "(61) 99567-8901", source: "referral" as const, status: "qualifying" as const, campaign: "Indicação de Clientes" },
      { name: "Beatriz Gomes", company: "AgriTech Cerrado LTDA", industry: "Agropecuária", size: "medium" as const, city: "Rio Verde", state: "GO", email: "beatriz@agritech.com.br", phone: "(64) 99678-9012", source: "event" as const, status: "qualifying" as const, campaign: "Feira AgroBrasília 2025" },
      { name: "Diego Martins", company: "Pedreira Regional DF", industry: "Mineração", size: "medium" as const, city: "Brasília", state: "DF", email: "diego@pedreira.com.br", phone: "(61) 99789-0123", source: "paid_social" as const, status: "new" as const, campaign: "LinkedIn Ads - Mineração" },
      { name: "Isabela Santos", company: "Micro Serviços ME", industry: "Industrial", size: "micro" as const, city: "Goiânia", state: "GO", email: "isabela@microservicos.com.br", phone: "(62) 99890-1234", source: "outbound" as const, status: "new" as const, campaign: "Prospecção Outbound" },
    ];

    const leadScoreData = [
      { score: 94, tier: "hot" as const, conv: 0.87, ltv: 1200000, offer: "Diagnóstico Executivo de Frota — R$ 35.000 a R$ 55.000", action: "Apresentar proposta personalizada.", icpMatch: 0.94, icpCluster: "Mineradoras Mid-Market Centro-Oeste", shap: [
        { feature: "sector_icp", label: "Setor alinhado ao ICP Cluster 1 (Mineração)", impact: 0.22, direction: "positive" },
        { feature: "company_size", label: "Empresa com +800 funcionários", impact: 0.15, direction: "positive" },
        { feature: "source_referral", label: "Veio de indicação de cliente ativo", impact: 0.12, direction: "positive" },
        { feature: "region", label: "Região Centro-Oeste (GO)", impact: 0.08, direction: "positive" },
        { feature: "demo_scheduled", label: "Já agendou demo", impact: 0.10, direction: "positive" },
        { feature: "last_contact_days", label: "Tempo sem contato (5 dias)", impact: -0.04, direction: "negative" },
      ]},
      { score: 88, tier: "hot" as const, conv: 0.80, ltv: 890000, offer: "Locação de Frota Integrada — R$ 45.000/mês", action: "Demonstração técnica especializada.", icpMatch: 0.88, icpCluster: "Mineradoras Mid-Market Centro-Oeste", shap: [
        { feature: "sector_icp", label: "Setor de Construção Civil alinhado ao ICP", impact: 0.18, direction: "positive" },
        { feature: "company_size", label: "Grande empresa (+500 funcionários)", impact: 0.14, direction: "positive" },
        { feature: "event_source", label: "Captado em Feira do setor", impact: 0.10, direction: "positive" },
        { feature: "region", label: "Região Centro-Oeste (DF)", impact: 0.08, direction: "positive" },
        { feature: "last_contact_days", label: "8 dias sem contato", impact: -0.06, direction: "negative" },
      ]},
      { score: 85, tier: "hot" as const, conv: 0.75, ltv: 780000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 82, tier: "hot" as const, conv: 0.71, ltv: 650000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 78, tier: "warm" as const, conv: 0.65, ltv: 920000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Mineradoras Mid-Market Centro-Oeste", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 74, tier: "warm" as const, conv: 0.60, ltv: 560000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 71, tier: "warm" as const, conv: 0.55, ltv: 480000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 68, tier: "warm" as const, conv: 0.50, ltv: 340000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 65, tier: "warm" as const, conv: 0.48, ltv: 720000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Mineradoras Mid-Market Centro-Oeste", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 58, tier: "warm" as const, conv: 0.40, ltv: 290000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 52, tier: "warm" as const, conv: 0.35, ltv: 210000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 45, tier: "cold" as const, conv: 0.25, ltv: 120000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.30, icpCluster: "Anti-ICP: Micro-empresas", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: -0.08, direction: "negative" }] },
      { score: 38, tier: "cold" as const, conv: 0.18, ltv: 45000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.20, icpCluster: "Anti-ICP: Micro-empresas", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.05, direction: "positive" }, { feature: "company_size", label: "Porte micro", impact: -0.12, direction: "negative" }] },
      { score: 32, tier: "cold" as const, conv: 0.12, ltv: 35000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.15, icpCluster: "Anti-ICP: Micro-empresas", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.04, direction: "positive" }, { feature: "company_size", label: "Porte micro", impact: -0.14, direction: "negative" }] },
      { score: 28, tier: "disqualified" as const, conv: 0.05, ltv: 18000, offer: "N/A", action: "Desqualificar.", icpMatch: 0.10, icpCluster: "Anti-ICP: Micro-empresas", shap: [{ feature: "company_size", label: "Micro-empresa", impact: -0.18, direction: "negative" }] },
      { score: 76, tier: "warm" as const, conv: 0.62, ltv: 580000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 91, tier: "hot" as const, conv: 0.84, ltv: 1100000, offer: "Diagnóstico Executivo de Frota + Contrato de Manutenção", action: "Proposta técnica detalhada.", icpMatch: 0.91, icpCluster: "Mineradoras Mid-Market Centro-Oeste", shap: [
        { feature: "sector_icp", label: "Mineração — perfil ICP ideal", impact: 0.24, direction: "positive" },
        { feature: "referral", label: "Indicação de cliente ativo", impact: 0.16, direction: "positive" },
        { feature: "company_size", label: "Grande empresa", impact: 0.12, direction: "positive" },
        { feature: "region", label: "DF — mercado prioritário", impact: 0.08, direction: "positive" },
      ]},
      { score: 72, tier: "warm" as const, conv: 0.58, ltv: 420000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 63, tier: "warm" as const, conv: 0.45, ltv: 380000, offer: "Apresentação geral dos serviços DCCO", action: "Qualificar necessidades.", icpMatch: 0.60, icpCluster: "Construtoras Regionais em Expansão", shap: [{ feature: "sector", label: "Setor alinhado", impact: 0.10, direction: "positive" }, { feature: "company_size", label: "Porte da empresa", impact: 0.08, direction: "positive" }] },
      { score: 22, tier: "disqualified" as const, conv: 0.03, ltv: 12000, offer: "N/A", action: "Desqualificar.", icpMatch: 0.05, icpCluster: "Anti-ICP: Micro-empresas", shap: [{ feature: "company_size", label: "Micro-empresa", impact: -0.20, direction: "negative" }] },
    ];

    const leadRows = await db.insert(leads).values(
      leadMockData.map(l => ({
        tenantId,
        name: l.name,
        company: l.company,
        industry: l.industry,
        companySize: l.size,
        city: l.city,
        state: l.state,
        email: l.email,
        phone: l.phone,
        source: l.source,
        status: l.status,
        campaignId: campaignIds[l.campaign],
        assignedTo: userId,
      }))
    ).returning();
    const leadIds: Record<string, string> = {};
    leadRows.forEach((row, i) => { leadIds[`l${i + 1}`] = row.id; });

    // ── 10. Scores (20) ────────────────────────────────────────────────────
    await db.insert(obtainScores).values(
      leadScoreData.map((s, i) => ({
        tenantId,
        leadId: leadIds[`l${i + 1}`],
        score: s.score,
        riskTier: s.tier,
        conversionProbability: s.conv,
        ltvPrediction: s.ltv,
        recommendedAction: s.action,
        recommendedOffer: s.offer,
        shapValues: s.shap as any,
      }))
    );

    // ── 11. ICP Clusters (3) ───────────────────────────────────────────────
    await db.insert(obtainIcpClusters).values([
      { tenantId, clusterId: 1, clusterName: "Mineradoras Mid-Market Centro-Oeste", description: "Empresas de mineração e beneficiamento mineral com 200-1000 funcionários na região Centro-Oeste.", characteristics: { ltv: 90, cac: 85, conversion: 88, tenure: 92, churn: 95 }, averageLtv: 1080000, averageCac: 3200, averageConversionRate: 0.38, averageTenureDays: 1620, churnRate30d: 0.021, isIdeal: true },
      { tenantId, clusterId: 2, clusterName: "Construtoras Regionais em Expansão", description: "Construtoras médias em expansão, buscando locação de longo prazo de equipamentos pesados.", characteristics: { ltv: 65, cac: 60, conversion: 62, tenure: 70, churn: 72 }, averageLtv: 540000, averageCac: 5800, averageConversionRate: 0.24, averageTenureDays: 900, churnRate30d: 0.045, isIdeal: true },
      { tenantId, clusterId: 3, clusterName: "Anti-ICP: Micro-empresas Alta Rotatividade", description: "Micro-empresas com menos de 50 funcionários. Contratos curtos, alto volume de chamados técnicos.", characteristics: { ltv: 20, cac: 30, conversion: 25, tenure: 15, churn: 10 }, averageLtv: 85000, averageCac: 4100, averageConversionRate: 0.12, averageTenureDays: 180, churnRate30d: 0.18, isIdeal: false },
    ]);

    // ── 12. Campaign ROI (5) ───────────────────────────────────────────────
    await db.insert(obtainCampaignRoi).values(
      campaignData.map(camp => ({
        tenantId,
        campaignId: campaignIds[camp.name],
        totalLeads: camp.totalLeads,
        qualifiedLeads: Math.round(camp.totalLeads * 0.4),
        totalCac: camp.cac * camp.totalLeads,
        averageLtvPrediction: camp.avgLtv,
        projectedRoi: camp.roi,
        roiStatus: camp.roiStatus,
      }))
    );

    // ── 13. Funnel Metrics (5) ─────────────────────────────────────────────
    await db.insert(obtainFunnelMetrics).values([
      { tenantId, stageName: "Prospecção", stageOrder: 1, leadsCount: 287, avgTimeDays: 0, dropOffRate: 0, revenueAtRisk: 14400000 },
      { tenantId, stageName: "Qualificação", stageOrder: 2, leadsCount: 198, avgTimeDays: 5, dropOffRate: 0.31, revenueAtRisk: 9600000 },
      { tenantId, stageName: "Demo", stageOrder: 3, leadsCount: 89, avgTimeDays: 8, dropOffRate: 0.55, revenueAtRisk: 7200000 },
      { tenantId, stageName: "Proposta", stageOrder: 4, leadsCount: 45, avgTimeDays: 18, dropOffRate: 0.49, revenueAtRisk: 4800000 },
      { tenantId, stageName: "Fechado", stageOrder: 5, leadsCount: 12, avgTimeDays: 12, dropOffRate: 0.73, revenueAtRisk: 0 },
    ]);

    // ── 14. Obtain Uploads (2) ─────────────────────────────────────────────
    await db.insert(obtainUploads).values([
      { tenantId, filename: "leads_mar2026.csv", rowsCount: 287, status: "completed" as const, uploadedBy: userId },
      { tenantId, filename: "leads_fev2026.csv", rowsCount: 245, status: "completed" as const, uploadedBy: userId },
    ]);

    res.json({
      message: "Seed DCCO concluído",
      email: "demo@dcco.com.br",
      tenantId,
      stats: {
        customers: 20,
        predictions: 20,
        churnCauses: 6,
        analytics: 12,
        campaigns: 5,
        leads: 20,
        scores: 20,
        icpClusters: 3,
        funnelStages: 5,
      },
    });
  } catch (err) {
    console.error("Seed error:", err);
    res.status(500).json({ error: "Erro ao executar seed", details: String(err) });
  }
});

// ─── POST /api/seed/demo — Pipeline-based seed ─────────────────────────────
// Uses the same intelligence engines that real uploads use.
seedRouter.post("/demo", async (_req, res) => {
  try {
    // ── Cleanup existing demo tenant ─────────────────────────────────────
    const existingTenants = await db.select({ id: tenants.id }).from(tenants)
      .where(eq(tenants.companyName, "DCCO Equipamentos"));

    for (const existing of existingTenants) {
      const tid = existing.id;
      const tables = [
        "customer_notes", "customer_score_history", "retain_alerts",
        "obtain_alerts", "lead_score_history",
        "obtain_lead_actions", "obtain_scores", "obtain_campaign_roi",
        "obtain_funnel_metrics", "obtain_uploads", "leads",
        "obtain_icp_clusters", "obtain_campaigns",
        "retain_actions", "retain_predictions", "retain_churn_causes",
        "retain_analytics", "retain_uploads", "customers",
        "scoring_configs", "custom_dimensions", "column_mapping_templates",
      ];
      for (const table of tables) {
        await db.execute(sql.raw(`DELETE FROM ${table} WHERE tenant_id = '${tid}'`));
      }
      await db.execute(sql`DELETE FROM users WHERE tenant_id = ${tid}`);
      await db.execute(sql`DELETE FROM tenants WHERE id = ${tid}`);
    }
    await db.execute(sql`DELETE FROM users WHERE email = 'demo@dcco.com.br'`);

    // ── 1. Create tenant ────────────────────────────────────────────────
    const [tenant] = await db.insert(tenants).values({
      companyName: "DCCO Equipamentos",
      sector: "industrial_b2b",
      sectorConfig: {
        customerLabel: "Empresa",
        customersLabel: "Empresas",
        revenueLabel: "Valor do Contrato",
        engagementLabel: "Utilização de Equipamentos",
        ticketLabel: "Chamados Técnicos",
        tenureLabel: "Tempo de Parceria",
        segments: ["Mineração", "Construção Civil", "Agropecuária", "Industrial"],
        currency: "BRL",
      },
      plan: "enterprise",
    }).returning();
    const tenantId = tenant.id;

    // ── 2. Create admin user ────────────────────────────────────────────
    const passwordHash = await bcrypt.hash("Demo@2026", 12);
    await db.insert(users).values({
      tenantId,
      email: "demo@dcco.com.br",
      passwordHash,
      name: "Admin DCCO",
      role: "admin",
    });

    // ── 3. Parse and insert customers from CSV ──────────────────────────
    const csvDir = path.join(import.meta.dirname ?? __dirname, "../seed/csv-templates");
    const customerCsvPath = path.join(csvDir, "mineracao_clientes.csv");
    const customerCsv = fs.readFileSync(customerCsvPath, "utf-8");
    const parsedCustomers = Papa.parse<Record<string, string>>(customerCsv, { header: true, skipEmptyLines: true });

    // Auto-detect mapping
    const customerHeaders = parsedCustomers.meta.fields ?? [];
    const customerMapping = suggestMapping(customerHeaders, parsedCustomers.data.slice(0, 3), "retain");
    const retainMap: Record<string, string> = {};
    for (const suggestion of customerMapping) {
      if (suggestion.suggestedDimension && suggestion.confidenceScore > 0.3) {
        retainMap[suggestion.suggestedDimension] = suggestion.csvColumn;
      }
    }

    // Manual overrides for known columns specific to this CSV
    retainMap["customerCode"] = "codigo";
    retainMap["name"] = "razao_social";
    retainMap["segment"] = "segmento";

    const toFloat = (v: string | undefined) => v ? parseFloat(v.replace(",", ".")) || null : null;
    const toInt = (v: string | undefined) => v ? parseInt(v, 10) || null : null;

    // Simulate 3 monthly uploads for trend data
    for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
      for (const row of parsedCustomers.data) {
        const get = (key: string) => {
          const col = retainMap[key];
          return col ? row[col] : undefined;
        };

        // Add variation to simulate change over months
        const variation = monthOffset === 0 ? 1 : monthOffset === 1 ? 0.95 + Math.random() * 0.1 : 0.9 + Math.random() * 0.2;
        const code = get("customerCode") ?? "";

        const existingRows = await db.select({ id: customers.id })
          .from(customers)
          .where(sql`${customers.tenantId} = ${tenantId} AND ${customers.customerCode} = ${code}`)
          .limit(1);

        const customerData = {
          tenantId,
          customerCode: code,
          name: get("name") ?? "Sem nome",
          segment: get("segment") ?? undefined,
          dimRevenue: toFloat(get("dimRevenue")),
          dimPaymentRegularity: toFloat(get("dimPaymentRegularity")),
          dimTenureDays: toInt(get("dimTenureDays")),
          dimInteractionFrequency: toFloat(get("dimInteractionFrequency")),
          dimSupportVolume: toFloat(get("dimSupportVolume")),
          dimSatisfaction: toFloat(get("dimSatisfaction")),
          dimContractRemainingDays: toInt(get("dimContractRemainingDays")),
          dimUsageIntensity: toFloat(get("dimUsageIntensity")),
          dimRecencyDays: toInt(get("dimRecencyDays")),
          rawData: row,
          updatedAt: new Date(),
        };

        // Apply variation to simulate trends
        if (monthOffset > 0 && customerData.dimSatisfaction != null) {
          customerData.dimSatisfaction = Math.round(customerData.dimSatisfaction * variation);
        }
        if (monthOffset > 0 && customerData.dimUsageIntensity != null) {
          customerData.dimUsageIntensity = Math.round(customerData.dimUsageIntensity * variation);
        }

        if (existingRows.length > 0) {
          await db.update(customers).set(customerData).where(eq(customers.id, existingRows[0].id));
        } else {
          await db.insert(customers).values({ ...customerData, status: "active" as const });
        }
      }

      // Run full pipeline after each "upload"
      await runRetainPredictions(tenantId);
      await generateAnalyticsSnapshot(tenantId);
      await generateChurnCauses(tenantId);
    }

    // Generate alerts only on the final run
    await generateAlerts(tenantId);

    // ── 4. Parse and insert leads from CSV ──────────────────────────────
    const leadCsvPath = path.join(csvDir, "construcao_leads.csv");
    const leadCsv = fs.readFileSync(leadCsvPath, "utf-8");
    const parsedLeads = Papa.parse<Record<string, string>>(leadCsv, { header: true, skipEmptyLines: true });

    for (const row of parsedLeads.data) {
      await db.insert(leads).values({
        tenantId,
        name: row["nome_contato"] ?? "Sem nome",
        company: row["empresa"] ?? undefined,
        industry: row["segmento"] ?? undefined,
        companySize: (["micro", "small", "medium", "large", "enterprise"].includes(row["porte"] ?? "")
          ? row["porte"] as any : undefined),
        city: row["cidade"] ?? undefined,
        state: row["uf"] ?? undefined,
        email: row["email_comercial"] ?? undefined,
        phone: row["telefone"] ?? undefined,
        source: (["referral", "event", "outbound", "paid_search", "paid_social", "organic"].includes(row["origem"] ?? "")
          ? row["origem"] as any : "csv"),
        status: "new",
        rawData: row,
      });
    }

    // Run Obtain pipeline
    await runObtainScoring(tenantId);
    await generateIcpClusters(tenantId);
    await generateObtainAlerts(tenantId);

    // ── 5. Count results ────────────────────────────────────────────────
    const [cCount] = await db.select({ c: sql<number>`count(*)::int` }).from(customers).where(eq(customers.tenantId, tenantId));
    const [pCount] = await db.select({ c: sql<number>`count(*)::int` }).from(retainPredictions).where(eq(retainPredictions.tenantId, tenantId));
    const [aCount] = await db.select({ c: sql<number>`count(*)::int` }).from(retainAlerts).where(eq(retainAlerts.tenantId, tenantId));
    const [lCount] = await db.select({ c: sql<number>`count(*)::int` }).from(leads).where(eq(leads.tenantId, tenantId));
    const [sCount] = await db.select({ c: sql<number>`count(*)::int` }).from(obtainScores).where(eq(obtainScores.tenantId, tenantId));
    const [iCount] = await db.select({ c: sql<number>`count(*)::int` }).from(obtainIcpClusters).where(eq(obtainIcpClusters.tenantId, tenantId));
    const [hCount] = await db.select({ c: sql<number>`count(*)::int` }).from(customerScoreHistory).where(eq(customerScoreHistory.tenantId, tenantId));

    res.json({
      message: "Demo seed concluído via pipeline real",
      email: "demo@dcco.com.br",
      password: "Demo@2026",
      tenantId,
      stats: {
        customers: cCount.c,
        predictions: pCount.c,
        alerts: aCount.c,
        leads: lCount.c,
        leadScores: sCount.c,
        icpClusters: iCount.c,
        scoreHistorySnapshots: hCount.c,
      },
    });
  } catch (err) {
    console.error("Demo seed error:", err);
    res.status(500).json({ error: "Erro ao executar demo seed", details: String(err) });
  }
});
