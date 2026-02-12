import { CHUNK_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { BlendGraph } from "./BlendGraph.js";
import { MAX_BLEND_LAYERS } from "./BlendGraph.js";
import { AutotileBit, canonicalize } from "./bitmask.js";
import { GM_BLOB_LOOKUP } from "./gmBlobLayout.js";
import { getBaseSelectionMode, TERRAIN_DEPTH, type TerrainId } from "./TerrainId.js";

export { AutotileBit, canonicalize } from "./bitmask.js";

/** Packed blend layer: (sheetIndex << 16) | (col << 8) | row */
function packBlend(sheetIndex: number, col: number, row: number): number {
  return (sheetIndex << 16) | (col << 8) | row;
}

/**
 * Compute direct 8-bit mask: which of 8 subgrid neighbors match the target terrain?
 * Reads each of 8 subgrid neighbor directions independently from the 33×33 subgrid.
 */
function computeDirectMask(
  n: number,
  ne: number,
  e: number,
  se: number,
  s: number,
  sw: number,
  w: number,
  nw: number,
  terrain: number,
): number {
  let mask = 0;
  if (n === terrain) mask |= AutotileBit.N;
  if (w === terrain) mask |= AutotileBit.W;
  if (e === terrain) mask |= AutotileBit.E;
  if (s === terrain) mask |= AutotileBit.S;
  if (nw === terrain) mask |= AutotileBit.NW;
  if (ne === terrain) mask |= AutotileBit.NE;
  if (sw === terrain) mask |= AutotileBit.SW;
  if (se === terrain) mask |= AutotileBit.SE;
  return mask;
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
 * Compute per-tile blend layers from the chunk's 33×33 subgrid.
 *
 * For each tile (lx, ly), reads its 8 surrounding subgrid neighbors at
 * (2*lx+1 ± 1, 2*ly+1 ± 1). Each direction is tested independently,
 * giving all 47 canonical GM blob shapes (vs 16 from the old 4-corner approach).
 *
 * @param blendGraph - The blend sheet selection graph.
 */
export function computeChunkSubgridBlend(chunk: Chunk, blendGraph: BlendGraph): void {
  const layers: TileLayer[] = [];
  const seen = new Uint8Array(8);

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;

      // Clear blend layer slots for this tile
      for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
        chunk.blendLayers[tileOffset + s] = 0;
      }

      // Subgrid center of this tile
      const cx = 2 * lx + 1;
      const cy = 2 * ly + 1;

      // Read center + 8 neighbors from subgrid
      const center = chunk.getSubgrid(cx, cy) as TerrainId;
      const nb_n = chunk.getSubgrid(cx, cy - 1) as TerrainId;
      const nb_ne = chunk.getSubgrid(cx + 1, cy - 1) as TerrainId;
      const nb_e = chunk.getSubgrid(cx + 1, cy) as TerrainId;
      const nb_se = chunk.getSubgrid(cx + 1, cy + 1) as TerrainId;
      const nb_s = chunk.getSubgrid(cx, cy + 1) as TerrainId;
      const nb_sw = chunk.getSubgrid(cx - 1, cy + 1) as TerrainId;
      const nb_w = chunk.getSubgrid(cx - 1, cy) as TerrainId;
      const nb_nw = chunk.getSubgrid(cx - 1, cy - 1) as TerrainId;

      // Gather unique terrains from center + 8 neighbors
      seen.fill(0);
      seen[center] = 1;
      const all: TerrainId[] = [center];
      for (const t of [nb_n, nb_ne, nb_e, nb_se, nb_s, nb_sw, nb_w, nb_nw]) {
        if (!seen[t]) {
          seen[t] = 1;
          all.push(t);
        }
      }

      // Skip uniform tiles — no blend needed
      if (all.length === 1) continue;

      // Find base terrain
      let base: TerrainId;
      if (getBaseSelectionMode() === "nw") {
        base = nb_nw;
      } else {
        base = center;
        for (const t of all) {
          if (TERRAIN_DEPTH[t] < TERRAIN_DEPTH[base]) base = t;
        }
      }

      // Collect overlay terrains (not base), sorted by depth ascending
      const overlays = all.filter((t) => t !== base);
      if (getBaseSelectionMode() === "depth") {
        overlays.sort((a, b) => TERRAIN_DEPTH[a] - TERRAIN_DEPTH[b]);
      }

      // Build blend layers
      layers.length = 0;

      for (const overlay of overlays) {
        const entry = blendGraph.getBlend(overlay, base);
        if (!entry) continue;

        let rawMask: number;
        if (entry.inverted) {
          // Inverted: mask shows where BASE is present
          rawMask = computeDirectMask(nb_n, nb_ne, nb_e, nb_se, nb_s, nb_sw, nb_w, nb_nw, base);
        } else {
          // Direct: mask shows where OVERLAY is present
          rawMask = computeDirectMask(nb_n, nb_ne, nb_e, nb_se, nb_s, nb_sw, nb_w, nb_nw, overlay);
        }

        const mask = canonicalize(rawMask);
        // Skip degenerate masks: mask=0 means a lone diagonal with no adjacent
        // cardinals (invisible in the subgrid system).
        if (mask === 0) continue;

        const sprite = GM_BLOB_LOOKUP[mask & 0xff] ?? 0;
        const col = sprite & 0xff;
        const row = sprite >> 8;
        layers.push({
          packed: packBlend(entry.sheetIndex, col, row),
          category: entry.isAlpha ? 2 : 1,
          depth: TERRAIN_DEPTH[overlay],
        });
      }

      // Sort: dedicated pairs (cat 1) → alpha (cat 2); within category, by depth
      if (getBaseSelectionMode() === "depth") {
        layers.sort((a, b) => a.category - b.category || a.depth - b.depth);
      } else {
        layers.sort((a, b) => a.category - b.category);
      }

      // Pack into chunk.blendLayers
      const count = Math.min(layers.length, MAX_BLEND_LAYERS);
      for (let i = 0; i < count; i++) {
        chunk.blendLayers[tileOffset + i] = layers[i]?.packed ?? 0;
      }
    }
  }
}
