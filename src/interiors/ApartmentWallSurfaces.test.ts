import { describe, expect, it } from "vitest";
import { buildLayeredApartmentPlan } from "./ApartmentArchitecture.js";
import { parseFloorPlan } from "./ApartmentFloorPlan.js";
import { APARTMENT_JOIN_FIXTURES } from "./ApartmentJoinFixtures.js";
import { horizontalWallSurface } from "./ApartmentWallSurfaces.js";

describe("wall surface transitions", () => {
  it("splits one horizontal run where the lower room ends", () => {
    const plan = parseFloorPlan(APARTMENT_JOIN_FIXTURES[1].sketch);
    expect(horizontalWallSurface(plan, 2, 3)).toBe("full");
    expect(horizontalWallSurface(plan, 4, 3)).toBe("full");
    expect(horizontalWallSurface(plan, 5, 3)).toBe("cutaway");
    expect(horizontalWallSurface(plan, 7, 3)).toBe("cutaway");
    const map = buildLayeredApartmentPlan(plan);
    // The tail over exterior space emits no full-height face or floor.
    for (let y = 6; y <= 7; y++)
      for (let x = 10; x <= 15; x++) {
        expect(map.cells[y]?.[x]?.wall).toEqual([]);
        expect(map.cells[y]?.[x]?.floor).toEqual([]);
      }
  });
  it("preserves a one-cell vertical link between two horizontal south edges", () => {
    const plan = parseFloorPlan(APARTMENT_JOIN_FIXTURES[0].sketch);
    expect(horizontalWallSurface(plan, 4, 5)).toBe("cutaway");
    const map = buildLayeredApartmentPlan(plan);
    expect(map.cells[10]?.[9]?.wall[0]?.key).toBe("room-builder/3d-walls/c13-r02");
    expect(map.cells[11]?.[9]?.wall[0]?.key).toBe("room-builder/3d-walls/c13-r02");
  });
  it("uses incident arms rather than the unrelated room beside a vertical continuation", () => {
    const plan = parseFloorPlan(
      APARTMENT_JOIN_FIXTURES[0].sketch
        .split("\n")
        .map((r) => [...r].reverse().join(""))
        .join("\n"),
    );
    expect(horizontalWallSurface(plan, 3, 5)).toBe("cutaway");
    expect(plan.inside[5]?.[4]).toBe(true);
  });
});
