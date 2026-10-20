import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { isCarryable } from "../wildlife/ForageResources.js";
import { roofSupport } from "./RoofSupport.js";
import { bedVisualOwner, DUMP_BED, hasVehicleBed, vehicleBedBlocks } from "./VehicleBed.js";

export type VehicleBedAction = "board" | "leave" | "load" | "unload";

/** Airborne contents still occupy the hollow volume, rather than the broad body.
 * This is not support: jumps retain world momentum and are never carried here. */
export function bedInteriorOccupant(truck: Entity, actor: Entity): boolean {
  return (
    hasVehicleBed(truck) &&
    !!actor.collider &&
    (actor.type === "player" || isCarryable(actor)) &&
    (actor.wz ?? 0) >= (truck.wz ?? 0) + DUMP_BED.floorZ - 0.1 &&
    bedVisualOwner(actor, [truck])?.id === truck.id &&
    !vehicleBedBlocks(
      truck,
      getEntityAABB(actor.position, actor.collider),
      actor.wz ?? 0,
      actor.collider.physicalHeight ?? 12,
    )
  );
}

/** Loose identities, never seat attachments. Animal-held/claimed food stays owned. */
export function isLooseCargo(e: Entity): boolean {
  return (
    isCarryable(e) &&
    e.parentId === undefined &&
    !e.workItem?.claimedBy &&
    !e.workItem?.growth &&
    !!e.collider
  );
}
export function bedContents(truck: Entity, entities: readonly Entity[]): Entity[] {
  if (!hasVehicleBed(truck)) return [];
  return entities.filter(
    (e) =>
      isLooseCargo(e) &&
      Math.abs((e.wz ?? 0) - (truck.wz ?? 0) - DUMP_BED.floorZ) < 0.1 &&
      roofSupport(e, [truck])?.id === truck.id,
  );
}
export function nearbyCargo(player: Entity, truck: Entity, entities: readonly Entity[]) {
  return entities
    .filter(
      (e) =>
        isLooseCargo(e) &&
        e.jumpVZ === undefined &&
        Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) < 8 &&
        Math.hypot(e.position.wx - player.position.wx, e.position.wy - player.position.wy) <= 40 &&
        Math.abs((e.wz ?? 0) - (player.wz ?? 0)) <= 8 &&
        roofSupport(e, [truck])?.id !== truck.id,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.position.wx - player.position.wx, a.position.wy - player.position.wy) -
          Math.hypot(b.position.wx - player.position.wx, b.position.wy - player.position.wy) ||
        a.id - b.id,
    );
}
/** Candidate foot anchors account for the actor's offset collider at any heading. */
export function bedSlots(actor: Entity) {
  const collider = actor.collider;
  if (!collider) return [];
  const centerX = collider.offsetX,
    centerY = collider.offsetY - collider.height / 2;
  return [-16, 0, 16].flatMap((dx) =>
    [-7, 7].map((y) => ({
      x: DUMP_BED.center.x + dx,
      y,
      centerX,
      centerY,
    })),
  );
}
export function onBedFloor(actor: Entity, truck: Entity): boolean {
  if (!actor.collider || !hasVehicleBed(truck)) return false;
  return (
    Math.abs((actor.wz ?? 0) - (truck.wz ?? 0) - DUMP_BED.floorZ) < 0.1 &&
    roofSupport(actor, [truck])?.id === truck.id
  );
}
