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
import {
  applyVehicleFacing,
  isVehicle,
  vehicleNoseHeading,
  vehicleTurningRadius,
} from "./Vehicle.js";
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
  // Directional input steers toward a nose bearing. It never supplies sideways
  // velocity: signed rolling distance turns the chassis, including in reverse.
  const heading = vehicleNoseHeading(car);
  const reverse = input.reversing === true;
  const targetSpeed =
    performance.speed *
    (reverse ? -0.5 : input.sprinting ? 1.6 : 1) *
    (reverse ? 1 : length * scale);
  const old = car.velocity ?? { vx: 0, vy: 0 };
  const oldSpeed = old.vx * Math.cos(heading) + old.vy * Math.sin(heading);
  const acceleration = (length || reverse ? performance.acceleration : 448) * dt;
  let speed = oldSpeed + Math.max(-acceleration, Math.min(acceleration, targetSpeed - oldSpeed));
  if (contactSpeed !== undefined) speed = Math.max(-contactSpeed, Math.min(contactSpeed, speed));
  const distance = speed * dt;
  const error = length
    ? Math.atan2(
        Math.sin(Math.atan2(input.dy, input.dx) - heading),
        Math.cos(Math.atan2(input.dy, input.dx) - heading),
      )
    : 0;
  const steering = reverse ? Math.sin(error) : Math.max(-1, Math.min(1, error / (Math.PI / 3)));
  let turn = (steering * distance) / vehicleTurningRadius(car.type);
  if (distance > 0) turn = Math.sign(turn) * Math.min(Math.abs(turn), Math.abs(error));
  // Quantize the authoritative bearing to its wire representation before using
  // it again, so binary replay and native simulation share the same turn state.
  const nose = Math.fround(Math.atan2(Math.sin(heading + turn), Math.cos(heading + turn)));
  const velocity = { vx: Math.cos(nose) * speed, vy: Math.sin(nose) * speed };
  const middle = heading + turn / 2;
  const arcScale = Math.abs(turn) > 0.000001 ? Math.sin(turn / 2) / (turn / 2) : 1;
  const next: Entity = {
    ...car,
    sprite: car.sprite && { ...car.sprite },
    position: {
      wx: car.position.wx + Math.cos(middle) * distance * arcScale,
      wy: car.position.wy + Math.sin(middle) * distance * arcScale,
    },
    velocity,
    vehicleHeading: nose,
  };
  applyVehicleFacing(next, facing(Math.cos(nose), Math.sin(nose), previous));
  if (!checkedCarPose(car, next, dt, world, props, entities, queries, pushes !== undefined)) return;
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

/** NPC parking follows authored waypoints, with the same collision/passenger gates.
 * Waypoints retain their existing directional integrator; they are not driver input. */
export function routedCarPose(
  car: Entity,
  target: { vx: number; vy: number },
  dt: number,
  world: World,
  props: readonly Prop[],
  entities: readonly Entity[],
): Entity | undefined {
  const old = car.velocity ?? { vx: 0, vy: 0 };
  const dx = target.vx - old.vx,
    dy = target.vy - old.vy;
  const factor = Math.min(
    1,
    (vehiclePerformance(car.type).acceleration * dt) / (Math.hypot(dx, dy) || 1),
  );
  const velocity = { vx: old.vx + dx * factor, vy: old.vy + dy * factor };
  const next = {
    ...car,
    sprite: car.sprite && { ...car.sprite },
    position: { wx: car.position.wx + velocity.vx * dt, wy: car.position.wy + velocity.vy * dt },
    velocity,
  };
  delete next.vehicleHeading;
  applyVehicleFacing(
    next,
    facing(velocity.vx, velocity.vy, car.sprite?.direction ?? Direction.Down),
  );
  return checkedCarPose(car, next, dt, world, props, entities);
}

/** Pure full-body validation, shared by driven rolling motion and routed parking. */
function checkedCarPose(
  car: Entity,
  next: Entity,
  dt: number,
  world: World,
  props: readonly Prop[],
  entities: readonly Entity[],
  queries?: DrivingQueries,
  planPushes = false,
): Entity | undefined {
  const velocity = next.velocity ?? { vx: 0, vy: 0 };
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
  for (const other of planPushes ? [] : (queries?.bodies?.(swept) ?? entities)) {
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
  return next;
}
