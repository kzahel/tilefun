import { isBoat } from "../boats/Boat.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { isVehicle, vehicleBodySize } from "./Vehicle.js";

/** Boats/rail controls are deferred; every land model has the same basic seat. */
export function isDrivable(entity: Entity): boolean {
  return isVehicle(entity) && !isBoat(entity);
}
export function occupiedVehicle(player: Entity, entities: readonly Entity[]): Entity | undefined {
  return player.parentId === undefined
    ? undefined
    : entities.find((e) => e.id === player.parentId && isDrivable(e));
}
export function boardingDistance(player: Entity, vehicle: Entity): number {
  if (!vehicle.collider) return Infinity;
  const b = getEntityAABB(vehicle.position, vehicle.collider);
  return Math.hypot(
    Math.max(b.left - player.position.wx, 0, player.position.wx - b.right),
    Math.max(b.top - player.position.wy, 0, player.position.wy - b.bottom),
  );
}

/** Distance to the rotated physical height interval, not the car's nominal base.
 * An overturned truck's local base may be high above the ground beside it. */
export function vehicleVerticalDistance(player: Entity, vehicle: Entity): number {
  const base = vehicle.wz ?? 0,
    q = vehicle.bodyRotation;
  if (!q) return Math.abs((player.wz ?? 0) - base);
  const size = vehicleBodySize(vehicle.type, 0),
    height = vehicle.collider?.physicalHeight ?? 16;
  const x = rotateBodyVector(q, 1, 0, 0),
    y = rotateBodyVector(q, 0, 1, 0),
    z = rotateBodyVector(q, 0, 0, 1);
  const center = base + (z.z * height) / 2;
  const half =
    (Math.abs(x.z) * size.width + Math.abs(y.z) * size.height + Math.abs(z.z) * height) / 2;
  return Math.max(center - half - (player.wz ?? 0), (player.wz ?? 0) - center - half, 0);
}
