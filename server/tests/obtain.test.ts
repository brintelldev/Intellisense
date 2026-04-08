/**
 * obtain.test.ts
 * Testa os endpoints da API Obtain após seed.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("Obtain API", () => {
  let agent: ReturnType<typeof request.agent>;
  let leadId: string;

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
  it("GET /api/obtain/dashboard retorna KPIs", async () => {
    const res = await agent.get("/api/obtain/dashboard");

    expect(res.status).toBe(200);
    expect(res.body.kpis).toBeDefined();
    expect(res.body.kpis.totalLeads).toBeGreaterThan(0);
    expect(res.body.kpis.hotLeads).toBeGreaterThan(0);
    expect(res.body.kpis.cac).toBeGreaterThan(0);
  });

  // ── Leads ──────────────────────────────────────────────────────────────────
  it("GET /api/obtain/leads retorna lista paginada com scores", async () => {
    const res = await agent.get("/api/obtain/leads");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBe(20);
    expect(res.body.total).toBe(20);

    // Guardar leadId para próximo teste
    leadId = res.body.data[0].id;

    // Verificar que score está presente
    expect(res.body.data[0].score).toBeDefined();
  });

  it("GET /api/obtain/leads?scoreTier=hot filtra leads hot", async () => {
    const res = await agent.get("/api/obtain/leads?scoreTier=hot");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((l: any) => {
      expect(l.scoreTier).toBe("hot");
    });
  });

  it("GET /api/obtain/leads/:id retorna lead com score e shapValues", async () => {
    const res = await agent.get(`/api/obtain/leads/${leadId}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBeDefined();
    expect(res.body.score).toBeDefined();
    expect(res.body.shapValues).toBeDefined();
  });

  // ── ICP Clusters ───────────────────────────────────────────────────────────
  it("GET /api/obtain/icp-clusters retorna 3 clusters", async () => {
    const res = await agent.get("/api/obtain/icp-clusters");

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0].name).toBeDefined();
    expect(res.body[0].avgLtv).toBeDefined();
  });

  // ── Funnel ─────────────────────────────────────────────────────────────────
  it("GET /api/obtain/funnel retorna 5 estágios em ordem", async () => {
    const res = await agent.get("/api/obtain/funnel");

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(5);
    // Verificar ordenação
    for (let i = 1; i < res.body.length; i++) {
      expect(res.body[i].order).toBeGreaterThan(res.body[i - 1].order);
    }
  });

  // ── Campaigns ──────────────────────────────────────────────────────────────
  it("GET /api/obtain/campaigns retorna 5 campanhas com ROI", async () => {
    const res = await agent.get("/api/obtain/campaigns");

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(5);
    expect(res.body[0].name).toBeDefined();
    expect(res.body[0].projectedRoi).toBeDefined();
  });

  // ── Lead Actions ───────────────────────────────────────────────────────────
  it("POST /api/obtain/lead-actions cria ação com status 201", async () => {
    const res = await agent.post("/api/obtain/lead-actions").send({
      leadId,
      actionType: "call",
      notes: "Contato inicial de qualificação",
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  // ── Uploads ────────────────────────────────────────────────────────────────
  it("GET /api/obtain/uploads retorna histórico de uploads", async () => {
    const res = await agent.get("/api/obtain/uploads");

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});
