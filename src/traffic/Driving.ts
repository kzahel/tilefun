import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { resolveGroundZForTracking } from "../physics/surfaceHeight.js";
import { isTrain } from "../railway/Train.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import { movingPassengerPosition } from "./MovingSupport.js";
import { roofSupport } from "./RoofSupport.js";
import { applyVehicleFacing, isVehicle } from "./Vehicle.js";

export const DRIVE_SPEED = 112;
export function isDrivable(entity: Entity): boolean {
  return isVehicle(entity) || isTrain(entity);
}
export function occupiedVehicle(player: Entity, entities: readonly Entity[]): Entity | undefined {
  return player.parentId === undefined
    ? undefined
    : entities.find((e) => e.id === player.parentId && isDrivable(e));
}
export function boardingDistance(player: Entity, vehicle: Entity): number {
  if (!vehicle.collider) return Infinity;
  const box = getEntityAABB(vehicle.position, vehicle.collider);
  return Math.hypot(
    Math.max(box.left - player.position.wx, 0, player.position.wx - box.right),
    Math.max(box.top - player.position.wy, 0, player.position.wy - box.bottom),
  );
}
function facing(dx: number, dy: number, previous: Direction): Direction {
  if (!dx && !dy) return previous;
  const horizontal = previous === Direction.Left || previous === Direction.Right;
  const x = Math.abs(dx),
    y = Math.abs(dy);
  const useX = horizontal ? x >= y * 0.9 : x > y * 1.1;
  return useX
    ? dx > 0
      ? Direction.Right
      : Direction.Left
    : dy > 0
      ? Direction.Down
      : Direction.Up;
}

/** Shared authority/replay car step. Call in small substeps; commit only a clear full body. */
export function drivenCarPose(
  car: Entity,
  input: { dx: number; dy: number },
  dt: number,
  world: World,
  props: readonly Prop[],
  entities: readonly Entity[],
): Entity | undefined {
  if (![input.dx, input.dy, dt].every(Number.isFinite) || dt <= 0 || dt > 0.1) return;
  const length = Math.hypot(input.dx, input.dy);
  const scale = length > 1 ? 1 / length : 1;
  const targetX = input.dx * scale * DRIVE_SPEED,
    targetY = input.dy * scale * DRIVE_SPEED;
  const old = car.velocity ?? { vx: 0, vy: 0 };
  const change = { vx: targetX - old.vx, vy: targetY - old.vy };
  const difference = Math.hypot(change.vx, change.vy);
  const amount = Math.min(1, ((length ? 224 : 448) * dt) / (difference || 1));
  const velocity = { vx: old.vx + change.vx * amount, vy: old.vy + change.vy * amount };
  const next: Entity = {
    ...car,
    sprite: car.sprite && { ...car.sprite },
    position: { wx: car.position.wx + velocity.vx * dt, wy: car.position.wy + velocity.vy * dt },
    velocity,
  };
  applyVehicleFacing(
    next,
    facing(velocity.vx, velocity.vy, car.sprite?.direction ?? Direction.Down),
  );
  if (!car.collider || !next.collider) return;
  const before = getEntityAABB(car.position, car.collider),
    after = getEntityAABB(next.position, next.collider);
  const swept = {
    left: Math.min(before.left, after.left),
    top: Math.min(before.top, after.top),
    right: Math.max(before.right, after.right),
    bottom: Math.max(before.bottom, after.bottom),
  };
  for (let y = Math.floor(swept.top / 16); y <= Math.floor((swept.bottom - 0.001) / 16); y++)
    for (let x = Math.floor(swept.left / 16); x <= Math.floor((swept.right - 0.001) / 16); x++)
      if (!world.getChunkIfLoaded(Math.floor(x / 16), Math.floor(y / 16))) return;
  if (
    aabbOverlapsSolid(
      swept,
      (x, y) => world.getCollisionIfLoaded(x, y),
      CollisionFlag.Solid | CollisionFlag.Water,
    )
  )
    return;
  const z = resolveGroundZForTracking(next, (x, y) => world.getHeightAt(x, y), props, []);
  const beforeZ = car.wz ?? 0;
  if (Math.abs(z - beforeZ) > Math.hypot(velocity.vx, velocity.vy) * dt * 0.5 + 0.001) return;
  next.wz = next.groundZ = z;
  const height = next.collider.physicalHeight ?? 24;
  for (const prop of props)
    if (
      aabbOverlapsPropWalls(before, prop.position, prop, beforeZ, height) ||
      aabbOverlapsPropWalls(after, prop.position, prop, z, height)
    )
      return;
  for (const other of entities) {
    if (
      other.id === car.id ||
      other.parentId === car.id ||
      !other.collider ||
      other.collider.solid === false
    )
      continue;
    const base = other.wz ?? 0;
    if (
      base >= Math.max(beforeZ, z) + height ||
      base + (other.collider.physicalHeight ?? 16) <= Math.min(beforeZ, z)
    )
      continue;
    if (aabbsOverlap(swept, getEntityAABB(other.position, other.collider))) return;
  }
  for (const rider of entities) {
    if (rider.type !== "player" || !rider.collider || roofSupport(rider, entities)?.id !== car.id)
      continue;
    const position = movingPassengerPosition(rider, car, next);
    const a = getEntityAABB(rider.position, rider.collider),
      b = getEntityAABB(position, rider.collider);
    const sweep = {
      left: Math.min(a.left, b.left),
      right: Math.max(a.right, b.right),
      top: Math.min(a.top, b.top),
      bottom: Math.max(a.bottom, b.bottom),
    };
    const roofZ = z + height;
    if (
      props.some((p) =>
        aabbOverlapsPropWalls(
          sweep,
          p.position,
          p,
          Math.min(rider.wz ?? roofZ, roofZ),
          (rider.collider?.physicalHeight ?? 16) + Math.abs((rider.wz ?? roofZ) - roofZ),
        ),
      )
    )
      return;
  }
  if (next.sprite) next.sprite.moving = Math.hypot(velocity.vx, velocity.vy) > 0.01;
  return next;
}
