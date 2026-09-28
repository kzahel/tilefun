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

  it("accepts an enclosed standalone room without an entrance", () => {
    const plan = parseFloorPlan("####\n#LL#\n#LL#\n####");
    expect(plan.entrances).toHaveLength(0);
    expect(plan.rooms).toEqual(["L"]);
  });

  it("accepts a wall-only draft before any floor is painted", () => {
    const plan = parseFloorPlan("#####\n#   #\n#   #\n#####");
    expect(plan.rooms).toHaveLength(0);
    expect(plan.entrances).toHaveLength(0);
    expect(plan.inside[1]?.[1]).toBe(true);
    expect(plan.inside[0]?.[0]).toBe(false);
  });

  it("does not mistake an open gap for enclosed space", () => {
    const plan = parseFloorPlan("## ##\n#   #\n#####");
    expect(plan.inside[1]?.[2]).toBe(false);
  });

  it("rejects a doorway that ends in a wall", () => {
    expect(() => parseFloorPlan("#####\n#LL+#\n#####")).toThrow(/Passage/);
  });
});
