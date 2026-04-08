/**
 * navigation.spec.ts
 * Testa guards de autenticação e fluxos de navegação.
 *
 * Grupos:
 * A — Auth Guards: rotas protegidas redirecionam para /login sem sessão
 * B — Sidebar Navigation: links de módulos navegam para a URL correta
 * C — 404: rota inválida renderiza componente de erro
 * D — Demo mode: botão "Entrar como Demo" ativa modo demo via localStorage
 */
import { test, expect } from "@playwright/test";

// ── A: Auth Guards ────────────────────────────────────────────────────────────
test.describe("Auth Guards — redirecionamento sem sessão", () => {
  // Sobrescreve o storageState do projeto desktop para contexto limpo (sem sessão)
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of ["/", "/retain", "/obtain", "/settings", "/retain/predictions", "/obtain/leads"]) {
    test(`${route} sem sessão redireciona para /login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      await expect(page.locator("h1")).toBeVisible();
    });
  }

  test("página /login é acessível sem autenticação", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toBeVisible({ timeout: 5_000 });
  });

  test("/login não redireciona para si mesma em loop", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── B: Sidebar Navigation ─────────────────────────────────────────────────────
test.describe("Sidebar Navigation — links de módulos (autenticado)", () => {
  test("link 'Ciclo de Vida' navega para /", async ({ page }) => {
    await page.goto("/retain");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /ciclo de vida/i }).click();
    await expect(page).toHaveURL("/", { timeout: 5_000 });
  });

  test("link 'Dashboard Executivo' do Retain navega para /retain", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    // Retain Dashboard é o primeiro "Dashboard Executivo" no DOM
    await page.getByRole("button", { name: /dashboard executivo/i }).first().click();
    await expect(page).toHaveURL("/retain", { timeout: 5_000 });
  });

  test("link 'Dashboard Executivo' do Obtain navega para /obtain", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    // Obtain Dashboard é o último "Dashboard Executivo" no DOM
    await page.getByRole("button", { name: /dashboard executivo/i }).last().click();
    await expect(page).toHaveURL("/obtain", { timeout: 5_000 });
  });

  test("link 'Predições de Churn' navega para /retain/predictions", async ({ page }) => {
    await page.goto("/retain");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /predições de churn/i }).click();
    await expect(page).toHaveURL("/retain/predictions", { timeout: 5_000 });
  });

  test("link 'Causas Raiz' navega para /retain/root-causes", async ({ page }) => {
    await page.goto("/retain");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /causas raiz/i }).click();
    await expect(page).toHaveURL("/retain/root-causes", { timeout: 5_000 });
  });

  test("link 'Lead Scoring' navega para /obtain/leads", async ({ page }) => {
    await page.goto("/obtain");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /lead scoring/i }).click();
    await expect(page).toHaveURL("/obtain/leads", { timeout: 5_000 });
  });

  test("link 'ICP & Lookalike' navega para /obtain/icp", async ({ page }) => {
    await page.goto("/obtain");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /icp & lookalike/i }).click();
    await expect(page).toHaveURL("/obtain/icp", { timeout: 5_000 });
  });

  test("link 'Configurações' navega para /settings", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /configurações/i }).click();
    await expect(page).toHaveURL("/settings", { timeout: 5_000 });
  });
});

// ── C: 404 ────────────────────────────────────────────────────────────────────
test.describe("404 — rota inválida (autenticado)", () => {
  test("URL inválida renderiza componente 404", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz");
    await page.waitForTimeout(500);
    await expect(page.getByText("404")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/página não encontrada/i)).toBeVisible({ timeout: 5_000 });
  });

  test("link 'Voltar ao início' na 404 retorna para /", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz");
    await page.getByRole("link", { name: /voltar ao início/i }).click();
    await expect(page).toHaveURL("/", { timeout: 5_000 });
  });
});

// ── D: Demo mode ──────────────────────────────────────────────────────────────
test.describe("Demo mode — botão 'Entrar como Demo'", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("botão 'Entrar como Demo' carrega o app como DEMO_USER", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /entrar como demo/i }).click();
    await page.waitForURL("/", { timeout: 10_000 });
    await page.waitForTimeout(1000);
    await expect(page.locator("aside").getByText(/caio ferreira/i)).toBeVisible({ timeout: 5_000 });
  });

  test("demo mode: flag localStorage 'is-demo' é setada após clicar no botão", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /entrar como demo/i }).click();
    const demoFlag = await page.evaluate(() => localStorage.getItem("is-demo"));
    expect(demoFlag).toBe("true");
  });
});
