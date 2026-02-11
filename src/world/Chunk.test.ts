import { describe, expect, it } from "vitest";
import { TERRAIN_LAYERS } from "../autotile/TerrainLayers.js";
import { Chunk } from "./Chunk.js";
import { CollisionFlag, TileId } from "./TileRegistry.js";

const LAYER_COUNT = TERRAIN_LAYERS.length;

describe("Chunk", () => {
  it("initializes all terrain to 0 (Empty)", () => {
    const chunk = new Chunk(LAYER_COUNT);
    expect(chunk.getTerrain(0, 0)).toBe(TileId.Empty);
    expect(chunk.getTerrain(15, 15)).toBe(TileId.Empty);
  });

  it("sets and gets terrain", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.setTerrain(3, 7, TileId.Grass);
    expect(chunk.getTerrain(3, 7)).toBe(TileId.Grass);
    expect(chunk.getTerrain(0, 0)).toBe(TileId.Empty);
  });

  it("sets and gets collision", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.setCollision(5, 5, CollisionFlag.Solid | CollisionFlag.Water);
    expect(chunk.getCollision(5, 5)).toBe(3);
    expect(chunk.getCollision(0, 0)).toBe(0);
  });

  it("fillTerrain fills entire chunk", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Grass);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(chunk.getTerrain(x, y)).toBe(TileId.Grass);
      }
    }
  });

  it("fillCollision fills entire chunk", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillCollision(CollisionFlag.Water);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(chunk.getCollision(x, y)).toBe(CollisionFlag.Water);
      }
    }
  });

  it("terrain and collision are independent", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.setTerrain(0, 0, TileId.Water);
    chunk.setCollision(0, 0, CollisionFlag.Solid);
    expect(chunk.getTerrain(0, 0)).toBe(TileId.Water);
    expect(chunk.getCollision(0, 0)).toBe(CollisionFlag.Solid);
  });

  it("allocates correct number of autotile layers", () => {
    const chunk = new Chunk(LAYER_COUNT);
    expect(chunk.autotileLayers.length).toBe(LAYER_COUNT);
    for (const layer of chunk.autotileLayers) {
      expect(layer.length).toBe(16 * 16);
    }
  });

  it("allocates corners array of size 17×17", () => {
    const chunk = new Chunk(LAYER_COUNT);
    expect(chunk.corners.length).toBe(17 * 17);
    expect(Chunk.CORNER_SIZE).toBe(17);
  });

  it("sets and gets corner values", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.setCorner(0, 0, 3);
    chunk.setCorner(16, 16, 5);
    expect(chunk.getCorner(0, 0)).toBe(3);
    expect(chunk.getCorner(16, 16)).toBe(5);
    expect(chunk.getCorner(1, 1)).toBe(0);
  });

  it("corners default to 0", () => {
    const chunk = new Chunk(LAYER_COUNT);
    for (let y = 0; y <= 16; y++) {
      for (let x = 0; x <= 16; x++) {
        expect(chunk.getCorner(x, y)).toBe(0);
      }
    }
  });
});
