import { describe, expect, it } from "vitest";
import { APARTMENT_EXAMPLES, parseFloorPlan } from "./ApartmentFloorPlan.js";

describe("apartment floor plans", () => {
  it.each(APARTMENT_EXAMPLES)("keeps every room reachable in $name", ({ sketch }) => {
    const plan = parseFloorPlan(sketch);
    expect(plan.rooms.length).toBeGreaterThanOrEqual(4);
    expect(plan.entrances).toHaveLength(1);
  });

  it("rejects a sealed room", () => {
    expect(() => parseFloorPlan("#####\n#LLL#\n#####\n#BBB#\n##+##")).toThrow(/cannot be reached/);
  });

  it("rejects a doorway that ends in a wall", () => {
    expect(() => parseFloorPlan("#####\n#LL+#\n#####")).toThrow(/Passage/);
  });
});
