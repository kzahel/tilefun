import type { Spritesheet } from "../assets/Spritesheet.js";
import type { TileVariants } from "../assets/TileVariants.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { MAX_BLEND_LAYERS } from "../autotile/BlendGraph.js";
import { TerrainId } from "../autotile/TerrainId.js";
import {
  CHUNK_SIZE,
  MAX_CHUNK_CACHE_ROWS_PER_FRAME,
  RENDER_DISTANCE,
  TILE_SIZE,
  WATER_FRAME_COUNT,
  WATER_FRAME_DURATION_MS,
} from "../config/constants.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { commercialSurfacePieces, isCommercialSurface } from "../road/CommercialCitySurface.js";
import { denseCitySurfacePieces, isCitySurface } from "../road/DenseCitySurface.js";
import { computeRoadCardinalMask, getRoadSprite } from "../road/RoadAutotiler.js";
import { getRoadSheetKey, isRoad, RoadType } from "../road/RoadType.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { getTileDef, TileId } from "../world/TileRegistry.js";
import { chunkToWorld } from "../world/types.js";
import type { Camera } from "./Camera.js";
import { allocateTerrainResourceId, CanvasTerrainResources } from "./CanvasTerrainResources.js";
import { drawCitySurfacePieces } from "./CitySurfaceRenderer.js";
import { ElevationDescriptorCache } from "./ElevationDescriptorCache.js";
import type { ElevationItem } from "./SceneItem.js";
import type {
  TerrainPresentation,
  TerrainRenderWorld,
  TerrainResourceId,
} from "./TerrainPresentation.js";

const CHUNK_NATIVE_PX = CHUNK_SIZE * TILE_SIZE;

interface CacheBuildState {
  resourceId: TerrainResourceId;
  chunk: Chunk;
  canvas: OffscreenCanvas;
  nextRowOrderIdx: number;
  revision: number;
  visualRevision: number;
  assetRevision: number;
  rowOrder: number[];
}

interface TerrainResident {
  key: string;
  cx: number;
  cy: number;
  chunk: Chunk;
  pendingSince: number | null;
  visited: boolean;
  priority: number;
  distance: number;
}

function compareTerrainJobs(a: TerrainResident, b: TerrainResident): number {
  return a.priority - b.priority || a.distance - b.distance || a.cy - b.cy || a.cx - b.cx;
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
export class TileRenderer implements TerrainPresentation {
  /** Indexed sheets array (index matches BlendEntry.sheetIndex). */
  private blendSheets: Spritesheet[] = [];
  /** BlendGraph for base fill lookups. */
  private blendGraph: BlendGraph | null = null;
  /** Optional tile variants for base fill variety. */
  private variants: TileVariants | null = null;
  /** Road overlay autotile sheets keyed by RoadType. */
  private roadSheetMap = new Map<RoadType, Spritesheet>();
  /** Progressive chunk cache rebuilds in progress (keyed by "cx,cy"). */
  private readonly resources = new CanvasTerrainResources();
  private readonly elevation = new ElevationDescriptorCache();
  private readonly partialResources = new Map<TerrainResourceId, OffscreenCanvas>();
  private cacheBuildStates = new Map<string, CacheBuildState>();

  private readonly resident = new Map<string, TerrainResident>();
  // Jobs borrow resident records only during prepareTerrain; no separate record pool.
  private readonly terrainJobs: TerrainResident[] = [];
  private visitStamp = false;
  private schedulerRecordsCreated = 0;
  private hasLastCamera = false;
  private lastCameraX = 0;
  private lastCameraY = 0;
  private preparedRows = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** Release surfaces on realm changes and teardown, including half-built jobs. */
  clear(): void {
    this.resources.clear();
    this.elevation.clear();
    this.resident.clear();
    this.clearCacheBuildStates();
    this.terrainJobs.length = 0;
    this.hasLastCamera = false;
    this.preparedRows = 0;
  }

  /** Prepare the loaded camera halo before drawing. Residency is bounded by
   * (visible width + 2R) * (visible height + 2R), with at most an old surface
   * plus a replacement surface per chunk. No offscreen terrain is generated.
   */
  prepareTerrain(
    camera: Camera,
    world: TerrainRenderWorld,
    sheets: Map<string, Spritesheet>,
    visible: ChunkRange,
    timeBudgetMs = 2,
    rowBudget = 128,
  ): void {
    const started = this.now();
    const deadline = started + Math.max(0, timeBudgetMs);
    const dx = this.hasLastCamera ? camera.x - this.lastCameraX : 0;
    const dy = this.hasLastCamera ? camera.y - this.lastCameraY : 0;
    const length = Math.hypot(dx, dy);
    const aheadX = camera.x + (length ? (dx / length) * CHUNK_NATIVE_PX : 0);
    const aheadY = camera.y + (length ? (dy / length) * CHUNK_NATIVE_PX : 0);
    this.lastCameraX = camera.x;
    this.lastCameraY = camera.y;
    this.hasLastCamera = true;
    const visited = !this.visitStamp;
    this.visitStamp = visited;
    const jobs = this.terrainJobs;
    try {
      for (let cy = visible.minCy - RENDER_DISTANCE; cy <= visible.maxCy + RENDER_DISTANCE; cy++) {
        for (
          let cx = visible.minCx - RENDER_DISTANCE;
          cx <= visible.maxCx + RENDER_DISTANCE;
          cx++
        ) {
          const chunk = world.getChunkIfLoaded(cx, cy);
          if (!chunk) continue;
          const key = `${cx},${cy}`;
          let entry = this.resident.get(key);
          if (!entry) {
            entry = { key, cx, cy, chunk, pendingSince: null, visited, priority: 0, distance: 0 };
            this.resident.set(key, entry);
            this.schedulerRecordsCreated++;
          } else if (entry.chunk !== chunk) {
            this.resources.delete(entry.chunk);
            this.deleteCacheBuildState(key);
            entry.chunk = chunk;
            entry.pendingSince = null;
          }
          entry.visited = visited;
          const pending = !this.resources.isReady(chunk, cx, cy);
          entry.pendingSince = pending ? (entry.pendingSince ?? started) : null;
          if (!pending) continue;
          const onScreen =
            cx >= visible.minCx &&
            cx <= visible.maxCx &&
            cy >= visible.minCy &&
            cy <= visible.maxCy;
          entry.priority = onScreen ? (this.resources.get(chunk) ? 1 : 0) : 2;
          entry.distance = Math.hypot(
            (cx + 0.5) * CHUNK_NATIVE_PX - aheadX,
            (cy + 0.5) * CHUNK_NATIVE_PX - aheadY,
          );
          jobs.push(entry);
        }
      }
      for (const entry of this.resident.values()) {
        if (entry.visited === visited) continue;
        const key = entry.key;
        this.resources.delete(entry.chunk);
        this.resident.delete(key);
        this.deleteCacheBuildState(key);
      }
      this.resources.retainCoordinates(this.resident);
      // Also discard work made through another rendering path before preparation.
      for (const key of this.cacheBuildStates.keys())
        if (!this.resident.has(key)) this.deleteCacheBuildState(key);
      jobs.sort(compareTerrainJobs);
      let remaining = Math.max(0, Math.floor(rowBudget));
      const initial = remaining;
      const roadAt = (tx: number, ty: number) => world.getRoadAt(tx, ty);
      for (const job of jobs) {
        if (remaining <= 0 || this.now() >= deadline) break;
        const focalRow = Math.max(
          0,
          Math.min(CHUNK_SIZE - 1, Math.floor((camera.y - job.cy * CHUNK_NATIVE_PX) / TILE_SIZE)),
        );
        remaining = this.advanceCacheBuild(
          job.key,
          job.chunk,
          job.cx,
          job.cy,
          sheets,
          remaining,
          focalRow,
          roadAt,
          deadline,
        );
        if (this.resources.isReady(job.chunk, job.cx, job.cy)) {
          if (job.pendingSince !== null) {
            performanceMetrics.record("client.cacheLatency", this.now() - job.pendingSince);
            job.pendingSince = null;
          }
        }
      }
      this.preparedRows = initial - remaining;
    } catch (error) {
      // An incomplete membership scan must not leave stamps for the next pass.
      this.clear();
      throw error;
    } finally {
      // Release borrowed chunk references even if cache drawing throws.
      jobs.length = 0;
    }
  }

  getDiagnostics() {
    let pending = 0,
      oldestMs = 0,
      surfaces = this.cacheBuildStates.size + this.resources.size;
    for (const { pendingSince } of this.resident.values()) {
      if (pendingSince !== null) {
        pending++;
        oldestMs = Math.max(oldestMs, this.now() - pendingSince);
      }
    }
    return {
      resident: this.resident.size,
      schedulerRecordsCreated: this.schedulerRecordsCreated,
      queuedJobs: this.terrainJobs.length,
      building: this.cacheBuildStates.size,
      pending,
      oldestMs,
      rowsLastFrame: this.preparedRows,
      surfaceBytes: surfaces * CHUNK_NATIVE_PX * CHUNK_NATIVE_PX * 4,
    };
  }

  getTerrainSurface(chunk: Chunk | undefined): OffscreenCanvas | null {
    return this.resources.get(chunk);
  }

  hasTerrain(chunk: Chunk | undefined): boolean {
    return this.resources.get(chunk) !== null;
  }

  resolveTerrainResource(id: TerrainResourceId): OffscreenCanvas | null {
    return this.resources.resolve(id) ?? this.partialResources.get(id) ?? null;
  }

  isTerrainReady(chunk: Chunk | undefined): boolean {
    return this.resources.isReady(chunk);
  }

  releaseChunk(chunk: Chunk): void {
    this.resources.delete(chunk);
    for (const [key, entry] of this.resident) if (entry.chunk === chunk) this.resident.delete(key);
    for (const [key, state] of this.cacheBuildStates)
      if (state.chunk === chunk) this.deleteCacheBuildState(key);
  }

  /** Call after replacing images in the sheets map or changing atlas content. */
  invalidateAssets(): void {
    this.resources.invalidateAssets();
    this.clearCacheBuildStates();
  }

  /** Set the blend sheets and graph for the renderer. */
  setBlendSheets(sheets: Spritesheet[], graph: BlendGraph): void {
    this.invalidateAssets();
    this.blendSheets = sheets;
    this.blendGraph = graph;
  }

  /** Set tile variants for base fill variety. */
  setVariants(variants: TileVariants): void {
    this.invalidateAssets();
    this.variants = variants;
  }

  /** Set road autotile sheets from the loaded sheet map. */
  setRoadSheets(sheets: Map<string, Spritesheet>): void {
    this.invalidateAssets();
    this.roadSheetMap.clear();
    for (const rt of [RoadType.Sidewalk, RoadType.LineWhite, RoadType.LineYellow]) {
      const key = getRoadSheetKey(rt);
      if (key) {
        const sheet = sheets.get(key);
        if (sheet) this.roadSheetMap.set(rt, sheet);
      }
    }
  }

  groundResourceId(
    chunk: Chunk,
    cx: number,
    cy: number,
    readyOnly: boolean,
  ): TerrainResourceId | null {
    const completed = this.resources.resourceId(chunk, cx, cy);
    if (completed !== null || readyOnly) return completed;
    const building = this.cacheBuildStates.get(`${cx},${cy}`);
    return building?.chunk === chunk &&
      building.revision === chunk.revision &&
      building.visualRevision === chunk.visualRevision &&
      building.assetRevision === this.resources.assetRevision
      ? building.resourceId
      : null;
  }

  /** Visible-only bounded preparation for native reference/explorer surfaces. */
  prepareVisibleTerrain(
    camera: Camera,
    world: TerrainRenderWorld,
    sheets: Map<string, Spritesheet>,
    visible: ChunkRange,
    cacheRowBudget = MAX_CHUNK_CACHE_ROWS_PER_FRAME,
    viewportWidth = camera.viewportWidth,
    viewportHeight = camera.viewportHeight,
  ): void {
    const chunkScreenSize = CHUNK_SIZE * TILE_SIZE * camera.scale;
    const getGlobalRoad = (tx: number, ty: number) => world.getRoadAt(tx, ty);
    let rowsRemaining = cacheRowBudget;
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
          sx > viewportWidth ||
          sy > viewportHeight
        ) {
          continue;
        }

        // Rebuild cache incrementally to avoid single-frame spikes.
        if (!this.resources.isReady(chunk, cx, cy) && rowsRemaining > 0) {
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
      }
    }

    if (cacheRowBudget > 0) this.resources.retainCoordinates(visibleKeys);
    for (const key of this.cacheBuildStates.keys()) {
      if (cacheRowBudget > 0 && !visibleKeys.has(key)) this.deleteCacheBuildState(key);
    }
  }

  /**
   * Collect elevation tiles as Y-sortable scene items so they interleave
   * correctly with entities. Entities north of a cliff sort before it and
   * get occluded; entities south (or on top with wz) sort after and draw
   * on top. Returns renderer-agnostic ElevationItem[] with world-space data.
   */
  collectElevationItems(world: TerrainRenderWorld, visible: ChunkRange): ElevationItem[] {
    return this.elevation.collect(world, visible, this.resources);
  }

  getElevationDiagnostics() {
    return this.elevation.getDiagnostics();
  }

  private deleteCacheBuildState(key: string): void {
    const state = this.cacheBuildStates.get(key);
    if (state) this.partialResources.delete(state.resourceId);
    this.cacheBuildStates.delete(key);
  }

  private clearCacheBuildStates(): void {
    this.cacheBuildStates.clear();
    this.partialResources.clear();
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
    deadline = Number.POSITIVE_INFINITY,
  ): number {
    const timing = performanceMetrics.start();
    let state = this.cacheBuildStates.get(key);
    if (!state || state.chunk !== chunk) {
      this.deleteCacheBuildState(key);
      state = {
        resourceId: allocateTerrainResourceId(),
        chunk,
        canvas: new OffscreenCanvas(CHUNK_NATIVE_PX, CHUNK_NATIVE_PX),
        nextRowOrderIdx: 0,
        revision: chunk.revision,
        visualRevision: chunk.visualRevision,
        assetRevision: this.resources.assetRevision,
        rowOrder: this.buildRowOrder(focalRow),
      };
      this.cacheBuildStates.set(key, state);
      this.partialResources.set(state.resourceId, state.canvas);
    }
    if (
      state.revision !== chunk.revision ||
      state.visualRevision !== chunk.visualRevision ||
      state.assetRevision !== this.resources.assetRevision
    ) {
      this.partialResources.delete(state.resourceId);
      state.resourceId = allocateTerrainResourceId();
      this.partialResources.set(state.resourceId, state.canvas);
      state.revision = chunk.revision;
      state.visualRevision = chunk.visualRevision;
      state.assetRevision = this.resources.assetRevision;
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
    while (
      usedRows < rowBudget &&
      state.nextRowOrderIdx < state.rowOrder.length &&
      (usedRows === 0 || this.now() < deadline)
    ) {
      const ly = state.rowOrder[state.nextRowOrderIdx];
      state.nextRowOrderIdx++;
      if (ly === undefined) continue;
      this.drawCacheRows(chunk, cx, cy, sheets, offCtx, ly, ly + 1, getGlobalRoad);
      usedRows++;
    }

    if (state.nextRowOrderIdx >= state.rowOrder.length) {
      this.resources.publish(chunk, cx, cy, state.canvas);
      this.deleteCacheBuildState(key);
    }

    performanceMetrics.end("client.cache", timing);
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
        if (isCommercialSurface(road) || (isCitySurface(road) && getGlobalRoad)) {
          const sheet = sheets.get("me-complete");
          if (sheet)
            drawCitySurfacePieces(
              offCtx,
              sheet,
              isCommercialSurface(road)
                ? commercialSurfacePieces(road, baseTx + lx, baseTy + ly)
                : getGlobalRoad
                  ? denseCitySurfacePieces(road, baseTx + lx, baseTy + ly, getGlobalRoad)
                  : [],
              baseTx * TILE_SIZE,
              baseTy * TILE_SIZE,
            );
        } else if (isRoad(road)) {
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
