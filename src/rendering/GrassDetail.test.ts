import { expect, it } from "vitest";
import { grassOpacity } from "./GrassBladeRenderer.js";

it("fades grass continuously only between overview and ordinary zoom", () => {
  expect([0.05, 0.1, 0.25].map(grassOpacity)).toEqual([0, 0, 0]);
  expect([0.5, 1, 2].map(grassOpacity)).toEqual([1, 1, 1]);
  expect(grassOpacity(0.375)).toBe(0.5);
  const values = Array.from({ length: 101 }, (_, i) => grassOpacity(0.25 + i / 400));
  expect(values).toEqual([...values].sort((a, b) => a - b));
  expect(grassOpacity(0.250001)).toBeLessThan(0.000001);
  expect(grassOpacity(0.499999)).toBeGreaterThan(0.999999);
});
