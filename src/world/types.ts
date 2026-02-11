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
export interface ScreenPos {
	sx: number;
	sy: number;
}

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

/** Map key for chunk coordinates. */
export function chunkKey(cx: number, cy: number): string {
	return `${cx},${cy}`;
}
