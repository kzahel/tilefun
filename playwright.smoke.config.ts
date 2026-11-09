import { defineConfig } from "@playwright/test";
import full from "./playwright.config.js";

/**
 * The CI browser gate: a few stable boundaries that need a real page under
 * hosted software WebGL (launch and pixels, keyboard input, the local authority
 * Worker's lifecycle and saves, launcher assets). Every other browser contract
 * runs in the local full suite (`npm run test:all`); see docs/topics/testing.md.
 */
const SMOKE_FILES = ["smoke.spec.ts", "worker-server.spec.ts", "pwa.spec.ts"];

export default defineConfig(full, {
  projects: [{ name: "chromium", use: { browserName: "chromium" }, testMatch: SMOKE_FILES }],
  globalTimeout: (process.env.CI ? 10 : 5) * 60_000,
});
