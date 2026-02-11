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
 * Uses majority vote; ties broken by terrain priority (higher wins).
 */
export function deriveTerrainFromCorners(
  nw: BiomeId,
  ne: BiomeId,
  sw: BiomeId,
  se: BiomeId,
): BiomeId {
  // Fast path: all same
  if (nw === ne && ne === sw && sw === se) return nw;

  // Count occurrences (max 6 biome ids, use array)
  const counts = new Uint8Array(6);
  counts[nw] = (counts[nw] ?? 0) + 1;
  counts[ne] = (counts[ne] ?? 0) + 1;
  counts[sw] = (counts[sw] ?? 0) + 1;
  counts[se] = (counts[se] ?? 0) + 1;

  let maxCount = 0;
  let winner: BiomeId = nw;
  for (let b = 0; b < 6; b++) {
    const c = counts[b] ?? 0;
    if (c > maxCount || (c === maxCount && b > winner)) {
      maxCount = c;
      winner = b as BiomeId;
    }
  }
  return winner;
}
