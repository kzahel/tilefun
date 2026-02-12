import { describe, expect, it } from "vitest";
import { Chunk } from "./Chunk.js";
import { CollisionFlag, TileId } from "./TileRegistry.js";

describe("Chunk", () => {
  it("initializes all terrain to 0 (Empty)", () => {
    const chunk = new Chunk();
    expect(chunk.getTerrain(0, 0)).toBe(TileId.Empty);
    expect(chunk.getTerrain(15, 15)).toBe(TileId.Empty);
  });

  it("sets and gets terrain", () => {
    const chunk = new Chunk();
    chunk.setTerrain(3, 7, TileId.Grass);
    expect(chunk.getTerrain(3, 7)).toBe(TileId.Grass);
    expect(chunk.getTerrain(0, 0)).toBe(TileId.Empty);
  });

  it("sets and gets collision", () => {
    const chunk = new Chunk();
    chunk.setCollision(5, 5, CollisionFlag.Solid | CollisionFlag.Water);
    expect(chunk.getCollision(5, 5)).toBe(3);
    expect(chunk.getCollision(0, 0)).toBe(0);
  });

  it("fillTerrain fills entire chunk", () => {
    const chunk = new Chunk();
    chunk.fillTerrain(TileId.Grass);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(chunk.getTerrain(x, y)).toBe(TileId.Grass);
      }
    }
  });

  it("fillCollision fills entire chunk", () => {
    const chunk = new Chunk();
    chunk.fillCollision(CollisionFlag.Water);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(chunk.getCollision(x, y)).toBe(CollisionFlag.Water);
      }
    }
  });

  it("terrain and collision are independent", () => {
    const chunk = new Chunk();
    chunk.setTerrain(0, 0, TileId.Water);
    chunk.setCollision(0, 0, CollisionFlag.Solid);
    expect(chunk.getTerrain(0, 0)).toBe(TileId.Water);
    expect(chunk.getCollision(0, 0)).toBe(CollisionFlag.Solid);
  });

  it("allocates subgrid array of size 33×33", () => {
    const chunk = new Chunk();
    expect(chunk.subgrid.length).toBe(33 * 33);
    expect(Chunk.SUBGRID_SIZE).toBe(33);
  });

  it("getSubgrid/setSubgrid access raw subgrid points", () => {
    const chunk = new Chunk();
    chunk.setSubgrid(1, 1, 4); // center of tile (0,0)
    chunk.setSubgrid(0, 0, 2); // corner (0,0)
    expect(chunk.getSubgrid(1, 1)).toBe(4);
    expect(chunk.getSubgrid(0, 0)).toBe(2);
    expect(chunk.getSubgrid(2, 2)).toBe(0);
  });

  it("setCorner/getCorner map to subgrid even coords", () => {
    const chunk = new Chunk();
    chunk.setCorner(0, 0, 3);
    chunk.setCorner(16, 16, 5);
    expect(chunk.getCorner(0, 0)).toBe(3);
    expect(chunk.getCorner(16, 16)).toBe(5);
    expect(chunk.getCorner(1, 1)).toBe(0);
    // Verify corner (1,1) maps to subgrid (2,2)
    chunk.setCorner(1, 1, 7);
    expect(chunk.getSubgrid(2, 2)).toBe(7);
  });

  it("corners default to 0", () => {
    const chunk = new Chunk();
    for (let y = 0; y <= 16; y++) {
      for (let x = 0; x <= 16; x++) {
        expect(chunk.getCorner(x, y)).toBe(0);
      }
    }
  });
});
