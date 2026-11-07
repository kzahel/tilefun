import { defineConfig } from "@playwright/test";
import full from "./playwright.config.js";

/** Existing browser boundaries required for each push; the full suite stays intact. */
const SMOKE_FILES = [
  "smoke.spec.ts",
  "worker-server.spec.ts",
  "controller-menu.spec.ts",
  "mobile-editor.spec.ts",
  "p2p-menu.spec.ts",
  "vehicle-placement.spec.ts",
  "pwa.spec.ts",
];
/** Single `@smoke`-tagged cases from larger files (226: touch input and a lab Worker).
 * A tag only takes effect for files listed here. */
const TAGGED_FILES = ["tap-movement.spec.ts", "world-geometry.spec.ts"];

export default defineConfig(full, {
  projects: [
    { name: "chromium", use: { browserName: "chromium" }, testMatch: SMOKE_FILES },
    {
      name: "chromium-tagged",
      use: { browserName: "chromium" },
      testMatch: TAGGED_FILES,
      grep: /@smoke/,
    },
  ],
  // Hosted software rendering needed ten minutes for the first 20 passing cases.
  // Keep per-test/assertion deadlines while allowing every smoke case to finish.
  globalTimeout: (process.env.CI ? 20 : 10) * 60_000,
  maxFailures: process.env.CI ? 1 : 0,
});
