import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("TC002 - Show an error for invalid login credentials", async ({ page }) => {
    // Navigate to /login
    await page.goto("/login");

    // Fill invalid.user@example.com into the email field
    await page.getByLabel(/email/i).fill("invalid.user@example.com");

    // Fill wrong-password into the password field
    await page.getByLabel(/senha/i).fill("wrong-password");

    // Submit the login form
    await page.getByRole("button", { name: /entrar|login/i }).click();

    // Verify an invalid credentials error is visible
    // "Credenciais inválidas" based on backend response, or the equivalent Toast/Text
    await expect(page.getByText(/credenciais inválidas/i)).toBeVisible({ timeout: 5000 });

    // Verify the user remains on the login page
    await expect(page).toHaveURL(/.*\/login/);
  });
});
