import { describe, expect, it } from "vitest";
import { buildLayeredApartmentPlan } from "./ApartmentArchitecture.js";
import { APARTMENT_EXAMPLES, parseFloorPlan } from "./ApartmentFloorPlan.js";
import type { LayeredInteriorMap } from "./LayeredInteriorMap.js";

function reachableFloorCount(map: LayeredInteriorMap, x: number, y: number): number {
  const passable = (px: number, py: number): boolean => {
    const cell = map.cells[py]?.[px];
    return cell !== undefined && cell.semantic !== "wall" && cell.semantic !== "void";
  };
  const queue: [number, number][] = [[x, y]];
  const seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const [px, py] = queue[i] as [number, number];
    const key = `${px},${py}`;
    if (!passable(px, py) || seen.has(key)) continue;
    seen.add(key);
    queue.push([px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]);
  }
  return seen.size;
}

describe("layered apartment compiler", () => {
  it.each(APARTMENT_EXAMPLES)("keeps every opening and room connected in $name", ({ sketch }) => {
    const plan = parseFloorPlan(sketch);
    const map = buildLayeredApartmentPlan(plan);
    expect(map.width).toBe(plan.width * 2);
    expect(map.height).toBe(plan.height * 2);
    const walkable = map.cells
      .flat()
      .filter((cell) => cell.semantic !== "wall" && cell.semantic !== "void");
    expect(walkable.every((cell) => cell.floor.length === 1)).toBe(true);
    const entrance = plan.entrances[0];
    if (!entrance) throw new Error("Missing parsed entrance");
    expect(reachableFloorCount(map, entrance.x * 2, entrance.y * 2)).toBe(walkable.length);
  });

  it("uses the source divider jambs and layered side-wall returns", () => {
    const plan = parseFloorPlan(APARTMENT_EXAMPLES[0].sketch);
    const map = buildLayeredApartmentPlan(plan);
    // Horizontal doorway at 11,6: two wall rows flank a floor passage.
    expect(map.cells[12]?.[21]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r03");
    expect(map.cells[13]?.[21]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r04");
    expect(map.cells[12]?.[24]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r00");
    expect(map.cells[13]?.[24]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r01");
    // Shared vertical doorway at 9,3: both wall faces taper over floor below it.
    expect(map.cells[4]?.[18]?.wall[0]?.key).toBe("room-builder/3d-walls/c13-r03");
    expect(map.cells[5]?.[19]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r04");
    expect(map.cells[8]?.[18]?.floor).toHaveLength(1);
    expect(map.cells[8]?.[18]?.foreground[0]?.key).toBe("room-builder/3d-walls/c14-r04");
    expect(map.cells[8]?.[19]?.foreground[0]?.key).toBe("room-builder/3d-walls/c09-r04");
  });

  it("rejects a side passage too close to an upper wall step", () => {
    const plan = parseFloorPlan("########\n#LL#HHH#\n#LL+HHH#\n#LL#HHH#\n##+#####");
    expect(() => buildLayeredApartmentPlan(plan)).toThrow(/needs two wall cells above/);
    const topDoor = parseFloorPlan("########\n#LL+HHH#\n#LL#HHH#\n##+#####");
    expect(() => buildLayeredApartmentPlan(topDoor)).toThrow(/needs two wall cells above/);
  });

  it("uses shallow exterior trim without cutting concave wall joins", () => {
    const small = buildLayeredApartmentPlan(parseFloorPlan(APARTMENT_EXAMPLES[0].sketch));
    expect(small.cells[28]?.[2]?.foreground[0]).toEqual({
      key: "room-builder/3d-walls/c11-r05",
      cropHeight: 6,
    });
    expect(small.pixelHeight).toBe(small.height * 16 - 26);
    const strange = buildLayeredApartmentPlan(parseFloorPlan(APARTMENT_EXAMPLES[2].sketch));
    expect(strange.cells[32]?.[20]?.wall).toHaveLength(1);
    expect(strange.cells[32]?.[20]?.foreground).toHaveLength(0);
  });
});
