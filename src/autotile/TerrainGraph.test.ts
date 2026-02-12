import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../config/constants.js";
import { BiomeId } from "../generation/BiomeMapper.js";
import { Chunk } from "../world/Chunk.js";
import { TileId, terrainIdToTileId } from "../world/TileRegistry.js";
import {
  deriveTerrainFromCorners,
  deriveTerrainIdFromCorners,
  getValidFallback,
  isValidAdjacency,
} from "./TerrainGraph.js";
import { TerrainId } from "./TerrainId.js";

describe("isValidAdjacency", () => {
  it("allows self-adjacency for all biomes", () => {
    for (const b of [
      BiomeId.DeepWater,
      BiomeId.ShallowWater,
      BiomeId.Sand,
      BiomeId.Grass,
      BiomeId.Forest,
      BiomeId.DenseForest,
    ]) {
      expect(isValidAdjacency(b, b)).toBe(true);
    }
  });

  it("allows DeepWater ↔ ShallowWater", () => {
    expect(isValidAdjacency(BiomeId.DeepWater, BiomeId.ShallowWater)).toBe(true);
    expect(isValidAdjacency(BiomeId.ShallowWater, BiomeId.DeepWater)).toBe(true);
  });

  it("allows ShallowWater ↔ land biomes", () => {
    expect(isValidAdjacency(BiomeId.ShallowWater, BiomeId.Sand)).toBe(true);
    expect(isValidAdjacency(BiomeId.ShallowWater, BiomeId.Grass)).toBe(true);
    expect(isValidAdjacency(BiomeId.ShallowWater, BiomeId.Forest)).toBe(true);
    expect(isValidAdjacency(BiomeId.ShallowWater, BiomeId.DenseForest)).toBe(true);
  });

  it("allows Sand ↔ land biomes", () => {
    expect(isValidAdjacency(BiomeId.Sand, BiomeId.Grass)).toBe(true);
    expect(isValidAdjacency(BiomeId.Sand, BiomeId.Forest)).toBe(true);
    expect(isValidAdjacency(BiomeId.Sand, BiomeId.DenseForest)).toBe(true);
  });

  it("allows vegetation transitions", () => {
    expect(isValidAdjacency(BiomeId.Grass, BiomeId.Forest)).toBe(true);
    expect(isValidAdjacency(BiomeId.Grass, BiomeId.DenseForest)).toBe(true);
    expect(isValidAdjacency(BiomeId.Forest, BiomeId.DenseForest)).toBe(true);
  });

  it("rejects DeepWater ↔ land (needs ShallowWater buffer)", () => {
    expect(isValidAdjacency(BiomeId.DeepWater, BiomeId.Sand)).toBe(false);
    expect(isValidAdjacency(BiomeId.DeepWater, BiomeId.Grass)).toBe(false);
    expect(isValidAdjacency(BiomeId.DeepWater, BiomeId.Forest)).toBe(false);
    expect(isValidAdjacency(BiomeId.DeepWater, BiomeId.DenseForest)).toBe(false);
  });
});

describe("getValidFallback", () => {
  it("returns ShallowWater when neighbor is DeepWater", () => {
    expect(getValidFallback(BiomeId.Grass, BiomeId.DeepWater)).toBe(BiomeId.ShallowWater);
    expect(getValidFallback(BiomeId.Sand, BiomeId.DeepWater)).toBe(BiomeId.ShallowWater);
  });

  it("returns Grass for other invalid adjacencies", () => {
    expect(getValidFallback(BiomeId.DeepWater, BiomeId.Grass)).toBe(BiomeId.Grass);
  });
});

describe("deriveTerrainFromCorners", () => {
  it("returns the biome when all 4 corners are the same", () => {
    const { Grass, Sand, DeepWater } = BiomeId;
    expect(deriveTerrainFromCorners(Grass, Grass, Grass, Grass)).toBe(Grass);
    expect(deriveTerrainFromCorners(Sand, Sand, Sand, Sand)).toBe(Sand);
    expect(deriveTerrainFromCorners(DeepWater, DeepWater, DeepWater, DeepWater)).toBe(DeepWater);
  });

  it("returns lowest-priority biome when corners differ (3 vs 1)", () => {
    const { Grass, Sand, ShallowWater } = BiomeId;
    // Sand (2) < Grass (3) → Sand wins
    expect(deriveTerrainFromCorners(Grass, Grass, Grass, Sand)).toBe(Sand);
    // Sand (2) < Grass (3) → Sand wins
    expect(deriveTerrainFromCorners(Sand, Sand, Sand, Grass)).toBe(Sand);
    // ShallowWater (1) < Grass (3) → ShallowWater wins
    expect(deriveTerrainFromCorners(Grass, Grass, Grass, ShallowWater)).toBe(ShallowWater);
  });

  it("returns lowest-priority biome in 2v2 split", () => {
    const { ShallowWater, Grass } = BiomeId;
    // ShallowWater (1) < Grass (3) → ShallowWater wins
    expect(deriveTerrainFromCorners(ShallowWater, ShallowWater, Grass, Grass)).toBe(ShallowWater);
    expect(deriveTerrainFromCorners(Grass, ShallowWater, Grass, ShallowWater)).toBe(ShallowWater);
  });

  it("returns lowest-priority biome in 2v2 Sand vs Grass", () => {
    const { Sand, Grass } = BiomeId;
    // Sand (2) < Grass (3) → Sand wins
    expect(deriveTerrainFromCorners(Sand, Sand, Grass, Grass)).toBe(Sand);
  });

  it("returns lowest-priority biome with 4 distinct corners", () => {
    const { DeepWater, ShallowWater, Sand, Grass } = BiomeId;
    // DeepWater (0) is lowest → wins
    expect(deriveTerrainFromCorners(DeepWater, ShallowWater, Sand, Grass)).toBe(DeepWater);
  });

  it("returns lowest-priority biome with 3 distinct biomes", () => {
    const { ShallowWater, Sand, Grass } = BiomeId;
    // ShallowWater (1) is lowest → wins regardless of counts
    expect(deriveTerrainFromCorners(Grass, Grass, ShallowWater, Sand)).toBe(ShallowWater);
  });

  it("single water corner on flat grass produces water (editor corner brush scenario)", () => {
    const { ShallowWater, Grass } = BiomeId;
    // Painting one water corner: the 4 tiles sharing it each have 3 Grass + 1 Water
    // All 4 orientations should produce Water
    expect(deriveTerrainFromCorners(Grass, Grass, Grass, ShallowWater)).toBe(ShallowWater); // SE corner
    expect(deriveTerrainFromCorners(Grass, Grass, ShallowWater, Grass)).toBe(ShallowWater); // SW corner
    expect(deriveTerrainFromCorners(Grass, ShallowWater, Grass, Grass)).toBe(ShallowWater); // NE corner
    expect(deriveTerrainFromCorners(ShallowWater, Grass, Grass, Grass)).toBe(ShallowWater); // NW corner
  });
});

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
    // DeepWater(0) < ShallowWater(1) < Sand(2) < Grass(4)
    expect(
      deriveTerrainIdFromCorners(
        TerrainId.DeepWater,
        TerrainId.ShallowWater,
        TerrainId.Sand,
        TerrainId.Grass,
      ),
    ).toBe(TerrainId.DeepWater);
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

  it("SandLight (depth 3) vs Grass (depth 4)", () => {
    expect(
      deriveTerrainIdFromCorners(
        TerrainId.SandLight,
        TerrainId.Grass,
        TerrainId.SandLight,
        TerrainId.Grass,
      ),
    ).toBe(TerrainId.SandLight);
  });
});
