/**
 * routes-protection.test.ts
 *
 * Testa se as rotas protegidas bloqueiam acesso sem sessão.
 * Cobre padrão de segurança para todos os endpoints autenticados.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("Proteção de Rotas Autenticadas", () => {

  const PROTECTED_ROUTES = [
    { method: "get",  path: "/api/tenants" },
    { method: "get",  path: "/api/retain/dashboard" },
    { method: "get",  path: "/api/retain/predictions" },
    { method: "get",  path: "/api/retain/customers" },
    { method: "get",  path: "/api/obtain/dashboard" },
    { method: "get",  path: "/api/obtain/leads" },
  ];

  for (const route of PROTECTED_ROUTES) {
    it(`${route.method.toUpperCase()} ${route.path} sem sessão retorna 401`, async () => {
      const req = request(app);
      const res = await (req as any)[route.method](route.path);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/não autenticado/i);
    });
  }
});
