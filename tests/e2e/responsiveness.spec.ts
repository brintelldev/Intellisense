/**
 * responsiveness.spec.ts
 * Valida que as telas principais são utilizáveis em Mobile (375px) e Desktop (1280px).
 */
import { test, expect, Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 667 },
  { name: "desktop", width: 1280, height: 720 },
];

// Login rápido via API antes dos testes de responsividade
async function quickLogin(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "demo@dcco.com.br");
  await page.fill('input[type="password"]', "Demo@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });
}

for (const vp of VIEWPORTS) {
  test.describe(`Responsividade — ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("Login page renderiza corretamente", async ({ page }) => {
      await page.goto("/login");
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // Nenhum elemento deve estar cortado fora da viewport
      const form = page.locator("form");
      const box = await form.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test("Lifecycle page (/) renderiza KPIs e não tem overflow horizontal", async ({ page }) => {
      await quickLogin(page);
      await page.goto("/");

      // Sem scroll horizontal
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 5);

      // Página carregou (há conteúdo)
      await expect(page.locator("main, [role='main'], .min-h-screen").first()).toBeVisible();
    });

    test("Retain Dashboard renderiza sem overflow horizontal", async ({ page }) => {
      await quickLogin(page);
      await page.goto("/retain");

      // Aguarda carregamento
      await page.waitForTimeout(1500);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 5);
    });

    test("Obtain Leads renderiza sem overflow horizontal", async ({ page }) => {
      await quickLogin(page);
      await page.goto("/obtain/leads");

      await page.waitForTimeout(1500);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 5);
    });

    test("Botão toggle de senha funciona", async ({ page }) => {
      await page.goto("/login");
      const passwordInput = page.locator('input[type="password"]');
      const toggleBtn = page.locator("button").filter({ has: page.locator("svg") }).last();

      await expect(passwordInput).toBeVisible();
      await toggleBtn.click();
      await expect(page.locator('input[type="text"][placeholder="••••••••"]')).toBeVisible();
    });
  });
}
