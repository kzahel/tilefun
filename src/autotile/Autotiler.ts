import { CHUNK_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { BlendGraph } from "./BlendGraph.js";
import { MAX_BLEND_LAYERS } from "./BlendGraph.js";
import { computeTileBlend } from "./computeTileBlend.js";
import { toBaseTerrainId } from "./TerrainId.js";

export { AutotileBit, canonicalize } from "./bitmask.js";
export type { BlendLayer, TileBlendResult } from "./computeTileBlend.js";
export { computeDirectMask, computeTileBlend } from "./computeTileBlend.js";

/** Packed blend layer: (sheetIndex << 16) | (col << 8) | row */
function packBlend(sheetIndex: number, col: number, row: number): number {
  return (sheetIndex << 16) | (col << 8) | row;
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

      const result = computeTileBlend(
        chunk.getSubgrid(cx, cy),
        toBaseTerrainId(chunk.getSubgrid(cx, cy - 1)),
        toBaseTerrainId(chunk.getSubgrid(cx + 1, cy - 1)),
        toBaseTerrainId(chunk.getSubgrid(cx + 1, cy)),
        toBaseTerrainId(chunk.getSubgrid(cx + 1, cy + 1)),
        toBaseTerrainId(chunk.getSubgrid(cx, cy + 1)),
        toBaseTerrainId(chunk.getSubgrid(cx - 1, cy + 1)),
        toBaseTerrainId(chunk.getSubgrid(cx - 1, cy)),
        toBaseTerrainId(chunk.getSubgrid(cx - 1, cy - 1)),
        blendGraph,
      );

      // Pack into chunk.blendLayers
      const count = Math.min(result.layers.length, MAX_BLEND_LAYERS);
      for (let i = 0; i < count; i++) {
        const layer = result.layers[i];
        if (layer) {
          chunk.blendLayers[tileOffset + i] = packBlend(layer.sheetIndex, layer.col, layer.row);
        }
      }
    }
  }
}
