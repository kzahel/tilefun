import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW_DISTANCE, VIEW_DISTANCES, viewDistance } from "./firstPersonViewDistance.js";

describe("first-person view distance choice", () => {
  it("accepts the three choices and falls back for anything else", () => {
    for (const choice of Object.keys(VIEW_DISTANCES)) expect(viewDistance(choice)).toBe(choice);
    for (const bad of [undefined, null, "", "toString", "huge", 800])
      expect(viewDistance(bad)).toBe(DEFAULT_VIEW_DISTANCE);
  });
});
