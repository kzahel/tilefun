import { expect, it } from "vitest";
import { unifiedTopDownChoice } from "./unifiedTopDown.js";

it("draws the unified view, with the fixed view standing in on software WebGL", () => {
  expect(unifiedTopDownChoice("")).toBe(true);
  expect(unifiedTopDownChoice("?nogamepad")).toBe(true);
  expect(unifiedTopDownChoice("", true)).toBe(false);
});

it("lets a URL choose for one load", () => {
  expect(unifiedTopDownChoice("?view=topdown3d", true)).toBe(true);
  expect(unifiedTopDownChoice("?view=fixed")).toBe(false);
  expect(unifiedTopDownChoice("?view=2d")).toBe(false);
});
