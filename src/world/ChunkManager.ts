import { RENDER_DISTANCE, UNLOAD_DISTANCE } from "../config/constants.js";
import { Chunk } from "./Chunk.js";
import { CollisionFlag, TileId } from "./TileRegistry.js";
import { chunkKey } from "./types.js";

export interface ChunkRange {
	minCx: number;
	minCy: number;
	maxCx: number;
	maxCy: number;
}

export class ChunkManager {
	private chunks = new Map<string, Chunk>();

	/** Get an existing chunk, or create and populate it. */
	getOrCreate(cx: number, cy: number): Chunk {
		const key = chunkKey(cx, cy);
		let chunk = this.chunks.get(key);
		if (!chunk) {
			chunk = new Chunk();
			this.generate(chunk, cx, cy);
			this.chunks.set(key, chunk);
		}
		return chunk;
	}

	/** Get chunk if it exists (no creation). */
	get(cx: number, cy: number): Chunk | undefined {
		return this.chunks.get(chunkKey(cx, cy));
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

		for (const [key, _chunk] of this.chunks) {
			const commaIdx = key.indexOf(",");
			const cx = Number(key.slice(0, commaIdx));
			const cy = Number(key.slice(commaIdx + 1));
			if (cx < unloadMinCx || cx > unloadMaxCx || cy < unloadMinCy || cy > unloadMaxCy) {
				this.chunks.delete(key);
			}
		}
	}

	/**
	 * Generate terrain for a chunk.
	 * For now, fill everything with grass. Procedural generation comes in Session 4.
	 */
	private generate(chunk: Chunk, _cx: number, _cy: number): void {
		chunk.fillTerrain(TileId.Grass);
		chunk.fillCollision(CollisionFlag.None);
	}
}
