import alea from "alea";
import {
  deriveTerrainFromCorners,
  getValidFallback,
  isValidAdjacency,
} from "../autotile/TerrainGraph.js";
import { biomeIdToTerrainId } from "../autotile/terrainMapping.js";
import { CHUNK_SIZE } from "../config/constants.js";
import { Chunk } from "../world/Chunk.js";
import { CollisionFlag, TileId } from "../world/TileRegistry.js";
import { BiomeId, BiomeMapper } from "./BiomeMapper.js";
import { NoiseMap } from "./NoiseMap.js";
import type { TerrainStrategy } from "./TerrainStrategy.js";

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
  [BiomeId.DenseForest]: CollisionFlag.None,
};

/** Detail tiles per biome type. */
const GRASS_DETAILS: TileId[] = [
  TileId.FlowerRed,
  TileId.FlowerYellow,
  TileId.TallGrass,
  TileId.Sunflower,
  TileId.SmallBerries,
  TileId.Sprout,
];
const FOREST_DETAILS: TileId[] = [
  TileId.Mushroom,
  TileId.Rock,
  TileId.TallGrass,
  TileId.Leaf,
  TileId.Pumpkin,
  TileId.BigRock,
];

/** Detail noise threshold: values above this get a detail tile. */
const DETAIL_THRESHOLD_GRASS = 0.72;
const DETAIL_THRESHOLD_FOREST = 0.55;

/** Path noise band — values in this range become DirtPath. */
const PATH_BAND_LOW = 0.48;
const PATH_BAND_HIGH = 0.52;

const SUBGRID_SIZE = Chunk.SUBGRID_SIZE;

/**
 * Sub-grid terrain generator using BiomeId noise.
 * Fills chunk subgrid (33×33) from noise at half-tile positions,
 * enforces adjacency constraints, derives per-tile terrain, collision,
 * and details, then converts subgrid from BiomeId to TerrainId.
 */
export class OnionStrategy implements TerrainStrategy {
  readonly biomeMapper: BiomeMapper;
  private readonly detailNoise: NoiseMap;
  private readonly pathNoise: NoiseMap;
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

    this.pathNoise = new NoiseMap(`${seed}-paths`, {
      frequency: 0.05,
      octaves: 2,
      lacunarity: 2.0,
      persistence: 0.5,
    });

    this.biomeMapper = new BiomeMapper(elevation, moisture);
  }

  /** Fill a chunk's subgrid, derive terrain, collision, and details. */
  generate(chunk: Chunk, cx: number, cy: number): void {
    const baseX = cx * CHUNK_SIZE;
    const baseY = cy * CHUNK_SIZE;

    // Phase 1: Fill 33×33 subgrid from noise at half-tile positions.
    // Subgrid (sx, sy) → world (baseX + sx*0.5, baseY + sy*0.5)
    for (let sy = 0; sy < SUBGRID_SIZE; sy++) {
      for (let sx = 0; sx < SUBGRID_SIZE; sx++) {
        const wx = baseX + sx * 0.5;
        const wy = baseY + sy * 0.5;
        const biome = this.biomeMapper.getBiome(wx, wy);
        chunk.setSubgrid(sx, sy, biome);
      }
    }

    // Phase 2: Enforce adjacency constraints on all subgrid points
    this.enforceSubgridAdjacency(chunk, baseX, baseY);

    // Phase 3: Derive per-tile terrain from subgrid corners + apply overlays.
    // Each tile (lx, ly) uses its 4 corner subgrid values at even coords:
    //   NW = (lx*2, ly*2), NE = (lx*2+2, ly*2), SW = (lx*2, ly*2+2), SE = (lx*2+2, ly*2+2)
    const chunkRng = alea(`${this.seed}-detail-${cx},${cy}`);

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tx = baseX + lx;
        const ty = baseY + ly;

        const biome = deriveTerrainFromCorners(
          chunk.getCorner(lx, ly) as BiomeId,
          chunk.getCorner(lx + 1, ly) as BiomeId,
          chunk.getCorner(lx, ly + 1) as BiomeId,
          chunk.getCorner(lx + 1, ly + 1) as BiomeId,
        );

        let tileId = BIOME_TILE[biome];

        // DirtPath overlay on grass/forest tiles
        if (biome === BiomeId.Grass || biome === BiomeId.Forest) {
          const pathValue = this.pathNoise.sample(tx, ty);
          if (pathValue > PATH_BAND_LOW && pathValue < PATH_BAND_HIGH) {
            if (!this.hasWaterOrSandNeighbor(tx, ty)) {
              tileId = TileId.DirtPath;
            }
          }
        }

        chunk.setTerrain(lx, ly, tileId);
        chunk.setCollision(lx, ly, BIOME_COLLISION[biome]);

        // Scatter detail tiles on land biomes
        this.scatterDetail(chunk, lx, ly, tx, ty, biome, chunkRng);
      }
    }

    // Phase 4: Convert entire subgrid from BiomeId to TerrainId for blend renderer
    for (let sy = 0; sy < SUBGRID_SIZE; sy++) {
      for (let sx = 0; sx < SUBGRID_SIZE; sx++) {
        const biome = chunk.getSubgrid(sx, sy) as BiomeId;
        chunk.setSubgrid(sx, sy, biomeIdToTerrainId(biome));
      }
    }
  }

  /**
   * Enforce adjacency constraints on subgrid biomes.
   * Checks each point against its 4 cardinal neighbors' RAW noise biomes
   * (deterministic, independent of chunk generation order).
   */
  private enforceSubgridAdjacency(chunk: Chunk, baseX: number, baseY: number): void {
    for (let sy = 0; sy < SUBGRID_SIZE; sy++) {
      for (let sx = 0; sx < SUBGRID_SIZE; sx++) {
        let biome = chunk.getSubgrid(sx, sy) as BiomeId;
        const wx = baseX + sx * 0.5;
        const wy = baseY + sy * 0.5;

        // Check 4 cardinal neighbors using raw noise (not post-enforcement)
        const offsets = [
          [0, -0.5],
          [-0.5, 0],
          [0.5, 0],
          [0, 0.5],
        ] as const;
        for (const [dx, dy] of offsets) {
          const nb = this.biomeMapper.getBiome(wx + dx, wy + dy);
          if (!isValidAdjacency(biome, nb)) {
            biome = getValidFallback(biome, nb);
          }
        }

        chunk.setSubgrid(sx, sy, biome);
      }
    }
  }

  /** Check if any of the 8 neighbor tile positions would be water or sand. */
  private hasWaterOrSandNeighbor(tx: number, ty: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const b = this.biomeMapper.getBiome(tx + dx, ty + dy);
        if (b === BiomeId.DeepWater || b === BiomeId.ShallowWater || b === BiomeId.Sand) {
          return true;
        }
      }
    }
    return false;
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
    if (biome !== BiomeId.Grass && biome !== BiomeId.Forest && biome !== BiomeId.DenseForest) {
      return;
    }

    const detailValue = this.detailNoise.sample(tx, ty);
    const threshold = biome === BiomeId.Grass ? DETAIL_THRESHOLD_GRASS : DETAIL_THRESHOLD_FOREST;
    const palette = biome === BiomeId.Grass ? GRASS_DETAILS : FOREST_DETAILS;

    if (detailValue > threshold) {
      const detailIdx = Math.floor(rng() * palette.length);
      const detail = palette[detailIdx];
      if (detail !== undefined) {
        chunk.setDetail(lx, ly, detail);
      }
    }
  }
}
