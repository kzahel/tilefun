import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";

/** World-pixel coordinates (fractional). */
export interface WorldPos {
  wx: number;
  wy: number;
}

/** Integer tile index. */
export interface TilePos {
  tx: number;
  ty: number;
}

/** Integer chunk index. */
export interface ChunkPos {
  cx: number;
  cy: number;
}

/** Canvas-pixel coordinates. */
/** Convert world-pixel position to tile index. */
export function worldToTile(wx: number, wy: number): TilePos {
  return {
    tx: Math.floor(wx / TILE_SIZE),
    ty: Math.floor(wy / TILE_SIZE),
  };
}

/** Convert tile index to world-pixel position (top-left corner of tile). */
export function tileToWorld(tx: number, ty: number): WorldPos {
  return {
    wx: tx * TILE_SIZE,
    wy: ty * TILE_SIZE,
  };
}

/** Convert tile index to chunk index. */
export function tileToChunk(tx: number, ty: number): ChunkPos {
  return {
    cx: Math.floor(tx / CHUNK_SIZE),
    cy: Math.floor(ty / CHUNK_SIZE),
  };
}

/** Get the local tile index within a chunk (0..CHUNK_SIZE-1). */
export function tileToLocal(tx: number, ty: number): { lx: number; ly: number } {
  return {
    lx: ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    ly: ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  };
}

/** Convert chunk index to world-pixel position (top-left corner of chunk). */
export function chunkToWorld(cx: number, cy: number): WorldPos {
  return {
    wx: cx * CHUNK_SIZE * TILE_SIZE,
    wy: cy * CHUNK_SIZE * TILE_SIZE,
  };
}

const chunkKeys = new Map<number, string>();

/** Map key for chunk coordinates. Per-actor-per-tick callers reuse the built string. */
export function chunkKey(cx: number, cy: number): string {
  // Integer coordinates within ±32768 pack exactly; anything else is formatted directly.
  if (
    !Number.isInteger(cx) ||
    !Number.isInteger(cy) ||
    Math.abs(cx) > 32767 ||
    Math.abs(cy) > 32767
  )
    return `${cx},${cy}`;
  const packed = (cx + 32768) * 65536 + (cy + 32768);
  let key = chunkKeys.get(packed);
  if (key === undefined) {
    if (chunkKeys.size >= 65536) chunkKeys.clear();
    key = `${cx},${cy}`;
    chunkKeys.set(packed, key);
  }
  return key;
}
