/**
 * retain.test.ts
 * Testa os endpoints da API Retain após seed.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("Retain API", () => {
  let agent: ReturnType<typeof request.agent>;
  let customerId: string;

  beforeAll(async () => {
    // Login (seed.test.ts roda antes e cria os dados)
    agent = request.agent(app);
    const loginRes = await agent.post("/api/auth/login").send({
      email: "demo@dcco.com.br",
      password: "Demo@2026",
    });
    if (loginRes.status !== 200) {
      throw new Error(`Login falhou: ${loginRes.status} — rode seed.test.ts antes`);
    }
  }, 30000);

  // ── Dashboard ──────────────────────────────────────────────────────────────
  it("GET /api/retain/dashboard retorna KPIs e alertas", async () => {
    const res = await agent.get("/api/retain/dashboard");

    expect(res.status).toBe(200);
    expect(res.body.kpis).toBeDefined();
    expect(res.body.kpis.totalCustomers).toBeGreaterThan(0);
    expect(res.body.kpis.riskDistribution).toBeDefined();
    expect(res.body.alerts).toBeDefined();
    expect(res.body.alerts.length).toBeGreaterThan(0);
  });

  // ── Predictions ────────────────────────────────────────────────────────────
  it("GET /api/retain/predictions retorna lista paginada", async () => {
    const res = await agent.get("/api/retain/predictions");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBe(20);
    expect(res.body.total).toBe(20);
    expect(res.body.page).toBe(1);

    // Guardar customerId para próximo teste
    customerId = res.body.data[0].id;
  });

  it("GET /api/retain/predictions?riskLevel=critical filtra corretamente", async () => {
    const res = await agent.get("/api/retain/predictions?riskLevel=critical");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    res.body.data.forEach((p: any) => {
      expect(p.riskLevel).toBe("critical");
    });
  });

  it("GET /api/retain/predictions?search=Mineradora filtra por nome", async () => {
    const res = await agent.get("/api/retain/predictions?search=Mineradora");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((p: any) => {
      expect(p.name.toLowerCase()).toContain("mineradora");
    });
  });

  it("GET /api/retain/predictions/:customerId retorna predição com shapValues", async () => {
    const res = await agent.get(`/api/retain/predictions/${customerId}`);

    expect(res.status).toBe(200);
    expect(res.body.shapValues).toBeDefined();
    expect(res.body.shapValues.length).toBeGreaterThan(0);
    expect(res.body.recommendedAction).toBeDefined();
  });

  // ── Customers ──────────────────────────────────────────────────────────────
  it("GET /api/retain/customers retorna lista paginada", async () => {
    const res = await agent.get("/api/retain/customers");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(20);
    expect(res.body.total).toBe(20);
  });

  // ── Churn Causes ───────────────────────────────────────────────────────────
  it("GET /api/retain/churn-causes retorna 6 causas ordenadas por impactPct DESC", async () => {
    const res = await agent.get("/api/retain/churn-causes");

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(6);
    // Verificar ordenação
    for (let i = 1; i < res.body.length; i++) {
      expect(res.body[i - 1].impactPct).toBeGreaterThanOrEqual(res.body[i].impactPct);
    }
  });

  // ── Analytics Trend ────────────────────────────────────────────────────────
  it("GET /api/retain/analytics/trend retorna 12 snapshots mensais", async () => {
    const res = await agent.get("/api/retain/analytics/trend");

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(12);
    expect(res.body[0].month).toBeDefined();
    expect(res.body[0].totalCustomers).toBeGreaterThan(0);
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  it("POST /api/retain/actions cria ação com status 201", async () => {
    const res = await agent.post("/api/retain/actions").send({
      customerId,
      type: "call",
      description: "Contato de acompanhamento",
      priority: "high",
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.type).toBe("call");
  });

  // ── Uploads ────────────────────────────────────────────────────────────────
  it("GET /api/retain/uploads retorna histórico de uploads", async () => {
    const res = await agent.get("/api/retain/uploads");

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });
});
