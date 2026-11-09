import { defineConfig } from "@playwright/test";
import full from "./playwright.config.js";

/** Local preview of the hosted lane (232): Chromium draws WebGL2 through SwiftShader
 * with CI test and assertion deadlines. Measure here before changing CI.
 * Spread rather than `defineConfig(full, …)`: that merges projects by name and
 * would also run the hardware `chromium` project. */
export default defineConfig({
  ...full,
  timeout: 60_000,
  expect: { ...full.expect, timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/software-webgl.json" }]],
  projects: [
    {
      name: "chromium-software-webgl",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu"],
        },
      },
    },
  ],
});
