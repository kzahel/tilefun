import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { TileId, terrainIdToTileId } from "../world/TileRegistry.js";
import { deriveTerrainIdFromCorners } from "./TerrainGraph.js";
import { TerrainId } from "./TerrainId.js";

describe("corner edit integration: single corner on flat grass chunk (TerrainId corners)", () => {
  /**
   * Simulates the Game.applyCornerEdit flow for a single chunk:
   * set one corner (TerrainId), then re-derive terrain for affected tiles.
   */
  function rederiveTile(chunk: Chunk, lx: number, ly: number): void {
    const nw = chunk.getCorner(lx, ly) as TerrainId;
    const ne = chunk.getCorner(lx + 1, ly) as TerrainId;
    const sw = chunk.getCorner(lx, ly + 1) as TerrainId;
    const se = chunk.getCorner(lx + 1, ly + 1) as TerrainId;
    const terrain = deriveTerrainIdFromCorners(nw, ne, sw, se);
    chunk.setTerrain(lx, ly, terrainIdToTileId(terrain));
  }

  function makeGrassChunk(): Chunk {
    const chunk = new Chunk();
    chunk.fillTerrain(TileId.Grass);
    const cornerSize = CHUNK_SIZE + 1;
    for (let cy = 0; cy < cornerSize; cy++) {
      for (let cx = 0; cx < cornerSize; cx++) {
        chunk.setCorner(cx, cy, TerrainId.Grass);
      }
    }
    return chunk;
  }

  it("painting one water corner at (5,5) makes the 4 sharing tiles Water", () => {
    const chunk = makeGrassChunk();

    // Paint a single ShallowWater corner at local corner position (5, 5)
    chunk.setCorner(5, 5, TerrainId.ShallowWater);

    // The 4 tiles sharing corner (5,5):
    // Tile (4,4) has SE = corner(5,5), Tile (5,4) has SW = corner(5,5),
    // Tile (4,5) has NE = corner(5,5), Tile (5,5) has NW = corner(5,5)
    const affectedTiles = [
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ] as const;

    for (const [lx, ly] of affectedTiles) {
      rederiveTile(chunk, lx, ly);
    }

    // All 4 affected tiles should be Water
    for (const [lx, ly] of affectedTiles) {
      expect(chunk.getTerrain(lx, ly)).toBe(TileId.Water);
    }

    // Neighboring tiles (not sharing the corner) should remain Grass
    const unaffectedTiles = [
      [3, 3],
      [6, 3],
      [3, 6],
      [6, 6],
      [5, 3],
      [3, 5],
    ] as const;
    for (const [lx, ly] of unaffectedTiles) {
      expect(chunk.getTerrain(lx, ly)).toBe(TileId.Grass);
    }
  });

  it("painting water corner back to grass restores all tiles to Grass", () => {
    const chunk = makeGrassChunk();

    // Paint water, re-derive
    chunk.setCorner(5, 5, TerrainId.ShallowWater);
    for (const [lx, ly] of [
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ] as const) {
      rederiveTile(chunk, lx, ly);
    }

    // Verify water
    expect(chunk.getTerrain(5, 5)).toBe(TileId.Water);

    // Paint back to grass
    chunk.setCorner(5, 5, TerrainId.Grass);
    for (const [lx, ly] of [
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ] as const) {
      rederiveTile(chunk, lx, ly);
    }

    // All 4 should be Grass again
    for (const [lx, ly] of [
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ] as const) {
      expect(chunk.getTerrain(lx, ly)).toBe(TileId.Grass);
    }
  });

  it("two adjacent water corners create a larger water area", () => {
    const chunk = makeGrassChunk();

    // Paint two adjacent corners: (5,5) and (6,5)
    chunk.setCorner(5, 5, TerrainId.ShallowWater);
    chunk.setCorner(6, 5, TerrainId.ShallowWater);

    // Tiles sharing corner (5,5): (4,4), (5,4), (4,5), (5,5)
    // Tiles sharing corner (6,5): (5,4), (6,4), (5,5), (6,5)
    // Union: (4,4), (5,4), (6,4), (4,5), (5,5), (6,5)
    const affectedTiles = [
      [4, 4],
      [5, 4],
      [6, 4],
      [4, 5],
      [5, 5],
      [6, 5],
    ] as const;

    for (const [lx, ly] of affectedTiles) {
      rederiveTile(chunk, lx, ly);
    }

    for (const [lx, ly] of affectedTiles) {
      expect(chunk.getTerrain(lx, ly)).toBe(TileId.Water);
    }
  });
});

describe("deriveTerrainIdFromCorners", () => {
  it("returns the terrain when all 4 corners are the same", () => {
    expect(
      deriveTerrainIdFromCorners(
        TerrainId.Grass,
        TerrainId.Grass,
        TerrainId.Grass,
        TerrainId.Grass,
      ),
    ).toBe(TerrainId.Grass);
    expect(
      deriveTerrainIdFromCorners(
        TerrainId.DeepWater,
        TerrainId.DeepWater,
        TerrainId.DeepWater,
        TerrainId.DeepWater,
      ),
    ).toBe(TerrainId.DeepWater);
  });

  it("returns lowest-depth terrain when corners differ", () => {
    // ShallowWater(depth 1) < Grass(depth 4)
    expect(
      deriveTerrainIdFromCorners(
        TerrainId.Grass,
        TerrainId.Grass,
        TerrainId.Grass,
        TerrainId.ShallowWater,
      ),
    ).toBe(TerrainId.ShallowWater);
  });

  it("returns lowest-depth terrain with 3+ distinct terrains", () => {
    // ShallowWater(0) < DeepWater(1) < Sand(2) < Grass(4)
    expect(
      deriveTerrainIdFromCorners(
        TerrainId.DeepWater,
        TerrainId.ShallowWater,
        TerrainId.Sand,
        TerrainId.Grass,
      ),
    ).toBe(TerrainId.ShallowWater);
  });

  it("handles DirtWarm (depth 6) vs Grass (depth 4)", () => {
    // Grass has lower depth → wins
    expect(
      deriveTerrainIdFromCorners(
        TerrainId.DirtWarm,
        TerrainId.DirtWarm,
        TerrainId.DirtWarm,
        TerrainId.Grass,
      ),
    ).toBe(TerrainId.Grass);
  });

  it("SandLight (depth 3) vs Grass (depth 2)", () => {
    expect(
      deriveTerrainIdFromCorners(
        TerrainId.SandLight,
        TerrainId.Grass,
        TerrainId.SandLight,
        TerrainId.Grass,
      ),
    ).toBe(TerrainId.Grass);
  });
});
