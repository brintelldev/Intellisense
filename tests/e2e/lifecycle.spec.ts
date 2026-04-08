/**
 * lifecycle.spec.ts
 * Valida responsividade e integridade visual da tela Ciclo de Vida do Cliente.
 * Viewports: iPhone 12 (390x844) e Desktop 1366x768.
 */
import { test, expect, Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "iPhone 12", width: 390, height: 844 },
  { name: "Desktop 1366", width: 1366, height: 768 },
];

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "demo@dcco.com.br");
  await page.fill('input[type="password"]', "Demo@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });
}

for (const vp of VIEWPORTS) {
  test.describe(`Ciclo de Vida — ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await login(page);
      await page.goto("/");
      // Aguarda os cards carregarem
      await page.waitForSelector("h1", { timeout: 10_000 });
      await page.waitForTimeout(800);
    });

    test("Sem overflow horizontal na página", async ({ page }) => {
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 2);
    });

    test("Header visível e não sobrepõe conteúdo", async ({ page }) => {
      const header = page.locator("header").first();
      await expect(header).toBeVisible();
      const box = await header.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.width).toBeLessThanOrEqual(vp.width + 2);
    });

    test("Título da página visível e legível", async ({ page }) => {
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();
      const box = await h1.boundingBox();
      expect(box).not.toBeNull();
      // Título não pode estar fora da viewport
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 2);
    });

    test("Card central '12 novos clientes' visível e com altura adequada", async ({ page }) => {
      // Procura o card gradiente central pelo texto característico
      const centralCard = page.locator("text=novos clientes este mês").first();
      await expect(centralCard).toBeVisible();

      const parent = page.locator("div").filter({ hasText: "novos clientes este mês" }).first();
      const box = await parent.boundingBox();
      expect(box).not.toBeNull();
      // Card central deve ter pelo menos 160px de altura para respirar
      expect(box!.height).toBeGreaterThanOrEqual(160);
    });

    test("Card Obtain (Aquisição) — todos os KPIs visíveis", async ({ page }) => {
      await expect(page.locator("text=Leads no Funil")).toBeVisible();
      await expect(page.locator("text=Leads Hot")).toBeVisible();
      await expect(page.locator("text=CAC Médio")).toBeVisible();
      await expect(page.locator("text=Tx. Conversão")).toBeVisible();
    });

    test("Card Retain (Retenção) — todos os KPIs visíveis", async ({ page }) => {
      await expect(page.getByText("Clientes Ativos", { exact: true })).toBeVisible();
      await expect(page.getByText("Em Risco", { exact: true })).toBeVisible();
      await expect(page.getByText("Churn Rate", { exact: true })).toBeVisible();
      await expect(page.getByText("Receita em Risco", { exact: true })).toBeVisible();
    });

    test("Botões 'Ver dashboard completo' visíveis e clicáveis", async ({ page }) => {
      const btns = page.locator("button", { hasText: "Ver dashboard completo" });
      await expect(btns.first()).toBeVisible();
      const count = await btns.count();
      expect(count).toBe(2);

      for (let i = 0; i < count; i++) {
        const box = await btns.nth(i).boundingBox();
        expect(box).not.toBeNull();
        // Botão não pode estar fora da área visível horizontalmente
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 2);
      }
    });

    test("Insight do Ecossistema visível e sem overflow", async ({ page }) => {
      const insight = page.locator("text=Insight do Ecossistema");
      await expect(insight).toBeVisible();
      const box = await insight.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 2);
    });

    test("Gráficos renderizados (SVG presente e com dimensões válidas)", async ({ page }) => {
      const svgs = page.locator("main svg.recharts-surface");
      const count = await svgs.count();
      expect(count).toBeGreaterThanOrEqual(2);

      for (let i = 0; i < count; i++) {
        const box = await svgs.nth(i).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(50);
        expect(box!.height).toBeGreaterThan(50);
        // Nenhum gráfico deve vazar para além da viewport
        expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 4);
      }
    });

    test("Sidebar não sobrepõe conteúdo principal", async ({ page }) => {
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeVisible();
      const sidebarBox = await sidebar.boundingBox();
      const main = page.locator("main").first();
      const mainBox = await main.boundingBox();

      expect(sidebarBox).not.toBeNull();
      expect(mainBox).not.toBeNull();

      // A borda direita da sidebar deve ser <= borda esquerda do main
      const sidebarRight = sidebarBox!.x + sidebarBox!.width;
      expect(mainBox!.x).toBeGreaterThanOrEqual(sidebarRight - 1);
    });

    test("Navegação para Retain via botão funciona", async ({ page }) => {
      const btns = page.locator("button", { hasText: "Ver dashboard completo" });
      // Primeiro botão é o do Obtain, segundo é o do Retain
      await btns.nth(1).click();
      await page.waitForURL("/retain", { timeout: 8_000 });
      expect(page.url()).toContain("/retain");
    });
  });
}
