import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { TileId } from "../world/TileRegistry.js";
import { AutotileBit, canonicalize, computeChunkAllLayers, computeMask } from "./Autotiler.js";
import { TERRAIN_LAYERS } from "./TerrainLayers.js";

const LAYER_COUNT = TERRAIN_LAYERS.length;

// Layer indices (must match TERRAIN_LAYERS order)
const DEEP_LAYER = 0;
const SAND_LAYER = 1; // sand_on_water: isNonWater group
const GRASS_LAYER = 2; // grass_on_sand: isGrassLand group (excludes Sand)
const DIRT_LAYER = 3; // dirt_on_grass: isDirtPath only

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
	it("returns 0 when surrounded by water (using sand layer)", () => {
		const getTerrain = () => TileId.Water;
		const isNonWater = TERRAIN_LAYERS[SAND_LAYER]!.isInGroup;
		const mask = computeMask(5, 5, getTerrain, isNonWater);
		expect(mask).toBe(0);
	});

	it("returns 255 when fully surrounded by grass (using sand layer)", () => {
		const getTerrain = () => TileId.Grass;
		const isNonWater = TERRAIN_LAYERS[SAND_LAYER]!.isInGroup;
		const mask = computeMask(5, 5, getTerrain, isNonWater);
		expect(mask).toBe(255);
	});

	it("correctly computes N+E with NE corner", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.Grass; // N
			if (tx === 6 && ty === 5) return TileId.Grass; // E
			if (tx === 6 && ty === 4) return TileId.Grass; // NE
			return TileId.Water;
		};
		const isNonWater = TERRAIN_LAYERS[SAND_LAYER]!.isInGroup;
		const mask = computeMask(5, 5, getTerrain, isNonWater);
		expect(mask).toBe(AutotileBit.N | AutotileBit.E | AutotileBit.NE); // 1+4+32 = 37
	});

	it("does not set diagonal when one cardinal is missing", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.Grass; // N only
			if (tx === 4 && ty === 4) return TileId.Grass; // NW position, but W is not grass
			return TileId.Water;
		};
		const isNonWater = TERRAIN_LAYERS[SAND_LAYER]!.isInGroup;
		const mask = computeMask(5, 5, getTerrain, isNonWater);
		expect(mask).toBe(AutotileBit.N); // NW not set because W is water
	});

	it("treats Forest and DenseForest as non-water group", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.Forest;
			if (tx === 6 && ty === 5) return TileId.DenseForest;
			return TileId.Water;
		};
		const isNonWater = TERRAIN_LAYERS[SAND_LAYER]!.isInGroup;
		const mask = computeMask(5, 5, getTerrain, isNonWater);
		expect(mask).toBe(AutotileBit.N | AutotileBit.E);
	});

	it("Sand is in non-water group but NOT in grass-land group", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.Sand;
			return TileId.Water;
		};
		const isNonWater = TERRAIN_LAYERS[SAND_LAYER]!.isInGroup;
		const isGrassLand = TERRAIN_LAYERS[GRASS_LAYER]!.isInGroup;
		expect(computeMask(5, 5, getTerrain, isNonWater)).toBe(AutotileBit.N);
		expect(computeMask(5, 5, getTerrain, isGrassLand)).toBe(0);
	});

	it("DirtPath is in non-water, grass-land, AND dirt groups", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.DirtPath;
			return TileId.Water;
		};
		expect(computeMask(5, 5, getTerrain, TERRAIN_LAYERS[SAND_LAYER]!.isInGroup))
			.toBe(AutotileBit.N);
		expect(computeMask(5, 5, getTerrain, TERRAIN_LAYERS[GRASS_LAYER]!.isInGroup))
			.toBe(AutotileBit.N);
		expect(computeMask(5, 5, getTerrain, TERRAIN_LAYERS[DIRT_LAYER]!.isInGroup))
			.toBe(AutotileBit.N);
	});

	it("DeepWater is in the deep water layer group", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.DeepWater; // N
			return TileId.Water;
		};
		const isDeep = TERRAIN_LAYERS[DEEP_LAYER]!.isInGroup;
		const mask = computeMask(5, 5, getTerrain, isDeep);
		expect(mask).toBe(AutotileBit.N);
	});

	it("ShallowWater is NOT in the deep water layer group", () => {
		const getTerrain = () => TileId.Water;
		const isDeep = TERRAIN_LAYERS[DEEP_LAYER]!.isInGroup;
		const mask = computeMask(5, 5, getTerrain, isDeep);
		expect(mask).toBe(0);
	});

	it("uses dirt layer predicate for DirtPath-only detection", () => {
		const getTerrain = (tx: number, ty: number) => {
			if (tx === 5 && ty === 4) return TileId.DirtPath; // N
			if (tx === 6 && ty === 5) return TileId.Sand; // E — NOT in dirt group
			return TileId.Grass;
		};
		const isDirt = TERRAIN_LAYERS[DIRT_LAYER]!.isInGroup;
		const mask = computeMask(5, 5, getTerrain, isDirt);
		expect(mask).toBe(AutotileBit.N); // Only DirtPath, not Sand
	});
});

describe("computeChunkAllLayers", () => {
	it("fills sand layer for grass tiles (nested ring)", () => {
		const chunk = new Chunk(LAYER_COUNT);
		chunk.fillTerrain(TileId.Grass);
		const getTerrain = () => TileId.Grass;

		computeChunkAllLayers(chunk, 0, 0, getTerrain);

		// All tiles should be full interior (mask 255 → col=1, row=0 in GM blob)
		const packed = (0 << 8) | 1; // row=0, col=1
		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileLayers[SAND_LAYER]![i]).toBe(packed);
			expect(chunk.autotileLayers[GRASS_LAYER]![i]).toBe(packed);
		}
	});

	it("sets 0 in all land layers for water tiles", () => {
		const chunk = new Chunk(LAYER_COUNT);
		chunk.fillTerrain(TileId.Water);
		const getTerrain = () => TileId.Water;

		computeChunkAllLayers(chunk, 0, 0, getTerrain);

		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileLayers[SAND_LAYER]![i]).toBe(0);
			expect(chunk.autotileLayers[GRASS_LAYER]![i]).toBe(0);
			expect(chunk.autotileLayers[DIRT_LAYER]![i]).toBe(0);
		}
	});

	it("fills deep water layer for DeepWater tiles", () => {
		const chunk = new Chunk(LAYER_COUNT);
		chunk.fillTerrain(TileId.DeepWater);
		const getTerrain = () => TileId.DeepWater;

		computeChunkAllLayers(chunk, 0, 0, getTerrain);

		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileLayers[DEEP_LAYER]![i]).toBeGreaterThan(0);
			expect(chunk.autotileLayers[SAND_LAYER]![i]).toBe(0);
			expect(chunk.autotileLayers[GRASS_LAYER]![i]).toBe(0);
			expect(chunk.autotileLayers[DIRT_LAYER]![i]).toBe(0);
		}
	});

	it("fills sand layer but NOT grass/dirt layers for Sand tiles", () => {
		const chunk = new Chunk(LAYER_COUNT);
		chunk.fillTerrain(TileId.Sand);
		const getTerrain = () => TileId.Sand;

		computeChunkAllLayers(chunk, 0, 0, getTerrain);

		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileLayers[SAND_LAYER]![i]).toBeGreaterThan(0);
			expect(chunk.autotileLayers[GRASS_LAYER]![i]).toBe(0);
			expect(chunk.autotileLayers[DIRT_LAYER]![i]).toBe(0);
		}
	});

	it("fills all 3 land layers for DirtPath tiles", () => {
		const chunk = new Chunk(LAYER_COUNT);
		chunk.fillTerrain(TileId.DirtPath);
		const getTerrain = () => TileId.DirtPath;

		computeChunkAllLayers(chunk, 0, 0, getTerrain);

		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileLayers[SAND_LAYER]![i]).toBeGreaterThan(0);
			expect(chunk.autotileLayers[GRASS_LAYER]![i]).toBeGreaterThan(0);
			expect(chunk.autotileLayers[DIRT_LAYER]![i]).toBeGreaterThan(0);
		}
	});

	it("computes edge tiles at chunk borders", () => {
		const chunk = new Chunk(LAYER_COUNT);
		chunk.fillTerrain(TileId.Grass);

		const getTerrain = (tx: number, ty: number) => {
			if (tx >= 0 && tx < CHUNK_SIZE && ty >= 0 && ty < CHUNK_SIZE) {
				return TileId.Grass;
			}
			return TileId.Water;
		};

		computeChunkAllLayers(chunk, 0, 0, getTerrain);

		// Corner tile should have edge variant (not full interior)
		const cornerPacked = chunk.autotileLayers[SAND_LAYER]![0];
		expect(cornerPacked).not.toBeUndefined();
		expect(cornerPacked).not.toBe(0);
		// Interior tile should be full (255 → col=1, row=0 in GM blob)
		const interiorPacked = chunk.autotileLayers[SAND_LAYER]![8 * CHUNK_SIZE + 8];
		const fullPacked = (0 << 8) | 1;
		expect(interiorPacked).toBe(fullPacked);
	});

	it("computes sand edges for sand surrounded by grass", () => {
		const chunk = new Chunk(LAYER_COUNT);
		chunk.fillTerrain(TileId.Sand);
		const getTerrain = (tx: number, ty: number) => {
			if (tx >= 0 && tx < CHUNK_SIZE && ty >= 0 && ty < CHUNK_SIZE) {
				return TileId.Sand;
			}
			return TileId.Grass;
		};

		computeChunkAllLayers(chunk, 0, 0, getTerrain);

		// Sand layer: all tiles non-zero (sand + grass are both non-water = same group)
		const fullPacked = (0 << 8) | 1;
		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileLayers[SAND_LAYER]![i]).toBe(fullPacked);
		}
		// Grass layer: 0 for all (Sand not in grassLand group)
		for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
			expect(chunk.autotileLayers[GRASS_LAYER]![i]).toBe(0);
		}
	});

	it("computes deep water edges at deep/shallow boundary", () => {
		const chunk = new Chunk(LAYER_COUNT);
		chunk.fillTerrain(TileId.DeepWater);

		const getTerrain = (tx: number, ty: number) => {
			if (tx >= 0 && tx < CHUNK_SIZE && ty >= 0 && ty < CHUNK_SIZE) {
				return TileId.DeepWater;
			}
			return TileId.Water;
		};

		computeChunkAllLayers(chunk, 0, 0, getTerrain);

		// Corner deep water tile should have edge variant
		const cornerPacked = chunk.autotileLayers[DEEP_LAYER]![0];
		expect(cornerPacked).toBeGreaterThan(0);
		// Interior tile should be full interior
		const interiorPacked = chunk.autotileLayers[DEEP_LAYER]![8 * CHUNK_SIZE + 8];
		expect(interiorPacked).toBeGreaterThan(0);
		expect(interiorPacked).not.toBe(cornerPacked);
	});
});
