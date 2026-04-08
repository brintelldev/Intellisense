/**
 * auth.test.ts
 *
 * Cobre os cenários identificados pelo TestSprite:
 *  TC001 - Login com credenciais válidas retorna 200 + dados de usuário/tenant
 *  TC002 - Login com credenciais inválidas retorna 401 + "Credenciais inválidas"
 *  TC_REG - Registro de novo usuário cria tenant + usuário e retorna 201
 *  TC_ME  - GET /api/auth/me sem sessão retorna 401
 *  TC_LOGOUT - POST /api/auth/logout encerra a sessão
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db";
import { users, tenants } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

const app = createApp();
const db = drizzle(pool, { schema: { users, tenants } });

// ─── Dados de teste ───────────────────────────────────────────────────────────
const TEST_USER = {
  email: `test.auth.${Date.now()}@intellisense.test`,
  password: "Test@12345",
  name: "Usuário de Teste",
  companyName: "Empresa Teste",
  sector: "saas",
};

// ─── Cleanup: remove o usuário/tenant criado nos testes ───────────────────────
afterAll(async () => {
  try {
    const found = await db
      .select({ id: users.id, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.email, TEST_USER.email))
      .limit(1);

    if (found.length > 0) {
      await db.delete(users).where(eq(users.email, TEST_USER.email));
      await db.delete(tenants).where(eq(tenants.id, found[0].tenantId));
    }
  } catch (err) {
    console.error("[CLEANUP] Erro ao limpar dados de teste:", err);
  }
});

// ─── Testes ───────────────────────────────────────────────────────────────────
describe("Auth API", () => {

  // ── Health Check ───────────────────────────────────────────────────────────
  it("GET /api/health retorna status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("intelli-sense-api");
  });

  // ── TC_REG: Registro ────────────────────────────────────────────────────────
  it("TC_REG - POST /api/auth/register cria usuário e tenant com sucesso", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(TEST_USER);

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.user.role).toBe("admin");
    expect(res.body.tenant).toBeDefined();
    expect(res.body.tenant.companyName).toBe(TEST_USER.companyName);
    expect(res.body.tenant.sector).toBe(TEST_USER.sector);
  });

  it("TC_REG - POST /api/auth/register retorna 409 para email já cadastrado", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(TEST_USER); // mesmo email

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/já cadastrado/i);
  });

  it("TC_REG - POST /api/auth/register retorna 400 se campos obrigatórios faltam", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "incompleto@test.com" }); // sem password, name, companyName

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // ── TC002: Login inválido ────────────────────────────────────────────────────
  it("TC002 - POST /api/auth/login com credenciais inválidas retorna 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "naoexiste@intellisense.test", password: "senha-errada" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenciais inválidas/i);
  });

  it("TC002 - POST /api/auth/login com senha errada para email válido retorna 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, password: "senha-errada-123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenciais inválidas/i);
  });

  it("POST /api/auth/login retorna 400 se email ou senha faltam", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_USER.email }); // sem password

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // ── TC001: Login válido ──────────────────────────────────────────────────────
  it("TC001 - POST /api/auth/login com credenciais válidas retorna 200 + user/tenant", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.tenant).toBeDefined();
    expect(res.body.tenant.companyName).toBe(TEST_USER.companyName);
    // Senha NÃO deve aparecer na resposta
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  // ── TC_ME: Sessão ────────────────────────────────────────────────────────────
  it("TC_ME - GET /api/auth/me sem sessão retorna 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/não autenticado/i);
  });

  it("TC_ME - GET /api/auth/me com sessão ativa retorna dados do usuário", async () => {
    const agent = request.agent(app); // agent mantém cookies/sessão entre requests

    // Login primeiro
    await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    // Agora /me deve responder com o usuário
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_USER.email);
  });

  // ── TC_LOGOUT: Logout ────────────────────────────────────────────────────────
  it("TC_LOGOUT - POST /api/auth/logout encerra sessão", async () => {
    const agent = request.agent(app);

    // Login
    await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    // Logout
    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);

    // Após logout, /me deve retornar 401
    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(401);
  });
});
