import { BiomeId } from "../generation/BiomeMapper.js";

/**
 * Terrain priority for corner-to-tile derivation.
 * Higher-priority terrain wins ties because higher autotile layers cover lower ones.
 */
export const TERRAIN_PRIORITY: Record<BiomeId, number> = {
  [BiomeId.DeepWater]: 0,
  [BiomeId.ShallowWater]: 1,
  [BiomeId.Sand]: 2,
  [BiomeId.Grass]: 3,
  [BiomeId.Forest]: 4,
  [BiomeId.DenseForest]: 5,
};

/**
 * Valid biome adjacency pairs. Each pair means the two biomes can be
 * directly adjacent at corner positions. Self-adjacency is always valid.
 */
const VALID_PAIRS: ReadonlyArray<readonly [BiomeId, BiomeId]> = [
  // Water depth transitions
  [BiomeId.DeepWater, BiomeId.ShallowWater],
  // Water-land transitions (handled by nested ring layers #8+#12)
  [BiomeId.ShallowWater, BiomeId.Sand],
  [BiomeId.ShallowWater, BiomeId.Grass],
  [BiomeId.ShallowWater, BiomeId.Forest],
  [BiomeId.ShallowWater, BiomeId.DenseForest],
  // Sand-land transitions (handled by nested ring layers #8+#12)
  [BiomeId.Sand, BiomeId.Grass],
  [BiomeId.Sand, BiomeId.Forest],
  [BiomeId.Sand, BiomeId.DenseForest],
  // Land vegetation transitions (same group, no sheet needed)
  [BiomeId.Grass, BiomeId.Forest],
  [BiomeId.Grass, BiomeId.DenseForest],
  [BiomeId.Forest, BiomeId.DenseForest],
];

const pairSet = new Set<number>();
for (const [a, b] of VALID_PAIRS) {
  pairSet.add(a * 16 + b);
  pairSet.add(b * 16 + a);
}

/** Check if two biomes can be directly adjacent. */
export function isValidAdjacency(a: BiomeId, b: BiomeId): boolean {
  if (a === b) return true;
  return pairSet.has(a * 16 + b);
}

/**
 * Given a corner's biome and an invalid neighbor biome,
 * return a fallback biome that is valid with the neighbor.
 * Grass is the universal buffer — it's adjacent to everything except DeepWater.
 */
export function getValidFallback(_myBiome: BiomeId, neighborBiome: BiomeId): BiomeId {
  if (neighborBiome === BiomeId.DeepWater) return BiomeId.ShallowWater;
  return BiomeId.Grass;
}

/**
 * Derive a tile's biome from its 4 corner biomes.
 * Returns the lowest-priority biome present in any corner.
 * This ensures that painting a single lower-layer corner (e.g. water on grass)
 * immediately produces that terrain, with autotile transitions at edges.
 */
export function deriveTerrainFromCorners(
  nw: BiomeId,
  ne: BiomeId,
  sw: BiomeId,
  se: BiomeId,
): BiomeId {
  // Fast path: all same
  if (nw === ne && ne === sw && sw === se) return nw;

  // Lowest-priority (numerically smallest) biome wins.
  // Rendering layers draw bottom-to-top, so the lowest layer must be the tile
  // type for the blend/autotile system to render transitions correctly.
  return Math.min(nw, ne, sw, se) as BiomeId;
}
