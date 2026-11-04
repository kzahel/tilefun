import { defineConfig } from "@playwright/test";
import full from "./playwright.config.js";

/** Existing browser boundaries required for each push; the full suite stays intact. */
export default defineConfig(full, {
  testMatch: [
    "smoke.spec.ts",
    "worker-server.spec.ts",
    "controller-menu.spec.ts",
    "mobile-editor.spec.ts",
    "p2p-menu.spec.ts",
    "vehicle-placement.spec.ts",
    "pwa.spec.ts",
  ],
  // Hosted software rendering needed ten minutes for the first 20 passing cases.
  // Keep per-test/assertion deadlines while allowing all 29 cases to finish.
  globalTimeout: (process.env.CI ? 20 : 10) * 60_000,
  maxFailures: process.env.CI ? 1 : 0,
});
