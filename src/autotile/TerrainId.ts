/**
 * Graph renderer terrain types — ground materials only.
 * No vegetation variants (Forest/DenseForest collapse to Grass).
 */
export enum TerrainId {
  DeepWater = 0,
  ShallowWater = 1,
  Sand = 2,
  SandLight = 3,
  Grass = 4,
  DirtLight = 5,
  DirtWarm = 6,
}

/** Number of terrain types. */
export const TERRAIN_COUNT = 7;

/** All terrain IDs for iteration. */
export const ALL_TERRAIN_IDS: readonly TerrainId[] = [
  TerrainId.DeepWater,
  TerrainId.ShallowWater,
  TerrainId.Sand,
  TerrainId.SandLight,
  TerrainId.Grass,
  TerrainId.DirtLight,
  TerrainId.DirtWarm,
];

/**
 * Terrain depth for draw ordering.
 * Lower = drawn first (deeper, serves as background).
 * Higher = drawn last (shallower, covers what's below).
 */
export const TERRAIN_DEPTH: Record<TerrainId, number> = {
  [TerrainId.DeepWater]: 0,
  [TerrainId.ShallowWater]: 1,
  [TerrainId.Sand]: 2,
  [TerrainId.SandLight]: 3,
  [TerrainId.Grass]: 4,
  [TerrainId.DirtLight]: 5,
  [TerrainId.DirtWarm]: 6,
};
