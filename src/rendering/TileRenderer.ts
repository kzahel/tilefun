import type { Spritesheet } from "../assets/Spritesheet.js";
import type { TileVariants } from "../assets/TileVariants.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { MAX_BLEND_LAYERS } from "../autotile/BlendGraph.js";
import { TerrainId } from "../autotile/TerrainId.js";
import {
  CHUNK_SIZE,
  ELEVATION_PX,
  TILE_SIZE,
  WATER_FRAME_COUNT,
  WATER_FRAME_DURATION_MS,
} from "../config/constants.js";
import { computeRoadCardinalMask, getRoadSprite } from "../road/RoadAutotiler.js";
import { getRoadSheetKey, isRoad, RoadType } from "../road/RoadType.js";
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
  /** Indexed sheets array (index matches BlendEntry.sheetIndex). */
  private blendSheets: Spritesheet[] = [];
  /** BlendGraph for base fill lookups. */
  private blendGraph: BlendGraph | null = null;
  /** Optional tile variants for base fill variety. */
  private variants: TileVariants | null = null;
  /** Road overlay autotile sheets keyed by RoadType. */
  private roadSheetMap = new Map<RoadType, Spritesheet>();

  /** Set the blend sheets and graph for the renderer. */
  setBlendSheets(sheets: Spritesheet[], graph: BlendGraph): void {
    this.blendSheets = sheets;
    this.blendGraph = graph;
  }

  /** Set tile variants for base fill variety. */
  setVariants(variants: TileVariants): void {
    this.variants = variants;
  }

  /** Set road autotile sheets from the loaded sheet map. */
  setRoadSheets(sheets: Map<string, Spritesheet>): void {
    for (const rt of [RoadType.Sidewalk, RoadType.LineWhite, RoadType.LineYellow]) {
      const key = getRoadSheetKey(rt);
      if (key) {
        const sheet = sheets.get(key);
        if (sheet) this.roadSheetMap.set(rt, sheet);
      }
    }
  }

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
    const getGlobalRoad = (tx: number, ty: number) => world.getRoadAt(tx, ty);

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
          this.rebuildCache(chunk, cx, cy, sheets, getGlobalRoad);
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
   * Draw elevation: cliff faces and Y-offset tiles for elevated terrain.
   * Must be called after drawTerrain() so elevated tiles overlay correctly.
   */
  drawElevation(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    world: World,
    visible: ChunkRange,
  ): void {
    const tileScreenSize = TILE_SIZE * camera.scale;

    for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk?.renderCache) continue;

        // Check if chunk has any elevation at all (fast skip)
        let hasElevation = false;
        for (let i = 0; i < chunk.heightGrid.length; i++) {
          if (chunk.heightGrid[i] !== 0) {
            hasElevation = true;
            break;
          }
        }
        if (!hasElevation) continue;

        const origin = chunkToWorld(cx, cy);
        const screenOrigin = camera.worldToScreen(origin.wx, origin.wy);
        const chunkSx = Math.round(screenOrigin.sx);
        const chunkSy = Math.round(screenOrigin.sy);

        // Iterate tiles top-to-bottom for correct overlap
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const h = chunk.getHeight(lx, ly);
            if (h <= 0) continue;

            const tileSx = chunkSx + lx * tileScreenSize;
            const tileSy = chunkSy + ly * tileScreenSize;
            const cliffH = h * ELEVATION_PX * camera.scale;

            // Source rect in chunk cache (native pixels)
            const srcX = lx * TILE_SIZE;
            const srcY = ly * TILE_SIZE;

            // 1. Draw cliff face: stretch bottom 1px row downward
            ctx.drawImage(
              chunk.renderCache,
              srcX,
              srcY + TILE_SIZE - 1,
              TILE_SIZE,
              1,
              tileSx,
              tileSy + tileScreenSize - cliffH,
              tileScreenSize,
              cliffH,
            );

            // Darken the cliff face
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#000";
            ctx.fillRect(tileSx, tileSy + tileScreenSize - cliffH, tileScreenSize, cliffH);
            ctx.globalAlpha = 1;

            // 2. Draw elevated tile shifted up
            ctx.drawImage(
              chunk.renderCache,
              srcX,
              srcY,
              TILE_SIZE,
              TILE_SIZE,
              tileSx,
              tileSy - cliffH,
              tileScreenSize,
              tileScreenSize,
            );

            // 3. Subtle darken on elevated surface so it reads as raised
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = "#000";
            ctx.fillRect(tileSx, tileSy - cliffH, tileScreenSize, tileScreenSize);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }

  /**
   * Rebuild the chunk's OffscreenCanvas cache.
   * Draws: shallow water base → tile base fill → blend layers → details.
   */
  private rebuildCache(
    chunk: Chunk,
    cx: number,
    cy: number,
    sheets: Map<string, Spritesheet>,
    getGlobalRoad?: (tx: number, ty: number) => number,
  ): void {
    if (!chunk.renderCache) {
      chunk.renderCache = new OffscreenCanvas(CHUNK_NATIVE_PX, CHUNK_NATIVE_PX);
    }
    const offCtx = chunk.renderCache.getContext("2d");
    if (!offCtx) return;
    offCtx.imageSmoothingEnabled = false;
    offCtx.clearRect(0, 0, CHUNK_NATIVE_PX, CHUNK_NATIVE_PX);

    const waterSheet = sheets.get("shallowwater");
    const graph = this.blendGraph;
    const variants = this.variants;
    // World tile origin for this chunk
    const baseTx = cx * CHUNK_SIZE;
    const baseTy = cy * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const dx = lx * TILE_SIZE;
        const dy = ly * TILE_SIZE;
        const tileOffset = (ly * CHUNK_SIZE + lx) * MAX_BLEND_LAYERS;

        // 1. Universal shallow water base
        if (waterSheet) {
          waterSheet.drawTile(offCtx, 1, 0, dx, dy, 1);
        }

        // 2. Tile's own terrain base fill (covers water for land tiles).
        //    Use the blend-computed base (accounts for isolated center points).
        //    Blend sprites are opaque 16×16 tiles and fully cover the base fill
        //    wherever a transition exists, so the base only shows on uniform tiles.
        if (graph) {
          const terrainId = chunk.blendBase[ly * CHUNK_SIZE + lx] as TerrainId;
          // Skip base fill for shallow water (already drawn as universal base)
          if (terrainId !== TerrainId.ShallowWater) {
            // Try tile variants first for visual variety
            const groupName = TerrainId[terrainId];
            const drawn =
              variants && groupName
                ? variants.drawVariant(offCtx, groupName, baseTx + lx, baseTy + ly, dx, dy, 1)
                : false;

            // Fall back to uniform base fill from blend graph
            if (!drawn) {
              const baseFill = graph.getBaseFill(terrainId);
              if (baseFill) {
                const baseSheet = this.blendSheets[baseFill.sheetIndex];
                if (baseSheet) {
                  baseSheet.drawTile(offCtx, baseFill.col, baseFill.row, dx, dy, 1);
                }
              }
            }
          }
        }

        // 3. Blend layers in order
        for (let s = 0; s < MAX_BLEND_LAYERS; s++) {
          const packed = chunk.blendLayers[tileOffset + s] ?? 0;
          if (packed === 0) break; // 0 = empty, remaining slots also empty
          const sheetIdx = (packed >> 16) & 0xffff;
          const col = (packed >> 8) & 0xff;
          const row = packed & 0xff;
          const sheet = this.blendSheets[sheetIdx];
          if (sheet) {
            sheet.drawTile(offCtx, col, row, dx, dy, 1);
          }
        }

        // 4. Road layer (asphalt base + overlay autotile)
        const road = chunk.getRoad(lx, ly);
        if (isRoad(road)) {
          // Draw asphalt base fill from complete tileset (col=0, row=5)
          if (variants) {
            variants.sheet.drawTile(offCtx, 0, 5, dx, dy, 1);
          }

          // Draw overlay sprite for non-asphalt road types
          if (road !== RoadType.Asphalt) {
            const overlaySheet = this.roadSheetMap.get(road as RoadType);
            if (overlaySheet && getGlobalRoad) {
              const gtx = baseTx + lx;
              const gty = baseTy + ly;
              const nsew = computeRoadCardinalMask(
                road,
                getGlobalRoad(gtx, gty - 1),
                getGlobalRoad(gtx + 1, gty),
                getGlobalRoad(gtx, gty + 1),
                getGlobalRoad(gtx - 1, gty),
              );
              const { col, row } = getRoadSprite(nsew);
              overlaySheet.drawTile(offCtx, col, row, dx, dy, 1);
            }
          }
        }

        // 5. Detail layer on top
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
