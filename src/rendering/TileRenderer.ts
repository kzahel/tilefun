import type { Spritesheet } from "../assets/Spritesheet.js";
import { TERRAIN_LAYERS } from "../autotile/TerrainLayers.js";
import {
  CHUNK_SIZE,
  TILE_SIZE,
  WATER_FRAME_COUNT,
  WATER_FRAME_DURATION_MS,
} from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { getTileDef, TileId } from "../world/TileRegistry.js";
import { chunkToWorld } from "../world/types.js";
import type { World } from "../world/World.js";
import type { Camera } from "./Camera.js";

const CHUNK_NATIVE_PX = CHUNK_SIZE * TILE_SIZE;

/** Compute the current water animation frame index from a timestamp. */
export function getWaterFrame(nowMs: number): number {
  return Math.floor(nowMs / WATER_FRAME_DURATION_MS) % WATER_FRAME_COUNT;
}

/**
 * Chunk-cached tile renderer. Each chunk is pre-rendered to an OffscreenCanvas
 * at native resolution (256x256), then drawn scaled to the main canvas.
 * Includes both terrain (with autotile) and detail layers in the cache.
 */
export class TileRenderer {
  /**
   * Draw all visible chunks from their cached OffscreenCanvas.
   * All layers (water base, autotile, details) are baked into the cache.
   */
  drawTerrain(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    world: World,
    sheets: Map<string, Spritesheet>,
    visible: ChunkRange,
  ): void {
    const chunkScreenSize = CHUNK_SIZE * TILE_SIZE * camera.scale;

    for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk) continue;
        const origin = chunkToWorld(cx, cy);
        const screenOrigin = camera.worldToScreen(origin.wx, origin.wy);

        const sx = Math.round(screenOrigin.sx);
        const sy = Math.round(screenOrigin.sy);

        // Chunk-level frustum cull
        if (
          sx + chunkScreenSize < 0 ||
          sy + chunkScreenSize < 0 ||
          sx > ctx.canvas.width ||
          sy > ctx.canvas.height
        ) {
          continue;
        }

        // Rebuild cache if stale or missing
        if (chunk.dirty || !chunk.renderCache) {
          this.rebuildCache(chunk, sheets);
          chunk.dirty = false;
        }

        if (chunk.renderCache) {
          // Draw 1px oversize to prevent sub-pixel seams between chunks
          ctx.drawImage(chunk.renderCache, sx, sy, chunkScreenSize + 1, chunkScreenSize + 1);
        }
      }
    }
  }

  /**
   * Rebuild the chunk's OffscreenCanvas cache.
   * Draws shallow water base (from ME #16 sheet), then autotile layers, then details.
   */
  private rebuildCache(chunk: Chunk, sheets: Map<string, Spritesheet>): void {
    if (!chunk.renderCache) {
      chunk.renderCache = new OffscreenCanvas(CHUNK_NATIVE_PX, CHUNK_NATIVE_PX);
    }
    const offCtx = chunk.renderCache.getContext("2d");
    if (!offCtx) return;
    offCtx.imageSmoothingEnabled = false;
    offCtx.clearRect(0, 0, CHUNK_NATIVE_PX, CHUNK_NATIVE_PX);

    // ME sheet #3 (water_shallow/grass): (1,0) = mask 255 = solid shallow water fill
    const waterSheet = sheets.get("shallowwater");

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const dx = lx * TILE_SIZE;
        const dy = ly * TILE_SIZE;
        const idx = ly * CHUNK_SIZE + lx;

        // Shallow water base under all tiles (opaque autotile covers it for land)
        if (waterSheet) {
          waterSheet.drawTile(offCtx, 1, 0, dx, dy, 1);
        }

        // Draw each autotile layer in order
        for (let layerIdx = 0; layerIdx < TERRAIN_LAYERS.length; layerIdx++) {
          const packed = chunk.autotileLayers[layerIdx]?.[idx] ?? 0;
          if (packed > 0) {
            const layer = TERRAIN_LAYERS[layerIdx];
            if (!layer) continue;
            const sheet = sheets.get(layer.sheetKey);
            if (sheet) {
              const col = packed & 0xff;
              const row = packed >> 8;
              sheet.drawTile(offCtx, col, row, dx, dy, 1);
            }
          }
        }

        // Detail layer on top
        const detailId = chunk.getDetail(lx, ly);
        if (detailId !== TileId.Empty) {
          const def = getTileDef(detailId);
          if (def) {
            const sheet = sheets.get(def.sheetKey);
            if (sheet) {
              sheet.drawTile(offCtx, def.spriteCol, def.spriteRow, dx, dy, 1);
            }
          }
        }
      }
    }
  }
}
