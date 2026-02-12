import { describe, expect, it } from "vitest";
import { TileId } from "../world/TileRegistry.js";
import { TerrainId } from "./TerrainId.js";
import { tileIdToTerrainId } from "./terrainMapping.js";

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
