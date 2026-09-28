import { describe, expect, it } from "vitest";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { APARTMENT_JOIN_FIXTURES, CONFLICTING_WALL_FIXTURE } from "./ApartmentJoinFixtures.js";
import { verticalWallProfile, wallFacingConstraint } from "./ApartmentWallAlignment.js";

describe("vertical wall alignment", () => {
  for (const index of [2, 4] as const) {
    it(`keeps the mirrored upper exterior rail anchored through fixture ${index}`, () => {
      const plan = parseFloorPlan(
        APARTMENT_JOIN_FIXTURES[index].sketch
          .split("\n")
          .map((row) => [...row].reverse().join(""))
          .join("\n"),
      );
      for (let y = 0; y < plan.height; y++)
        expect(verticalWallProfile(plan, 3, y)).toEqual({
          column: 0,
          facing: "east",
          railX: 0,
          tileOffsetX: 0,
        });
    });
  }
  it("propagates the exterior facing through the shared section", () => {
    const plan = parseFloorPlan(APARTMENT_JOIN_FIXTURES[0].sketch);
    const upper = verticalWallProfile(plan, 4, 1);
    const lower = verticalWallProfile(plan, 4, 5);
    expect(upper).toEqual({ column: 1, facing: "west", railX: 25, tileOffsetX: 0 });
    expect(lower).toEqual({ column: 1, facing: "west", railX: 25, tileOffsetX: 0 });
    expect(verticalWallProfile(plan, 4, 6).railX).toBe(upper.railX);
  });
  it("propagates the upper exterior facing through the lower shared section", () => {
    const plan = parseFloorPlan(APARTMENT_JOIN_FIXTURES[2].sketch);
    const lower = verticalWallProfile(plan, 4, 3);
    const upper = verticalWallProfile(plan, 4, 1);
    expect(upper).toEqual({ column: 1, facing: "west", railX: 25, tileOffsetX: 0 });
    expect(lower).toEqual({ column: 1, facing: "west", railX: 25, tileOffsetX: 0 });
    expect(verticalWallProfile(plan, 4, 0).railX).toBe(lower.railX);
  });
  it("does not translate the already consistent mirrored join", () => {
    const plan = parseFloorPlan(
      APARTMENT_JOIN_FIXTURES[0].sketch
        .split("\n")
        .map((row) => [...row].reverse().join(""))
        .join("\n"),
    );
    for (let y = 0; y < plan.height; y++)
      expect(verticalWallProfile(plan, 3, y)).toMatchObject({ railX: 16, tileOffsetX: 0 });
  });
});

describe("wall facing constraints", () => {
  for (const [arms, facing] of [
    [
      [
        [0, -1],
        [1, 0],
      ],
      "west",
    ],
    [
      [
        [0, 1],
        [-1, 0],
      ],
      "west",
    ],
    [
      [
        [0, -1],
        [-1, 0],
      ],
      "east",
    ],
    [
      [
        [0, 1],
        [1, 0],
      ],
      "east",
    ],
  ] as const) {
    it(`matches the full-height corner ports ${JSON.stringify(arms)} to ${facing}`, () => {
      const occupied = new Set(["2,2", ...arms.map(([dx, dy]) => `${2 + dx},${2 + dy}`)]);
      const sketch = Array.from({ length: 5 }, (_, y) =>
        Array.from({ length: 5 }, (_, x) => (occupied.has(`${x},${y}`) ? "#" : "L")).join(""),
      ).join("\n");
      const constraint = wallFacingConstraint(parseFloorPlan(sketch), 2, 2);
      expect(constraint.required).toEqual([facing]);
      expect(constraint.conflict).toBe(false);
      expect(constraint.sources).toContainEqual({ x: 2, y: 2, facing, kind: "corner" });
    });
  }
  it("uses the exterior endpoint even when no straight cell separates the junctions", () => {
    const plan = parseFloorPlan(APARTMENT_JOIN_FIXTURES[0].sketch);
    const constraint = wallFacingConstraint(plan, 4, 1);
    expect(constraint.required).toEqual(["west"]);
    expect(constraint.conflict).toBe(false);
    expect(constraint.sources).toContainEqual({ x: 4, y: 6, facing: "west", kind: "exterior" });
  });
  it("reports opposing requirements rather than treating rail alignment as a solution", () => {
    const plan = parseFloorPlan(CONFLICTING_WALL_FIXTURE);
    const constraint = wallFacingConstraint(plan, 4, 3);
    expect(constraint.conflict).toBe(true);
    expect(new Set(constraint.required)).toEqual(new Set(["west", "east"]));
    expect(constraint.sources.some((p) => p.y < 3 && p.facing === "west")).toBe(true);
    expect(constraint.sources.some((p) => p.y > 3 && p.facing === "east")).toBe(true);
  });
});
