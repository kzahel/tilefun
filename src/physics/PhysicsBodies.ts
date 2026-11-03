import { DEFAULT_PHYSICAL_HEIGHT } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { vehicleBodySize, vehicleNoseHeading } from "../traffic/Vehicle.js";
import type { PhysicsBodyKind } from "./PhysicsState.js";
export function physicsBodyKind(entity: Entity): PhysicsBodyKind {
  if (entity.type.startsWith("vehicle-v1:")) return "vehicle";
  if (entity.type === "ball") return "loose";
  if (entity.workItem) {
    const item = entity.workItem;
    // Food sources and storage sites are anchored gameplay markers. Collected
    // loose food/toys participate in the same scene as characters.
    if (
      item.growth ||
      item.cachedIn ||
      ["nest", "cache", "lodge", "dust", "hoard"].includes(item.kind)
    )
      return "fixed";
    return "loose";
  }
  if (entity.type === "player" || entity.wanderAI || entity.routeAI || entity.resident)
    return "character";
  return "fixed";
}

/** Outer dimensions in world pixels, shared by Rapier and read-only inspection.
 * Facing never rotates a character footprint. Vehicle dimensions stay canonical;
 * the body yaw rotates them exactly once. */
export function physicsBodyDimensions(entity: Entity) {
  const c = entity.collider;
  if (!c) throw Error("Physics body requires a collider");
  const vehicle = entity.type.startsWith("vehicle-v1:");
  const size = vehicle ? vehicleBodySize(entity.type, 0) : undefined;
  return {
    width: size?.width ?? c.width,
    depth: size?.height ?? c.height,
    height: c.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT,
    offsetX: vehicle ? 0 : c.offsetX,
    offsetY: vehicle ? 0 : c.offsetY - c.height / 2,
    yaw: vehicle ? vehicleNoseHeading(entity) : 0,
  };
}
