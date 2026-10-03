import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntitySurface } from "../physics/surfaceHeight.js";
import { isVehicle } from "./Vehicle.js";

export function vehicleRoofBounds(e: EntitySurface) {
  // Every solid part of the body must support feet at its top plane. A smaller
  // roof let walkers fall inside the hood/trunk and become trapped by side collision.
  if (!e.collider) throw new Error("Vehicle has no collider");
  return getEntityAABB(e.position, e.collider);
}
export function roofSupport(
  entity: Entity,
  entities: readonly EntitySurface[],
): EntitySurface | undefined {
  if (entity.jumpVZ !== undefined || !entity.collider) return undefined;
  const box = getEntityAABB(entity.position, entity.collider);
  return entities.find(
    (e) =>
      isVehicle(e) &&
      e.id !== entity.id &&
      e.collider &&
      Math.abs((entity.wz ?? 0) - (e.wz ?? 0) - (e.collider.physicalHeight ?? 0)) < 0.1 &&
      aabbsOverlap(box, vehicleRoofBounds(e)),
  );
}
