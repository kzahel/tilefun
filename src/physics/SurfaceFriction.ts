import { TerrainId } from "../autotile/TerrainId.js";
import { TILE_SIZE } from "../config/constants.js";
import { isRoad } from "../road/RoadType.js";
import { CollisionFlag } from "../world/TileRegistry.js";

export interface SurfaceProperties {
  /** Friction multiplier (1.0 = normal, >1 = stickier, <1 = slippery). */
  friction: number;
  /** Max speed multiplier (1.0 = normal, <1 = slower max speed). */
  speedMult: number;
}

const DEFAULT_SURFACE: SurfaceProperties = { friction: 1.0, speedMult: 1.0 };

/** Surface properties per terrain type. */
const TERRAIN_SURFACES: Partial<Record<TerrainId, SurfaceProperties>> = {
  [TerrainId.Grass]: { friction: 1.0, speedMult: 1.0 },
  [TerrainId.Sand]: { friction: 1.8, speedMult: 0.75 },
  [TerrainId.SandLight]: { friction: 1.4, speedMult: 0.85 },
  [TerrainId.DirtLight]: { friction: 0.9, speedMult: 1.05 },
  [TerrainId.DirtWarm]: { friction: 0.9, speedMult: 1.05 },
  [TerrainId.ShallowWater]: { friction: 2.0, speedMult: 0.5 },
  [TerrainId.DeepWater]: { friction: 2.0, speedMult: 0.5 },
  [TerrainId.Playground]: { friction: 0.8, speedMult: 1.0 },
  [TerrainId.Curb]: { friction: 1.0, speedMult: 1.0 },
};

const ROAD_SURFACE: SurfaceProperties = { friction: 0.6, speedMult: 1.15 };

/**
 * Look up surface friction and speed properties at a world position.
 * Road grid is checked first (roads override terrain).
 * For water terrain, only applies water friction if the tile's collision
 * actually has the Water flag (respects the subgrid majority heuristic).
 */
export function getSurfaceProperties(
  wx: number,
  wy: number,
  getTerrainAt: (tx: number, ty: number) => number,
  getRoadAt: (tx: number, ty: number) => number,
  getCollision?: (tx: number, ty: number) => number,
): SurfaceProperties {
  const tx = Math.floor(wx / TILE_SIZE);
  const ty = Math.floor(wy / TILE_SIZE);

  // Roads override terrain
  if (isRoad(getRoadAt(tx, ty))) return ROAD_SURFACE;

  const terrain = getTerrainAt(tx, ty) as TerrainId;
  // Water transition tiles that are mostly land (no Water collision flag)
  // should not apply water friction — consistent with walkability heuristic
  if (
    (terrain === TerrainId.ShallowWater || terrain === TerrainId.DeepWater) &&
    getCollision &&
    !(getCollision(tx, ty) & CollisionFlag.Water)
  ) {
    return DEFAULT_SURFACE;
  }
  return TERRAIN_SURFACES[terrain] ?? DEFAULT_SURFACE;
}
