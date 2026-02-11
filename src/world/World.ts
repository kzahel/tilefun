import { computeChunkAutotile } from "../autotile/Autotiler.js";
import { WorldGenerator } from "../generation/WorldGenerator.js";
import type { Chunk } from "./Chunk.js";
import { ChunkManager, type ChunkRange } from "./ChunkManager.js";
import { registerDefaultTiles, TileId, type TileId as TileIdType } from "./TileRegistry.js";
import { tileToChunk, tileToLocal } from "./types.js";

const DEFAULT_SEED = "tilefun-default";

export class World {
	readonly chunks: ChunkManager;

	constructor(seed: string = DEFAULT_SEED) {
		registerDefaultTiles();
		this.chunks = new ChunkManager();
		this.chunks.setGenerator(new WorldGenerator(seed));
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

	/**
	 * Run the autotile pass for chunks that need it.
	 * Should be called after updateLoadedChunks ensures all neighbors are generated.
	 */
	computeAutotile(): void {
		const getTerrain = (tx: number, ty: number) => this.getTerrainIfLoaded(tx, ty);

		for (const [key, chunk] of this.chunks.entries()) {
			if (chunk.autotileComputed) continue;

			const commaIdx = key.indexOf(",");
			const cx = Number(key.slice(0, commaIdx));
			const cy = Number(key.slice(commaIdx + 1));

			computeChunkAutotile(chunk, cx, cy, getTerrain);
			chunk.autotileComputed = true;
			chunk.dirty = true;
		}
	}
}
