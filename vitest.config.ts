import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Carregar .env.test antes de tudo
process.loadEnvFile(resolve(__dirname, ".env.test"));

export default defineConfig({
  resolve: {
    alias: {
      // Espelha os paths do tsconfig.json para o Vitest conseguir resolver
      "@shared": resolve(__dirname, "./shared"),
      "@": resolve(__dirname, "./client/src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["server/tests/**/*.test.ts"],
    setupFiles: ["server/tests/setup.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30000,
  },
});
