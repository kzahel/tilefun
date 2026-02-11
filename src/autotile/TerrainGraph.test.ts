import { describe, expect, it } from "vitest";
import { BiomeId } from "../generation/BiomeMapper.js";
import { deriveTerrainFromCorners, getValidFallback, isValidAdjacency } from "./TerrainGraph.js";

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

  it("returns majority biome (3 vs 1)", () => {
    const { Grass, Sand } = BiomeId;
    expect(deriveTerrainFromCorners(Grass, Grass, Grass, Sand)).toBe(Grass);
    expect(deriveTerrainFromCorners(Sand, Sand, Sand, Grass)).toBe(Sand);
  });

  it("breaks 2v2 ties by higher priority", () => {
    const { ShallowWater, Grass } = BiomeId;
    // Grass (priority 3) > ShallowWater (priority 1)
    expect(deriveTerrainFromCorners(ShallowWater, ShallowWater, Grass, Grass)).toBe(Grass);
    expect(deriveTerrainFromCorners(Grass, ShallowWater, Grass, ShallowWater)).toBe(Grass);
  });

  it("breaks 2v2 tie between Sand and Grass in favor of Grass", () => {
    const { Sand, Grass } = BiomeId;
    expect(deriveTerrainFromCorners(Sand, Sand, Grass, Grass)).toBe(Grass);
  });

  it("handles 4-way tie (1 each) by highest priority", () => {
    const { DeepWater, ShallowWater, Sand, Grass } = BiomeId;
    expect(deriveTerrainFromCorners(DeepWater, ShallowWater, Sand, Grass)).toBe(Grass);
  });

  it("handles 3 distinct biomes", () => {
    const { ShallowWater, Sand, Grass } = BiomeId;
    // 2 Grass, 1 ShallowWater, 1 Sand → Grass wins by majority
    expect(deriveTerrainFromCorners(Grass, Grass, ShallowWater, Sand)).toBe(Grass);
  });
});
