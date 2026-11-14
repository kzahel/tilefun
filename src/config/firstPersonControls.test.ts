import { expect, it } from "vitest";
import { firstPersonControls } from "./firstPersonControls.js";

it("defaults to simple controls and preserves mouse controls for old profiles", () => {
  expect(firstPersonControls(undefined)).toBe("simple");
  expect(firstPersonControls(undefined, "mouse")).toBe("mouse");
  expect(firstPersonControls("simple", "mouse")).toBe("simple");
  expect(firstPersonControls("mouse")).toBe("mouse");
  expect(firstPersonControls("unknown", "mouse")).toBe("mouse");
});
