import { expect, it } from "vitest";
import { pageBudget } from "./GpuPages.js";

const MiB = 1024 * 1024;

it("keeps room for idle pages when the pages in use alone near the budget", () => {
  // Ordinary play: the fixed budget, as before 250.
  expect(pageBudget(0)).toBe(64 * MiB);
  expect(pageBudget(20 * MiB)).toBe(64 * MiB);
  expect(pageBudget(48 * MiB)).toBe(64 * MiB);
  // A far 3D view's ground, or two of them: pages in use cannot be retired, so
  // without headroom every idle page would be dropped and uploaded again.
  expect(pageBudget(60 * MiB)).toBe(76 * MiB);
  expect(pageBudget(97 * MiB)).toBe(113 * MiB);
});
