import { isBoat } from "../boats/Boat.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { isVehicle } from "./Vehicle.js";

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
