/**
 * seed.test.ts
 * Testa o endpoint POST /api/seed/dcco — idempotência e dados corretos.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("Seed DCCO", () => {
  it("POST /api/seed/dcco retorna 200 com credenciais e stats", async () => {
    const res = await request(app).post("/api/seed/dcco");

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/seed dcco/i);
    expect(res.body.email).toBe("demo@dcco.com.br");
    expect(res.body.password).toBeUndefined(); // password não deve ser exposto
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.customers).toBe(20);
    expect(res.body.stats.predictions).toBe(20);
    expect(res.body.stats.churnCauses).toBe(6);
    expect(res.body.stats.analytics).toBe(12);
    expect(res.body.stats.campaigns).toBe(5);
    expect(res.body.stats.leads).toBe(20);
    expect(res.body.stats.scores).toBe(20);
    expect(res.body.stats.icpClusters).toBe(3);
    expect(res.body.stats.funnelStages).toBe(5);
  }, 30000);

  it("POST /api/seed/dcco é idempotente (segunda chamada também sucede)", async () => {
    const res = await request(app).post("/api/seed/dcco");

    expect(res.status).toBe(200);
    expect(res.body.stats.customers).toBe(20);
  }, 30000);
});
