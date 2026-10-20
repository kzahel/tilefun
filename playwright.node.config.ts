import { defineConfig } from "@playwright/test";

// Production image-comparator and HTTP integration contracts without a browser,
// preview server, Workshop session or generated build. Runs once in the check job.
export default defineConfig({
  testDir: "./tests-node",
  workers: 2,
  reporter: "list",
  outputDir: "test-results/node-integration",
  snapshotPathTemplate: "{testDir}/../tests/fixtures/interior-approved/{arg}{ext}",
  updateSnapshots: "none",
  projects: [{ name: "node" }],
});
