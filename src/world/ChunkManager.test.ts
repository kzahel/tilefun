import { describe, expect, it } from "vitest";
import { WorldGenerator } from "../generation/WorldGenerator.js";
import { ChunkManager } from "./ChunkManager.js";
import { registerDefaultTiles, TileId } from "./TileRegistry.js";

describe("ChunkManager", () => {
	it("creates chunks on demand with generated terrain", () => {
		registerDefaultTiles();
		const mgr = new ChunkManager();
		mgr.setGenerator(new WorldGenerator("test-seed"));
		const chunk = mgr.getOrCreate(0, 0);
		// With a generator, tiles should not all be Empty
		const tile = chunk.getTerrain(0, 0);
		expect(tile).not.toBe(TileId.Empty);
	});

	it("returns same chunk for same coordinates", () => {
		const mgr = new ChunkManager();
		const a = mgr.getOrCreate(1, 2);
		const b = mgr.getOrCreate(1, 2);
		expect(a).toBe(b);
	});

	it("creates different chunks for different coordinates", () => {
		const mgr = new ChunkManager();
		const a = mgr.getOrCreate(0, 0);
		const b = mgr.getOrCreate(1, 0);
		expect(a).not.toBe(b);
	});

	it("handles negative chunk coordinates", () => {
		registerDefaultTiles();
		const mgr = new ChunkManager();
		mgr.setGenerator(new WorldGenerator("test-seed"));
		const chunk = mgr.getOrCreate(-1, -1);
		expect(chunk.getTerrain(0, 0)).not.toBe(TileId.Empty);
	});

	it("tracks loaded chunk count", () => {
		const mgr = new ChunkManager();
		expect(mgr.loadedCount).toBe(0);
		mgr.getOrCreate(0, 0);
		expect(mgr.loadedCount).toBe(1);
		mgr.getOrCreate(1, 0);
		expect(mgr.loadedCount).toBe(2);
		// Same chunk doesn't increase count
		mgr.getOrCreate(0, 0);
		expect(mgr.loadedCount).toBe(2);
	});

	it("updateLoadedChunks loads within render distance", () => {
		const mgr = new ChunkManager();
		mgr.updateLoadedChunks({ minCx: 0, minCy: 0, maxCx: 0, maxCy: 0 });
		// RENDER_DISTANCE = 3, so should load from -3 to 3 in each direction = 7x7 = 49
		expect(mgr.loadedCount).toBe(49);
	});

	it("updateLoadedChunks unloads beyond unload distance", () => {
		const mgr = new ChunkManager();
		// Load chunks around origin
		mgr.updateLoadedChunks({ minCx: 0, minCy: 0, maxCx: 0, maxCy: 0 });
		const initialCount = mgr.loadedCount;
		expect(initialCount).toBeGreaterThan(0);

		// Move camera far away - chunks at origin should be unloaded
		mgr.updateLoadedChunks({ minCx: 20, minCy: 20, maxCx: 20, maxCy: 20 });
		// Old chunks at origin (beyond UNLOAD_DISTANCE=5 from 20) should be gone
		expect(mgr.get(0, 0)).toBeUndefined();
	});

	it("get returns undefined for unloaded chunks", () => {
		const mgr = new ChunkManager();
		expect(mgr.get(99, 99)).toBeUndefined();
	});
});
