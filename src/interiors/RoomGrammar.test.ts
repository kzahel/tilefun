import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRoomTiles, type PlacedRoomTile } from "./RoomGrammar.js";

function blocksAt(tiles: PlacedRoomTile[], x: number, y: number): boolean {
  return tiles.some((tile) => tile.x === x && tile.y === y && tile.blocksMovement);
}

describe("gray room grammar", () => {
  it("stretches a square shell while leaving a one-tile front passage", () => {
    for (const width of [8, 12]) {
      const openingX = Math.floor(width / 2);
      const tiles = buildRoomTiles({ width, height: 8, frontOpeningX: openingX });
      expect(
        tiles.find((tile) => tile.x === 3 && tile.y === 0 && tile.role === "back-wall")?.key,
      ).toBe("room-builder/3d-walls/c11-r02");
      expect(
        tiles.find((tile) => tile.x === 0 && tile.y === 4 && tile.role === "side-wall")?.key,
      ).toBe("room-builder/3d-walls/c10-r02");
      for (let x = 0; x < width; x++) {
        expect(blocksAt(tiles, x, 8)).toBe(x !== openingX);
      }
      expect(
        tiles.filter((tile) => tile.role === "front-wall").every((tile) => tile.cropHeight === 6),
      ).toBe(true);
    }
  });

  it("frames a divider passage with source tiles and keeps it walkable", () => {
    const tiles = buildRoomTiles({
      width: 12,
      height: 10,
      frontOpeningX: 6,
      divider: { y: 5, openingX: 6 },
    });
    for (const y of [5, 6]) {
      for (let x = 0; x < 12; x++) {
        const dividerTile = tiles.find(
          (tile) => tile.x === x && tile.y === y && tile.role === "divider-wall",
        );
        expect(Boolean(dividerTile)).toBe(x !== 6);
      }
      expect(tiles.some((tile) => tile.y === y && tile.role === "side-wall")).toBe(false);
    }
    expect(
      tiles.find((tile) => tile.x === 0 && tile.y === 5 && tile.role === "divider-wall")?.key,
    ).toBe("room-builder/3d-walls/c11-r00");
    expect(
      tiles.find((tile) => tile.x === 11 && tile.y === 5 && tile.role === "divider-wall")?.key,
    ).toBe("room-builder/3d-walls/c12-r00");
    expect(
      tiles.find((tile) => tile.x === 5 && tile.y === 5 && tile.role === "divider-wall")?.key,
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
      frontOpeningX: 6,
      divider: { y: 5, openingX: 6 },
    });
    expect(tiles.every((tile) => keys.has(tile.key))).toBe(true);
  });
});
