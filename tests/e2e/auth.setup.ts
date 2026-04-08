/**
 * auth.setup.ts — Loga com a conta demo e salva o estado de sessão
 * para ser reutilizado em todos os testes E2E autenticados.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.resolve("tests/e2e/.auth/user.json");

setup("authenticate as demo user", async ({ page, request }) => {
  // Garante que o seed existe
  await request.post("http://localhost:3001/api/seed/dcco").catch(() => {
    // Silencia erro caso o seed já exista ou o endpoint não esteja disponível
  });

  await page.goto("/login");
  await expect(page.locator("h1")).toContainText("IntelliSense");

  await page.fill('input[type="email"]', "demo@dcco.com.br");
  await page.fill('input[type="password"]', "Demo@2026");
  await page.click('button[type="submit"]');

  // Aguarda redirecionamento para a home
  await page.waitForURL("/", { timeout: 15_000 });

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
