import type { TerrainId } from "../autotile/TerrainId.js";
import { CHUNK_SIZE, RENDER_DISTANCE, UNLOAD_DISTANCE } from "../config/constants.js";
import type { TerrainStrategy } from "../generation/TerrainStrategy.js";
import { Chunk } from "./Chunk.js";
import { getCollisionForTerrain, TileId, terrainIdToTileId } from "./TileRegistry.js";
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

  /** Inject saved subgrid data for chunk restore on load. */
  setSavedSubgrids(saved: Map<string, Uint8Array>): void {
    this.savedSubgrids = saved;
  }

  /** Update the saved copy of a chunk's subgrid (called after IDB write). */
  updateSavedSubgrid(key: string, subgrid: Uint8Array): void {
    this.savedSubgrids.set(key, new Uint8Array(subgrid));
  }

  /** Get a chunk's subgrid by key string, for persistence. */
  getSubgridByKey(key: string): Uint8Array | undefined {
    return this.chunks.get(key)?.subgrid;
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
        const terrain = chunk.getSubgrid(lx * 2 + 1, ly * 2 + 1) as TerrainId;
        const tileId = terrainIdToTileId(terrain);
        chunk.setTerrain(lx, ly, tileId);
        chunk.setCollision(lx, ly, getCollisionForTerrain(tileId));
        chunk.setDetail(lx, ly, TileId.Empty);
      }
    }
  }

  /** Get chunk if it exists (no creation). */
  get(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cy));
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
