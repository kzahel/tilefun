import type { Chunk } from "./Chunk.js";
import { ChunkManager, type ChunkRange } from "./ChunkManager.js";
import { registerDefaultTiles, type TileId } from "./TileRegistry.js";
import { tileToChunk, tileToLocal } from "./types.js";

export class World {
	readonly chunks: ChunkManager;

	constructor() {
		registerDefaultTiles();
		this.chunks = new ChunkManager();
	}

	/** Get terrain tile at a global tile position. */
	getTerrain(tx: number, ty: number): TileId {
		const { cx, cy } = tileToChunk(tx, ty);
		const { lx, ly } = tileToLocal(tx, ty);
		return this.chunks.getOrCreate(cx, cy).getTerrain(lx, ly);
	}

	/** Get collision flags at a global tile position. */
	getCollision(tx: number, ty: number): number {
		const { cx, cy } = tileToChunk(tx, ty);
		const { lx, ly } = tileToLocal(tx, ty);
		return this.chunks.getOrCreate(cx, cy).getCollision(lx, ly);
	}

	/** Get chunk at chunk coordinates (creates if needed). */
	getChunk(cx: number, cy: number): Chunk {
		return this.chunks.getOrCreate(cx, cy);
	}

	/** Update chunk loading/unloading based on visible range. */
	updateLoadedChunks(visible: ChunkRange): void {
		this.chunks.updateLoadedChunks(visible);
	}
}
