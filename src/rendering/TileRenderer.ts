import type { Spritesheet } from "../assets/Spritesheet.js";
import type { TileVariants } from "../assets/TileVariants.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { MAX_BLEND_LAYERS } from "../autotile/BlendGraph.js";
import { TerrainId } from "../autotile/TerrainId.js";
import {
  CHUNK_SIZE,
  ELEVATION_PX,
  MAX_CHUNK_CACHE_ROWS_PER_FRAME,
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
import type { ElevationItem } from "./SceneItem.js";

const CHUNK_NATIVE_PX = CHUNK_SIZE * TILE_SIZE;

interface CacheBuildState {
  canvas: OffscreenCanvas;
  nextRowOrderIdx: number;
  revision: number;
  rowOrder: number[];
}

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
  /** Progressive chunk cache rebuilds in progress (keyed by "cx,cy"). */
  private cacheBuildStates = new Map<string, CacheBuildState>();

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
    let rowsRemaining = MAX_CHUNK_CACHE_ROWS_PER_FRAME;
    const visibleKeys = new Set<string>();
    const centerWy = camera.y;

    for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk) continue;
        const key = `${cx},${cy}`;
        visibleKeys.add(key);
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

        // Rebuild cache incrementally to avoid single-frame spikes.
        if ((chunk.dirty || !chunk.renderCache) && rowsRemaining > 0) {
          const chunkOriginWy = origin.wy;
          const focalRow = Math.max(
            0,
            Math.min(CHUNK_SIZE - 1, Math.floor((centerWy - chunkOriginWy) / TILE_SIZE)),
          );
          rowsRemaining = this.advanceCacheBuild(
            key,
            chunk,
            cx,
            cy,
            sheets,
            rowsRemaining,
            focalRow,
            getGlobalRoad,
          );
        }

        const drawCache = chunk.renderCache ?? this.cacheBuildStates.get(key)?.canvas;
        if (drawCache) {
          // Draw 1px oversize to prevent sub-pixel seams between chunks
          ctx.drawImage(drawCache, sx, sy, chunkScreenSize + 1, chunkScreenSize + 1);
        }
      }
    }

    for (const key of this.cacheBuildStates.keys()) {
      if (!visibleKeys.has(key)) this.cacheBuildStates.delete(key);
    }
  }

  /**
   * Collect elevation tiles as Y-sortable scene items so they interleave
   * correctly with entities. Entities north of a cliff sort before it and
   * get occluded; entities south (or on top with wz) sort after and draw
   * on top. Returns renderer-agnostic ElevationItem[] with world-space data.
   */
  collectElevationItems(world: World, visible: ChunkRange): ElevationItem[] {
    const result: ElevationItem[] = [];

    for (let cy = visible.minCy; cy <= visible.maxCy; cy++) {
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk?.renderCache) continue;

        // Fast skip: no elevation in this chunk
        let hasElevation = false;
        for (let i = 0; i < chunk.heightGrid.length; i++) {
          if (chunk.heightGrid[i] !== 0) {
            hasElevation = true;
            break;
          }
        }
        if (!hasElevation) continue;

        const origin = chunkToWorld(cx, cy);

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const h = chunk.getHeight(lx, ly);
            if (h <= 0) continue;

            const globalTy = cy * CHUNK_SIZE + ly;
            const tileWx = origin.wx + lx * TILE_SIZE;
            const tileWy = origin.wy + ly * TILE_SIZE;
            const base = {
              kind: "elevation" as const,
              wx: tileWx,
              wy: tileWy,
              chunkCache: chunk.renderCache,
              srcX: lx * TILE_SIZE,
              srcY: ly * TILE_SIZE,
              height: h,
            };
            // Surface: sorts just before entities at this elevation so they
            // draw on top of their own ground.
            result.push({
              ...base,
              phase: "surface",
              sortKey: globalTy * TILE_SIZE + h * ELEVATION_PX - 0.5,
            });
            // Cliff face: sorts at the tile's south edge so it occludes
            // lower-elevation entities approaching from the north.
            result.push({
              ...base,
              phase: "cliff",
              sortKey: (globalTy + 1) * TILE_SIZE,
            });
          }
        }
      }
    }
    return result;
  }

  /** Advance one chunk cache build by up to `rowBudget` rows. */
  private advanceCacheBuild(
    key: string,
    chunk: Chunk,
    cx: number,
    cy: number,
    sheets: Map<string, Spritesheet>,
    rowBudget: number,
    focalRow: number,
    getGlobalRoad?: (tx: number, ty: number) => number,
  ): number {
    let state = this.cacheBuildStates.get(key);
    if (!state) {
      state = {
        canvas: new OffscreenCanvas(CHUNK_NATIVE_PX, CHUNK_NATIVE_PX),
        nextRowOrderIdx: 0,
        revision: chunk.revision,
        rowOrder: this.buildRowOrder(focalRow),
      };
      this.cacheBuildStates.set(key, state);
    }
    if (state.revision !== chunk.revision) {
      state.revision = chunk.revision;
      state.nextRowOrderIdx = 0;
      state.rowOrder = this.buildRowOrder(focalRow);
      const restartCtx = state.canvas.getContext("2d");
      if (!restartCtx) return rowBudget;
      restartCtx.imageSmoothingEnabled = false;
      restartCtx.clearRect(0, 0, CHUNK_NATIVE_PX, CHUNK_NATIVE_PX);
    } else if (state.nextRowOrderIdx === 0) {
      const setupCtx = state.canvas.getContext("2d");
      if (!setupCtx) return rowBudget;
      setupCtx.imageSmoothingEnabled = false;
      setupCtx.clearRect(0, 0, CHUNK_NATIVE_PX, CHUNK_NATIVE_PX);
    }

    const offCtx = state.canvas.getContext("2d");
    if (!offCtx) return rowBudget;
    let usedRows = 0;
    while (usedRows < rowBudget && state.nextRowOrderIdx < state.rowOrder.length) {
      const ly = state.rowOrder[state.nextRowOrderIdx];
      state.nextRowOrderIdx++;
      if (ly === undefined) continue;
      this.drawCacheRows(chunk, cx, cy, sheets, offCtx, ly, ly + 1, getGlobalRoad);
      usedRows++;
    }

    if (state.nextRowOrderIdx >= state.rowOrder.length) {
      chunk.renderCache = state.canvas;
      chunk.dirty = false;
      this.cacheBuildStates.delete(key);
    }

    return rowBudget - usedRows;
  }

  /** Build center-out row ordering so rows near the camera are rendered first. */
  private buildRowOrder(centerRow: number): number[] {
    const order: number[] = [];
    for (let d = 0; d < CHUNK_SIZE; d++) {
      const up = centerRow - d;
      if (up >= 0) order.push(up);
      if (d === 0) continue;
      const down = centerRow + d;
      if (down < CHUNK_SIZE) order.push(down);
    }
    return order;
  }

  /** Draw a contiguous row range into a chunk cache canvas. */
  private drawCacheRows(
    chunk: Chunk,
    cx: number,
    cy: number,
    sheets: Map<string, Spritesheet>,
    offCtx: OffscreenCanvasRenderingContext2D,
    rowStart: number,
    rowEnd: number,
    getGlobalRoad?: (tx: number, ty: number) => number,
  ): void {
    const waterSheet = sheets.get("shallowwater");
    const graph = this.blendGraph;
    const variants = this.variants;
    // World tile origin for this chunk
    const baseTx = cx * CHUNK_SIZE;
    const baseTy = cy * CHUNK_SIZE;

    for (let ly = rowStart; ly < rowEnd; ly++) {
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
