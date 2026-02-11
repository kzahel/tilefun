import { describe, expect, it } from "vitest";
import { Chunk } from "./Chunk.js";
import { CollisionFlag, TileId } from "./TileRegistry.js";

describe("Chunk", () => {
	it("initializes all terrain to 0 (Empty)", () => {
		const chunk = new Chunk();
		expect(chunk.getTerrain(0, 0)).toBe(TileId.Empty);
		expect(chunk.getTerrain(15, 15)).toBe(TileId.Empty);
	});

	it("sets and gets terrain", () => {
		const chunk = new Chunk();
		chunk.setTerrain(3, 7, TileId.Grass);
		expect(chunk.getTerrain(3, 7)).toBe(TileId.Grass);
		expect(chunk.getTerrain(0, 0)).toBe(TileId.Empty);
	});

	it("sets and gets collision", () => {
		const chunk = new Chunk();
		chunk.setCollision(5, 5, CollisionFlag.Solid | CollisionFlag.Water);
		expect(chunk.getCollision(5, 5)).toBe(3);
		expect(chunk.getCollision(0, 0)).toBe(0);
	});

	it("fillTerrain fills entire chunk", () => {
		const chunk = new Chunk();
		chunk.fillTerrain(TileId.Grass);
		for (let y = 0; y < 16; y++) {
			for (let x = 0; x < 16; x++) {
				expect(chunk.getTerrain(x, y)).toBe(TileId.Grass);
			}
		}
	});

	it("fillCollision fills entire chunk", () => {
		const chunk = new Chunk();
		chunk.fillCollision(CollisionFlag.Water);
		for (let y = 0; y < 16; y++) {
			for (let x = 0; x < 16; x++) {
				expect(chunk.getCollision(x, y)).toBe(CollisionFlag.Water);
			}
		}
	});

	it("terrain and collision are independent", () => {
		const chunk = new Chunk();
		chunk.setTerrain(0, 0, TileId.Water);
		chunk.setCollision(0, 0, CollisionFlag.Solid);
		expect(chunk.getTerrain(0, 0)).toBe(TileId.Water);
		expect(chunk.getCollision(0, 0)).toBe(CollisionFlag.Solid);
	});
});
