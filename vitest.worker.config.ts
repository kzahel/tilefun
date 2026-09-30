import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["worker/src/**/*.test.ts"] },
});
