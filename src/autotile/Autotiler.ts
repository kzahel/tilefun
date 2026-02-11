import { CHUNK_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { TileId } from "../world/TileRegistry.js";
import { AutotileBit } from "./bitmask.js";
import { GM_BLOB_LOOKUP } from "./gmBlobLayout.js";
import { TERRAIN_LAYERS } from "./TerrainLayers.js";

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
    const layer = TERRAIN_LAYERS[layerIdx]!;
    const cache = chunk.autotileLayers[layerIdx]!;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tileId = chunk.getTerrain(lx, ly);
        const idx = ly * CHUNK_SIZE + lx;
        if (layer.appliesTo(tileId)) {
          const tx = baseX + lx;
          const ty = baseY + ly;
          const mask = computeMask(tx, ty, getTerrain, layer.isInGroup);
          cache[idx] = GM_BLOB_LOOKUP[mask & 0xff]!;
        } else {
          cache[idx] = 0;
        }
      }
    }
  }
}
