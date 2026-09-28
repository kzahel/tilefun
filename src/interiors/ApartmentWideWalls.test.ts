import { describe, expect, it } from "vitest";
import { buildLayeredApartmentPlan } from "./ApartmentArchitecture.js";
import { APARTMENT_EXAMPLES, parseFloorPlan } from "./ApartmentFloorPlan.js";
import { CONFLICTING_WALL_FIXTURE, WIDE_WALL_FIXTURES } from "./ApartmentJoinFixtures.js";
import { wallFacingConstraint } from "./ApartmentWallAlignment.js";

describe("two-sided and thick wall coverage", () => {
  it.each([
    false,
    true,
  ])("keeps a low branch shallow beside a continuing wall (mirror=%s)", (mirror) => {
    const rows = WIDE_WALL_FIXTURES[0].sketch.split("\n");
    const width = Math.max(...rows.map((row) => row.length));
    const sketch = rows
      .map((row) => (mirror ? [...row.padEnd(width)].reverse().join("") : row))
      .join("\n");
    const map = buildLayeredApartmentPlan(parseFloorPlan(sketch));
    const x = mirror ? (width - 3) * 2 + 1 : 4;
    // Below the six-pixel incoming cutaway, this exterior half has only its
    // vertical top rail, with neither a projected face nor a floor under it.
    for (const y of [10, 11]) {
      const cell = map.cells[y]?.[x];
      expect(cell?.floor).toEqual([]);
      expect(cell?.wall).toHaveLength(1);
      expect(cell?.wall[0]).toMatchObject({ cropX: mirror ? 0 : 9, cropWidth: 7 });
    }
    expect(map.cells[10]?.[x]?.foreground).toContainEqual({
      key: "room-builder/3d-walls/c11-r05",
      cropX: mirror ? 6 : 0,
      cropWidth: 10,
      cropHeight: 6,
    });
  });
  it("keeps both room-facing surfaces inside a conflicting wall footprint", () => {
    const plan = parseFloorPlan(CONFLICTING_WALL_FIXTURE);
    const map = buildLayeredApartmentPlan(plan);
    expect(wallFacingConstraint(plan, 4, 3).conflict).toBe(true);
    expect(map.cells[6]?.[8]?.wall[0]?.key).toBe("room-builder/3d-walls/c13-r02");
    expect(map.cells[6]?.[9]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r02");
    for (let y = 0; y < map.height; y++)
      for (const dx of [0, 1]) {
        const cell = map.cells[y]?.[8 + dx];
        if (!cell) throw new Error("Missing wall cell");
        for (const tile of [...cell.wall, ...cell.foreground]) {
          const left = dx * 16 + (tile.cropX ?? 0) + (tile.offsetX ?? 0);
          const right = left + (tile.drawWidth ?? tile.cropWidth ?? 16 - (tile.cropX ?? 0));
          expect(left).toBeGreaterThanOrEqual(0);
          expect(right).toBeLessThanOrEqual(32);
        }
      }
    // The exterior half has a rail, never a room floor or outward shaded face.
    expect(map.cells[2]?.[9]?.floor).toEqual([]);
    expect(map.cells[2]?.[9]?.wall[0]).toMatchObject({ cropX: 0, cropWidth: 7 });
  });
  it("keeps a doorway open through both halves of the wider wall", () => {
    const map = buildLayeredApartmentPlan(parseFloorPlan(WIDE_WALL_FIXTURES[2].sketch));
    for (const y of [10, 11])
      for (const x of [8, 9]) {
        expect(map.cells[y]?.[x]?.semantic).toBe("opening");
        expect(map.cells[y]?.[x]?.floor).toHaveLength(1);
        expect(map.cells[y]?.[x]?.wall).toEqual([]);
        expect(map.cells[y]?.[x]?.foreground).toEqual([]);
      }
  });
  it("gives wall masses an opaque top and constrains their exposed side", () => {
    const plan = parseFloorPlan(WIDE_WALL_FIXTURES[0].sketch);
    expect(wallFacingConstraint(plan, 2, 3).sources).toContainEqual({
      x: 2,
      y: 3,
      facing: "west",
      kind: "mass",
    });
    const map = buildLayeredApartmentPlan(plan);
    for (const y of [4, 5])
      for (const x of [6, 7, 8, 9, 10, 11]) {
        expect(map.cells[y]?.[x]?.semantic).toBe("wall");
        expect(map.cells[y]?.[x]?.floor[0]).toMatchObject({
          key: "room-builder/3d-walls/c10-r02",
          drawWidth: 16,
        });
      }
  });
  it("does not copy the hall floor into the exterior spare column", () => {
    const map = buildLayeredApartmentPlan(parseFloorPlan(APARTMENT_EXAMPLES[2].sketch));
    for (const y of [34, 35, 36, 37]) expect(map.cells[y]?.[32]?.floor).toEqual([]);
  });
});
