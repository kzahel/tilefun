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
  // 7-10 reserved (formerly road IDs, then variant IDs — now unused)
  // Structure terrains
  Playground = 11,
  Curb = 12,
}

/** Number of terrain types (includes gap at 7-10 for save compatibility). */
export const TERRAIN_COUNT = 13;

/** All active terrain IDs for iteration (excludes gaps). */
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
  [TerrainId.Curb]: 7,
  [TerrainId.Playground]: 12,
};

// ---------------------------------------------------------------------------
// Terrain Variants
// ---------------------------------------------------------------------------
//
// Variant IDs are stored in the subgrid alongside base TerrainIds. They map
// to a base terrain for the blend/adjacency system but carry extra hints:
//   - preferredPartner: boost a specific neighbor as base (+10 in scoring)
//   - preferOverlay: penalize self as base (-10) so this terrain becomes overlay
//
// Variant IDs are stored at ALL subgrid points painted by a brush stroke
// (not just the tile center). However, only the center subgrid point
// (odd,odd coordinates) of each tile is read as `centerRaw` in
// computeTileBlend. Neighbor positions are always mapped through
// toBaseTerrainId() before entering the blend algorithm. Edge/corner
// subgrid points store the variant ID but it has no effect there.

/** Definition of a terrain variant stored in the subgrid. */
export interface VariantDef {
  /** The variant ID stored in the subgrid Uint8Array. */
  id: number;
  /** The base TerrainId this variant maps to in the blend/adjacency system. */
  base: TerrainId;
  /** When this terrain is center, prefer this neighbor as base (partner wins base selection). */
  preferredPartner?: TerrainId;
  /** When true, penalize this terrain as base candidate so it becomes overlay. */
  preferOverlay?: boolean;
}

/** Variant IDs start at 64 to stay clear of base terrain IDs (0-12). */
export enum VariantId {
  ShallowWaterOnGrass = 64,
  GrassOnDirtWarm = 65,
  GrassAlpha = 66,
  SandAlpha = 67,
  SandLightAlpha = 68,
}

const VARIANT_TABLE: readonly VariantDef[] = [
  {
    id: VariantId.ShallowWaterOnGrass,
    base: TerrainId.ShallowWater,
    preferredPartner: TerrainId.Grass,
  },
  { id: VariantId.GrassOnDirtWarm, base: TerrainId.Grass, preferredPartner: TerrainId.DirtWarm },
  { id: VariantId.GrassAlpha, base: TerrainId.Grass, preferOverlay: true },
  { id: VariantId.SandAlpha, base: TerrainId.Sand, preferOverlay: true },
  { id: VariantId.SandLightAlpha, base: TerrainId.SandLight, preferOverlay: true },
];

/** Fast lookup: variant ID → VariantDef. */
const VARIANT_MAP = new Map<number, VariantDef>();
for (const v of VARIANT_TABLE) {
  VARIANT_MAP.set(v.id, v);
}

/** Get the variant definition for an ID, or undefined for base terrain IDs. */
export function getVariant(id: number): VariantDef | undefined {
  return VARIANT_MAP.get(id);
}

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
  const v = VARIANT_MAP.get(id);
  return v ? v.base : (id as TerrainId);
}

/**
 * For variant terrain IDs, the preferred base partner terrain.
 * When this terrain is the tile center and the partner is a neighbor,
 * the partner gets a score boost to become the base (so this terrain
 * becomes the overlay using its preferred blend sheet).
 */
export function getPreferredPartner(id: number): TerrainId | undefined {
  return VARIANT_MAP.get(id)?.preferredPartner;
}

/** True if this variant prefers to be drawn as overlay rather than base. */
export function isOverlayPreferred(id: number): boolean {
  return VARIANT_MAP.get(id)?.preferOverlay === true;
}
