import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../config/constants.js";
import { BiomeId } from "../generation/BiomeMapper.js";
import { Chunk } from "../world/Chunk.js";
import { TileId } from "../world/TileRegistry.js";
import {
  AutotileBit,
  canonicalize,
  computeChunkAllLayers,
  computeChunkBlendLayers,
  computeChunkCornerBlend,
  computeMask,
} from "./Autotiler.js";
import { BlendGraph, MAX_BLEND_LAYERS } from "./BlendGraph.js";
import { TerrainId } from "./TerrainId.js";
import { TERRAIN_LAYERS } from "./TerrainLayers.js";

const LAYER_COUNT = TERRAIN_LAYERS.length;

// Layer indices (must match TERRAIN_LAYERS order)
const DEEP_LAYER = 0;
const SAND_LAYER = 1; // sand_on_water: isNonWater group
const GRASS_LAYER = 2; // grass_on_sand: isGrassLand group (excludes Sand)
const DIRT_LAYER = 3; // dirt_on_grass: isDirtPath only

// Pre-extract layer predicates (asserted non-null once here)
function getLayerPredicate(idx: number): (tileId: TileId) => boolean {
  const layer = TERRAIN_LAYERS[idx];
  if (!layer) throw new Error(`Missing terrain layer ${idx}`);
  return layer.isInGroup;
}

describe("canonicalize", () => {
  it("keeps cardinal-only masks unchanged", () => {
    expect(canonicalize(0)).toBe(0);
    expect(canonicalize(0x0f)).toBe(0x0f); // N+W+E+S
    expect(canonicalize(1)).toBe(1); // N only
  });

  it("strips diagonal bits when adjacent cardinals are missing", () => {
    // NW(16) without both N and W → stripped
    expect(canonicalize(AutotileBit.NW)).toBe(0);
    expect(canonicalize(AutotileBit.N | AutotileBit.NW)).toBe(AutotileBit.N);
    expect(canonicalize(AutotileBit.W | AutotileBit.NW)).toBe(AutotileBit.W);
  });

  it("keeps diagonal bits when both adjacent cardinals present", () => {
    const mask = AutotileBit.N | AutotileBit.W | AutotileBit.NW;
    expect(canonicalize(mask)).toBe(mask);
  });

  it("all 4 cardinals + all 4 diagonals = 255", () => {
    expect(canonicalize(255)).toBe(255);
  });

  it("collapses to at most 47 unique values", () => {
    const unique = new Set<number>();
    for (let m = 0; m < 256; m++) {
      unique.add(canonicalize(m));
    }
    expect(unique.size).toBe(47);
  });
});

describe("computeMask", () => {
  it("returns 0 when surrounded by water (using sand layer)", () => {
    const getTerrain = () => TileId.Water;
    const isNonWater = getLayerPredicate(SAND_LAYER);
    const mask = computeMask(5, 5, getTerrain, isNonWater);
    expect(mask).toBe(0);
  });

  it("returns 255 when fully surrounded by grass (using sand layer)", () => {
    const getTerrain = () => TileId.Grass;
    const isNonWater = getLayerPredicate(SAND_LAYER);
    const mask = computeMask(5, 5, getTerrain, isNonWater);
    expect(mask).toBe(255);
  });

  it("correctly computes N+E with NE corner", () => {
    const getTerrain = (tx: number, ty: number) => {
      if (tx === 5 && ty === 4) return TileId.Grass; // N
      if (tx === 6 && ty === 5) return TileId.Grass; // E
      if (tx === 6 && ty === 4) return TileId.Grass; // NE
      return TileId.Water;
    };
    const isNonWater = getLayerPredicate(SAND_LAYER);
    const mask = computeMask(5, 5, getTerrain, isNonWater);
    expect(mask).toBe(AutotileBit.N | AutotileBit.E | AutotileBit.NE); // 1+4+32 = 37
  });

  it("does not set diagonal when one cardinal is missing", () => {
    const getTerrain = (tx: number, ty: number) => {
      if (tx === 5 && ty === 4) return TileId.Grass; // N only
      if (tx === 4 && ty === 4) return TileId.Grass; // NW position, but W is not grass
      return TileId.Water;
    };
    const isNonWater = getLayerPredicate(SAND_LAYER);
    const mask = computeMask(5, 5, getTerrain, isNonWater);
    expect(mask).toBe(AutotileBit.N); // NW not set because W is water
  });

  it("treats Forest and DenseForest as non-water group", () => {
    const getTerrain = (tx: number, ty: number) => {
      if (tx === 5 && ty === 4) return TileId.Forest;
      if (tx === 6 && ty === 5) return TileId.DenseForest;
      return TileId.Water;
    };
    const isNonWater = getLayerPredicate(SAND_LAYER);
    const mask = computeMask(5, 5, getTerrain, isNonWater);
    expect(mask).toBe(AutotileBit.N | AutotileBit.E);
  });

  it("Sand is in non-water group but NOT in grass-land group", () => {
    const getTerrain = (tx: number, ty: number) => {
      if (tx === 5 && ty === 4) return TileId.Sand;
      return TileId.Water;
    };
    const isNonWater = getLayerPredicate(SAND_LAYER);
    const isGrassLand = getLayerPredicate(GRASS_LAYER);
    expect(computeMask(5, 5, getTerrain, isNonWater)).toBe(AutotileBit.N);
    expect(computeMask(5, 5, getTerrain, isGrassLand)).toBe(0);
  });

  it("DirtPath is in non-water, grass-land, AND dirt groups", () => {
    const getTerrain = (tx: number, ty: number) => {
      if (tx === 5 && ty === 4) return TileId.DirtPath;
      return TileId.Water;
    };
    expect(computeMask(5, 5, getTerrain, getLayerPredicate(SAND_LAYER))).toBe(AutotileBit.N);
    expect(computeMask(5, 5, getTerrain, getLayerPredicate(GRASS_LAYER))).toBe(AutotileBit.N);
    expect(computeMask(5, 5, getTerrain, getLayerPredicate(DIRT_LAYER))).toBe(AutotileBit.N);
  });

  it("DeepWater is in the deep water layer group", () => {
    const getTerrain = (tx: number, ty: number) => {
      if (tx === 5 && ty === 4) return TileId.DeepWater; // N
      return TileId.Water;
    };
    const isDeep = getLayerPredicate(DEEP_LAYER);
    const mask = computeMask(5, 5, getTerrain, isDeep);
    expect(mask).toBe(AutotileBit.N);
  });

  it("ShallowWater is NOT in the deep water layer group", () => {
    const getTerrain = () => TileId.Water;
    const isDeep = getLayerPredicate(DEEP_LAYER);
    const mask = computeMask(5, 5, getTerrain, isDeep);
    expect(mask).toBe(0);
  });

  it("uses dirt layer predicate for DirtPath-only detection", () => {
    const getTerrain = (tx: number, ty: number) => {
      if (tx === 5 && ty === 4) return TileId.DirtPath; // N
      if (tx === 6 && ty === 5) return TileId.Sand; // E — NOT in dirt group
      return TileId.Grass;
    };
    const isDirt = getLayerPredicate(DIRT_LAYER);
    const mask = computeMask(5, 5, getTerrain, isDirt);
    expect(mask).toBe(AutotileBit.N); // Only DirtPath, not Sand
  });
});

describe("computeChunkAllLayers", () => {
  it("fills sand layer for grass tiles (nested ring)", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Grass);
    const getTerrain = () => TileId.Grass;

    computeChunkAllLayers(chunk, 0, 0, getTerrain);

    // All tiles should be full interior (mask 255 → col=1, row=0 in GM blob)
    const packed = (0 << 8) | 1; // row=0, col=1
    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.autotileLayers[SAND_LAYER]?.[i]).toBe(packed);
      expect(chunk.autotileLayers[GRASS_LAYER]?.[i]).toBe(packed);
    }
  });

  it("sets 0 in all land layers for water tiles", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Water);
    const getTerrain = () => TileId.Water;

    computeChunkAllLayers(chunk, 0, 0, getTerrain);

    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.autotileLayers[SAND_LAYER]?.[i]).toBe(0);
      expect(chunk.autotileLayers[GRASS_LAYER]?.[i]).toBe(0);
      expect(chunk.autotileLayers[DIRT_LAYER]?.[i]).toBe(0);
    }
  });

  it("fills deep water layer for DeepWater tiles", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.DeepWater);
    const getTerrain = () => TileId.DeepWater;

    computeChunkAllLayers(chunk, 0, 0, getTerrain);

    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.autotileLayers[DEEP_LAYER]?.[i]).toBeGreaterThan(0);
      expect(chunk.autotileLayers[SAND_LAYER]?.[i]).toBe(0);
      expect(chunk.autotileLayers[GRASS_LAYER]?.[i]).toBe(0);
      expect(chunk.autotileLayers[DIRT_LAYER]?.[i]).toBe(0);
    }
  });

  it("fills sand layer but NOT grass/dirt layers for Sand tiles", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Sand);
    const getTerrain = () => TileId.Sand;

    computeChunkAllLayers(chunk, 0, 0, getTerrain);

    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.autotileLayers[SAND_LAYER]?.[i]).toBeGreaterThan(0);
      expect(chunk.autotileLayers[GRASS_LAYER]?.[i]).toBe(0);
      expect(chunk.autotileLayers[DIRT_LAYER]?.[i]).toBe(0);
    }
  });

  it("fills all 3 land layers for DirtPath tiles", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.DirtPath);
    const getTerrain = () => TileId.DirtPath;

    computeChunkAllLayers(chunk, 0, 0, getTerrain);

    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.autotileLayers[SAND_LAYER]?.[i]).toBeGreaterThan(0);
      expect(chunk.autotileLayers[GRASS_LAYER]?.[i]).toBeGreaterThan(0);
      expect(chunk.autotileLayers[DIRT_LAYER]?.[i]).toBeGreaterThan(0);
    }
  });

  it("computes edge tiles at chunk borders", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Grass);

    const getTerrain = (tx: number, ty: number) => {
      if (tx >= 0 && tx < CHUNK_SIZE && ty >= 0 && ty < CHUNK_SIZE) {
        return TileId.Grass;
      }
      return TileId.Water;
    };

    computeChunkAllLayers(chunk, 0, 0, getTerrain);

    // Corner tile should have edge variant (not full interior)
    const cornerPacked = chunk.autotileLayers[SAND_LAYER]?.[0];
    expect(cornerPacked).not.toBeUndefined();
    expect(cornerPacked).not.toBe(0);
    // Interior tile should be full (255 → col=1, row=0 in GM blob)
    const interiorPacked = chunk.autotileLayers[SAND_LAYER]?.[8 * CHUNK_SIZE + 8];
    const fullPacked = (0 << 8) | 1;
    expect(interiorPacked).toBe(fullPacked);
  });

  it("computes sand edges for sand surrounded by grass", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Sand);
    const getTerrain = (tx: number, ty: number) => {
      if (tx >= 0 && tx < CHUNK_SIZE && ty >= 0 && ty < CHUNK_SIZE) {
        return TileId.Sand;
      }
      return TileId.Grass;
    };

    computeChunkAllLayers(chunk, 0, 0, getTerrain);

    // Sand layer: all tiles non-zero (sand + grass are both non-water = same group)
    const fullPacked = (0 << 8) | 1;
    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.autotileLayers[SAND_LAYER]?.[i]).toBe(fullPacked);
    }
    // Grass layer: 0 for all (Sand not in grassLand group)
    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.autotileLayers[GRASS_LAYER]?.[i]).toBe(0);
    }
  });

  it("computes deep water edges at deep/shallow boundary", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.DeepWater);

    const getTerrain = (tx: number, ty: number) => {
      if (tx >= 0 && tx < CHUNK_SIZE && ty >= 0 && ty < CHUNK_SIZE) {
        return TileId.DeepWater;
      }
      return TileId.Water;
    };

    computeChunkAllLayers(chunk, 0, 0, getTerrain);

    // Corner deep water tile should have edge variant
    const cornerPacked = chunk.autotileLayers[DEEP_LAYER]?.[0];
    expect(cornerPacked).toBeGreaterThan(0);
    // Interior tile should be full interior
    const interiorPacked = chunk.autotileLayers[DEEP_LAYER]?.[8 * CHUNK_SIZE + 8];
    expect(interiorPacked).toBeGreaterThan(0);
    expect(interiorPacked).not.toBe(cornerPacked);
  });
});

describe("computeChunkBlendLayers", () => {
  const blendGraph = new BlendGraph();

  /** Unpack sheetIndex from a packed blend layer value. */
  function unpackSheet(packed: number): number {
    return (packed >> 16) & 0xffff;
  }

  it("produces no blend layers for uniform grass chunk", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Grass);
    const getTerrain = () => TileId.Grass;

    computeChunkBlendLayers(chunk, 0, 0, getTerrain, blendGraph);

    for (let i = 0; i < MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.blendLayers[i]).toBe(0);
    }
  });

  it("produces no blend layers for uniform water chunk", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Water);
    const getTerrain = () => TileId.Water;

    computeChunkBlendLayers(chunk, 0, 0, getTerrain, blendGraph);

    for (let i = 0; i < MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.blendLayers[i]).toBe(0);
    }
  });

  it("produces blend layers at grass/water boundary", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Grass);
    const getTerrain = (tx: number, ty: number) => {
      if (tx >= 0 && tx < CHUNK_SIZE && ty >= 0 && ty < CHUNK_SIZE) {
        return TileId.Grass;
      }
      return TileId.Water;
    };

    computeChunkBlendLayers(chunk, 0, 0, getTerrain, blendGraph);

    // Corner tile (0,0) should have at least one non-zero blend layer
    const tileOffset = 0 * MAX_BLEND_LAYERS;
    let hasLayer = false;
    for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
      if (chunk.blendLayers[tileOffset + s] !== 0) {
        hasLayer = true;
        break;
      }
    }
    expect(hasLayer).toBe(true);

    // Interior tile (8,8) should have no blend layers (all neighbors are also grass)
    const interiorOffset = (8 * CHUNK_SIZE + 8) * MAX_BLEND_LAYERS;
    for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
      expect(chunk.blendLayers[interiorOffset + s]).toBe(0);
    }
  });

  it("uses dedicated pair sheet #15 for grass bordering water", () => {
    const chunk = new Chunk(LAYER_COUNT);
    // Single grass tile at (8,8) surrounded by water
    chunk.fillTerrain(TileId.Water);
    chunk.setTerrain(8, 8, TileId.Grass);

    const getTerrain = (tx: number, ty: number) => {
      if (tx === 8 && ty === 8) return TileId.Grass;
      return TileId.Water;
    };

    computeChunkBlendLayers(chunk, 0, 0, getTerrain, blendGraph);

    const tileOffset = (8 * CHUNK_SIZE + 8) * MAX_BLEND_LAYERS;
    const packed = chunk.blendLayers[tileOffset];
    expect(packed).toBeGreaterThan(0);
    // Should use the grass/water sheet (#15 = "me15")
    const entry = blendGraph.getBlend(TerrainId.Grass, TerrainId.ShallowWater);
    expect(entry).toBeDefined();
    expect(unpackSheet(packed ?? 0)).toBe(entry?.sheetIndex);
  });

  it("produces independent masks for tile with multiple neighbor terrains", () => {
    const chunk = new Chunk(LAYER_COUNT);
    // Set up: grass tile at (8,8), water to the north, sand to the east
    chunk.fillTerrain(TileId.Grass);
    chunk.setTerrain(8, 7, TileId.Water); // N
    chunk.setTerrain(9, 8, TileId.Sand); // E
    // Also set corners for diagonal masking
    chunk.setTerrain(9, 7, TileId.Water); // NE

    const getTerrain = (tx: number, ty: number) => {
      if (tx === 8 && ty === 7) return TileId.Water;
      if (tx === 9 && ty === 8) return TileId.Sand;
      if (tx === 9 && ty === 7) return TileId.Water;
      return TileId.Grass;
    };

    computeChunkBlendLayers(chunk, 0, 0, getTerrain, blendGraph);

    const tileOffset = (8 * CHUNK_SIZE + 8) * MAX_BLEND_LAYERS;
    // Should have multiple non-zero layers (water dedicated + sand alpha background + grass alpha)
    let layerCount = 0;
    for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
      if (chunk.blendLayers[tileOffset + s] !== 0) layerCount++;
    }
    expect(layerCount).toBeGreaterThanOrEqual(2);
  });

  it("uses alpha fallback for grass bordering sand (no dedicated pair)", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Grass);
    chunk.setTerrain(9, 8, TileId.Sand);

    const getTerrain = (tx: number, ty: number) => {
      if (tx === 9 && ty === 8) return TileId.Sand;
      return TileId.Grass;
    };

    computeChunkBlendLayers(chunk, 0, 0, getTerrain, blendGraph);

    const tileOffset = (8 * CHUNK_SIZE + 8) * MAX_BLEND_LAYERS;
    // Should have layers (sand background fill + grass alpha)
    let layerCount = 0;
    for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
      if (chunk.blendLayers[tileOffset + s] !== 0) layerCount++;
    }
    expect(layerCount).toBeGreaterThanOrEqual(1);

    // Check that the alpha sheet (me13 = grass alpha) is used
    const grassAlpha = blendGraph.getAlpha(TerrainId.Grass);
    expect(grassAlpha).toBeDefined();
    let foundAlpha = false;
    for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
      const packed = chunk.blendLayers[tileOffset + s] ?? 0;
      if (packed !== 0 && grassAlpha && unpackSheet(packed) === grassAlpha.sheetIndex) {
        foundAlpha = true;
      }
    }
    expect(foundAlpha).toBe(true);
  });

  it("respects MAX_BLEND_LAYERS cap", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Grass);

    computeChunkBlendLayers(chunk, 0, 0, () => TileId.Grass, blendGraph);

    // Verify we never write beyond MAX_BLEND_LAYERS slots per tile
    expect(chunk.blendLayers.length).toBe(MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE);
  });

  it("handles DirtPath (mapped to DirtWarm) correctly", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Grass);
    chunk.setTerrain(8, 8, TileId.DirtPath);

    const getTerrain = (tx: number, ty: number) => {
      if (tx === 8 && ty === 8) return TileId.DirtPath;
      return TileId.Grass;
    };

    computeChunkBlendLayers(chunk, 0, 0, getTerrain, blendGraph);

    // DirtPath → DirtWarm, bordering Grass. Should use #2 (dirt_warm/grass) or #12
    const tileOffset = (8 * CHUNK_SIZE + 8) * MAX_BLEND_LAYERS;
    const packed = chunk.blendLayers[tileOffset];
    expect(packed).toBeGreaterThan(0);
    // DirtWarm→Grass uses me02
    const entry = blendGraph.getBlend(TerrainId.DirtWarm, TerrainId.Grass);
    expect(entry).toBeDefined();
    expect(unpackSheet(packed ?? 0)).toBe(entry?.sheetIndex);
  });

  it("Forest/DenseForest collapse to Grass (no blend layers between them)", () => {
    const chunk = new Chunk(LAYER_COUNT);
    chunk.fillTerrain(TileId.Forest);
    chunk.setTerrain(8, 8, TileId.DenseForest);

    const getTerrain = (tx: number, ty: number) => {
      if (tx === 8 && ty === 8) return TileId.DenseForest;
      return TileId.Forest;
    };

    computeChunkBlendLayers(chunk, 0, 0, getTerrain, blendGraph);

    // Both map to Grass, so no foreign neighbors → no blend layers
    const tileOffset = (8 * CHUNK_SIZE + 8) * MAX_BLEND_LAYERS;
    for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
      expect(chunk.blendLayers[tileOffset + s]).toBe(0);
    }
  });
});

describe("computeChunkCornerBlend", () => {
  const blendGraph = new BlendGraph();
  const B = BiomeId;

  /** Unpack sheetIndex from a packed blend layer value. */
  function unpackSheet(packed: number): number {
    return (packed >> 16) & 0xffff;
  }

  /** Create a chunk with all corners set to the given BiomeId. */
  function makeUniformChunk(biome: number): Chunk {
    const chunk = new Chunk(LAYER_COUNT);
    const cornerSize = CHUNK_SIZE + 1;
    for (let cy = 0; cy < cornerSize; cy++) {
      for (let cx = 0; cx < cornerSize; cx++) {
        chunk.setCorner(cx, cy, biome);
      }
    }
    return chunk;
  }

  it("produces no blend layers for uniform grass chunk", () => {
    const chunk = makeUniformChunk(B.Grass);
    computeChunkCornerBlend(chunk, blendGraph);

    for (let i = 0; i < MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.blendLayers[i]).toBe(0);
    }
  });

  it("produces no blend layers for uniform water chunk", () => {
    const chunk = makeUniformChunk(B.ShallowWater);
    computeChunkCornerBlend(chunk, blendGraph);

    for (let i = 0; i < MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.blendLayers[i]).toBe(0);
    }
  });

  it("single water corner produces blend layers on the 4 sharing tiles only (no fan-out)", () => {
    const chunk = makeUniformChunk(B.Grass);

    // Paint a single ShallowWater corner at (5, 5)
    chunk.setCorner(5, 5, B.ShallowWater);

    computeChunkCornerBlend(chunk, blendGraph);

    // The 4 tiles sharing corner (5,5): (4,4), (5,4), (4,5), (5,5)
    const affectedTiles = [
      [4, 4],
      [5, 4],
      [4, 5],
      [5, 5],
    ] as const;

    for (const [lx, ly] of affectedTiles) {
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;
      let hasLayer = false;
      for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
        if (chunk.blendLayers[tileOffset + s] !== 0) {
          hasLayer = true;
          break;
        }
      }
      expect(hasLayer).toBe(true);
    }

    // Non-sharing tiles should have NO blend layers (no fan-out)
    const unaffectedTiles = [
      [3, 3],
      [6, 3],
      [3, 6],
      [6, 6],
      [5, 3],
      [3, 5],
      [8, 8],
    ] as const;

    for (const [lx, ly] of unaffectedTiles) {
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;
      for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
        expect(chunk.blendLayers[tileOffset + s]).toBe(0);
      }
    }
  });

  it("uses dedicated pair sheet for grass/water corner blend", () => {
    const chunk = makeUniformChunk(B.Grass);

    // Set SE corner of tile (4,4) to water — corners (5,5)
    chunk.setCorner(5, 5, B.ShallowWater);

    computeChunkCornerBlend(chunk, blendGraph);

    // Tile (4,4) has corners: NW=grass, NE=grass, SW=grass, SE=water
    // Base = water (lower depth), overlay = grass
    // blendGraph.getBlend(Grass, ShallowWater) → me15 (dedicated)
    const tileOffset = (4 * CHUNK_SIZE + 4) * MAX_BLEND_LAYERS;
    const packed = chunk.blendLayers[tileOffset];
    expect(packed).toBeGreaterThan(0);

    const entry = blendGraph.getBlend(TerrainId.Grass, TerrainId.ShallowWater);
    expect(entry).toBeDefined();
    expect(unpackSheet(packed ?? 0)).toBe(entry?.sheetIndex);
  });

  it("two adjacent water corners produce a wider transition zone", () => {
    const chunk = makeUniformChunk(B.Grass);

    // Two adjacent water corners: (5,5) and (6,5)
    chunk.setCorner(5, 5, B.ShallowWater);
    chunk.setCorner(6, 5, B.ShallowWater);

    computeChunkCornerBlend(chunk, blendGraph);

    // Tiles sharing either corner: (4,4), (5,4), (6,4), (4,5), (5,5), (6,5)
    const affectedTiles = [
      [4, 4],
      [5, 4],
      [6, 4],
      [4, 5],
      [5, 5],
      [6, 5],
    ] as const;

    for (const [lx, ly] of affectedTiles) {
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;
      let hasLayer = false;
      for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
        if (chunk.blendLayers[tileOffset + s] !== 0) {
          hasLayer = true;
          break;
        }
      }
      expect(hasLayer).toBe(true);
    }
  });

  it("Forest/DenseForest corners collapse to Grass (no blend layers)", () => {
    const chunk = makeUniformChunk(B.Grass);
    // Set some corners to Forest — maps to TerrainId.Grass via biomeIdToTerrainId
    chunk.setCorner(5, 5, B.Forest);
    chunk.setCorner(6, 5, B.DenseForest);

    computeChunkCornerBlend(chunk, blendGraph);

    // All corners map to Grass → uniform → no blend layers
    for (let i = 0; i < MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.blendLayers[i]).toBe(0);
    }
  });

  it("respects MAX_BLEND_LAYERS cap", () => {
    const chunk = makeUniformChunk(B.Grass);
    computeChunkCornerBlend(chunk, blendGraph);
    expect(chunk.blendLayers.length).toBe(MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE);
  });
});
