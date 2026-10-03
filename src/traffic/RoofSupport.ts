import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntitySurface } from "../physics/surfaceHeight.js";
import { isVehicle, vehicleRoofSize } from "./Vehicle.js";

export function vehicleRoofBounds(e: EntitySurface) {
  const size = vehicleRoofSize(e.type ?? "");
  return {
    left: e.position.wx - size / 2,
    right: e.position.wx + size / 2,
    top: e.position.wy - size / 2,
    bottom: e.position.wy + size / 2,
  };
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
