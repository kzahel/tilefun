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
  // Sheet variants: same base terrain but different preferred blend direction
  ShallowWaterOnGrass = 7, // ShallowWater terrain, prefers me03 (water over grass)
  GrassOnDirtWarm = 8, // Grass terrain, prefers me12 (grass over dirt)
  // Structure terrains
  Playground = 11,
  Curb = 12,
}

/** Number of terrain types (includes gap at 7-10 for save compatibility). */
export const TERRAIN_COUNT = 13;

/** All active terrain IDs for iteration (excludes removed road IDs 7-10). */
export const ALL_TERRAIN_IDS: readonly TerrainId[] = [
  TerrainId.DeepWater,
  TerrainId.ShallowWater,
  TerrainId.Sand,
  TerrainId.SandLight,
  TerrainId.Grass,
  TerrainId.DirtLight,
  TerrainId.DirtWarm,
  TerrainId.Playground,
  TerrainId.Curb,
];

/**
 * Terrain depth for draw ordering.
 * Lower = drawn first (deeper, serves as background).
 * Higher = drawn last (shallower, covers what's below).
 */
export const TERRAIN_DEPTH: Record<TerrainId, number> = {
  [TerrainId.ShallowWater]: 0,
  [TerrainId.DeepWater]: 1,
  [TerrainId.Grass]: 2,
  [TerrainId.SandLight]: 3,
  [TerrainId.Sand]: 4,
  [TerrainId.DirtLight]: 5,
  [TerrainId.DirtWarm]: 6,
  [TerrainId.ShallowWaterOnGrass]: 0, // same depth as ShallowWater
  [TerrainId.GrassOnDirtWarm]: 2, // same depth as Grass
  [TerrainId.Curb]: 7,
  [TerrainId.Playground]: 12,
};

/**
 * Base selection strategy for mixed-corner tiles.
 * - "depth": lowest TERRAIN_DEPTH wins (current behavior)
 * - "nw": NW corner always wins (no depth concept)
 */
export type BaseSelectionMode = "depth" | "nw";
let _baseSelectionMode: BaseSelectionMode = "depth";

export function getBaseSelectionMode(): BaseSelectionMode {
  return _baseSelectionMode;
}
export function setBaseSelectionMode(mode: BaseSelectionMode): void {
  _baseSelectionMode = mode;
}

/** When true, force all diagonal bits on → only convex (corner-system) shapes. */
let _forceConvex = false;

export function getForceConvex(): boolean {
  return _forceConvex;
}
export function setForceConvex(v: boolean): void {
  _forceConvex = v;
}

/** Map variant subgrid values to their base TerrainId. Base IDs return themselves. */
export function toBaseTerrainId(id: number): TerrainId {
  switch (id) {
    case TerrainId.ShallowWaterOnGrass:
      return TerrainId.ShallowWater;
    case TerrainId.GrassOnDirtWarm:
      return TerrainId.Grass;
    default:
      return id as TerrainId;
  }
}

/**
 * For variant terrain IDs, the preferred base partner terrain.
 * When this terrain is the tile center and the partner is a neighbor,
 * the partner gets a score boost to become the base (so this terrain
 * becomes the overlay using its preferred blend sheet).
 */
export function getPreferredPartner(id: number): TerrainId | undefined {
  switch (id) {
    case TerrainId.ShallowWaterOnGrass:
      return TerrainId.Grass;
    case TerrainId.GrassOnDirtWarm:
      return TerrainId.DirtWarm;
    default:
      return undefined;
  }
}
