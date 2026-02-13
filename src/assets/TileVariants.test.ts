import { describe, expect, it } from "vitest";
import { TileVariants } from "./TileVariants.js";

// Minimal mock spritesheet — TileVariants only needs `sheet` for drawVariant
const mockSheet = { drawTile: () => {} } as never;

describe("TileVariants", () => {
  it("has() returns false for unregistered group", () => {
    const v = new TileVariants(mockSheet);
    expect(v.has("Grass")).toBe(false);
  });

  it("has() returns true after addTiles", () => {
    const v = new TileVariants(mockSheet);
    v.addTiles("Grass", [{ col: 1, row: 2 }]);
    expect(v.has("Grass")).toBe(true);
  });

  it("count() returns correct tile count", () => {
    const v = new TileVariants(mockSheet);
    v.addTiles("Grass", [
      { col: 1, row: 2 },
      { col: 3, row: 4 },
    ]);
    expect(v.count("Grass")).toBe(2);
  });

  it("addRect registers cols×rows tiles", () => {
    const v = new TileVariants(mockSheet);
    v.addRect("Grass", 10, 20, 3, 2);
    expect(v.count("Grass")).toBe(6);
  });

  it("addRect + addTiles accumulate into same group", () => {
    const v = new TileVariants(mockSheet);
    v.addRect("Grass", 0, 0, 2, 2);
    v.addTiles("Grass", [{ col: 10, row: 10 }]);
    expect(v.count("Grass")).toBe(5);
  });

  it("pick() returns undefined for unknown group", () => {
    const v = new TileVariants(mockSheet);
    expect(v.pick("Nope", 0, 0)).toBeUndefined();
  });

  it("pick() returns a registered tile", () => {
    const v = new TileVariants(mockSheet);
    const tiles = [
      { col: 1, row: 2 },
      { col: 3, row: 4 },
      { col: 5, row: 6 },
    ];
    v.addTiles("Grass", tiles);
    const result = v.pick("Grass", 7, 13);
    expect(result).toBeDefined();
    expect(tiles).toContainEqual(result);
  });

  it("pick() is deterministic for same position", () => {
    const v = new TileVariants(mockSheet);
    v.addRect("Grass", 0, 0, 10, 10);
    const a = v.pick("Grass", 42, 99);
    const b = v.pick("Grass", 42, 99);
    expect(a).toEqual(b);
  });

  it("pick() varies across different positions", () => {
    const v = new TileVariants(mockSheet);
    v.addRect("Grass", 0, 0, 100, 100); // lots of variants
    const results = new Set<string>();
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        const t = v.pick("Grass", x, y);
        if (t) results.add(`${t.col},${t.row}`);
      }
    }
    // With 10000 variants and 400 picks, we should get significant variety
    expect(results.size).toBeGreaterThan(50);
  });
});
