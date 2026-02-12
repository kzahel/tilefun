import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { AutotileBit, canonicalize, computeChunkSubgridBlend } from "./Autotiler.js";
import { BlendGraph, MAX_BLEND_LAYERS } from "./BlendGraph.js";
import { GM_BLOB_LOOKUP } from "./gmBlobLayout.js";
import { TerrainId } from "./TerrainId.js";

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

describe("computeChunkSubgridBlend", () => {
  const blendGraph = new BlendGraph();
  const T = TerrainId;

  /** Unpack sheetIndex from a packed blend layer value. */
  function unpackSheet(packed: number): number {
    return (packed >> 16) & 0xffff;
  }

  /** Unpack col and row from a packed blend layer value. */
  function unpackColRow(packed: number): { col: number; row: number } {
    return { col: (packed >> 8) & 0xff, row: packed & 0xff };
  }

  /** Get the expected sprite col/row for a given mask. */
  function expectedSprite(mask: number): { col: number; row: number } {
    const packed = GM_BLOB_LOOKUP[mask & 0xff] ?? 0;
    return { col: packed & 0xff, row: packed >> 8 };
  }

  /** Create a chunk with entire subgrid filled with a terrain. */
  function makeUniformChunk(terrain: number): Chunk {
    const chunk = new Chunk();
    chunk.subgrid.fill(terrain);
    return chunk;
  }

  /**
   * Paint a rectangular tile region in subgrid space.
   * Sets all subgrid points (centers, midpoints, corners) for tiles in [x0,x1]×[y0,y1].
   */
  function paintTileRegion(
    chunk: Chunk,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    terrain: number,
  ): void {
    const sx0 = 2 * x0;
    const sy0 = 2 * y0;
    const sx1 = 2 * x1 + 2;
    const sy1 = 2 * y1 + 2;
    for (let sy = sy0; sy <= sy1; sy++) {
      for (let sx = sx0; sx <= sx1; sx++) {
        chunk.setSubgrid(sx, sy, terrain);
      }
    }
  }

  it("produces no blend layers for uniform grass chunk", () => {
    const chunk = makeUniformChunk(T.Grass);
    computeChunkSubgridBlend(chunk, blendGraph);

    for (let i = 0; i < MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.blendLayers[i]).toBe(0);
    }
  });

  it("produces no blend layers for uniform water chunk", () => {
    const chunk = makeUniformChunk(T.ShallowWater);
    computeChunkSubgridBlend(chunk, blendGraph);

    for (let i = 0; i < MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE; i++) {
      expect(chunk.blendLayers[i]).toBe(0);
    }
  });

  it("single subgrid point change affects only 4 surrounding tiles", () => {
    const chunk = makeUniformChunk(T.Grass);

    // Paint a single subgrid point at corner position (5,5) → subgrid (10,10)
    chunk.setCorner(5, 5, T.ShallowWater);

    computeChunkSubgridBlend(chunk, blendGraph);

    // The 4 tiles whose center is ±1 from this point: (4,4), (5,4), (4,5), (5,5)
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

    // Non-adjacent tiles should have NO blend layers
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

  it("uses dedicated pair sheet for grass/water blend", () => {
    const chunk = makeUniformChunk(T.Grass);

    // Single water point at subgrid (10,10)
    chunk.setCorner(5, 5, T.ShallowWater);

    computeChunkSubgridBlend(chunk, blendGraph);

    // Tile (4,4): base = ShallowWater (lower depth), overlay = Grass
    // blendGraph.getBlend(Grass, ShallowWater) → me15 (dedicated)
    const tileOffset = (4 * CHUNK_SIZE + 4) * MAX_BLEND_LAYERS;
    const packed = chunk.blendLayers[tileOffset];
    expect(packed).toBeGreaterThan(0);

    const entry = blendGraph.getBlend(TerrainId.Grass, TerrainId.ShallowWater);
    expect(entry).toBeDefined();
    expect(unpackSheet(packed ?? 0)).toBe(entry?.sheetIndex);
  });

  it("single water subgrid point produces 4 inner concave sprites (tiny pond)", () => {
    const chunk = makeUniformChunk(T.Grass);
    chunk.setCorner(5, 5, T.ShallowWater);

    computeChunkSubgridBlend(chunk, blendGraph);

    // Each tile sees Water in exactly one of 8 directions.
    // Overlay=Grass (direct): 7 of 8 neighbors match → concave corner mask.
    const cases: Array<{
      lx: number;
      ly: number;
      mask: number;
      label: string;
    }> = [
      { lx: 4, ly: 4, mask: 127, label: "concave SE (all except SE)" },
      { lx: 5, ly: 4, mask: 191, label: "concave SW (all except SW)" },
      { lx: 4, ly: 5, mask: 223, label: "concave NE (all except NE)" },
      { lx: 5, ly: 5, mask: 239, label: "concave NW (all except NW)" },
    ];

    for (const { lx, ly, mask, label } of cases) {
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;
      const packed = chunk.blendLayers[tileOffset] ?? 0;
      expect(packed, `${label}: should have blend layer`).toBeGreaterThan(0);
      const sprite = unpackColRow(packed);
      const expected = expectedSprite(mask);
      expect(sprite.col, `${label}: col`).toBe(expected.col);
      expect(sprite.row, `${label}: row`).toBe(expected.row);
    }
  });

  it("tile region paint produces correct edge and corner sprites", () => {
    const chunk = makeUniformChunk(T.Grass);

    // Paint a 2×2 tile block (5,5)-(6,6) as water — fills subgrid (10,10)-(14,14)
    paintTileRegion(chunk, 5, 5, 6, 6, T.ShallowWater);

    computeChunkSubgridBlend(chunk, blendGraph);

    // Inner tiles (5,5), (5,6), (6,5), (6,6) are fully surrounded by water → uniform → no blend
    for (const [lx, ly] of [
      [5, 5],
      [5, 6],
      [6, 5],
      [6, 6],
    ] as const) {
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;
      for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
        expect(chunk.blendLayers[tileOffset + s], `inner tile (${lx},${ly})`).toBe(0);
      }
    }

    // Top edge tile (5,4): S, SW, SE are water → Grass overlay mask = N+W+E+NW+NE = 55
    const topEdge = (4 * CHUNK_SIZE + 5) * MAX_BLEND_LAYERS;
    const topPacked = chunk.blendLayers[topEdge] ?? 0;
    expect(topPacked).toBeGreaterThan(0);
    expect(unpackColRow(topPacked)).toEqual(expectedSprite(55));

    // Left edge tile (4,5): E, NE, SE are water → Grass overlay mask = N+W+S+NW+SW = 91
    const leftEdge = (5 * CHUNK_SIZE + 4) * MAX_BLEND_LAYERS;
    const leftPacked = chunk.blendLayers[leftEdge] ?? 0;
    expect(leftPacked).toBeGreaterThan(0);
    expect(unpackColRow(leftPacked)).toEqual(expectedSprite(91));

    // NW corner tile (4,4): only SE is water → concave SE mask = 127
    const nwCorner = (4 * CHUNK_SIZE + 4) * MAX_BLEND_LAYERS;
    const nwPacked = chunk.blendLayers[nwCorner] ?? 0;
    expect(nwPacked).toBeGreaterThan(0);
    expect(unpackColRow(nwPacked)).toEqual(expectedSprite(127));
  });

  it("alpha overlay only drawn on overlay terrain's own tiles", () => {
    const chunk = makeUniformChunk(T.Grass);

    // Paint a 1×1 tile block (5,5) as Sand → subgrid (10,10)-(12,12)
    paintTileRegion(chunk, 5, 5, 5, 5, T.Sand);

    computeChunkSubgridBlend(chunk, blendGraph);

    // Sand→Grass uses sand alpha fallback (no dedicated pair)
    // Sand(depth 4) is overlay on Grass(depth 2) base
    const entry = blendGraph.getBlend(TerrainId.Sand, TerrainId.Grass);
    expect(entry).toBeDefined();
    expect(entry?.isAlpha).toBe(true);

    // Grass tile (5,4) near Sand: center=Grass, overlay=Sand → alpha NOT drawn
    // (sand alpha skipped because overlay=Sand ≠ center=Grass)
    const grassTileOffset = (4 * CHUNK_SIZE + 5) * MAX_BLEND_LAYERS;
    for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
      expect(chunk.blendLayers[grassTileOffset + s]).toBe(0);
    }

    // Sand tile (5,5) center: all 8 subgrid neighbors are Sand → uniform → no blend
    const sandTileOffset = (5 * CHUNK_SIZE + 5) * MAX_BLEND_LAYERS;
    for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
      expect(chunk.blendLayers[sandTileOffset + s]).toBe(0);
    }
  });

  it("alpha overlay not drawn on different terrain (deep water near grass)", () => {
    const chunk = makeUniformChunk(T.Grass);

    // Paint a 2×2 tile block as DeepWater
    paintTileRegion(chunk, 5, 5, 6, 6, T.DeepWater);

    computeChunkSubgridBlend(chunk, blendGraph);

    // DeepWater has no alpha, and Grass alpha should NOT be drawn on water tiles.
    // Inner DeepWater tiles are uniform → no blend.
    for (const [lx, ly] of [
      [5, 5],
      [5, 6],
      [6, 5],
      [6, 6],
    ] as const) {
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;
      for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
        expect(chunk.blendLayers[tileOffset + s], `deep water tile (${lx},${ly})`).toBe(0);
      }
    }

    // But surrounding Grass tiles should have blend layers (grass alpha softening edges)
    const grassEdgeTile = (4 * CHUNK_SIZE + 5) * MAX_BLEND_LAYERS;
    expect(chunk.blendLayers[grassEdgeTile]).toBeGreaterThan(0);
  });

  it("all TerrainId values treated directly (no BiomeId conversion)", () => {
    // Verify SandLight (TerrainId=3) is NOT misread as BiomeId.Grass(=3)
    // Use ShallowWater + Grass which have dedicated pair sheets in both directions
    const chunk = makeUniformChunk(T.ShallowWater);
    paintTileRegion(chunk, 5, 5, 5, 5, T.Grass);

    computeChunkSubgridBlend(chunk, blendGraph);

    // Tile (5,4): center=ShallowWater, S neighbor is Grass → dedicated pair blend
    const tileOffset = (4 * CHUNK_SIZE + 5) * MAX_BLEND_LAYERS;
    let hasLayer = false;
    for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
      if (chunk.blendLayers[tileOffset + s] !== 0) {
        hasLayer = true;
        break;
      }
    }
    expect(hasLayer).toBe(true);
  });

  it("respects MAX_BLEND_LAYERS cap", () => {
    const chunk = makeUniformChunk(T.Grass);
    computeChunkSubgridBlend(chunk, blendGraph);
    expect(chunk.blendLayers.length).toBe(MAX_BLEND_LAYERS * CHUNK_SIZE * CHUNK_SIZE);
  });

  it("wider region transition with 2 affected tile rows", () => {
    const chunk = makeUniformChunk(T.Grass);

    // Paint two adjacent tiles (5,5) and (6,5) as water → subgrid (10,10)-(14,12)
    paintTileRegion(chunk, 5, 5, 6, 5, T.ShallowWater);

    computeChunkSubgridBlend(chunk, blendGraph);

    // Both inner tiles (5,5) and (6,5) have all 8 neighbors = water → uniform → no blend
    for (const [lx, ly] of [
      [5, 5],
      [6, 5],
    ] as const) {
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;
      for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
        expect(chunk.blendLayers[tileOffset + s]).toBe(0);
      }
    }

    // Adjacent tiles should have blend layers
    const affectedTiles = [
      [4, 4],
      [5, 4],
      [6, 4],
      [7, 4],
      [4, 5],
      [7, 5],
      [4, 6],
      [5, 6],
      [6, 6],
      [7, 6],
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
      expect(hasLayer, `tile (${lx},${ly}) should have blend`).toBe(true);
    }
  });
});
