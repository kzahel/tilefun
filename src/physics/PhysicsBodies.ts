import { DEFAULT_PHYSICAL_HEIGHT } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { curveTrainView, isCurveTrain } from "../railway/CurveTrain.js";
import { isTrain } from "../railway/Train.js";
import { vehicleBodySize, vehicleNoseHeading } from "../traffic/Vehicle.js";
import { isCarryable } from "../wildlife/ForageResources.js";
import type { PhysicsBodyKind } from "./PhysicsState.js";

/** The support whose motion carries a rider. Wildlife bodies (animals and their
 * resources) are ordinary solid support for players: an escaping animal moves out
 * from under them instead of carrying them. Keyed on replicated types so client
 * prediction follows the same rule; other riders (e.g. predators) keep carrying. */
export function carryingSupportId(
  rider: Entity,
  supportId: number | undefined,
  bodies: ReadonlyMap<number, { entity: Entity }>,
): number {
  const support = bodies.get(supportId ?? -1)?.entity;
  return rider.type === "player" && support?.type.startsWith("wildlife-") ? -1 : (supportId ?? -1);
}
export function physicsBodyKind(entity: Entity): PhysicsBodyKind {
  if (entity.type.startsWith("vehicle-v1:") || isTrain(entity)) return "vehicle";
  if (entity.type === "ball") return "loose";
  if (entity.workItem || entity.type.startsWith("wildlife-resource-")) {
    // Ground supplies/sites are anchors. Only real carryable items become loose
    // bodies; type identity also works on replicas without private work state.
    if (entity.workItem?.growth || entity.workItem?.cachedIn) return "fixed";
    return isCarryable(entity) ? "loose" : "fixed";
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
  const train = isTrain(entity),
    curve = isCurveTrain(entity);
  const vehicle = entity.type.startsWith("vehicle-v1:");
  const size = vehicle ? vehicleBodySize(entity.type, 0) : undefined;
  return {
    width: size?.width ?? (curve ? (curveTrainView(entity.type, 0)?.width ?? c.width) : c.width),
    depth: size?.height ?? (curve ? 24 : c.height),
    height: c.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT,
    offsetX: vehicle ? 0 : c.offsetX,
    offsetY: vehicle ? 0 : c.offsetY - c.height / 2,
    yaw:
      vehicle || train
        ? (entity.vehicleHeading ??
          (curve ? ((entity.sprite?.frameRow ?? 0) * Math.PI) / 128 : vehicleNoseHeading(entity)))
        : 0,
  };
}
