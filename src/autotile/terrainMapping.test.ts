import { describe, expect, it } from "vitest";
import { BiomeId } from "../generation/BiomeMapper.js";
import { TileId } from "../world/TileRegistry.js";
import { TerrainId } from "./TerrainId.js";
import { biomeIdToTerrainId, terrainIdToTileId, tileIdToTerrainId } from "./terrainMapping.js";

describe("tileIdToTerrainId", () => {
  it("maps water types correctly", () => {
    expect(tileIdToTerrainId(TileId.DeepWater)).toBe(TerrainId.DeepWater);
    expect(tileIdToTerrainId(TileId.Water)).toBe(TerrainId.ShallowWater);
  });

  it("maps Sand to Sand", () => {
    expect(tileIdToTerrainId(TileId.Sand)).toBe(TerrainId.Sand);
  });

  it("maps Grass to Grass", () => {
    expect(tileIdToTerrainId(TileId.Grass)).toBe(TerrainId.Grass);
  });

  it("collapses Forest and DenseForest to Grass", () => {
    expect(tileIdToTerrainId(TileId.Forest)).toBe(TerrainId.Grass);
    expect(tileIdToTerrainId(TileId.DenseForest)).toBe(TerrainId.Grass);
  });

  it("maps DirtPath to DirtWarm", () => {
    expect(tileIdToTerrainId(TileId.DirtPath)).toBe(TerrainId.DirtWarm);
  });

  it("maps Empty and unknown tiles to Grass (safe default)", () => {
    expect(tileIdToTerrainId(TileId.Empty)).toBe(TerrainId.Grass);
    expect(tileIdToTerrainId(TileId.FlowerRed)).toBe(TerrainId.Grass);
  });
});

describe("terrainIdToTileId", () => {
  it("maps water types correctly", () => {
    expect(terrainIdToTileId(TerrainId.DeepWater)).toBe(TileId.DeepWater);
    expect(terrainIdToTileId(TerrainId.ShallowWater)).toBe(TileId.Water);
  });

  it("maps Sand and SandLight both to TileId.Sand", () => {
    expect(terrainIdToTileId(TerrainId.Sand)).toBe(TileId.Sand);
    expect(terrainIdToTileId(TerrainId.SandLight)).toBe(TileId.Sand);
  });

  it("maps Grass to Grass", () => {
    expect(terrainIdToTileId(TerrainId.Grass)).toBe(TileId.Grass);
  });

  it("maps DirtLight and DirtWarm both to DirtPath", () => {
    expect(terrainIdToTileId(TerrainId.DirtLight)).toBe(TileId.DirtPath);
    expect(terrainIdToTileId(TerrainId.DirtWarm)).toBe(TileId.DirtPath);
  });
});

describe("biomeIdToTerrainId", () => {
  it("maps water types correctly", () => {
    expect(biomeIdToTerrainId(BiomeId.DeepWater)).toBe(TerrainId.DeepWater);
    expect(biomeIdToTerrainId(BiomeId.ShallowWater)).toBe(TerrainId.ShallowWater);
  });

  it("maps Sand to Sand", () => {
    expect(biomeIdToTerrainId(BiomeId.Sand)).toBe(TerrainId.Sand);
  });

  it("maps Grass to TerrainId.Grass (not a direct cast!)", () => {
    // BiomeId.Grass=3, TerrainId.Grass=4 — must use mapping, not cast
    expect(biomeIdToTerrainId(BiomeId.Grass)).toBe(TerrainId.Grass);
    expect(BiomeId.Grass).not.toBe(TerrainId.Grass); // Sanity: values differ
  });

  it("collapses Forest and DenseForest to Grass", () => {
    expect(biomeIdToTerrainId(BiomeId.Forest)).toBe(TerrainId.Grass);
    expect(biomeIdToTerrainId(BiomeId.DenseForest)).toBe(TerrainId.Grass);
  });
});
