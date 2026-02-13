import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import { createChicken } from "./Chicken.js";
import { aabbOverlapsSolid, getEntityAABB } from "./collision.js";
import type { Entity } from "./Entity.js";
import type { EntityManager } from "./EntityManager.js";

/** Move entity to the nearest walkable tile (spiral search). */
export function findWalkableSpawn(entity: Entity, world: World): void {
  const blockMask = CollisionFlag.Solid | CollisionFlag.Water;
  const getCollision = (tx: number, ty: number) => world.getCollision(tx, ty);

  if (
    entity.collider &&
    !aabbOverlapsSolid(getEntityAABB(entity.position, entity.collider), getCollision, blockMask)
  ) {
    return;
  }

  const tx0 = Math.floor(entity.position.wx / TILE_SIZE);
  const ty0 = Math.floor(entity.position.wy / TILE_SIZE);
  for (let radius = 1; radius <= CHUNK_SIZE * 2; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const tx = tx0 + dx;
        const ty = ty0 + dy;
        const candidatePos = {
          wx: tx * TILE_SIZE + TILE_SIZE / 2,
          wy: ty * TILE_SIZE + TILE_SIZE / 2,
        };
        if (
          entity.collider &&
          !aabbOverlapsSolid(getEntityAABB(candidatePos, entity.collider), getCollision, blockMask)
        ) {
          entity.position.wx = candidatePos.wx;
          entity.position.wy = candidatePos.wy;
          return;
        }
      }
    }
  }
}

/** Spawn chickens on walkable tiles near the origin. */
export function spawnInitialChickens(
  count: number,
  world: World,
  entityManager: EntityManager,
): void {
  let spawned = 0;
  let attempts = 0;
  const range = CHUNK_SIZE * TILE_SIZE;
  while (spawned < count && attempts < 200) {
    attempts++;
    const wx = (Math.random() - 0.5) * range * 2;
    const wy = (Math.random() - 0.5) * range * 2;
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    const collision = world.getCollision(tx, ty);
    if (collision === CollisionFlag.None) {
      entityManager.spawn(createChicken(wx, wy));
      spawned++;
    }
  }
}
