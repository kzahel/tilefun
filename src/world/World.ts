import { computeChunkSubgridBlend } from "../autotile/Autotiler.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { OnionStrategy } from "../generation/OnionStrategy.js";
import type { TerrainStrategy } from "../generation/TerrainStrategy.js";
import { isRoad } from "../road/RoadType.js";
import type { Chunk } from "./Chunk.js";
import { ChunkManager, type ChunkRange } from "./ChunkManager.js";
import {
  CollisionFlag,
  registerDefaultTiles,
  TileId,
  type TileId as TileIdType,
} from "./TileRegistry.js";
import { tileToChunk, tileToLocal } from "./types.js";

export class World {
  readonly chunks: ChunkManager;

  constructor(strategy: TerrainStrategy = new OnionStrategy()) {
    registerDefaultTiles();
    this.chunks = new ChunkManager();
    this.chunks.setGenerator(strategy);
  }

  /** Get terrain tile at a global tile position. */
  getTerrain(tx: number, ty: number): TileIdType {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    return this.chunks.getOrCreate(cx, cy).getTerrain(lx, ly);
  }

  /**
   * Get terrain at a global tile position without creating new chunks.
   * Returns TileId.Empty if the chunk is not loaded.
   */
  getTerrainIfLoaded(tx: number, ty: number): TileIdType {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.chunks.get(cx, cy);
    if (!chunk) return TileId.Empty;
    return chunk.getTerrain(lx, ly);
  }

  /** Get collision flags at a global tile position. Roads override terrain blocking. */
  getCollision(tx: number, ty: number): number {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.chunks.getOrCreate(cx, cy);
    if (isRoad(chunk.getRoad(lx, ly))) return CollisionFlag.None;
    return chunk.getCollision(lx, ly);
  }

  /** Get collision flags without creating chunks. Returns blocking for unloaded chunks. */
  getCollisionIfLoaded(tx: number, ty: number): number {
    const { cx, cy } = tileToChunk(tx, ty);
    const chunk = this.chunks.get(cx, cy);
    if (!chunk) return CollisionFlag.Solid | CollisionFlag.Water;
    const { lx, ly } = tileToLocal(tx, ty);
    if (isRoad(chunk.getRoad(lx, ly))) return CollisionFlag.None;
    return chunk.getCollision(lx, ly);
  }

  /** Get chunk at chunk coordinates (creates if needed). */
  getChunk(cx: number, cy: number): Chunk {
    return this.chunks.getOrCreate(cx, cy);
  }

  /** Get chunk if loaded, or undefined. Never creates chunks. */
  getChunkIfLoaded(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(cx, cy);
  }

  /** Get elevation height at a global tile position. Returns 0 if chunk not loaded. */
  getHeightAt(tx: number, ty: number): number {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.chunks.get(cx, cy);
    if (!chunk) return 0;
    return chunk.getHeight(lx, ly);
  }

  /** Get road type at a global tile position. Returns 0 (None) if chunk not loaded. */
  getRoadAt(tx: number, ty: number): number {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.chunks.get(cx, cy);
    if (!chunk) return 0;
    return chunk.getRoad(lx, ly);
  }

  /** Get computed blendBase TerrainId at a global tile position. Returns Grass if unloaded. */
  getBlendBaseAt(tx: number, ty: number): number {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.chunks.get(cx, cy);
    if (!chunk) return TerrainId.Grass;
    return chunk.getBlendBase(lx, ly);
  }

  /** Update chunk loading/unloading based on visible range. */
  updateLoadedChunks(visible: ChunkRange, maxChunkLoads = Number.POSITIVE_INFINITY): void {
    this.chunks.updateLoadedChunks(visible, maxChunkLoads);
  }

  /**
   * Run the autotile pass for chunks that need it.
   * Computes per-tile blend layers from corners using the blend graph.
   */
  computeAutotile(blendGraph: BlendGraph, maxChunks = Number.POSITIVE_INFINITY): void {
    const limit = Math.max(0, Math.floor(maxChunks));
    let processed = 0;
    for (const [, chunk] of this.chunks.entries()) {
      if (chunk.autotileComputed) continue;
      if (processed >= limit) break;

      computeChunkSubgridBlend(chunk, blendGraph);
      chunk.autotileComputed = true;
      chunk.dirty = true;
      chunk.revision++;
      processed++;
    }
  }
}
