import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { isVehicle } from "./Vehicle.js";

export function roofSupport(actor: Entity, vehicles: readonly Entity[]): Entity | undefined {
  if (actor.jumpVZ !== undefined || !actor.collider) return;
  const feet = getEntityAABB(actor.position, actor.collider);
  return vehicles.find(
    (e) =>
      e.id !== actor.id &&
      isVehicle(e) &&
      e.collider &&
      Math.abs((actor.wz ?? 0) - (e.wz ?? 0) - (e.collider.physicalHeight ?? 0)) < 0.25 &&
      aabbsOverlap(feet, getEntityAABB(e.position, e.collider)),
  );
}
