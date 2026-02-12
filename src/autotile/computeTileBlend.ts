import type { BlendGraph } from "./BlendGraph.js";
import { AutotileBit, canonicalize } from "./bitmask.js";
import { GM_BLOB_LOOKUP } from "./gmBlobLayout.js";
import { getBaseSelectionMode, TERRAIN_DEPTH, type TerrainId } from "./TerrainId.js";

/** Rich per-tile blend layer info, usable by both game rendering and demo display. */
export interface BlendLayer {
  sheetIndex: number;
  sheetKey: string;
  assetPath: string;
  col: number;
  row: number;
  isAlpha: boolean;
  rawMask: number;
  mask: number;
  terrain: TerrainId;
  depth: number;
}

export interface TileBlendResult {
  base: TerrainId;
  layers: BlendLayer[];
}

/**
 * Compute direct 8-bit mask: which of 8 neighbors match the target terrain?
 */
export function computeDirectMask(
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

/**
 * Compute blend layers for a single tile given its center terrain and 8 neighbors.
 *
 * This is the shared algorithm used by both the game (via computeChunkSubgridBlend)
 * and the interactive demo. Changes here affect both.
 */
export function computeTileBlend(
  center: TerrainId,
  n: TerrainId,
  ne: TerrainId,
  e: TerrainId,
  se: TerrainId,
  s: TerrainId,
  sw: TerrainId,
  w: TerrainId,
  nw: TerrainId,
  blendGraph: BlendGraph,
): TileBlendResult {
  // Gather unique terrains
  const seen = new Uint8Array(8);
  seen[center] = 1;
  const all: TerrainId[] = [center];
  for (const t of [n, ne, e, se, s, sw, w, nw]) {
    if (!seen[t]) {
      seen[t] = 1;
      all.push(t);
    }
  }

  // Find base terrain
  let base: TerrainId;
  if (getBaseSelectionMode() === "nw") {
    base = nw;
  } else {
    base = center;
    for (const t of all) {
      if (TERRAIN_DEPTH[t] < TERRAIN_DEPTH[base]) base = t;
    }
  }

  // Uniform tile — no blend needed
  if (all.length === 1) return { base, layers: [] };

  // Collect overlay terrains (not base), sorted by depth ascending
  const overlays = all.filter((t) => t !== base);
  if (getBaseSelectionMode() === "depth") {
    overlays.sort((a, b) => TERRAIN_DEPTH[a] - TERRAIN_DEPTH[b]);
  }

  // Build blend layers
  const layers: BlendLayer[] = [];

  for (const overlay of overlays) {
    const entry = blendGraph.getBlend(overlay, base);
    if (!entry) continue;

    // Alpha overlays only make sense on the overlay terrain's own tile.
    // Drawing grass alpha on a water tile (or vice versa) covers the wrong terrain.
    if (entry.isAlpha && overlay !== center) continue;

    const rawMask = computeDirectMask(n, ne, e, se, s, sw, w, nw, overlay);
    const mask = canonicalize(rawMask);
    // Skip degenerate masks: mask=0 means a lone diagonal with no adjacent
    // cardinals (invisible in the subgrid system).
    if (mask === 0) continue;

    const sprite = GM_BLOB_LOOKUP[mask & 0xff] ?? 0;
    const col = sprite & 0xff;
    const row = sprite >> 8;

    layers.push({
      sheetIndex: entry.sheetIndex,
      sheetKey: entry.sheetKey,
      assetPath: entry.assetPath,
      col,
      row,
      isAlpha: entry.isAlpha,
      rawMask,
      mask,
      terrain: overlay,
      depth: TERRAIN_DEPTH[overlay],
    });
  }

  // Sort: dedicated pairs (cat 1) → alpha (cat 2); within category, by depth
  if (getBaseSelectionMode() === "depth") {
    layers.sort((a, b) => {
      const catA = a.isAlpha ? 2 : 1;
      const catB = b.isAlpha ? 2 : 1;
      return catA - catB || a.depth - b.depth;
    });
  } else {
    layers.sort((a, b) => {
      const catA = a.isAlpha ? 2 : 1;
      const catB = b.isAlpha ? 2 : 1;
      return catA - catB;
    });
  }

  return { base, layers };
}
