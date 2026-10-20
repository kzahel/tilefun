import {
  type AABB,
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { Prop } from "../entities/Prop.js";
import { boxDepth, separationAlong } from "../physics/OrientedBox.js";
import { resolveGroundZForTracking } from "../physics/surfaceHeight.js";
import { canBecomeRoadkill, createRoadkill } from "../wildlife/Roadkill.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import { separatesContact } from "./ContactRecovery.js";
import type { DrivingQueries } from "./DrivingQueries.js";
import { carBodyMotion, entityBody, orientedCar } from "./VehicleContact.js";

export interface VehiclePush {
  entity: Entity;
  position: Entity["position"];
  z: number;
  /** Planned removal, committed only with the complete vehicle/passenger step. */
  roadkill?: boolean;
}
export interface VehicleMotion {
  before: Entity;
  after: Entity;
}
function envelope(a: AABB, b: AABB): AABB {
  return {
    left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right),
    top: Math.min(a.top, b.top),
    bottom: Math.max(a.bottom, b.bottom),
  };
}
function overlapsHeight(entity: Entity, low: number, high: number): boolean {
  return (
    (entity.wz ?? 0) < high && (entity.wz ?? 0) + (entity.collider?.physicalHeight ?? 16) > low
  );
}
/** Intersect the moving box's six half-spaces over the step. The envelope is
 * only broad phase: diagonal corner misses and height-separated crossings are safe. */
function sweptBodyContact(before: Entity, after: Entity, other: Entity): boolean {
  if (!before.collider || !after.collider || !other.collider) return false;
  const a = getEntityAABB(before.position, before.collider);
  const b = getEntityAABB(after.position, after.collider);
  const target = getEntityAABB(other.position, other.collider);
  const low = other.wz ?? 0;
  const high = low + (other.collider.physicalHeight ?? 16);
  let enter = 0,
    leave = 1;
  for (const [start, end] of [
    [a.right - target.left, b.right - target.left],
    [target.right - a.left, target.right - b.left],
    [a.bottom - target.top, b.bottom - target.top],
    [target.bottom - a.top, target.bottom - b.top],
    [
      (before.wz ?? 0) + (before.collider.physicalHeight ?? 24) - low,
      (after.wz ?? 0) + (after.collider.physicalHeight ?? 24) - low,
    ],
    [high - (before.wz ?? 0), high - (after.wz ?? 0)],
  ] as const) {
    if (start <= 0 && end <= 0) return false;
    if (start <= 0) enter = Math.max(enter, -start / (end - start));
    else if (end <= 0) leave = Math.min(leave, start / (start - end));
  }
  return enter < leave;
}
/** Pure, all-or-nothing contact plan. No impulses, chain pushing, wall clipping or roof displacement. */
export function planVehiclePushes(
  motions: readonly VehicleMotion[],
  dt: number,
  tuning: { pushSpeed: number; pushWeight: number },
  world: World,
  props: readonly Prop[],
  entities: readonly Entity[],
  queries?: DrivingQueries,
): VehiclePush[] | undefined {
  const movingIds = new Set(motions.map((m) => m.before.id));
  const planned = new Map<number, VehiclePush>();
  for (const { before, after } of motions) {
    if (!before.collider || !after.collider) return;
    const motion =
      orientedCar(before) && before.vehicleHeading !== undefined
        ? carBodyMotion(before, after)
        : undefined;
    const swept =
      motion?.bounds ??
      envelope(
        getEntityAABB(before.position, before.collider),
        getEntityAABB(after.position, after.collider),
      );
    const dx = after.position.wx - before.position.wx,
      dy = after.position.wy - before.position.wy;
    const distance = Math.hypot(dx, dy),
      ux = dx / (distance || 1),
      uy = dy / (distance || 1);
    for (const other of queries?.bodies?.(swept) ?? entities) {
      if (
        movingIds.has(other.id) ||
        !other.collider ||
        (other.collider.solid === false && other.type !== "ball") ||
        other.parentId !== undefined
      )
        continue;
      if (
        !overlapsHeight(
          other,
          Math.min(before.wz ?? 0, after.wz ?? 0),
          Math.max(before.wz ?? 0, after.wz ?? 0) + (after.collider.physicalHeight ?? 24),
        )
      )
        continue;
      const box = getEntityAABB(other.position, other.collider);
      if (!aabbsOverlap(swept, box)) continue;
      if (
        motion
          ? !motion.contact(entityBody(other), true)
          : separatesContact(
              getEntityAABB(before.position, before.collider),
              getEntityAABB(after.position, after.collider),
              box,
            )
      )
        continue;
      if (distance > 0 && canBecomeRoadkill(other)) {
        if (motion ? motion.contact(entityBody(other)) : sweptBodyContact(before, after, other))
          planned.set(other.id, {
            entity: other,
            position: { ...other.position },
            z: other.wz ?? 0,
            roadkill: true,
          });
        continue;
      }
      if (
        !distance ||
        !other.velocity ||
        !(other.type === "player" || other.type === "ball" || other.wanderAI) ||
        (other.weight ?? 30) > tuning.pushWeight
      )
        return;
      // Move along travel until one axis clears the complete vehicle sweep.
      const amount = motion
        ? separationAlong(entityBody(after), entityBody(other), ux, uy)
        : Math.min(
            ux > 0
              ? (swept.right - box.left + 0.001) / ux
              : ux < 0
                ? (swept.left - box.right - 0.001) / ux
                : Infinity,
            uy > 0
              ? (swept.bottom - box.top + 0.001) / uy
              : uy < 0
                ? (swept.top - box.bottom - 0.001) / uy
                : Infinity,
          );
      if (amount > tuning.pushSpeed * dt + 0.01 || amount < 0) return;
      const position = { wx: other.position.wx + ux * amount, wy: other.position.wy + uy * amount };
      const existing = planned.get(other.id);
      if (
        existing &&
        Math.hypot(existing.position.wx - position.wx, existing.position.wy - position.wy) > 0.01
      )
        return;
      planned.set(other.id, { entity: other, position, z: other.wz ?? 0 });
    }
  }
  const result = [...planned.values()];
  for (const push of result) {
    if (push.roadkill) continue;
    const { entity, position } = push,
      collider = entity.collider;
    if (!collider) return;
    const swept = envelope(
      getEntityAABB(entity.position, collider),
      getEntityAABB(position, collider),
    );
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
    const localProps = queries?.props(swept) ?? props;
    const ground = resolveGroundZForTracking(
      { ...entity, position },
      (x, y) => world.getHeightAt(x, y),
      localProps,
      [],
    );
    // Never shove someone over a ledge or up a step. Airborne height remains theirs.
    if (Math.abs(ground - (entity.groundZ ?? (entity.wz ?? 0) - (entity.jumpZ ?? 0))) > 1) return;
    if ((entity.jumpZ ?? 0) <= 0) push.z = ground;
    const low = Math.min(entity.wz ?? 0, push.z),
      height = (collider.physicalHeight ?? 16) + Math.abs((entity.wz ?? 0) - push.z);
    if (localProps.some((p) => aabbOverlapsPropWalls(swept, p.position, p, low, height))) return;
    for (const other of queries?.bodies?.(swept) ?? entities) {
      if (
        other.id === entity.id ||
        planned.get(other.id)?.roadkill ||
        movingIds.has(other.id) ||
        !other.collider ||
        other.collider.solid === false ||
        other.parentId !== undefined
      )
        continue;
      if (
        overlapsHeight(other, low, low + height) &&
        aabbsOverlap(swept, getEntityAABB(other.position, other.collider)) &&
        (!orientedCar(other) ||
          carBodyMotion(entity, { ...entity, position, wz: push.z }).contact(entityBody(other)))
      )
        return;
    }
    for (const { after } of motions) {
      if (!after.collider || !overlapsHeight(after, low, low + height)) continue;
      if (boxDepth(entityBody({ ...entity, position, wz: push.z }), entityBody(after)) > 1e-7)
        return;
    }
  }
  return result;
}
export function commitVehiclePushes(plan: readonly VehiclePush[], entities: EntityManager): void {
  for (const { entity, position, z, roadkill } of plan) {
    if (roadkill) {
      // A multi-carriage plan may meet the same animal more than once.
      if (!entities.byId.has(entity.id)) continue;
      const remains = createRoadkill(entity);
      entities.remove(entity.id);
      entities.spawn(remains);
      continue;
    }
    entity.position = position;
    if ((entity.jumpZ ?? 0) <= 0) entity.wz = entity.groundZ = z;
    entities.spatialHash.update(entity);
  }
}
