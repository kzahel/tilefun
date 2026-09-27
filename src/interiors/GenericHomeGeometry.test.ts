import { describe, expect, it } from "vitest";
import {
  buildGenericHomeLayeredMap,
  buildGenericHomeTiles,
  buildGenericHomeVariantTiles,
  GENERIC_HOME_HEIGHT,
  GENERIC_HOME_PORTALS,
  GENERIC_HOME_WIDTH,
  genericHomeCellAt,
  genericHomeVariantCellAt,
} from "./GenericHomeGeometry.js";

const walkable = (x: number, y: number): boolean =>
  ["wood", "tile", "opening"].includes(genericHomeCellAt(x, y));

describe("Generic Home 1 geometry", () => {
  it("has four boundary openings and one divider passage", () => {
    expect(GENERIC_HOME_PORTALS.map((portal) => portal.name)).toEqual([
      "north",
      "west",
      "east",
      "divider",
      "south",
    ]);
    for (const portal of GENERIC_HOME_PORTALS) {
      for (let y = portal.y; y < portal.y + portal.height; y++) {
        for (let x = portal.x; x < portal.x + portal.width; x++) {
          expect(genericHomeCellAt(x, y)).toBe("opening");
        }
      }
    }
    for (const y of [8, 9]) {
      for (let x = 2; x <= 12; x++) expect(walkable(x, y)).toBe(x === 7);
    }
    expect(genericHomeCellAt(6, 10)).toBe("tile");
    expect(genericHomeCellAt(6, 7)).toBe("wood");
  });

  it("connects each boundary opening through the divider to the south exit", () => {
    const queue: [number, number][] = [[7, 13]];
    const reached = new Set(["7,13"]);
    while (queue.length > 0) {
      const [x, y] = queue.shift() as [number, number];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (
          nx >= 0 &&
          nx < GENERIC_HOME_WIDTH &&
          ny >= 0 &&
          ny < GENERIC_HOME_HEIGHT &&
          walkable(nx, ny) &&
          !reached.has(key)
        ) {
          reached.add(key);
          queue.push([nx, ny]);
        }
      }
    }
    for (const portal of GENERIC_HOME_PORTALS) {
      expect(reached.has(`${portal.x},${portal.y}`)).toBe(true);
    }
  });

  it("uses a six-pixel bottom trim with a gap at the south exit", () => {
    const bottom = buildGenericHomeTiles().filter((tile) => tile.y === 13);
    expect(bottom).toHaveLength(10);
    expect(bottom.every((tile) => tile.cropHeight === 6)).toBe(true);
    expect(bottom.some((tile) => tile.x === 7)).toBe(false);
  });

  it("keeps floor beneath transparent tapered wall pieces", () => {
    const map = buildGenericHomeLayeredMap();
    for (const x of [2, 12]) {
      const cell = map.cells[6]?.[x];
      expect(cell?.semantic).toBe("wall");
      expect(cell?.floor).toHaveLength(1);
      expect(cell?.foreground).toHaveLength(1);
    }
    expect(map.cells[6]?.[3]?.floor).toHaveLength(1);
    expect(map.cells[6]?.[3]?.foreground).toHaveLength(0);
  });

  it("extends straight runs while preserving openings and floor zones", () => {
    const spec = { extraEastColumns: 2, extraHallRows: 2 };
    const tiles = buildGenericHomeVariantTiles(spec);
    expect(tiles.some((tile) => tile.x === 14 && tile.y === 15 && tile.role === "edge")).toBe(true);
    expect(tiles.some((tile) => tile.x === 7 && tile.y === 15)).toBe(false);
    expect(genericHomeVariantCellAt(7, 0, spec)).toBe("opening");
    expect(genericHomeVariantCellAt(15, 5, spec)).toBe("opening");
    expect(genericHomeVariantCellAt(7, 10, spec)).toBe("opening");
    expect(genericHomeVariantCellAt(7, 15, spec)).toBe("opening");
    expect(genericHomeVariantCellAt(8, 8, spec)).toBe("wood");
    expect(genericHomeVariantCellAt(8, 12, spec)).toBe("tile");
    expect(
      tiles.some((tile) => tile.x === 10 && tile.y === 0 && tile.key.endsWith("c11-r02")),
    ).toBe(true);
  });
});
