import { getBaseSelectionMode, TERRAIN_DEPTH, type TerrainId } from "./TerrainId.js";

/**
 * Derive a tile's terrain from its 4 corner TerrainIds.
 * In "depth" mode: returns the lowest-depth terrain (original behavior).
 * In "nw" mode: returns the NW corner (no depth concept).
 */
export function deriveTerrainIdFromCorners(
  nw: TerrainId,
  ne: TerrainId,
  sw: TerrainId,
  se: TerrainId,
): TerrainId {
  if (nw === ne && ne === sw && sw === se) return nw;

  if (getBaseSelectionMode() === "nw") return nw;

  let base = nw;
  if (TERRAIN_DEPTH[ne] < TERRAIN_DEPTH[base]) base = ne;
  if (TERRAIN_DEPTH[sw] < TERRAIN_DEPTH[base]) base = sw;
  if (TERRAIN_DEPTH[se] < TERRAIN_DEPTH[base]) base = se;
  return base;
}
