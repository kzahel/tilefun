import { defineConfig } from "@playwright/test";

// Built-server integration using HTTP/WebSocket clients only. No Chromium fixtures.
export default defineConfig({
  testDir: "./tests-http",
  workers: 1,
  timeout: 60_000,
  reporter: "list",
  outputDir: "test-results/http-integration",
  projects: [{ name: "http" }],
});
