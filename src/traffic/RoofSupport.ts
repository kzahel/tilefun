import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { isVehicle } from "./Vehicle.js";

export function roofSupport(actor: Entity, vehicles: readonly Entity[]): Entity | undefined {
  if (actor.jumpVZ !== undefined || !actor.collider) return;
  const feet = getEntityAABB(actor.position, actor.collider);
  const wz = actor.wz ?? 0;
  // Height first: it rejects nearly every pair with arithmetic alone (a crowd
  // beside a car park tests each actor against each vehicle, every frame).
  return vehicles.find(
    (e) =>
      e.collider &&
      Math.abs(wz - (e.wz ?? 0) - (e.collider.physicalHeight ?? 0)) < 0.25 &&
      e.id !== actor.id &&
      isVehicle(e) &&
      aabbsOverlap(feet, getEntityAABB(e.position, e.collider)),
  );
}
