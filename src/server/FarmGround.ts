import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import type { PositionComponent } from "../entities/Entity.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";

export const FARM_BLOCKED_GROUND = CollisionFlag.Water | CollisionFlag.Solid;

export function dryFarmGround(world: World, point: PositionComponent): number | undefined {
  const tx = Math.floor(point.wx / TILE_SIZE);
  const ty = Math.floor(point.wy / TILE_SIZE);
  return world.getCollisionIfLoaded(tx, ty) & FARM_BLOCKED_GROUND
    ? undefined
    : world.getHeightAt(tx, ty) * ELEVATION_PX;
}
