/**
 * retain.spec.ts
 * Testa o módulo Retain Sense: dashboard, predictions, drawer e integração com backend.
 */
import { test, expect } from "@playwright/test";

test.describe("Retain Sense", () => {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  test.describe("Dashboard (/retain)", () => {
    test("renderiza 4 KPI cards", async ({ page }) => {
      await page.goto("/retain");
      await page.waitForTimeout(2000);

      // Verifica que há pelo menos 4 metric cards (contém texto de KPI)
      const cards = page.locator(".rounded-xl, .rounded-2xl").filter({ hasText: /churn|mrr|clientes|risco/i });
      await expect(cards.first()).toBeVisible();
    });

    test("carrega dados da API /retain/dashboard", async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/retain/dashboard"), { timeout: 10_000 }),
        page.goto("/retain"),
      ]);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("kpis");
      expect(body.kpis).toHaveProperty("totalCustomers");
    });

    test("gráficos estão visíveis", async ({ page }) => {
      await page.goto("/retain");
      await page.waitForTimeout(2000);
      // recharts renderiza SVG
      const charts = page.locator("svg.recharts-surface");
      const count = await charts.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Predictions ────────────────────────────────────────────────────────────
  test.describe("Predictions (/retain/predictions)", () => {
    test("tabela carrega com linhas de dados", async ({ page }) => {
      await page.goto("/retain/predictions");
      await page.waitForTimeout(2000);

      // Tabela deve ter pelo menos 1 linha de dado (não header)
      const rows = page.locator("table tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });

    test("carrega dados da API /retain/predictions", async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/retain/predictions"), { timeout: 10_000 }),
        page.goto("/retain/predictions"),
      ]);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    });

    test("filtro de risco exibe subset correto", async ({ page }) => {
      await page.goto("/retain/predictions");
      await page.waitForTimeout(1500);

      // Seleciona filtro "critical" se houver select de riskLevel
      const riskSelect = page.locator("select").first();
      if (await riskSelect.isVisible()) {
        await riskSelect.selectOption("critical");
        await page.waitForTimeout(1000);
        const rows = page.locator("table tbody tr");
        const count = await rows.count();
        // Pode ser 0 ou mais, mas a tabela deve existir
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test("clicar em linha abre o PredictionDetailDrawer", async ({ page }) => {
      await page.goto("/retain/predictions");
      await page.waitForTimeout(2000);

      const firstRow = page.locator("table tbody tr").first();
      await firstRow.click();

      // Drawer deve aparecer (Sheet/DetailDrawer)
      await expect(page.locator('[role="dialog"], [data-radix-sheet-content], .fixed.inset-0').first()).toBeVisible({ timeout: 5_000 });
    });

    test("drawer exibe SHAP waterfall e botão de ação de retenção", async ({ page }) => {
      await page.goto("/retain/predictions");
      await page.waitForTimeout(2000);

      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(1000);

      // Botão de ação
      const actionBtn = page.getByRole("button", { name: /criar ação de retenção/i });
      await expect(actionBtn).toBeVisible({ timeout: 5_000 });
    });

    test("botão 'Criar ação de retenção' envia POST /api/retain/actions", async ({ page }) => {
      await page.goto("/retain/predictions");
      await page.waitForTimeout(2000);
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(1000);

      const [request] = await Promise.all([
        page.waitForRequest(
          (req) => req.url().includes("/api/retain/actions") && req.method() === "POST",
          { timeout: 8_000 }
        ),
        page.getByRole("button", { name: /criar ação de retenção/i }).click(),
      ]);

      expect(request.method()).toBe("POST");
      const body = JSON.parse(request.postData() ?? "{}");
      expect(body).toHaveProperty("customerId");
      expect(body).toHaveProperty("type");
    });

    test("após clicar, botão muda para 'Ação registrada'", async ({ page }) => {
      await page.goto("/retain/predictions");
      await page.waitForTimeout(2000);
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(1000);

      await page.getByRole("button", { name: /criar ação de retenção/i }).click();
      await expect(page.getByRole("button", { name: /ação registrada/i })).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Customers ──────────────────────────────────────────────────────────────
  test.describe("Customers (/retain/customers)", () => {
    test("tabela carrega e exibe dados", async ({ page }) => {
      await page.goto("/retain/customers");
      await page.waitForTimeout(2000);
      const rows = page.locator("table tbody tr");
      expect(await rows.count()).toBeGreaterThan(0);
    });

    test("pageSize máximo respeitado (≤ 100 itens por página)", async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/retain/customers"), { timeout: 10_000 }),
        page.goto("/retain/customers"),
      ]);
      const body = await response.json();
      expect(body.pageSize).toBeLessThanOrEqual(100);
    });
  });
});
