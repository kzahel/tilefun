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
  globalTimeout: 10 * 60_000,
  maxFailures: process.env.CI ? 1 : 0,
});
