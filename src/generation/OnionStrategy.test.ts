import { describe, expect, it } from "vitest";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { TERRAIN_COUNT, TerrainId } from "../autotile/TerrainId.js";
import { TERRAIN_LAYERS } from "../autotile/TerrainLayers.js";
import { CHUNK_SIZE } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { registerDefaultTiles, TileId } from "../world/TileRegistry.js";
import { BiomeId } from "./BiomeMapper.js";
import { OnionStrategy } from "./OnionStrategy.js";

const LAYER_COUNT = TERRAIN_LAYERS.length;
const CORNER_SIZE = CHUNK_SIZE + 1;

describe("OnionStrategy", () => {
  it("generates a chunk that is not all the same tile", () => {
    registerDefaultTiles();
    const gen = new OnionStrategy("variety-test");
    const chunk = new Chunk(LAYER_COUNT);
    gen.generate(chunk, 0, 0);

    const tileSet = new Set<TileId>();
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        tileSet.add(chunk.getTerrain(x, y));
      }
    }

    // A single 16x16 chunk at the origin might be all one biome,
    // so test across multiple chunks to ensure variety
    const gen2 = new OnionStrategy("variety-test");
    const positions: [number, number][] = [
      [0, 0],
      [5, 5],
      [-3, 2],
      [10, -10],
      [20, 20],
    ];
    const allTiles = new Set<TileId>();
    for (const [cx, cy] of positions) {
      const c = new Chunk(LAYER_COUNT);
      gen2.generate(c, cx, cy);
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          allTiles.add(c.getTerrain(x, y));
        }
      }
    }

    // Should have at least 2 different tile types across multiple chunks
    expect(allTiles.size).toBeGreaterThanOrEqual(2);
  });

  it("produces deterministic output for same seed", () => {
    registerDefaultTiles();
    const gen1 = new OnionStrategy("det-seed");
    const gen2 = new OnionStrategy("det-seed");
    const chunk1 = new Chunk(LAYER_COUNT);
    const chunk2 = new Chunk(LAYER_COUNT);
    gen1.generate(chunk1, 3, -2);
    gen2.generate(chunk2, 3, -2);

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        expect(chunk1.getTerrain(x, y)).toBe(chunk2.getTerrain(x, y));
        expect(chunk1.getCollision(x, y)).toBe(chunk2.getCollision(x, y));
        expect(chunk1.getDetail(x, y)).toBe(chunk2.getDetail(x, y));
      }
    }
  });

  it("sets collision flags for water tiles", () => {
    registerDefaultTiles();
    const gen = new OnionStrategy("collision-test");

    // Generate many chunks, find at least one water tile with collision
    let foundWaterCollision = false;
    for (let cy = -5; cy <= 5 && !foundWaterCollision; cy++) {
      for (let cx = -5; cx <= 5 && !foundWaterCollision; cx++) {
        const chunk = new Chunk(LAYER_COUNT);
        gen.generate(chunk, cx, cy);
        for (let y = 0; y < CHUNK_SIZE; y++) {
          for (let x = 0; x < CHUNK_SIZE; x++) {
            const tile = chunk.getTerrain(x, y);
            if (tile === TileId.Water || tile === TileId.DeepWater) {
              expect(chunk.getCollision(x, y)).toBeGreaterThan(0);
              foundWaterCollision = true;
            }
          }
        }
      }
    }

    expect(foundWaterCollision).toBe(true);
  });

  it("scatters detail tiles on grass biomes", () => {
    registerDefaultTiles();
    const gen = new OnionStrategy("detail-test");

    let foundDetail = false;
    for (let cy = -5; cy <= 5 && !foundDetail; cy++) {
      for (let cx = -5; cx <= 5 && !foundDetail; cx++) {
        const chunk = new Chunk(LAYER_COUNT);
        gen.generate(chunk, cx, cy);
        for (let y = 0; y < CHUNK_SIZE; y++) {
          for (let x = 0; x < CHUNK_SIZE; x++) {
            if (chunk.getDetail(x, y) !== TileId.Empty) {
              foundDetail = true;
            }
          }
        }
      }
    }

    expect(foundDetail).toBe(true);
  });

  it("fills 17×17 corner grid with valid TerrainId values", () => {
    registerDefaultTiles();
    const gen = new OnionStrategy("corners-test");
    const chunk = new Chunk(LAYER_COUNT);
    gen.generate(chunk, 0, 0);

    for (let cy = 0; cy < CORNER_SIZE; cy++) {
      for (let cx = 0; cx < CORNER_SIZE; cx++) {
        const terrain = chunk.getCorner(cx, cy);
        expect(terrain).toBeGreaterThanOrEqual(TerrainId.DeepWater);
        expect(terrain).toBeLessThan(TERRAIN_COUNT);
      }
    }
  });

  it("enforces adjacency constraints on corners (TerrainId)", () => {
    registerDefaultTiles();
    const gen = new OnionStrategy("adj-test");
    const adjacency = new TerrainAdjacency(new BlendGraph());

    // Test multiple chunks to get diverse terrain
    const positions: [number, number][] = [
      [0, 0],
      [5, 5],
      [-3, 2],
      [10, -10],
      [20, 20],
    ];

    for (const [cx, cy] of positions) {
      const chunk = new Chunk(LAYER_COUNT);
      gen.generate(chunk, cx, cy);

      // Check all horizontally adjacent corner pairs within chunk
      for (let ccy = 0; ccy < CORNER_SIZE; ccy++) {
        for (let ccx = 0; ccx < CORNER_SIZE - 1; ccx++) {
          const a = chunk.getCorner(ccx, ccy) as TerrainId;
          const b = chunk.getCorner(ccx + 1, ccy) as TerrainId;
          expect(
            adjacency.isValidAdjacency(a, b),
            `Invalid h-adj at chunk(${cx},${cy}) corner(${ccx},${ccy}): ${TerrainId[a]}↔${TerrainId[b]}`,
          ).toBe(true);
        }
      }
      // Check all vertically adjacent corner pairs within chunk
      for (let ccy = 0; ccy < CORNER_SIZE - 1; ccy++) {
        for (let ccx = 0; ccx < CORNER_SIZE; ccx++) {
          const a = chunk.getCorner(ccx, ccy) as TerrainId;
          const b = chunk.getCorner(ccx, ccy + 1) as TerrainId;
          expect(
            adjacency.isValidAdjacency(a, b),
            `Invalid v-adj at chunk(${cx},${cy}) corner(${ccx},${ccy}): ${TerrainId[a]}↔${TerrainId[b]}`,
          ).toBe(true);
        }
      }
    }
  });

  it("produces deterministic corners for same seed", () => {
    registerDefaultTiles();
    const gen1 = new OnionStrategy("corner-det");
    const gen2 = new OnionStrategy("corner-det");
    const chunk1 = new Chunk(LAYER_COUNT);
    const chunk2 = new Chunk(LAYER_COUNT);
    gen1.generate(chunk1, 3, -2);
    gen2.generate(chunk2, 3, -2);

    for (let cy = 0; cy < CORNER_SIZE; cy++) {
      for (let cx = 0; cx < CORNER_SIZE; cx++) {
        expect(chunk1.getCorner(cx, cy)).toBe(chunk2.getCorner(cx, cy));
      }
    }
  });

  it("does not place DirtPath adjacent to water or sand", () => {
    registerDefaultTiles();
    const gen = new OnionStrategy("dirtpath-test");

    for (let cy = -5; cy <= 5; cy++) {
      for (let cx = -5; cx <= 5; cx++) {
        const chunk = new Chunk(LAYER_COUNT);
        gen.generate(chunk, cx, cy);
        const baseX = cx * CHUNK_SIZE;
        const baseY = cy * CHUNK_SIZE;

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            if (chunk.getTerrain(lx, ly) === TileId.DirtPath) {
              // Check 8 neighbors via biomeMapper raw noise
              const tx = baseX + lx;
              const ty = baseY + ly;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  const nb = gen.biomeMapper.getBiome(tx + dx, ty + dy);
                  expect(
                    nb !== BiomeId.DeepWater && nb !== BiomeId.ShallowWater && nb !== BiomeId.Sand,
                    `DirtPath at (${tx},${ty}) has ${BiomeId[nb]} neighbor at (${tx + dx},${ty + dy})`,
                  ).toBe(true);
                }
              }
            }
          }
        }
      }
    }
  });
});
