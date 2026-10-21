import { isBoat } from "../boats/Boat.js";
import {
  aabbLacksWater,
  aabbOverlapsPropWalls,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { axisBox } from "../physics/OrientedBox.js";
import { resolveGroundZForTracking } from "../physics/surfaceHeight.js";
import { isTrain } from "../railway/Train.js";
import { isCarryable } from "../wildlife/ForageResources.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import { separatesContact } from "./ContactRecovery.js";
import { type DrivingQueries, drivingQueries } from "./DrivingQueries.js";
import { movingPassengerPosition } from "./MovingSupport.js";
import { roofSupport } from "./RoofSupport.js";
import { towedPose } from "./Towing.js";
import {
  applyVehicleFacing,
  isVehicle,
  vehicleNoseHeading,
  vehicleTurningRadius,
} from "./Vehicle.js";
import { bedDriveLocked, movingSupportZ } from "./VehicleBed.js";
import { bedInteriorOccupant } from "./VehicleCargo.js";
import { carBodyMotion, entityBody, orientedCar } from "./VehicleContact.js";
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
  input: {
    dx: number;
    dy: number;
    sprinting?: boolean;
    reversing?: boolean;
    relativeDriving?: boolean;
  },
  dt: number,
  world: World,
  props: readonly Prop[],
  entities: readonly Entity[],
  queries?: DrivingQueries,
  pushes?: VehiclePush[],
  contactSpeed?: number,
  straight = false,
  towPlan?: { before: Entity; after: Entity }[],
): Entity | undefined {
  if (![input.dx, input.dy, dt].every(Number.isFinite) || dt <= 0 || dt > 0.1) return;
  if (car.towedBy !== undefined) return;
  const trailer =
    car.towTargetId !== undefined
      ? entities.find((e) => e.id === car.towTargetId && e.towedBy === car.id)
      : undefined;
  if (car.towTargetId !== undefined && !trailer) return;
  const collisionEntities = trailer ? entities.filter((e) => e.id !== trailer.id) : entities;
  const collisionQueries =
    trailer && queries
      ? {
          ...queries,
          ...(queries.bodies
            ? {
                bodies: (box: Parameters<NonNullable<DrivingQueries["bodies"]>>[0]) =>
                  (queries.bodies?.(box) ?? []).filter((e) => e.id !== trailer.id),
              }
            : {}),
        }
      : queries;
  if (bedDriveLocked(car))
    return {
      ...car,
      velocity: { vx: 0, vy: 0 },
      sprite: car.sprite && { ...car.sprite, moving: false },
    };
  const length = Math.hypot(input.dx, input.dy);
  const scale = length > 1 ? 1 / length : 1;
  const basePerformance = vehiclePerformance(car.type);
  const performance = trailer
    ? { ...basePerformance, speed: Math.min(64, basePerformance.speed), acceleration: 80 }
    : basePerformance;
  const previous = car.sprite?.direction ?? Direction.Down;
  // Directional input steers toward a nose bearing. It never supplies sideways
  // velocity: signed rolling distance turns the chassis, including in reverse.
  const heading = vehicleNoseHeading(car);
  if (car.vehicleHeading === undefined) {
    car = { ...car, sprite: car.sprite && { ...car.sprite }, vehicleHeading: Math.fround(heading) };
    applyVehicleFacing(car);
  }
  const old = car.velocity ?? { vx: 0, vy: 0 };
  const oldSpeed = old.vx * Math.cos(heading) + old.vy * Math.sin(heading);
  const relative = input.relativeDriving === true;
  const error =
    !relative && length
      ? Math.atan2(
          Math.sin(Math.atan2(input.dy, input.dx) - heading),
          Math.cos(Math.atan2(input.dy, input.dx) - heading),
        )
      : 0;
  // Enter reverse beyond 120 degrees; keep it until the aim passes 90 degrees.
  // The velocity sign supplies deterministic gear hysteresis through replay.
  const automaticReverse = length > 0 && Math.cos(error) < (oldSpeed < -0.01 ? 0 : -0.5);
  const reverse = input.reversing === true || (relative ? input.dy > 0 : automaticReverse);
  const throttle = relative ? Math.min(1, Math.abs(input.dy)) : length * scale;
  const targetSpeed =
    performance.speed *
    (reverse ? -0.5 : input.sprinting ? 1.6 : 1) *
    (input.reversing ? 1 : throttle);
  const acceleration =
    (throttle || input.reversing ? performance.acceleration : isBoat(car) ? 48 : 448) * dt;
  let speed = oldSpeed + Math.max(-acceleration, Math.min(acceleration, targetSpeed - oldSpeed));
  if (contactSpeed !== undefined) speed = Math.max(-contactSpeed, Math.min(contactSpeed, speed));
  const distance = speed * dt;
  const steering = relative
    ? Math.max(-1, Math.min(1, input.dx))
    : reverse
      ? Math.sin(error)
      : Math.max(-1, Math.min(1, error / (Math.PI / 3)));
  let turn = ((straight ? 0 : steering) * distance) / vehicleTurningRadius(car.type);
  if (!relative && distance > 0) turn = Math.sign(turn) * Math.min(Math.abs(turn), Math.abs(error));
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
  // A turn can widen the envelope against a wall. Let a clear straight roll
  // escape instead of requiring an impossible turn at rest. All gates still run.
  const retryStraight = () =>
    !straight && Math.abs(turn) > 1e-8
      ? drivenCarPose(
          car,
          input,
          dt,
          world,
          props,
          entities,
          queries,
          pushes,
          contactSpeed,
          true,
          towPlan,
        )
      : undefined;
  if (
    !checkedCarPose(
      car,
      next,
      dt,
      world,
      props,
      collisionEntities,
      collisionQueries,
      pushes !== undefined && !isBoat(car) && !trailer,
    )
  )
    return retryStraight();
  const towed = trailer && towedPose(trailer, next);
  if (
    trailer &&
    (!towed ||
      !checkedCarPose(
        trailer,
        towed,
        dt,
        world,
        props,
        entities.filter((e) => e.id !== car.id),
        queries && {
          ...queries,
          ...(queries.bodies
            ? {
                bodies: (box: Parameters<NonNullable<DrivingQueries["bodies"]>>[0]) =>
                  (queries.bodies?.(box) ?? []).filter((e) => e.id !== car.id),
              }
            : {}),
        },
        false,
      ) ||
      Math.abs((towed.wz ?? 0) - (next.wz ?? 0)) > 0.25)
  )
    return retryStraight();
  if (pushes && !isBoat(car) && !trailer) {
    const plan = planVehiclePushes(
      [{ before: car, after: next }],
      dt,
      performance,
      world,
      props,
      collisionEntities,
      collisionQueries,
    );
    if (!plan) {
      if (contactSpeed === undefined)
        return (
          drivenCarPose(
            car,
            input,
            dt,
            world,
            props,
            entities,
            queries,
            pushes,
            performance.pushSpeed * 0.98,
            straight,
            towPlan,
          ) ?? retryStraight()
        );
      return retryStraight();
    }
    pushes.push(...plan);
  }
  if (trailer && towed) towPlan?.push({ before: trailer, after: towed });
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
export function checkedCarPose(
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
  let motion =
    orientedCar(car) && car.vehicleHeading !== undefined ? carBodyMotion(car, next) : undefined;
  const swept = motion?.bounds ?? {
    left: Math.min(before.left, after.left),
    top: Math.min(before.top, after.top),
    right: Math.max(before.right, after.right),
    bottom: Math.max(before.bottom, after.bottom),
  };
  for (let y = Math.floor(swept.top / 16); y <= Math.floor((swept.bottom - 0.001) / 16); y++)
    for (let x = Math.floor(swept.left / 16); x <= Math.floor((swept.right - 0.001) / 16); x++) {
      if (!world.getChunkIfLoaded(Math.floor(x / 16), Math.floor(y / 16))) return;
      if (
        world.getCollisionIfLoaded(x, y) &
          (isBoat(car) ? CollisionFlag.Solid : CollisionFlag.Solid | CollisionFlag.Water) &&
        (motion
          ? motion.contact(
              axisBox(
                { left: x * 16, right: (x + 1) * 16, top: y * 16, bottom: (y + 1) * 16 },
                -1e30,
                1e30,
              ),
              true,
            )
          : isBoat(car) ||
            !separatesContact(before, after, {
              left: x * 16,
              right: (x + 1) * 16,
              top: y * 16,
              bottom: (y + 1) * 16,
            }))
      )
        return;
    }
  if (isBoat(car) && aabbLacksWater(swept, (x, y) => world.getCollisionIfLoaded(x, y))) return;
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
  if (motion) motion = carBodyMotion(car, next);
  const height = next.collider.physicalHeight ?? 24;
  for (const prop of localProps)
    for (const wall of prop.walls ?? (prop.collider ? [prop.collider] : [])) {
      const part = { collider: wall, walls: null };
      const wasBlocked = aabbOverlapsPropWalls(before, prop.position, part, beforeZ, height);
      const blocked = aabbOverlapsPropWalls(
        swept,
        prop.position,
        part,
        Math.min(beforeZ, z),
        height + Math.abs(z - beforeZ),
      );
      if (motion) {
        if (
          (wasBlocked || blocked) &&
          motion.contact(
            axisBox(
              getEntityAABB(prop.position, wall),
              wall.surface ? -1e30 : (wall.zBase ?? 0),
              wall.surface ? 1e30 : (wall.zBase ?? 0) + (wall.zHeight ?? 1e30),
            ),
            !wall.surface,
          )
        )
          return;
        continue;
      }
      if (
        (wasBlocked || blocked) &&
        !(
          !isBoat(car) &&
          wasBlocked &&
          !wall.surface &&
          separatesContact(before, after, getEntityAABB(prop.position, wall))
        )
      )
        return;
    }
  for (const other of planPushes ? [] : (queries?.bodies?.(swept) ?? entities)) {
    if (
      other.id === car.id ||
      other.parentId === car.id ||
      roofSupport(other, [car])?.id === car.id ||
      (bedInteriorOccupant(car, other) && bedInteriorOccupant(next, other)) ||
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
    const box = getEntityAABB(other.position, other.collider);
    if (
      aabbsOverlap(swept, box) &&
      (motion
        ? motion.contact(entityBody(other), true)
        : isBoat(car) || !separatesContact(before, after, box))
    )
      return;
  }
  for (const rider of entities) {
    if (
      (rider.type !== "player" && !isCarryable(rider)) ||
      !rider.collider ||
      roofSupport(rider, entities)?.id !== car.id
    )
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
    const roofZ = z + movingSupportZ(car, rider) - (car.wz ?? 0);
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
