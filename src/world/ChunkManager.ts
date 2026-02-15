import { toBaseTerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE, RENDER_DISTANCE, UNLOAD_DISTANCE } from "../config/constants.js";
import type { TerrainStrategy } from "../generation/TerrainStrategy.js";
import { Chunk } from "./Chunk.js";
import { getCollisionForWaterTile, TileId, terrainIdToTileId } from "./TileRegistry.js";
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
        this.rederiveFromSubgrid(chunk);
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

  /** Re-derive terrain/collision from subgrid center points after restoring saved data. */
  private rederiveFromSubgrid(chunk: Chunk): void {
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const terrain = toBaseTerrainId(chunk.getSubgrid(lx * 2 + 1, ly * 2 + 1));
        const tileId = terrainIdToTileId(terrain);
        chunk.setTerrain(lx, ly, tileId);
        const waterCount = this.countWaterSubgrid(chunk, lx, ly);
        chunk.setCollision(lx, ly, getCollisionForWaterTile(tileId, waterCount));
        chunk.setDetail(lx, ly, TileId.Empty);
      }
    }
  }

  /** Count water subgrid points in the 3×3 area around a tile. */
  private countWaterSubgrid(chunk: Chunk, lx: number, ly: number): number {
    let count = 0;
    const cx = lx * 2 + 1;
    const cy = ly * 2 + 1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = toBaseTerrainId(chunk.getSubgrid(cx + dx, cy + dy));
        const tid = terrainIdToTileId(t);
        if (tid === TileId.Water || tid === TileId.DeepWater) count++;
      }
    }
    return count;
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
  updateLoadedChunks(visible: ChunkRange): void {
    // Load chunks within render distance
    const loadMinCx = visible.minCx - RENDER_DISTANCE;
    const loadMaxCx = visible.maxCx + RENDER_DISTANCE;
    const loadMinCy = visible.minCy - RENDER_DISTANCE;
    const loadMaxCy = visible.maxCy + RENDER_DISTANCE;

    for (let cy = loadMinCy; cy <= loadMaxCy; cy++) {
      for (let cx = loadMinCx; cx <= loadMaxCx; cx++) {
        this.getOrCreate(cx, cy);
      }
    }

    // Unload chunks beyond unload distance
    const unloadMinCx = visible.minCx - UNLOAD_DISTANCE;
    const unloadMaxCx = visible.maxCx + UNLOAD_DISTANCE;
    const unloadMinCy = visible.minCy - UNLOAD_DISTANCE;
    const unloadMaxCy = visible.maxCy + UNLOAD_DISTANCE;

    for (const [key] of this.chunks) {
      const commaIdx = key.indexOf(",");
      const cx = Number(key.slice(0, commaIdx));
      const cy = Number(key.slice(commaIdx + 1));
      if (cx < unloadMinCx || cx > unloadMaxCx || cy < unloadMinCy || cy > unloadMaxCy) {
        this.chunks.delete(key);
      }
    }
  }

  /** Generate terrain for a chunk using the attached generator. */
  private generate(chunk: Chunk, cx: number, cy: number): void {
    if (this.generator) {
      this.generator.generate(chunk, cx, cy);
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
