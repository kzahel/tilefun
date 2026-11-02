import RAPIER from "@dimforge/rapier3d-compat";
import { DEFAULT_PHYSICAL_HEIGHT } from "../../config/constants.js";
import { getEntityAABB } from "../../entities/collision.js";
import type { Entity } from "../../entities/Entity.js";

export const PHYSICS_PIXELS_PER_METRE = 16;
export type CharacterHull = "box" | "capsule";
/** Physics hull and center derive from the same anchored game rectangle. No facing input. */
export function characterShape(entity: Entity, hull: CharacterHull) {
  const collider = entity.collider;
  if (!collider) throw Error("Character requires a collider");
  const bounds = getEntityAABB(entity.position, collider);
  const half = {
    x: collider.width / 2 / PHYSICS_PIXELS_PER_METRE,
    y: (collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT) / 2 / PHYSICS_PIXELS_PER_METRE,
    z: collider.height / 2 / PHYSICS_PIXELS_PER_METRE,
  };
  const radius = Math.min(half.x, half.y, half.z);
  return {
    half,
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
