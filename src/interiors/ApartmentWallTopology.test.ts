import { describe, expect, it } from "vitest";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { verticalWallProfile } from "./ApartmentWallAlignment.js";
import { wallPorts } from "./ApartmentWallTopology.js";

describe("structural wall ports", () => {
  it("connects adjacent bends without requiring a straight wall cell between them", () => {
    const plan = parseFloorPlan("#######\n#LLLLL#\n#LL####\n####LL#\n#LLLLL#\n#LLLLL#\n#######");
    expect(wallPorts(plan, 3, 2)).toEqual({
      north: false,
      east: true,
      south: true,
      west: false,
      count: 2,
    });
    expect(wallPorts(plan, 3, 3)).toEqual({
      north: true,
      east: false,
      south: false,
      west: true,
      count: 2,
    });
    for (const y of [2, 3])
      expect(verticalWallProfile(plan, 3, y)).toEqual({
        column: 1,
        facing: "east",
        railX: 16,
        tileOffsetX: 0,
      });
  });
  it("retains the south connection of a one-cell end beside room floor", () => {
    const plan = parseFloorPlan("#####\n#LLL#\n#L#L#\n#####");
    expect(wallPorts(plan, 2, 2)).toEqual({
      north: false,
      east: false,
      south: true,
      west: false,
      count: 1,
    });
    expect(wallPorts(plan, 2, 3)).toMatchObject({ north: true, count: 3 });
  });
  it("retains the north connection of a one-cell end beside room floor", () => {
    const plan = parseFloorPlan("#####\n#L#L#\n#LLL#\n#####");
    expect(wallPorts(plan, 2, 1)).toEqual({
      north: true,
      east: false,
      south: false,
      west: false,
      count: 1,
    });
    expect(wallPorts(plan, 2, 0)).toMatchObject({ south: true, count: 3 });
  });
  it("resolves both bends and reserves floor space beside a short shared divider", () => {
    const plan = parseFloorPlan("######\n#L#LL#\n#L##L#\n#LL#L#\n######");
    expect(wallPorts(plan, 2, 2)).toEqual({
      north: true,
      east: true,
      south: false,
      west: false,
      count: 2,
    });
    expect(wallPorts(plan, 3, 2)).toEqual({
      north: false,
      east: false,
      south: true,
      west: true,
      count: 2,
    });
    for (const [x, y] of [
      [2, 1],
      [2, 2],
      [3, 2],
      [3, 3],
    ] as const)
      expect(verticalWallProfile(plan, x, y)).toMatchObject({
        column: 1,
        railX: 25,
        facing: "west",
      });
  });
});
