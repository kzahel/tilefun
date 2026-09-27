import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRoomTiles, type PlacedRoomTile } from "./RoomGrammar.js";

function blocksAt(tiles: PlacedRoomTile[], x: number, y: number): boolean {
  return tiles.some((tile) => tile.x === x && tile.y === y && tile.blocksMovement);
}

describe("gray room grammar", () => {
  it("stretches a square shell while leaving a two-tile front passage", () => {
    for (const width of [8, 12]) {
      const openingX = Math.floor(width / 2) - 1;
      const tiles = buildRoomTiles({ width, height: 8, frontOpeningX: openingX });
      expect(
        tiles.find((tile) => tile.x === 3 && tile.y === 0 && tile.role === "back-wall")?.key,
      ).toBe("room-builder/3d-walls/c11-r02");
      expect(
        tiles.find((tile) => tile.x === 0 && tile.y === 4 && tile.role === "side-wall")?.key,
      ).toBe("room-builder/3d-walls/c10-r02");
      for (let x = 0; x < width; x++) {
        expect(blocksAt(tiles, x, 7)).toBe(x < openingX || x >= openingX + 2);
      }
    }
  });

  it("frames a divider passage with source tiles and keeps it walkable", () => {
    const tiles = buildRoomTiles({
      width: 12,
      height: 10,
      frontOpeningX: 5,
      divider: { y: 5, openingX: 5 },
    });
    for (const y of [5, 6]) {
      for (let x = 1; x < 11; x++) {
        expect(blocksAt(tiles, x, y)).toBe(x !== 5 && x !== 6);
      }
    }
    expect(
      tiles.find((tile) => tile.x === 4 && tile.y === 5 && tile.role === "divider-wall")?.key,
    ).toBe("room-builder/3d-walls/c08-r03");
    expect(
      tiles.find((tile) => tile.x === 7 && tile.y === 5 && tile.role === "divider-wall")?.key,
    ).toBe("room-builder/3d-walls/c08-r00");
  });

  it("uses tiles that exist in the packed atlas", () => {
    const atlas = JSON.parse(
      fs.readFileSync("public/data/modern-interiors-atlas.json", "utf8"),
    ) as {
      entries: { key: string }[];
    };
    const keys = new Set(atlas.entries.map((entry) => entry.key));
    const tiles = buildRoomTiles({
      width: 12,
      height: 10,
      frontOpeningX: 5,
      divider: { y: 5, openingX: 5 },
    });
    expect(tiles.every((tile) => keys.has(tile.key))).toBe(true);
  });
});
