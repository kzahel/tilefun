import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { DEER_TYPE } from "../wildlife/Deer.js";
import { faunaProfile } from "../wildlife/Fauna.js";
import { FROG_TYPE } from "../wildlife/Frog.js";
import { MALLARD_TYPE } from "../wildlife/Mallard.js";
import { RABBIT_TYPE } from "../wildlife/Rabbit.js";
import { ROBIN_TYPE } from "../wildlife/Robin.js";
import { clearAirMomentum } from "./AirborneMomentum.js";
import type { JumpGravityOutcome } from "./PlayerMovement.js";
import type { EntitySurface } from "./surfaceHeight.js";

/** Shared landing state transition, after a backend has resolved the floor.
 * No movement, gravity integration or collision query is performed here.
 */
export function completePlayerLanding(
  entity: Entity,
  groundZ: number,
  entities: readonly EntitySurface[] = [],
  supportId?: number,
): JumpGravityOutcome {
  entity.wz = entity.groundZ = groundZ;
  Reflect.set(entity, "jumpVZ", undefined);
  Reflect.set(entity, "jumpZ", undefined);
  if (entity.airMomentumX !== undefined || entity.airMomentumY !== undefined) {
    const support = roofSupport(entity, entities);
    if (entity.velocity && support?.velocity) {
      entity.velocity.vx -= support.velocity.vx;
      entity.velocity.vy -= support.velocity.vy;
    }
    clearAirMomentum(entity);
  }
  const footprint = entity.collider ? getEntityAABB(entity.position, entity.collider) : null;
  const animal =
    entity.type === "player" && footprint
      ? entities.find(
          (e) =>
            (e.type === MALLARD_TYPE ||
              e.type === FROG_TYPE ||
              e.type === RABBIT_TYPE ||
              e.type === ROBIN_TYPE ||
              e.type === DEER_TYPE ||
              faunaProfile(e.type) !== undefined) &&
            e.collider?.solid !== false &&
            e.collider &&
            (supportId !== undefined
              ? e.id === supportId
              : Math.abs((e.wz ?? 0) + (e.collider.physicalHeight ?? 0) - groundZ) < 0.001 &&
                aabbsOverlap(footprint, getEntityAABB(e.position, e.collider))),
        )
      : undefined;
  return animal
    ? { landed: true, groundZ, wildlifeContactId: animal.id }
    : { landed: true, groundZ };
}
