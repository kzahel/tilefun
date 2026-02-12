import { CHUNK_SIZE } from "../config/constants.js";
import type { BiomeId } from "../generation/BiomeMapper.js";
import type { Chunk } from "../world/Chunk.js";
import type { TileId } from "../world/TileRegistry.js";
import type { BlendGraph } from "./BlendGraph.js";
import { MAX_BLEND_LAYERS } from "./BlendGraph.js";
import { AutotileBit } from "./bitmask.js";
import { computeCornerMask } from "./CornerBlend.js";
import { GM_BLOB_LOOKUP } from "./gmBlobLayout.js";
import { TERRAIN_DEPTH, type TerrainId } from "./TerrainId.js";
import { TERRAIN_LAYERS } from "./TerrainLayers.js";
import { biomeIdToTerrainId, tileIdToTerrainId } from "./terrainMapping.js";

export { AutotileBit, canonicalize } from "./bitmask.js";

/**
 * Compute the 8-bit blob bitmask for a tile at global position (tx, ty).
 * Queries neighbors via the provided callback. Diagonal bits are only set
 * when both adjacent cardinals are also in the group.
 */
export function computeMask(
  tx: number,
  ty: number,
  getTerrain: (tx: number, ty: number) => TileId,
  isInGroup: (tileId: TileId) => boolean,
): number {
  let mask = 0;

  const n = isInGroup(getTerrain(tx, ty - 1));
  const w = isInGroup(getTerrain(tx - 1, ty));
  const e = isInGroup(getTerrain(tx + 1, ty));
  const s = isInGroup(getTerrain(tx, ty + 1));

  if (n) mask |= AutotileBit.N;
  if (w) mask |= AutotileBit.W;
  if (e) mask |= AutotileBit.E;
  if (s) mask |= AutotileBit.S;

  if (n && w && isInGroup(getTerrain(tx - 1, ty - 1))) mask |= AutotileBit.NW;
  if (n && e && isInGroup(getTerrain(tx + 1, ty - 1))) mask |= AutotileBit.NE;
  if (s && w && isInGroup(getTerrain(tx - 1, ty + 1))) mask |= AutotileBit.SW;
  if (s && e && isInGroup(getTerrain(tx + 1, ty + 1))) mask |= AutotileBit.SE;

  return mask;
}

/**
 * Compute autotile for all layers of a chunk.
 * Fills chunk.autotileLayers[layerIndex] for each defined terrain layer.
 *
 * @param getTerrain - Returns terrain TileId at global tile coords.
 *   Should NOT create new chunks (use a "safe" variant).
 */
export function computeChunkAllLayers(
  chunk: Chunk,
  cx: number,
  cy: number,
  getTerrain: (tx: number, ty: number) => TileId,
): void {
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;

  for (let layerIdx = 0; layerIdx < TERRAIN_LAYERS.length; layerIdx++) {
    const layer = TERRAIN_LAYERS[layerIdx];
    const cache = chunk.autotileLayers[layerIdx];
    if (!layer || !cache) continue;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tileId = chunk.getTerrain(lx, ly);
        const idx = ly * CHUNK_SIZE + lx;
        if (layer.appliesTo(tileId)) {
          const tx = baseX + lx;
          const ty = baseY + ly;
          const mask = computeMask(tx, ty, getTerrain, layer.isInGroup);
          cache[idx] = GM_BLOB_LOOKUP[mask & 0xff] ?? 0;
        } else {
          cache[idx] = 0;
        }
      }
    }
  }
}

/** Packed blend layer: (sheetIndex << 16) | (col << 8) | row */
function packBlend(sheetIndex: number, col: number, row: number): number {
  return (sheetIndex << 16) | (col << 8) | row;
}

/** Temporary per-tile layer for sorting before packing. */
interface TileLayer {
  packed: number;
  /** 0=background fill, 1=dedicated pair, 2=alpha overlay */
  category: number;
  /** Depth-based sort key within category. */
  depth: number;
}

/**
 * Compute per-tile blend layers from chunk corners (corner-based, no fan-out).
 *
 * For each tile, reads its 4 corners (currently BiomeId, converted to TerrainId),
 * finds the base terrain (lowest depth), and for each overlay terrain computes
 * a corner-based mask using computeCornerMask. No neighbor tiles are consulted —
 * transitions are self-contained within mixed-corner tiles.
 *
 * @param blendGraph - The blend sheet selection graph.
 */
export function computeChunkCornerBlend(chunk: Chunk, blendGraph: BlendGraph): void {
  const layers: TileLayer[] = [];
  const seen = new Uint8Array(8);

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;

      // Clear blend layer slots for this tile
      for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
        chunk.blendLayers[tileOffset + s] = 0;
      }

      // Read corners and convert BiomeId → TerrainId
      const nw = biomeIdToTerrainId(chunk.getCorner(lx, ly) as BiomeId);
      const ne = biomeIdToTerrainId(chunk.getCorner(lx + 1, ly) as BiomeId);
      const sw = biomeIdToTerrainId(chunk.getCorner(lx, ly + 1) as BiomeId);
      const se = biomeIdToTerrainId(chunk.getCorner(lx + 1, ly + 1) as BiomeId);

      // Skip uniform tiles — no blend needed
      if (nw === ne && ne === sw && sw === se) continue;

      // Find base terrain (lowest depth)
      let base = nw;
      if (TERRAIN_DEPTH[ne] < TERRAIN_DEPTH[base]) base = ne;
      if (TERRAIN_DEPTH[sw] < TERRAIN_DEPTH[base]) base = sw;
      if (TERRAIN_DEPTH[se] < TERRAIN_DEPTH[base]) base = se;

      // Collect unique overlay terrains (not base), sorted by depth ascending
      seen.fill(0);
      seen[base] = 1;
      const overlays: TerrainId[] = [];
      for (const t of [nw, ne, sw, se]) {
        if (!seen[t]) {
          seen[t] = 1;
          overlays.push(t);
        }
      }
      overlays.sort((a, b) => TERRAIN_DEPTH[a] - TERRAIN_DEPTH[b]);

      // Build blend layers
      layers.length = 0;

      for (const overlay of overlays) {
        const entry = blendGraph.getBlend(overlay, base);
        if (!entry) continue;

        let mask: number;
        if (entry.inverted) {
          // Inverted: mask shows where BASE is present
          mask = computeCornerMask(nw === base, ne === base, sw === base, se === base);
          // Skip degenerate: base everywhere (255) or base nowhere (0)
          if (mask === 0 || mask === 255) continue;
        } else {
          // Direct: mask shows where OVERLAY is present
          mask = computeCornerMask(nw === overlay, ne === overlay, sw === overlay, se === overlay);
        }

        const sprite = GM_BLOB_LOOKUP[mask & 0xff] ?? 0;
        const col = sprite & 0xff;
        const row = sprite >> 8;
        layers.push({
          packed: packBlend(entry.sheetIndex, col, row),
          category: entry.isAlpha ? 2 : 1,
          depth: TERRAIN_DEPTH[overlay],
        });
      }

      // Sort: dedicated pairs (cat 1, by depth asc) → alpha (cat 2, by depth asc)
      layers.sort((a, b) => a.category - b.category || a.depth - b.depth);

      // Pack into chunk.blendLayers
      const count = Math.min(layers.length, MAX_BLEND_LAYERS);
      for (let i = 0; i < count; i++) {
        chunk.blendLayers[tileOffset + i] = layers[i]?.packed ?? 0;
      }
    }
  }
}

/**
 * @legacy Compute per-tile blend layers for a chunk using the graph renderer.
 *
 * For each tile, finds unique neighbor terrains, selects blend sheets
 * (dedicated pair or alpha fallback), computes independent masks, and
 * packs results into chunk.blendLayers.
 *
 * @param getTerrain - Returns terrain TileId at global tile coords.
 *   Should NOT create new chunks.
 * @param blendGraph - The blend sheet selection graph.
 */
export function computeChunkBlendLayers(
  chunk: Chunk,
  cx: number,
  cy: number,
  getTerrain: (tx: number, ty: number) => TileId,
  blendGraph: BlendGraph,
): void {
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;

  // Reusable buffers to avoid per-tile allocations
  const neighborSet = new Uint8Array(8); // TerrainId values found in neighborhood
  let neighborCount = 0;
  const layers: TileLayer[] = [];

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const tileId = chunk.getTerrain(lx, ly);
      const myTerrain = tileIdToTerrainId(tileId);
      const tx = baseX + lx;
      const ty = baseY + ly;
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;

      // Clear blend layer slots for this tile
      for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
        chunk.blendLayers[tileOffset + s] = 0;
      }

      // Find unique neighbor terrains
      neighborCount = 0;
      const seen = new Uint8Array(8); // bitmap: seen[terrainId] = 1
      let hasAlphaFallback = false;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nt = tileIdToTerrainId(getTerrain(tx + dx, ty + dy));
          if (nt !== myTerrain && !seen[nt]) {
            seen[nt] = 1;
            neighborSet[neighborCount++] = nt;
          }
        }
      }

      if (neighborCount === 0) continue; // Uniform neighborhood

      // Build layers
      layers.length = 0;

      for (let ni = 0; ni < neighborCount; ni++) {
        const neighborTerrain = neighborSet[ni] as TerrainId;
        const entry = blendGraph.getBlend(myTerrain, neighborTerrain);
        if (!entry) continue;

        if (!entry.isAlpha) {
          // Dedicated pair (direct or inverted)
          let mask: number;
          if (entry.inverted) {
            // Inverted: bits set where neighborTerrain IS present
            mask = computeMask(
              tx,
              ty,
              getTerrain,
              (id) => tileIdToTerrainId(id) === neighborTerrain,
            );
            // Skip degenerate masks for inverted sheets
            if (mask === 0 || mask === 255) continue;
          } else {
            // Direct: bits set where my terrain IS present
            mask = computeMask(tx, ty, getTerrain, (id) => tileIdToTerrainId(id) === myTerrain);
          }
          const sprite = GM_BLOB_LOOKUP[mask & 0xff] ?? 0;
          const col = sprite & 0xff;
          const row = sprite >> 8;
          layers.push({
            packed: packBlend(entry.sheetIndex, col, row),
            category: 1, // dedicated pair
            depth: TERRAIN_DEPTH[neighborTerrain],
          });
        } else {
          // Alpha fallback — need background fill for deeper neighbors
          hasAlphaFallback = true;
          if (TERRAIN_DEPTH[neighborTerrain] < TERRAIN_DEPTH[myTerrain]) {
            // Draw neighbor's base fill as background layer (depth-based mask)
            const neighborDepth = TERRAIN_DEPTH[neighborTerrain];
            const bgMask = computeMask(tx, ty, getTerrain, (id) => {
              const d = TERRAIN_DEPTH[tileIdToTerrainId(id)];
              return d >= neighborDepth;
            });
            const baseFill = blendGraph.getBaseFill(neighborTerrain);
            if (baseFill) {
              // Use the base fill sheet but at the masked sprite position
              const bgSprite = GM_BLOB_LOOKUP[bgMask & 0xff] ?? 0;
              const bgCol = bgSprite & 0xff;
              const bgRow = bgSprite >> 8;
              layers.push({
                packed: packBlend(baseFill.sheetIndex, bgCol, bgRow),
                category: 0, // background fill
                depth: neighborDepth,
              });
            }
          }
        }
      }

      // Add single alpha overlay for the tile's own terrain (if any alpha fallbacks)
      if (hasAlphaFallback) {
        const alpha = blendGraph.getAlpha(myTerrain);
        if (alpha) {
          // Alpha mask: only my terrain is "in group" — fades at ALL foreign edges
          const alphaMask = computeMask(
            tx,
            ty,
            getTerrain,
            (id) => tileIdToTerrainId(id) === myTerrain,
          );
          const alphaSprite = GM_BLOB_LOOKUP[alphaMask & 0xff] ?? 0;
          const alphaCol = alphaSprite & 0xff;
          const alphaRow = alphaSprite >> 8;
          layers.push({
            packed: packBlend(alpha.sheetIndex, alphaCol, alphaRow),
            category: 2, // alpha overlay
            depth: TERRAIN_DEPTH[myTerrain],
          });
        }
      }

      // Sort: background fills (cat 0, by depth asc) → dedicated pairs (cat 1, by depth asc) → alpha (cat 2)
      layers.sort((a, b) => a.category - b.category || a.depth - b.depth);

      // Pack into chunk.blendLayers
      const count = Math.min(layers.length, MAX_BLEND_LAYERS);
      for (let i = 0; i < count; i++) {
        chunk.blendLayers[tileOffset + i] = layers[i]?.packed ?? 0;
      }
    }
  }
}
