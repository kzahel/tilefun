import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4174",
    screenshot: "only-on-failure",
  },
  webServer: {
    // Keep test persistence separate from any developer preview on port 4173.
    command: "npm run preview -- --port 4174 --strictPort",
    env: {
      INTERIOR_REVIEW_DIR: "test-results/interior-review-feedback",
      ART_NOTES_DIR: "test-results/art-notes",
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
