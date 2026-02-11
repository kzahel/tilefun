import alea from "alea";
import { CHUNK_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import { CollisionFlag, TileId } from "../world/TileRegistry.js";
import { BiomeId, BiomeMapper } from "./BiomeMapper.js";
import { NoiseMap } from "./NoiseMap.js";

/** Maps BiomeId to terrain TileId. */
const BIOME_TILE: Record<BiomeId, TileId> = {
	[BiomeId.DeepWater]: TileId.DeepWater,
	[BiomeId.ShallowWater]: TileId.Water,
	[BiomeId.Sand]: TileId.Sand,
	[BiomeId.Grass]: TileId.Grass,
	[BiomeId.Forest]: TileId.Forest,
	[BiomeId.DenseForest]: TileId.DenseForest,
};

/** Maps BiomeId to collision flags. */
const BIOME_COLLISION: Record<BiomeId, number> = {
	[BiomeId.DeepWater]: CollisionFlag.Water,
	[BiomeId.ShallowWater]: CollisionFlag.Water,
	[BiomeId.Sand]: CollisionFlag.None,
	[BiomeId.Grass]: CollisionFlag.None,
	[BiomeId.Forest]: CollisionFlag.None,
	[BiomeId.DenseForest]: CollisionFlag.SlowWalk,
};

/** Detail tiles to scatter on grass/forest biomes. */
const GRASS_DETAILS: TileId[] = [TileId.FlowerRed, TileId.FlowerYellow, TileId.TallGrass];

/** Detail noise threshold: values above this get a detail tile. */
const DETAIL_THRESHOLD_GRASS = 0.72;
const DETAIL_THRESHOLD_FOREST = 0.55;

/**
 * Generates chunk terrain from noise-based biome mapping.
 * Uses elevation + moisture noise for biome classification,
 * and a separate detail noise layer for scattering decorations.
 */
export class WorldGenerator {
	private readonly biomeMapper: BiomeMapper;
	private readonly detailNoise: NoiseMap;
	private readonly seed: string;

	constructor(seed: string) {
		this.seed = seed;

		const elevation = new NoiseMap(`${seed}-elevation`, {
			frequency: 0.008,
			octaves: 5,
			lacunarity: 2.0,
			persistence: 0.5,
		});

		const moisture = new NoiseMap(`${seed}-moisture`, {
			frequency: 0.012,
			octaves: 4,
			lacunarity: 2.0,
			persistence: 0.5,
		});

		this.detailNoise = new NoiseMap(`${seed}-detail`, {
			frequency: 0.1,
			octaves: 2,
			lacunarity: 2.0,
			persistence: 0.5,
		});

		this.biomeMapper = new BiomeMapper(elevation, moisture);
	}

	/** Fill a chunk's terrain, collision, and detail arrays from procedural generation. */
	generate(chunk: Chunk, cx: number, cy: number): void {
		const baseX = cx * CHUNK_SIZE;
		const baseY = cy * CHUNK_SIZE;
		// Per-chunk PRNG for detail tile selection (deterministic per chunk)
		const chunkRng = alea(`${this.seed}-detail-${cx},${cy}`);

		for (let ly = 0; ly < CHUNK_SIZE; ly++) {
			for (let lx = 0; lx < CHUNK_SIZE; lx++) {
				const tx = baseX + lx;
				const ty = baseY + ly;

				const biome = this.biomeMapper.getBiome(tx, ty);
				chunk.setTerrain(lx, ly, BIOME_TILE[biome]);
				chunk.setCollision(lx, ly, BIOME_COLLISION[biome]);

				// Scatter detail tiles on land biomes
				this.scatterDetail(chunk, lx, ly, tx, ty, biome, chunkRng);
			}
		}
	}

	private scatterDetail(
		chunk: Chunk,
		lx: number,
		ly: number,
		tx: number,
		ty: number,
		biome: BiomeId,
		rng: () => number,
	): void {
		// Only scatter on grass-like biomes
		if (biome !== BiomeId.Grass && biome !== BiomeId.Forest && biome !== BiomeId.DenseForest) {
			return;
		}

		const detailValue = this.detailNoise.sample(tx, ty);
		const threshold = biome === BiomeId.Grass ? DETAIL_THRESHOLD_GRASS : DETAIL_THRESHOLD_FOREST;

		if (detailValue > threshold) {
			const detailIdx = Math.floor(rng() * GRASS_DETAILS.length);
			const detail = GRASS_DETAILS[detailIdx];
			if (detail !== undefined) {
				chunk.setDetail(lx, ly, detail);
			}
		}
	}
}
