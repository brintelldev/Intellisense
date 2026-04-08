import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report/e2e", open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    // Auth setup — runs first
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Desktop tests
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /responsiveness\.spec\.ts/,
    },
    // Responsiveness — runs with multiple viewports, no auth dependency
    {
      name: "responsive",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /responsiveness\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
