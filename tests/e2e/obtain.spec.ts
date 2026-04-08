/**
 * obtain.spec.ts
 * Testa o módulo Obtain Sense: dashboard, leads, drawer e integração com backend.
 */
import { test, expect } from "@playwright/test";

test.describe("Obtain Sense", () => {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  test.describe("Dashboard (/obtain)", () => {
    test("renderiza KPI cards", async ({ page }) => {
      await page.goto("/obtain");
      await page.waitForTimeout(2000);
      const cards = page.locator(".rounded-xl, .rounded-2xl").filter({ hasText: /leads|cac|ltv|conversão/i });
      await expect(cards.first()).toBeVisible();
    });

    test("carrega dados da API /obtain/dashboard", async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/obtain/dashboard"), { timeout: 10_000 }),
        page.goto("/obtain"),
      ]);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("kpis");
      expect(body.kpis).toHaveProperty("totalLeads");
    });

    test("FunnelChart está visível", async ({ page }) => {
      await page.goto("/obtain");
      await page.waitForTimeout(2000);
      // Funil ou gráfico SVG presente
      const charts = page.locator("svg.recharts-surface");
      const count = await charts.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Leads ──────────────────────────────────────────────────────────────────
  test.describe("Leads (/obtain/leads)", () => {
    test("tabela carrega com dados", async ({ page }) => {
      await page.goto("/obtain/leads");
      await page.waitForTimeout(2000);
      const rows = page.locator("table tbody tr");
      expect(await rows.count()).toBeGreaterThan(0);
    });

    test("carrega dados da API /obtain/leads", async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/obtain/leads"), { timeout: 10_000 }),
        page.goto("/obtain/leads"),
      ]);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    test("clicar em linha abre o LeadDetailDrawer", async ({ page }) => {
      await page.goto("/obtain/leads");
      await page.waitForTimeout(2000);

      await page.locator("table tbody tr").first().click();
      await expect(
        page.locator('[role="dialog"], [data-radix-sheet-content], .fixed.inset-0').first()
      ).toBeVisible({ timeout: 5_000 });
    });

    test("drawer exibe botão 'Registrar ação'", async ({ page }) => {
      await page.goto("/obtain/leads");
      await page.waitForTimeout(2000);
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(1000);

      const actionBtn = page.getByRole("button", { name: /registrar ação/i });
      await expect(actionBtn).toBeVisible({ timeout: 5_000 });
    });

    test("botão 'Registrar ação' abre textarea para nota", async ({ page }) => {
      await page.goto("/obtain/leads");
      await page.waitForTimeout(2000);
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(1000);

      await page.getByRole("button", { name: /registrar ação/i }).click();
      await expect(page.locator("textarea")).toBeVisible({ timeout: 3_000 });
    });

    test("confirmar ação envia POST /api/obtain/lead-actions", async ({ page }) => {
      await page.goto("/obtain/leads");
      await page.waitForTimeout(2000);
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(1000);

      await page.getByRole("button", { name: /registrar ação/i }).click();
      await page.locator("textarea").fill("Teste de ação automatizado via Playwright");

      const [request] = await Promise.all([
        page.waitForRequest(
          (req) => req.url().includes("/api/obtain/lead-actions") && req.method() === "POST",
          { timeout: 8_000 }
        ),
        page.getByRole("button", { name: /confirmar/i }).click(),
      ]);

      expect(request.method()).toBe("POST");
      const body = JSON.parse(request.postData() ?? "{}");
      expect(body).toHaveProperty("leadId");
      expect(body).toHaveProperty("actionType");
      expect(body.notes).toBe("Teste de ação automatizado via Playwright");
    });

    test("após confirmar, exibe feedback de sucesso", async ({ page }) => {
      await page.goto("/obtain/leads");
      await page.waitForTimeout(2000);
      await page.locator("table tbody tr").first().click();
      await page.waitForTimeout(1000);

      await page.getByRole("button", { name: /registrar ação/i }).click();
      await page.locator("textarea").fill("Ação de teste");
      await page.getByRole("button", { name: /confirmar/i }).click();

      await expect(page.getByText(/ação registrada|gravada com sucesso/i).first()).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── ICP Clusters ───────────────────────────────────────────────────────────
  test.describe("ICP (/obtain/icp)", () => {
    test("carrega dados da API /obtain/icp-clusters", async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/obtain/icp-clusters"), { timeout: 10_000 }),
        page.goto("/obtain/icp"),
      ]);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });
  });

  // ── Funnel ─────────────────────────────────────────────────────────────────
  test.describe("Funnel (/obtain/funnel)", () => {
    test("carrega dados da API /obtain/funnel", async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/obtain/funnel"), { timeout: 10_000 }),
        page.goto("/obtain/funnel"),
      ]);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });
});
