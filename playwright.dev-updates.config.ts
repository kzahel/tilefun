import { defineConfig } from "@playwright/test";

// This boundary owns an isolated Vite dev server; no production preview/auth needed.
export default defineConfig({
  testDir: "./tests",
  testMatch: ["player-manual-reload.spec.ts", "player-dev-reload.spec.ts"],
  workers: 1,
  timeout: 120000,
  reporter: "list",
  outputDir: "test-results/dev-updates",
  use: { browserName: "chromium", screenshot: "only-on-failure" },
});
