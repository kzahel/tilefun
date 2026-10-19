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
import { type DrivingQueries, drivingQueries } from "./DrivingQueries.js";
import { movingPassengerPosition } from "./MovingSupport.js";
import { roofSupport } from "./RoofSupport.js";
import { applyVehicleFacing, isVehicle } from "./Vehicle.js";
import { vehiclePerformance } from "./VehiclePerformance.js";
import { planVehiclePushes, type VehiclePush } from "./VehiclePush.js";

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

/** Shared authority/replay car step. Supplying pushes opts into gentle contact planning.
 * Call in small substeps; commit body, pushes and passengers together only after all clear. */
export function drivenCarPose(
  car: Entity,
  input: { dx: number; dy: number; sprinting?: boolean; reversing?: boolean },
  dt: number,
  world: World,
  props: readonly Prop[],
  entities: readonly Entity[],
  queries?: DrivingQueries,
  pushes?: VehiclePush[],
  contactSpeed?: number,
): Entity | undefined {
  if (![input.dx, input.dy, dt].every(Number.isFinite) || dt <= 0 || dt > 0.1) return;
  const length = Math.hypot(input.dx, input.dy);
  const scale = length > 1 ? 1 / length : 1;
  const performance = vehiclePerformance(car.type);
  const previous = car.sprite?.direction ?? Direction.Down;
  // Reverse is a shared held action: back along the nose, with optional directional steering.
  // It is deliberately slower than forward driving and cannot be boosted.
  const reverse = input.reversing === true;
  const direction = length
    ? { x: input.dx * scale, y: input.dy * scale }
    : {
        x: previous === Direction.Left ? -1 : previous === Direction.Right ? 1 : 0,
        y: previous === Direction.Up ? -1 : previous === Direction.Down ? 1 : 0,
      };
  const speed = performance.speed * (reverse ? -0.5 : input.sprinting ? 1.6 : 1);
  const targetX = (reverse ? direction.x : input.dx * scale) * speed,
    targetY = (reverse ? direction.y : input.dy * scale) * speed;
  const old = car.velocity ?? { vx: 0, vy: 0 };
  const change = { vx: targetX - old.vx, vy: targetY - old.vy };
  const difference = Math.hypot(change.vx, change.vy);
  const amount = Math.min(
    1,
    ((length || reverse ? performance.acceleration : 448) * dt) / (difference || 1),
  );
  const velocity = { vx: old.vx + change.vx * amount, vy: old.vy + change.vy * amount };
  if (contactSpeed !== undefined) {
    const factor = Math.min(1, contactSpeed / (Math.hypot(velocity.vx, velocity.vy) || 1));
    velocity.vx *= factor;
    velocity.vy *= factor;
  }
  const next: Entity = {
    ...car,
    sprite: car.sprite && { ...car.sprite },
    position: { wx: car.position.wx + velocity.vx * dt, wy: car.position.wy + velocity.vy * dt },
    velocity,
  };
  applyVehicleFacing(
    next,
    reverse
      ? facing(direction.x, direction.y, previous)
      : length && velocity.vx * input.dx + velocity.vy * input.dy > 0
        ? facing(velocity.vx, velocity.vy, previous)
        : previous,
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
  queries ??= drivingQueries(props);
  // Include offset feet outside the collider as well as both cardinal poses.
  const bounds = {
    ...swept,
    left: Math.min(swept.left, next.position.wx),
    right: Math.max(swept.right, next.position.wx),
    top: Math.min(swept.top, next.position.wy),
    bottom: Math.max(swept.bottom, next.position.wy),
  };
  const localProps = queries?.props(bounds) ?? props;
  const z = resolveGroundZForTracking(next, (x, y) => world.getHeightAt(x, y), localProps, []);
  const beforeZ = car.wz ?? 0;
  if (Math.abs(z - beforeZ) > Math.hypot(velocity.vx, velocity.vy) * dt * 0.5 + 0.001) return;
  next.wz = next.groundZ = z;
  const height = next.collider.physicalHeight ?? 24;
  for (const prop of localProps)
    if (
      aabbOverlapsPropWalls(before, prop.position, prop, beforeZ, height) ||
      aabbOverlapsPropWalls(after, prop.position, prop, z, height)
    )
      return;
  for (const other of pushes ? [] : (queries?.bodies?.(swept) ?? entities)) {
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
      (queries?.props(sweep) ?? props).some((p) =>
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
  if (pushes) {
    const plan = planVehiclePushes(
      [{ before: car, after: next }],
      dt,
      performance,
      world,
      props,
      entities,
      queries,
    );
    if (!plan) {
      if (contactSpeed === undefined)
        return drivenCarPose(
          car,
          input,
          dt,
          world,
          props,
          entities,
          queries,
          pushes,
          performance.pushSpeed * 0.98,
        );
      return;
    }
    pushes.push(...plan);
  }
  return next;
}
