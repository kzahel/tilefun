import { defineConfig } from "@playwright/test";
import browserConfig from "./playwright.config.js";

// Opt-in artifact generation, excluded from the regression/CI test inventory.
export default defineConfig(browserConfig, {
  testDir: "./captures",
  globalSetup: "./tests/workshop-setup.ts",
  workers: 1,
});
