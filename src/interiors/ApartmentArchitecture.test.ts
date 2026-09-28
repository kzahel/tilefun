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
  it("adds a small top square at the bedroom/hall divider junction", () => {
    const map = buildLayeredApartmentPlan(parseFloorPlan(APARTMENT_EXAMPLES[0].sketch));
    expect(map.cells[12]?.[19]?.foreground).toEqual([
      { key: "room-builder/3d-walls/c10-r05", cropWidth: 7, cropHeight: 6 },
    ]);
    // Adjacent passage jambs keep their plain top; a square is a wall-joint
    // treatment rather than a new doorway cap.
    expect(map.cells[12]?.[21]?.foreground).toHaveLength(0);
    expect(map.cells[12]?.[23]?.foreground).toHaveLength(0);
    expect(map.cells[28]?.[13]?.foreground[0]?.key).toBe("room-builder/3d-walls/c08-r00");
  });

  it("keeps a west-branch T connected without an elbow projecting east", () => {
    const map = buildLayeredApartmentPlan(
      parseFloorPlan("#######\n#KK#KK#\n#KK#KK#\n####KK#\n#LL#KK#\n#LL#KK#\n#######"),
    );
    for (const y of [6, 7]) {
      expect(map.cells[y]?.[6]?.floor).toHaveLength(0);
      expect(map.cells[y]?.[6]?.wall[0]?.key).toBe(`room-builder/3d-walls/c11-r0${y - 4}`);
      expect(map.cells[y]?.[7]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r02");
      expect(map.cells[y]?.[8]?.wall).toHaveLength(0);
      expect(map.cells[y]?.[8]?.floor).toHaveLength(1);
    }
    expect(map.cells[6]?.[7]?.wall[1]).toEqual({
      key: "room-builder/3d-walls/c10-r03",
      cropWidth: 1,
      cropHeight: 6,
    });
  });

  it("carries a cross junction into the lower divider with matching wall height", () => {
    const map = buildLayeredApartmentPlan(
      parseFloorPlan("#######\n#LL#KK#\n#LL#KK#\n#######\n#KK#KK#\n#KK#KK#\n#######"),
    );
    expect([6, 7, 8].map((y) => map.cells[y]?.[7]?.wall[0]?.key)).toEqual([
      "room-builder/3d-walls/c11-r00",
      "room-builder/3d-walls/c10-r01",
      "room-builder/3d-walls/c10-r02",
    ]);
  });

  it.each([3, 5])("connects and closes the upper vertical divider in a %s-row room", (height) => {
    const rooms = Array<string>(height).fill("#LL#LL#");
    rooms[2] = "#LL+LL#";
    const map = buildLayeredApartmentPlan(
      parseFloorPlan(["#######", ...rooms, "#######"].join("\n")),
    );
    expect([0, 1, 2].map((y) => map.cells[y]?.[7]?.wall[0]?.key)).toEqual([
      "room-builder/3d-walls/c10-r00",
      "room-builder/3d-walls/c10-r01",
      "room-builder/3d-walls/c10-r02",
    ]);
    expect(map.cells[4]?.[7]?.wall).toEqual([
      { key: "room-builder/3d-walls/c10-r03" },
      { key: "room-builder/3d-walls/c08-r00", cropWidth: 1 },
    ]);
    expect(map.cells[5]?.[7]?.wall).toEqual([
      { key: "room-builder/3d-walls/c10-r04" },
      { key: "room-builder/3d-walls/c08-r01", cropWidth: 1 },
    ]);
    for (const y of [6, 7]) expect(map.cells[y]?.[7]?.wall).toHaveLength(0);
    if (height === 5)
      expect(map.cells[8]?.[7]?.foreground).toEqual([{ key: "room-builder/3d-walls/c09-r04" }]);
  });

  it.each([1, 2, 3])("joins both ends of a divider to the perimeter with door %s", (position) => {
    const divider = [..."#####"];
    divider[position] = "+";
    const map = buildLayeredApartmentPlan(
      parseFloorPlan(
        ["#####", "#LLL#", "#LLL#", divider.join(""), "#LLL#", "#LLL#", "#####"].join("\n"),
      ),
    );
    // Same T-junction caps as the authored Generic Home divider. The whole
    // band spans the perimeter, with exactly one atlas column left open.
    expect(map.cells[6]?.[0]?.wall[0]?.key).toBe("room-builder/3d-walls/c11-r00");
    expect(map.cells[7]?.[0]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r01");
    expect(map.cells[6]?.[9]?.wall[0]?.key).toBe("room-builder/3d-walls/c12-r00");
    expect(map.cells[7]?.[9]?.wall[0]?.key).toBe("room-builder/3d-walls/c12-r01");
    for (const y of [6, 7]) {
      for (let x = 0; x < map.width; x++) {
        expect(map.cells[y]?.[x]?.wall.length).toBe(x === position * 2 ? 0 : 1);
      }
    }
  });

  it.each(["L", "K"])("caps both sides of south doorways over %s floors", (floor) => {
    for (const position of [1, 2, 3]) {
      const bottom = [..."#####"];
      bottom[position] = "+";
      const map = buildLayeredApartmentPlan(
        parseFloorPlan(
          ["#####", ...Array(3).fill(`#${floor.repeat(3)}#`), bottom.join("")].join("\n"),
        ),
      );
      const opening = position * 2;
      expect(map.cells[8]?.[opening - 1]?.foreground).toEqual([
        { key: "room-builder/3d-walls/c08-r03", cropHeight: 6 },
      ]);
      expect(map.cells[8]?.[opening + 1]?.foreground).toEqual([
        { key: "room-builder/3d-walls/c08-r00", cropHeight: 6 },
      ]);
      expect(map.cells[8]?.[opening]?.semantic).toBe("opening");
      expect(map.cells[8]?.[opening]?.floor).toHaveLength(1);
      expect(map.cells[8]?.[opening]?.foreground).toHaveLength(0);
      expect(map.pixelHeight).toBe(134);
    }
  });

  it("renders a wall-only draft while its floor remains unpainted", () => {
    const map = buildLayeredApartmentPlan(parseFloorPlan("#####\n#   #\n#   #\n#####"));
    const floored = buildLayeredApartmentPlan(parseFloorPlan("#####\n#LLL#\n#LLL#\n#####"));
    expect(map.cells[2]?.[0]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r02");
    expect(map.cells[2]?.[9]?.wall[0]?.key).toBe("room-builder/3d-walls/c13-r02");
    expect(map.cells[6]?.[0]?.foreground[0]).toEqual({
      key: "room-builder/3d-walls/c10-r05",
      cropHeight: 6,
    });
    expect(map.cells[6]?.[9]?.foreground[0]).toEqual({
      key: "room-builder/3d-walls/c13-r05",
      cropHeight: 6,
    });
    expect(map.pixelHeight).toBe(102);
    expect(map.cells.map((row) => row.map((cell) => [cell.wall, cell.foreground]))).toEqual(
      floored.cells.map((row) => row.map((cell) => [cell.wall, cell.foreground])),
    );
    expect(map.cells[2]?.[2]?.semantic).toBe("void");
    expect(map.cells[2]?.[2]?.floor).toHaveLength(0);
  });

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
    // Horizontal doorway at 11,6: one atlas column opens through two wall rows.
    expect(map.cells[12]?.[21]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r03");
    expect(map.cells[13]?.[21]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r04");
    expect(map.cells[12]?.[22]?.semantic).toBe("opening");
    expect(map.cells[12]?.[23]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r00");
    expect(map.cells[13]?.[23]?.wall[0]?.key).toBe("room-builder/3d-walls/c08-r01");
    expect(map.cells[12]?.[23]?.semantic).toBe("wall");
    // Shared vertical doorway at 9,3: one face returns into the passage.
    expect(map.cells[4]?.[19]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r03");
    expect(map.cells[5]?.[19]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r04");
    expect(map.cells[8]?.[18]?.floor).toHaveLength(1);
    expect(map.cells[8]?.[19]?.foreground[0]?.key).toBe("room-builder/3d-walls/c09-r04");
    expect(map.cells[2]?.[2]?.floor[0]?.key).toBe("room-builder/floors/c01-r31");
    expect(map.cells[2]?.[30]?.floor[0]?.key).toBe("room-builder/floors/c13-r35");
  });

  it("uses fixed two-sided faces for the conflicting Offset wall", () => {
    const map = buildLayeredApartmentPlan(parseFloorPlan(APARTMENT_EXAMPLES[3].sketch));
    expect(map.cells[0]?.[32]?.wall[0]?.key).toBe("room-builder/3d-walls/c12-r00");
    expect(map.cells[2]?.[32]?.wall[0]?.key).toBe("room-builder/3d-walls/c13-r02");
    expect(map.cells[2]?.[33]?.wall[0]).toEqual({
      key: "room-builder/3d-walls/c10-r02",
      cropX: 0,
      cropWidth: 7,
    });
    expect(map.cells[4]?.[33]?.wall[0]?.key).toBe("room-builder/3d-walls/c11-r00");
    expect(map.cells[6]?.[32]?.wall[0]?.key).toBe("room-builder/3d-walls/c13-r02");
    expect(map.cells[6]?.[33]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r02");
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
    expect(small.cells[28]?.[12]?.semantic).toBe("opening");
    expect(small.cells[28]?.[13]?.semantic).toBe("wall");
    expect(small.cells[28]?.[13]?.foreground[0]?.key).toBe("room-builder/3d-walls/c08-r00");
    expect(small.pixelHeight).toBe(small.height * 16 - 26);
    const strange = buildLayeredApartmentPlan(parseFloorPlan(APARTMENT_EXAMPLES[2].sketch));
    expect(strange.cells[20]?.[4]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r03");
    expect(strange.cells[21]?.[4]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r04");
    // Recessed trim is at the same top edge as a straight south wall. No
    // floor or detached second rail spills into the exterior notch below it.
    expect(strange.cells[32]?.[20]?.foreground[0]).toEqual({
      key: "room-builder/3d-walls/c11-r05",
      cropHeight: 6,
    });
    expect(strange.cells[33]?.[20]?.floor).toHaveLength(0);
    expect(strange.cells[33]?.[20]?.foreground).toHaveLength(0);
    // The shared partition stays in the same atlas column past the notch.
    expect(strange.cells[31]?.[33]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r02");
    expect(strange.cells[33]?.[33]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r02");
    expect(strange.cells[34]?.[33]?.wall[0]?.key).toBe("room-builder/3d-walls/c10-r02");
    expect(strange.cells[38]?.[36]?.foreground[0]?.cropHeight).toBe(6);
    expect(strange.cells[38]?.[36]?.wall).toHaveLength(0);
  });
});
