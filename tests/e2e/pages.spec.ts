/**
 * pages.spec.ts
 * Cobre as páginas não testadas na rodada anterior:
 *
 * NOTA SOBRE SESSÃO: O teste de logout destrói a sessão no servidor.
 * O hook test.afterAll abaixo re-autentica ao final do arquivo para que
 * os arquivos subsequentes (retain.spec.ts, etc.) não recebam 401.
 * - Retain: Root Causes, ROI, Upload
 * - Obtain: CAC vs LTV, ROI, Upload
 * - Settings
 * - Lifecycle: integração API + navegação
 * - Auth: sidebar com nome real, register form, credenciais inválidas
 *
 * ATENÇÃO: O teste de logout destrói a sessão no servidor (connect-pg-simple).
 * Por isso ele fica como ÚLTIMO teste do arquivo.
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.resolve("tests/e2e/.auth/user.json");

// Re-autentica após todos os testes para restaurar a sessão destruída pelo logout
test.afterAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', "demo@dcco.com.br");
    await page.fill('input[type="password"]', "Demo@2026");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/", { timeout: 15_000 });
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    await context.storageState({ path: AUTH_FILE });
  } finally {
    await context.close();
  }
});

// ── Retain: Causas Raiz ───────────────────────────────────────────────────────
test.describe("Retain — Root Causes (/retain/root-causes)", () => {
  test("carrega dados da API /retain/churn-causes", async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/retain/churn-causes"), { timeout: 10_000 }),
      page.goto("/retain/root-causes"),
    ]);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test("renderiza tabela de causas e gráfico", async ({ page }) => {
    await page.goto("/retain/root-causes");
    await page.waitForTimeout(1500);
    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
    const charts = page.locator("svg.recharts-surface");
    expect(await charts.count()).toBeGreaterThanOrEqual(1);
  });
});

// ── Retain: ROI ───────────────────────────────────────────────────────────────
test.describe("Retain — ROI Simulator (/retain/roi)", () => {
  test("renderiza com sliders", async ({ page }) => {
    await page.goto("/retain/roi");
    await page.waitForTimeout(1500);
    const sliders = page.locator("input[type='range']");
    expect(await sliders.count()).toBeGreaterThan(0);
    await expect(sliders.first()).toBeEnabled();
  });

  test("exibe card de cenário Conservador e Esperado", async ({ page }) => {
    await page.goto("/retain/roi");
    await page.waitForTimeout(1000);
    await expect(page.getByText(/conservador/i).first()).toBeVisible();
    await expect(page.getByText(/esperado/i).first()).toBeVisible();
  });
});

// ── Retain: Upload ─────────────────────────────────────────────────────────────
test.describe("Retain — Upload (/retain/upload)", () => {
  test("carrega histórico da API /retain/uploads", async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/retain/uploads"), { timeout: 10_000 }),
      page.goto("/retain/upload"),
    ]);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("área de upload e tabela de histórico estão visíveis", async ({ page }) => {
    await page.goto("/retain/upload");
    await page.waitForTimeout(1500);
    await expect(page.locator("input[type='file']")).toBeAttached();
    await expect(page.locator("table")).toBeVisible();
  });
});

// ── Obtain: CAC vs LTV ────────────────────────────────────────────────────────
test.describe("Obtain — CAC vs LTV (/obtain/cac-ltv)", () => {
  test("carrega dados da API /obtain/campaigns", async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/obtain/campaigns"), { timeout: 10_000 }),
      page.goto("/obtain/cac-ltv"),
    ]);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test("tabela de campanhas e gráfico quadrante estão visíveis", async ({ page }) => {
    await page.goto("/obtain/cac-ltv");
    await page.waitForTimeout(1500);
    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(page.locator("svg").first()).toBeVisible();
  });
});

// ── Obtain: ROI ───────────────────────────────────────────────────────────────
test.describe("Obtain — ROI Simulator (/obtain/roi)", () => {
  test("renderiza com sliders e cenários", async ({ page }) => {
    await page.goto("/obtain/roi");
    await page.waitForTimeout(1000);
    const sliders = page.locator("input[type='range']");
    expect(await sliders.count()).toBeGreaterThan(0);
    await expect(page.getByText(/otimizado/i).first()).toBeVisible();
  });
});

// ── Obtain: Upload ────────────────────────────────────────────────────────────
test.describe("Obtain — Upload (/obtain/upload)", () => {
  test("carrega histórico da API /obtain/uploads", async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/obtain/uploads"), { timeout: 10_000 }),
      page.goto("/obtain/upload"),
    ]);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("step indicator e drop-zone estão visíveis", async ({ page }) => {
    await page.goto("/obtain/upload");
    await page.waitForTimeout(500);
    await expect(page.locator("input[type='file']")).toBeAttached();
    await expect(page.getByText(/upload/i).first()).toBeVisible();
  });
});

// ── Settings ──────────────────────────────────────────────────────────────────
// Nota: TabsTrigger é <button> customizado (não role="tab" do Radix padrão)
test.describe("Settings (/settings)", () => {
  test("renderiza as 4 abas", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: /^perfil$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^empresa$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^setor$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^usuários$/i })).toBeVisible();
  });

  test("aba Perfil exibe inputs de nome e email", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForTimeout(1000);
    const inputs = page.locator("input[type='text'], input:not([type])");
    expect(await inputs.count()).toBeGreaterThan(0);
    await expect(page.getByRole("button", { name: /salvar perfil/i })).toBeVisible();
  });

  test("aba Empresa exibe nome da empresa", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /^empresa$/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: /salvar empresa/i })).toBeVisible();
  });

  test("aba Setor renderiza editor de labels + preview em tempo real", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /^setor$/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/preview em tempo real/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /salvar configuração/i })).toBeVisible();
  });

  test("aba Usuários exibe tabela com usuários", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /^usuários$/i }).click();
    await page.waitForTimeout(500);
    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });
});

// ── Lifecycle: integração API ─────────────────────────────────────────────────
// Este bloco deve rodar ANTES dos testes de Auth (logout destrói sessão no servidor)
test.describe("Lifecycle Page (/)", () => {
  test("carrega dados das APIs retain e obtain", async ({ page }) => {
    const [retainRes, obtainRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/retain/dashboard"), { timeout: 10_000 }),
      page.waitForResponse((r) => r.url().includes("/api/obtain/dashboard"), { timeout: 10_000 }),
      page.goto("/"),
    ]);
    expect(retainRes.status()).toBe(200);
    expect(obtainRes.status()).toBe(200);
  });

  test("botão 'Ver dashboard completo' do Obtain navega para /obtain", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await page.getByText(/ver dashboard completo/i).first().click();
    await expect(page).toHaveURL("/obtain", { timeout: 5_000 });
  });

  test("botão 'Ver dashboard completo' do Retain navega para /retain", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await page.getByText(/ver dashboard completo/i).last().click();
    await expect(page).toHaveURL("/retain", { timeout: 5_000 });
  });

  test("gráficos SVG estão visíveis", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    const charts = page.locator("svg.recharts-surface");
    expect(await charts.count()).toBeGreaterThanOrEqual(2);
  });
});

// ── Auth ─────────────────────────────────────────────────────────────────────
// IMPORTANTE: o teste de logout destrói a sessão no servidor — deve ser o ÚLTIMO teste
test.describe("Auth flows", () => {
  test("sidebar exibe nome real do usuário após login (fix useAuth)", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);
    // Após o fix do useAuth, deve ser "Admin DCCO" e não o fallback "Demo"
    const userNameEl = page.locator("aside").getByText(/admin dcco/i);
    await expect(userNameEl).toBeVisible({ timeout: 5_000 });
  });

  test("sidebar exibe email real após login", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);
    const emailEl = page.locator("aside").getByText(/demo@dcco\.com\.br/i);
    await expect(emailEl).toBeVisible({ timeout: 5_000 });
  });

  test("credenciais inválidas exibem mensagem de erro", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@email.com");
    await page.fill('input[type="password"]', "WrongPass123");
    await page.click('button[type="submit"]');
    await expect(page.locator(".bg-red-50")).toBeVisible({ timeout: 5_000 });
  });

  test("botão 'Criar conta' abre o formulário de registro", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /criar conta/i }).click();
    await expect(page.getByRole("heading", { name: /criar conta/i })).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator("select")).toBeVisible();
  });

  test("formulário de registro desabilita submit com senhas diferentes", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /criar conta/i }).click();
    await page.fill('input[placeholder="Seu nome"]', "Teste User");
    await page.fill('input[type="email"]', "teste@example.com");
    await page.fill('input[placeholder="Empresa Ltda."]', "Empresa Teste");
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill("Senha@123");
    await passwords.nth(1).fill("Senha@999");
    const submitBtn = page.getByRole("button", { name: /criar conta/i }).last();
    await expect(submitBtn).toBeDisabled();
  });

  // ÚLTIMO: destrói a sessão no servidor — mantido no final do arquivo
  test("logout redireciona para /login", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    const logoutBtn = page.locator("aside button").filter({ hasText: /sair/i });
    await logoutBtn.click();
    await page.waitForURL("/login", { timeout: 10_000 });
    await expect(page.locator("h1")).toBeVisible();
  });
});
