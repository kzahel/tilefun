import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/workshop-setup.ts",
  timeout: 30_000,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/fixtures/interior-approved/{arg}{ext}",
  // New/changed visual references require human review, never an automatic write.
  updateSnapshots: "none",
  use: {
    baseURL: "http://localhost:4174",
    screenshot: "only-on-failure",
    storageState: "test-results/workshop-session.json",
  },
  webServer: {
    // Keep test persistence separate from any developer preview on port 4173.
    command: "npm run workshop:auth -- reset && npm run preview -- --port 4174 --strictPort",
    env: {
      INTERIOR_REVIEW_DIR: "test-results/interior-review-feedback",
      ART_NOTES_DIR: "test-results/art-notes",
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
