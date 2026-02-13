import type { BlendGraph } from "./BlendGraph.js";
import { AutotileBit, canonicalize, convexify } from "./bitmask.js";
import { GM_BLOB_LOOKUP } from "./gmBlobLayout.js";
import {
  getBaseSelectionMode,
  getForceConvex,
  getPreferredPartner,
  isOverlayPreferred,
  TERRAIN_COUNT,
  TERRAIN_DEPTH,
  type TerrainId,
  toBaseTerrainId,
} from "./TerrainId.js";

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
  centerRaw: number,
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
  const center = toBaseTerrainId(centerRaw);
  const preferredPartner = getPreferredPartner(centerRaw);

  // Gather unique terrains
  const seen = new Uint8Array(TERRAIN_COUNT);
  seen[center] = 1;
  const all: TerrainId[] = [center];
  for (const t of [n, ne, e, se, s, sw, w, nw]) {
    if (!seen[t]) {
      seen[t] = 1;
      all.push(t);
    }
  }

  // Detect "isolated center": center terrain has no matching cardinal neighbors.
  // Such a center can never produce a visible overlay mask (canonicalize strips
  // unsupported diagonals → mask=0). Exclude it from base selection so it doesn't
  // become an invisible base hidden under a full-coverage neighbor overlay.
  let centerCardinals = 0;
  if (n === center) centerCardinals++;
  if (e === center) centerCardinals++;
  if (s === center) centerCardinals++;
  if (w === center) centerCardinals++;
  const centerIsolated = centerCardinals === 0 && all.length > 1;

  // Find base terrain (the background fill that overlays are drawn on top of).
  // When center is isolated, exclude it from candidates (it will be added as
  // an "island" overlay after the normal blend computation).
  const baseCandidates = centerIsolated ? all.filter((t) => t !== center) : all;

  let base: TerrainId;
  if (getBaseSelectionMode() === "nw") {
    base = nw;
  } else {
    // Score each candidate: prefer the terrain that the most other terrains
    // have dedicated (non-alpha) blend entries against. This uses the
    // BlendGraph's per-pair direction instead of relying solely on depth.
    // TERRAIN_DEPTH is only a tiebreaker.
    base = baseCandidates[0] ?? nw;
    let bestScore = -1;
    for (const candidate of baseCandidates) {
      let score = 0;
      for (const other of baseCandidates) {
        if (other === candidate) continue;
        const entry = blendGraph.getBlend(other, candidate);
        if (entry && !entry.isAlpha) score += 2;
        else if (entry) score += 1;
      }
      // Preference boost: if center has a preferred partner, strongly prefer it as base
      if (preferredPartner !== undefined && candidate === preferredPartner) {
        score += 10;
      }
      // Overlay preference: penalize center terrain as base so it becomes overlay
      if (isOverlayPreferred(centerRaw) && candidate === center) {
        score -= 10;
      }
      if (
        score > bestScore ||
        (score === bestScore && TERRAIN_DEPTH[candidate] < TERRAIN_DEPTH[base])
      ) {
        bestScore = score;
        base = candidate;
      }
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
    let mask = canonicalize(rawMask);
    if (getForceConvex()) mask = convexify(mask);
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

  // Isolated center: add the center terrain as an "island" overlay drawn on top.
  // Uses GM blob mask=0 sprite (col=11, row=3) — a small rounded terrain blob.
  if (centerIsolated && center !== base) {
    const entry = blendGraph.getBlend(center, base);
    if (entry) {
      const islandSprite = GM_BLOB_LOOKUP[0] ?? 0;
      layers.push({
        sheetIndex: entry.sheetIndex,
        sheetKey: entry.sheetKey,
        assetPath: entry.assetPath,
        col: islandSprite & 0xff,
        row: islandSprite >> 8,
        isAlpha: entry.isAlpha,
        rawMask: 0,
        mask: 0,
        terrain: center,
        depth: TERRAIN_DEPTH[center],
      });
    }
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
