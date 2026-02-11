import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, CHUNK_SIZE_PX, PIXEL_SCALE, TILE_SIZE } from "./constants.js";

describe("constants", () => {
	it("has consistent chunk size", () => {
		expect(CHUNK_SIZE_PX).toBe(TILE_SIZE * CHUNK_SIZE);
	});

	it("has expected defaults", () => {
		expect(TILE_SIZE).toBe(16);
		expect(CHUNK_SIZE).toBe(16);
		expect(PIXEL_SCALE).toBe(3);
	});
});
