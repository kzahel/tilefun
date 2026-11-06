import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Many native tests open production Realms (regional generation, persistence,
    // physics) and take 1-5 s under full-suite parallel load locally, 2-4x longer
    // on 4-vCPU hosted runners. The 5 s default then fails by host speed rather
    // than by a hang; this deadline only detects hangs. Heavier tests keep their
    // explicit per-test timeouts.
    testTimeout: 20_000,
  },
});
