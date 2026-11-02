import RAPIER from "@dimforge/rapier3d-compat";
import { DEFAULT_PHYSICAL_HEIGHT } from "../../config/constants.js";
import { getEntityAABB } from "../../entities/collision.js";
import type { Entity } from "../../entities/Entity.js";
import { isVehicle } from "../../traffic/Vehicle.js";
import { entityBody } from "../../traffic/VehicleContact.js";

export const PHYSICS_PIXELS_PER_METRE = 16;
export type CharacterHull = "box" | "capsule";
/** Physics hull and center derive from the same anchored game rectangle. No facing input. */
export function characterShape(entity: Entity, hull: CharacterHull, physicalVehicle = false) {
  const collider = entity.collider;
  if (!collider) throw Error("Character requires a collider");
  const bounds = getEntityAABB(entity.position, collider);
  const half = {
    x: collider.width / 2 / PHYSICS_PIXELS_PER_METRE,
    y: (collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT) / 2 / PHYSICS_PIXELS_PER_METRE,
    z: collider.height / 2 / PHYSICS_PIXELS_PER_METRE,
  };
  const radius = Math.min(half.x, half.y, half.z);
  if (physicalVehicle && isVehicle(entity)) {
    const body = entityBody(entity);
    const rotation = { x: 0, y: -Math.sin(body.angle / 2), z: 0, w: Math.cos(body.angle / 2) };
    half.x = body.halfLength / PHYSICS_PIXELS_PER_METRE;
    half.z = body.halfWidth / PHYSICS_PIXELS_PER_METRE;
    return {
      half,
      sideHalfHeight: half.y,
      center: {
        x: body.x / PHYSICS_PIXELS_PER_METRE,
        y: (body.low + body.high) / 2 / PHYSICS_PIXELS_PER_METRE,
        z: body.y / PHYSICS_PIXELS_PER_METRE,
      },
      rotation,
      descriptor: RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setRotation(rotation),
    };
  }
  return {
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    half,
    sideHalfHeight: hull === "capsule" ? Math.max(0, half.y - radius) : half.y,
    center: {
      x: (bounds.left + bounds.right) / 2 / PHYSICS_PIXELS_PER_METRE,
      y: (entity.wz ?? 0) / PHYSICS_PIXELS_PER_METRE + half.y,
      z: (bounds.top + bounds.bottom) / 2 / PHYSICS_PIXELS_PER_METRE,
    },
    descriptor:
      hull === "capsule"
        ? RAPIER.ColliderDesc.capsule(Math.max(0, half.y - radius), radius)
        : RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z),
  };
}
