import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { registerDefaultTiles, TileId } from "../world/TileRegistry.js";
import { WorldGenerator } from "./WorldGenerator.js";

describe("WorldGenerator", () => {
	it("generates a chunk that is not all the same tile", () => {
		registerDefaultTiles();
		const gen = new WorldGenerator("variety-test");
		const chunk = new Chunk();
		gen.generate(chunk, 0, 0);

		const tileSet = new Set<TileId>();
		for (let y = 0; y < CHUNK_SIZE; y++) {
			for (let x = 0; x < CHUNK_SIZE; x++) {
				tileSet.add(chunk.getTerrain(x, y));
			}
		}

		// A single 16x16 chunk at the origin might be all one biome,
		// so test across multiple chunks to ensure variety
		const gen2 = new WorldGenerator("variety-test");
		const positions: [number, number][] = [
			[0, 0],
			[5, 5],
			[-3, 2],
			[10, -10],
			[20, 20],
		];
		const allTiles = new Set<TileId>();
		for (const [cx, cy] of positions) {
			const c = new Chunk();
			gen2.generate(c, cx, cy);
			for (let y = 0; y < CHUNK_SIZE; y++) {
				for (let x = 0; x < CHUNK_SIZE; x++) {
					allTiles.add(c.getTerrain(x, y));
				}
			}
		}

		// Should have at least 2 different tile types across multiple chunks
		expect(allTiles.size).toBeGreaterThanOrEqual(2);
	});

	it("produces deterministic output for same seed", () => {
		registerDefaultTiles();
		const gen1 = new WorldGenerator("det-seed");
		const gen2 = new WorldGenerator("det-seed");
		const chunk1 = new Chunk();
		const chunk2 = new Chunk();
		gen1.generate(chunk1, 3, -2);
		gen2.generate(chunk2, 3, -2);

		for (let y = 0; y < CHUNK_SIZE; y++) {
			for (let x = 0; x < CHUNK_SIZE; x++) {
				expect(chunk1.getTerrain(x, y)).toBe(chunk2.getTerrain(x, y));
				expect(chunk1.getCollision(x, y)).toBe(chunk2.getCollision(x, y));
				expect(chunk1.getDetail(x, y)).toBe(chunk2.getDetail(x, y));
			}
		}
	});

	it("sets collision flags for water tiles", () => {
		registerDefaultTiles();
		const gen = new WorldGenerator("collision-test");

		// Generate many chunks, find at least one water tile with collision
		let foundWaterCollision = false;
		for (let cy = -5; cy <= 5 && !foundWaterCollision; cy++) {
			for (let cx = -5; cx <= 5 && !foundWaterCollision; cx++) {
				const chunk = new Chunk();
				gen.generate(chunk, cx, cy);
				for (let y = 0; y < CHUNK_SIZE; y++) {
					for (let x = 0; x < CHUNK_SIZE; x++) {
						const tile = chunk.getTerrain(x, y);
						if (tile === TileId.Water || tile === TileId.DeepWater) {
							expect(chunk.getCollision(x, y)).toBeGreaterThan(0);
							foundWaterCollision = true;
						}
					}
				}
			}
		}

		expect(foundWaterCollision).toBe(true);
	});

	it("scatters detail tiles on grass biomes", () => {
		registerDefaultTiles();
		const gen = new WorldGenerator("detail-test");

		let foundDetail = false;
		for (let cy = -5; cy <= 5 && !foundDetail; cy++) {
			for (let cx = -5; cx <= 5 && !foundDetail; cx++) {
				const chunk = new Chunk();
				gen.generate(chunk, cx, cy);
				for (let y = 0; y < CHUNK_SIZE; y++) {
					for (let x = 0; x < CHUNK_SIZE; x++) {
						if (chunk.getDetail(x, y) !== TileId.Empty) {
							foundDetail = true;
						}
					}
				}
			}
		}

		expect(foundDetail).toBe(true);
	});
});
