import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/workshop-setup.ts",
  // Hosted runners reach data-ready in ~5 s (atlas decoding plus software WebGL),
  // and local runs share the machine across parallel workers. Both use the same
  // deadlines; scale assertion waits with the test timeout instead of per-call
  // overrides.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Hosted CI uses software GPU rendering; two full Chromium workers can starve
  // the authority Worker and miss short-lived gameplay phases, so CI runs one.
  // Locally (M4 Pro, 2026-11-09) four workers run the whole suite in ~15 min;
  // eight overloaded the machine (5 s readiness waits failed by contention).
  workers: process.env.CI ? 1 : 4,
  // Spread long spec files across workers (and CI shards) per test.
  fullyParallel: true,
  // A load flake retries once and is reported as flaky rather than failing.
  retries: 1,
  globalTimeout: process.env.CI ? 45 * 60_000 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/fixtures/interior-approved/{arg}{ext}",
  // New/changed visual references require human review, never an automatic write.
  updateSnapshots: "none",
  use: {
    baseURL: "http://localhost:4174",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    storageState: "test-results/workshop-session.json",
  },
  webServer: {
    // Keep test persistence separate from any developer preview on port 4173.
    command: "npm run workshop:auth -- reset && npm run preview -- --port 4174 --strictPort",
    env: {
      INTERIOR_REVIEW_DIR: "test-results/interior-review-feedback",
      ART_NOTES_DIR: "test-results/art-notes",
      WORKSHOP_LOCAL_AUTH_BYPASS: "0",
      WORKSHOP_AUTH_DIR: "test-results/workshop-auth",
      WORKSHOP_DATA_DIR: "test-results/workshop",
      WORKSHOP_SETUP_PASSWORD: "tilefun-workshop-browser-test-only",
    },
    port: 4174,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
