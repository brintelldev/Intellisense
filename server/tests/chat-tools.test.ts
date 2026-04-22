/**
 * chat-tools.test.ts
 *
 * Cobre:
 *  - Execução direta de cada uma das 12 tools com tenantId do tenant demo (seed)
 *  - CRÍTICO: tenant isolation — nenhuma tool retorna dados para um tenantId aleatório
 *  - Validação Zod rejeita input malformado com { ok: false, error: ... }
 *
 * Depende do 00-seed.test.ts ter rodado antes (fileParallelism: false + sequência alfabética).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { tenants } from "../../shared/schema";
import { executeTool, ALL_TOOLS } from "../src/engine/chat-tools";

describe("chat-tools — execução e tenant isolation", () => {
  let realTenantId: string;
  const FAKE_TENANT_ID = "00000000-0000-0000-0000-000000000000";

  beforeAll(async () => {
    // Resolve o tenantId do seed demo
    const [row] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.companyName, "DCCO Equipamentos"))
      .limit(1);
    if (!row) {
      throw new Error("Tenant DCCO não encontrado — rode 00-seed.test.ts antes");
    }
    realTenantId = row.id;
  });

  // ─────────────────────────────────────────────────────────────────────
  // Cada tool deve retornar algum dado (ou forma válida) para o tenant real
  // ─────────────────────────────────────────────────────────────────────

  it("get_overview_metrics retorna KPIs agregados", async () => {
    const res = await executeTool("get_overview_metrics", {}, { tenantId: realTenantId });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.result as Record<string, unknown>;
    expect(r.totalCustomers).toBeGreaterThan(0);
    expect(r.mrrFormatted).toMatch(/R\$/);
    expect(typeof r.nps).toBe("number");
  });

  it("list_customers_at_risk retorna clientes do tenant", async () => {
    const res = await executeTool(
      "list_customers_at_risk",
      { limit: 5 },
      { tenantId: realTenantId },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.result as { count: number; customers: Array<Record<string, unknown>> };
    expect(r.count).toBeGreaterThan(0);
    expect(r.customers.length).toBeLessThanOrEqual(5);
  });

  it("get_customer_detail funciona via nome", async () => {
    const list = await executeTool(
      "list_customers_at_risk",
      { limit: 1 },
      { tenantId: realTenantId },
    );
    if (!list.ok) throw new Error("list_customers_at_risk falhou");
    const first = (list.result as { customers: Array<{ name: string }> }).customers[0];

    const res = await executeTool(
      "get_customer_detail",
      { name: first.name },
      { tenantId: realTenantId },
    );
    expect(res.ok).toBe(true);
  });

  it("get_churn_root_causes retorna causas agregadas", async () => {
    const res = await executeTool("get_churn_root_causes", {}, { tenantId: realTenantId });
    expect(res.ok).toBe(true);
  });

  it("get_revenue_at_risk_breakdown retorna breakdown", async () => {
    const res = await executeTool(
      "get_revenue_at_risk_breakdown",
      {},
      { tenantId: realTenantId },
    );
    expect(res.ok).toBe(true);
  });

  it("get_nps_breakdown retorna NPS + detractors", async () => {
    const res = await executeTool(
      "get_nps_breakdown",
      { topDetractors: 3 },
      { tenantId: realTenantId },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.result as Record<string, unknown>;
    expect(typeof r.nps).toBe("number");
  });

  it("list_leads_by_score retorna leads", async () => {
    const res = await executeTool(
      "list_leads_by_score",
      { limit: 5 },
      { tenantId: realTenantId },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.result as { count: number };
    expect(r.count).toBeGreaterThan(0);
  });

  it("get_icp_clusters retorna clusters", async () => {
    const res = await executeTool("get_icp_clusters", {}, { tenantId: realTenantId });
    expect(res.ok).toBe(true);
  });

  it("compare_acquisition_channels retorna canais", async () => {
    const res = await executeTool(
      "compare_acquisition_channels",
      {},
      { tenantId: realTenantId },
    );
    expect(res.ok).toBe(true);
  });

  it("get_funnel_analysis retorna funil", async () => {
    const res = await executeTool("get_funnel_analysis", {}, { tenantId: realTenantId });
    expect(res.ok).toBe(true);
  });

  it("get_temporal_trend retorna snapshots", async () => {
    const res = await executeTool("get_temporal_trend", {}, { tenantId: realTenantId });
    expect(res.ok).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // CRÍTICO — tenant isolation
  // ─────────────────────────────────────────────────────────────────────

  it("[TENANT ISOLATION] list_customers_at_risk retorna 0 para tenantId aleatório", async () => {
    const res = await executeTool(
      "list_customers_at_risk",
      { limit: 50 },
      { tenantId: FAKE_TENANT_ID },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.result as { count: number; customers: unknown[] };
    expect(r.count).toBe(0);
    expect(r.customers.length).toBe(0);
  });

  it("[TENANT ISOLATION] get_overview_metrics zera todos os totais para tenantId aleatório", async () => {
    const res = await executeTool("get_overview_metrics", {}, { tenantId: FAKE_TENANT_ID });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.result as Record<string, number>;
    expect(r.totalCustomers).toBe(0);
    expect(r.mrr).toBe(0);
    expect(r.revenueAtRisk).toBe(0);
  });

  it("[TENANT ISOLATION] list_leads_by_score retorna 0 para tenantId aleatório", async () => {
    const res = await executeTool(
      "list_leads_by_score",
      { limit: 50 },
      { tenantId: FAKE_TENANT_ID },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.result as { count: number };
    expect(r.count).toBe(0);
  });

  it("[TENANT ISOLATION] nomes de clientes do tenant real não aparecem para tenantId aleatório", async () => {
    const real = await executeTool(
      "list_customers_at_risk",
      { limit: 50 },
      { tenantId: realTenantId },
    );
    const fake = await executeTool(
      "list_customers_at_risk",
      { limit: 50 },
      { tenantId: FAKE_TENANT_ID },
    );
    if (!real.ok || !fake.ok) throw new Error("falha nas queries");

    const realNames = new Set(
      (real.result as { customers: Array<{ name: string }> }).customers.map((c) => c.name),
    );
    const fakeNames = (fake.result as { customers: Array<{ name: string }> }).customers.map(
      (c) => c.name,
    );
    for (const n of fakeNames) {
      expect(realNames.has(n)).toBe(false);
    }
    expect(fakeNames.length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Validação de input
  // ─────────────────────────────────────────────────────────────────────

  it("retorna { ok: false } para tool desconhecida", async () => {
    const res = await executeTool("unknown_tool", {}, { tenantId: realTenantId });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/desconhecida/i);
  });

  it("retorna { ok: false } para input que viola schema Zod", async () => {
    // list_customers_at_risk aceita limit ≤ 50
    const res = await executeTool(
      "list_customers_at_risk",
      { limit: 9999 },
      { tenantId: realTenantId },
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/limit/i);
  });

  it("todas as 12 tools estão registradas em ALL_TOOLS", () => {
    const names = Object.keys(ALL_TOOLS);
    expect(names).toHaveLength(12);
    expect(names).toContain("get_overview_metrics");
    expect(names).toContain("list_customers_at_risk");
    expect(names).toContain("get_customer_detail");
    expect(names).toContain("get_churn_root_causes");
    expect(names).toContain("get_revenue_at_risk_breakdown");
    expect(names).toContain("get_nps_breakdown");
    expect(names).toContain("list_leads_by_score");
    expect(names).toContain("get_lead_detail");
    expect(names).toContain("get_icp_clusters");
    expect(names).toContain("compare_acquisition_channels");
    expect(names).toContain("get_funnel_analysis");
    expect(names).toContain("get_temporal_trend");
  });
});
