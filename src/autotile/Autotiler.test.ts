import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { TileId } from "../world/TileRegistry.js";
import {
	AutotileBit,
	canonicalize,
	computeChunkAutotile,
	computeChunkDirtAutotile,
	computeMask,
	isDirtGroup,
	isGrassGroup,
} from "./Autotiler.js";

describe("isGrassGroup", () => {
	it("returns true for grass biomes and sand", () => {
		expect(isGrassGroup(TileId.Grass)).toBe(true);
		expect(isGrassGroup(TileId.Forest)).toBe(true);
		expect(isGrassGroup(TileId.DenseForest)).toBe(true);
		expect(isGrassGroup(TileId.Sand)).toBe(true);
	});

	it("returns false for non-grass biomes", () => {
		expect(isGrassGroup(TileId.Water)).toBe(false);
		expect(isGrassGroup(TileId.DeepWater)).toBe(false);
		expect(isGrassGroup(TileId.Empty)).toBe(false);
	});
});

describe("isDirtGroup", () => {
	it("returns true for sand", () => {
		expect(isDirtGroup(TileId.Sand)).toBe(true);
	});

	it("returns false for non-dirt tiles", () => {
		expect(isDirtGroup(TileId.Grass)).toBe(false);
		expect(isDirtGroup(TileId.Forest)).toBe(false);
		expect(isDirtGroup(TileId.Water)).toBe(false);
		expect(isDirtGroup(TileId.Empty)).toBe(false);
	});
});

describe("canonicalize", () => {
	it("keeps cardinal-only masks unchanged", () => {
		expect(canonicalize(0)).toBe(0);
		expect(canonicalize(0x0f)).toBe(0x0f); // N+W+E+S
		expect(canonicalize(1)).toBe(1); // N only
	});

	it("strips diagonal bits when adjacent cardinals are missing", () => {
		// NW(16) without both N and W → stripped
		expect(canonicalize(AutotileBit.NW)).toBe(0);
		expect(canonicalize(AutotileBit.N | AutotileBit.NW)).toBe(AutotileBit.N);
		expect(canonicalize(AutotileBit.W | AutotileBit.NW)).toBe(AutotileBit.W);
	});

	it("keeps diagonal bits when both adjacent cardinals present", () => {
		const mask = AutotileBit.N | AutotileBit.W | AutotileBit.NW;
		expect(canonicalize(mask)).toBe(mask);
	});

	it("all 4 cardinals + all 4 diagonals = 255", () => {
		expect(canonicalize(255)).toBe(255);
	});

	it("collapses to at most 47 unique values", () => {
		const unique = new Set<number>();
		for (let m = 0; m < 256; m++) {
			unique.add(canonicalize(m));
		}
		expect(unique.size).toBe(47);
	});
});

describe("computeMask", () => {
	it("returns 0 when surrounded by water", () => {
		const getTerrain = () => TileId.Water;
		const mask = computeMask(5, 5, getTerrain);
		expect(mask).toBe(0);
	});

	it("returns 255 when fully surrounded by grass", () => {
		const getTerrain = () => TileId.Grass;
		const mask = computeMask(5, 5, getTerrain);
		expect(mask).toBe(255);
	});

	it("correctly computes N+E with NE corner", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.Grass; // N
			if (tx === 6 && ty === 5) return TileId.Grass; // E
			if (tx === 6 && ty === 4) return TileId.Grass; // NE
			return TileId.Water;
		};
		const mask = computeMask(5, 5, getTerrain);
		expect(mask).toBe(AutotileBit.N | AutotileBit.E | AutotileBit.NE); // 1+4+32 = 37
	});

	it("does not set diagonal when one cardinal is missing", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.Grass; // N only
			if (tx === 4 && ty === 4) return TileId.Grass; // NW position, but W is not grass
			return TileId.Water;
		};
		const mask = computeMask(5, 5, getTerrain);
		expect(mask).toBe(AutotileBit.N); // NW not set because W is water
	});

	it("treats Forest and DenseForest as grass group", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.Forest;
			if (tx === 6 && ty === 5) return TileId.DenseForest;
			return TileId.Water;
		};
		const mask = computeMask(5, 5, getTerrain);
		expect(mask).toBe(AutotileBit.N | AutotileBit.E);
	});

	it("treats Sand as grass group by default", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.Sand;
			return TileId.Water;
		};
		const mask = computeMask(5, 5, getTerrain);
		expect(mask).toBe(AutotileBit.N);
	});

	it("uses custom isInGroup predicate for dirt", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 5) return TileId.Sand;
			return TileId.Grass;
		};
		// With isDirtGroup, grass neighbors don't count
		const mask = computeMask(5, 5, getTerrain, isDirtGroup);
		expect(mask).toBe(0);
	});

	it("detects sand neighbors with isDirtGroup predicate", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.Sand; // N
			if (tx === 6 && ty === 5) return TileId.Sand; // E
			return TileId.Grass;
		};
		const mask = computeMask(5, 5, getTerrain, isDirtGroup);
		expect(mask).toBe(AutotileBit.N | AutotileBit.E);
	});
});

describe("computeChunkAutotile", () => {
	it("fills autotileCache for grass tiles", () => {
		const chunk = new Chunk();
		chunk.fillTerrain(TileId.Grass);
		const getTerrain = () => TileId.Grass;

		computeChunkAutotile(chunk, 0, 0, getTerrain);

		// All tiles should be full interior (255 → col=1, row=0 in GM blob)
		const packed = (0 << 8) | 1; // row=0, col=1
		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileCache[i]).toBe(packed);
		}
	});

	it("sets 0 for non-grass tiles", () => {
		const chunk = new Chunk();
		chunk.fillTerrain(TileId.Water);
		const getTerrain = () => TileId.Water;

		computeChunkAutotile(chunk, 0, 0, getTerrain);

		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileCache[i]).toBe(0);
		}
	});

	it("computes edge tiles at chunk borders", () => {
		const chunk = new Chunk();
		chunk.fillTerrain(TileId.Grass);

		// Chunk is all grass, but neighbors are water
		const getTerrain = (tx: number, ty: number) => {
			if (tx >= 0 && tx < CHUNK_SIZE && ty >= 0 && ty < CHUNK_SIZE) {
				return TileId.Grass;
			}
			return TileId.Water;
		};

		computeChunkAutotile(chunk, 0, 0, getTerrain);

		// Corner tile (0,0) should have S+E+SE neighbors (right and down are grass)
		const cornerPacked = chunk.autotileCache[0];
		expect(cornerPacked).not.toBeUndefined();
		expect(cornerPacked).not.toBe(0);
		// Interior tile should be full (255 → col=1, row=0 in GM blob)
		const interiorPacked = chunk.autotileCache[8 * CHUNK_SIZE + 8];
		const fullPacked = (0 << 8) | 1;
		expect(interiorPacked).toBe(fullPacked);
	});

	it("computes autotile for Sand tiles (Sand is in grass group)", () => {
		const chunk = new Chunk();
		chunk.fillTerrain(TileId.Sand);
		const getTerrain = () => TileId.Sand;

		computeChunkAutotile(chunk, 0, 0, getTerrain);

		// Sand is in grass group, so all tiles should have grass autotile
		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileCache[i]).toBeGreaterThan(0);
		}
	});
});

describe("computeChunkDirtAutotile", () => {
	it("fills dirtAutotileCache for sand tiles", () => {
		const chunk = new Chunk();
		chunk.fillTerrain(TileId.Sand);
		const getTerrain = () => TileId.Sand;

		computeChunkDirtAutotile(chunk, 0, 0, getTerrain);

		// All sand tiles should have non-zero dirt autotile
		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.dirtAutotileCache[i]).toBeGreaterThan(0);
		}
	});

	it("sets 0 for non-sand tiles", () => {
		const chunk = new Chunk();
		chunk.fillTerrain(TileId.Grass);
		const getTerrain = () => TileId.Grass;

		computeChunkDirtAutotile(chunk, 0, 0, getTerrain);

		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.dirtAutotileCache[i]).toBe(0);
		}
	});

	it("computes edges for sand surrounded by grass", () => {
		const chunk = new Chunk();
		chunk.fillTerrain(TileId.Sand);
		const getTerrain = (tx: number, ty: number) => {
			if (tx >= 0 && tx < CHUNK_SIZE && ty >= 0 && ty < CHUNK_SIZE) {
				return TileId.Sand;
			}
			return TileId.Grass;
		};

		computeChunkDirtAutotile(chunk, 0, 0, getTerrain);

		// Corner tile should have edge variant (not full interior)
		const cornerPacked = chunk.dirtAutotileCache[0];
		expect(cornerPacked).toBeGreaterThan(0);
		// Interior tile should be full interior
		const interiorPacked = chunk.dirtAutotileCache[8 * CHUNK_SIZE + 8];
		expect(interiorPacked).toBeGreaterThan(0);
		expect(interiorPacked).not.toBe(cornerPacked);
	});
});
