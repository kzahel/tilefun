import { RENDER_DISTANCE, UNLOAD_DISTANCE } from "../config/constants.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { deriveTerrain } from "../generation/deriveTerrain.js";
import type { TerrainStrategy } from "../generation/TerrainStrategy.js";
import { Chunk } from "./Chunk.js";
import { chunkKey } from "./types.js";

export interface ChunkRange {
  minCx: number;
  minCy: number;
  maxCx: number;
  maxCy: number;
}

export class ChunkManager {
  private chunks = new Map<string, Chunk>();
  private generator: TerrainStrategy | null = null;
  private savedSubgrids = new Map<string, Uint8Array>();
  private savedRoadGrids = new Map<string, Uint8Array>();
  private savedHeightGrids = new Map<string, Uint8Array>();

  /** Inject saved chunk data for restore on load. */
  setSavedData(
    saved: Map<
      string,
      { subgrid: Uint8Array; roadGrid: Uint8Array | null; heightGrid: Uint8Array | null }
    >,
  ): void {
    for (const [key, data] of saved) {
      this.savedSubgrids.set(key, data.subgrid);
      if (data.roadGrid) {
        this.savedRoadGrids.set(key, data.roadGrid);
      }
      if (data.heightGrid) {
        this.savedHeightGrids.set(key, data.heightGrid);
      }
    }
  }

  /** @deprecated Use setSavedData. */
  setSavedSubgrids(saved: Map<string, Uint8Array>): void {
    for (const [key, subgrid] of saved) {
      this.savedSubgrids.set(key, subgrid);
    }
  }

  /** Update saved copies after IDB write. */
  updateSavedChunk(
    key: string,
    subgrid: Uint8Array,
    roadGrid: Uint8Array,
    heightGrid: Uint8Array,
  ): void {
    this.savedSubgrids.set(key, new Uint8Array(subgrid));
    this.savedRoadGrids.set(key, new Uint8Array(roadGrid));
    this.savedHeightGrids.set(key, new Uint8Array(heightGrid));
  }

  /** Get a chunk's data by key string, for persistence. */
  getChunkDataByKey(
    key: string,
  ): { subgrid: Uint8Array; roadGrid: Uint8Array; heightGrid: Uint8Array } | undefined {
    const chunk = this.chunks.get(key);
    if (!chunk) return undefined;
    return { subgrid: chunk.subgrid, roadGrid: chunk.roadGrid, heightGrid: chunk.heightGrid };
  }

  /** Attach a world generator for procedural chunk creation. */
  setGenerator(generator: TerrainStrategy): void {
    this.generator = generator;
  }

  /** Get an existing chunk, or create and populate it. */
  getOrCreate(cx: number, cy: number): Chunk {
    const key = chunkKey(cx, cy);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk();
      const saved = this.savedSubgrids.get(key);
      if (saved) {
        chunk.subgrid.set(saved);
        deriveTerrain(chunk);
        const savedRoad = this.savedRoadGrids.get(key);
        if (savedRoad) {
          chunk.roadGrid.set(savedRoad);
        }
        const savedHeight = this.savedHeightGrids.get(key);
        if (savedHeight) {
          chunk.heightGrid.set(savedHeight);
        }
      } else {
        this.generate(chunk, cx, cy);
      }
      this.chunks.set(key, chunk);
      // Invalidate neighbors' autotile so their borders recompute
      this.invalidateNeighborAutotile(cx, cy);
    }
    return chunk;
  }

  /** Get chunk if it exists (no creation). */
  get(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cy));
  }

  /**
   * Insert a chunk directly without generation or neighbor invalidation.
   * Used by RemoteStateView where chunks are populated from server snapshots.
   */
  put(cx: number, cy: number, chunk: Chunk): void {
    this.chunks.set(chunkKey(cx, cy), chunk);
  }

  /** Remove a chunk by key. Used by RemoteStateView to unload server-unloaded chunks. */
  remove(key: string): boolean {
    return this.chunks.delete(key);
  }

  /** Iterate all loaded chunks. */
  entries(): IterableIterator<[string, Chunk]> {
    return this.chunks.entries();
  }

  /** Number of loaded chunks. */
  get loadedCount(): number {
    return this.chunks.size;
  }

  /**
   * Load chunks within RENDER_DISTANCE of the visible range,
   * unload chunks beyond UNLOAD_DISTANCE.
   */
  updateLoadedChunks(
    visible: ChunkRange | readonly ChunkRange[],
    maxChunkLoads = Number.POSITIVE_INFINITY,
  ): void {
    const ranges = "minCx" in visible ? [visible] : visible;
    const missing = new Map<string, { cx: number; cy: number; dist: number }>();
    for (const range of ranges) {
      const centerCx = (range.minCx + range.maxCx) * 0.5,
        centerCy = (range.minCy + range.maxCy) * 0.5;
      for (let cy = range.minCy - RENDER_DISTANCE; cy <= range.maxCy + RENDER_DISTANCE; cy++)
        for (let cx = range.minCx - RENDER_DISTANCE; cx <= range.maxCx + RENDER_DISTANCE; cx++) {
          if (this.get(cx, cy)) continue;
          const key = `${cx},${cy}`,
            dist = Math.abs(cx - centerCx) + Math.abs(cy - centerCy),
            prior = missing.get(key);
          if (!prior || dist < prior.dist) missing.set(key, { cx, cy, dist });
        }
    }
    const ordered = [...missing.values()].sort((a, b) => a.dist - b.dist);
    const count = Math.min(Math.max(0, Math.floor(maxChunkLoads)), ordered.length);
    for (let i = 0; i < count; i++) {
      const c = ordered[i];
      if (c) this.getOrCreate(c.cx, c.cy);
    }
    // Keep each player's neighborhood independently; never fill the rectangle between distant players.
    for (const key of this.chunks.keys()) {
      const [cx = 0, cy = 0] = key.split(",").map(Number);
      if (
        !ranges.some(
          (r) =>
            cx >= r.minCx - UNLOAD_DISTANCE &&
            cx <= r.maxCx + UNLOAD_DISTANCE &&
            cy >= r.minCy - UNLOAD_DISTANCE &&
            cy <= r.maxCy + UNLOAD_DISTANCE,
        )
      )
        this.chunks.delete(key);
    }
  }

  /** Generate terrain for a chunk using the attached generator. */
  private generate(chunk: Chunk, cx: number, cy: number): void {
    if (this.generator) {
      const timing = performanceMetrics.start();
      this.generator.generate(chunk, cx, cy);
      performanceMetrics.end("server.generate", timing);
    }
  }

  /** Mark existing neighbor chunks as needing autotile recomputation. */
  private invalidateNeighborAutotile(cx: number, cy: number): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const neighbor = this.get(cx + dx, cy + dy);
        if (neighbor) {
          neighbor.autotileComputed = false;
        }
      }
    }
  }
}
