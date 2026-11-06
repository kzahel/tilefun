import type { Entity } from "../entities/Entity.js";
import { alarmPrey } from "../wildlife/predatorAI.js";
import { isWildlife } from "../wildlife/WildlifeKinds.js";

/** Ten tiles: a nearby startle, rather than the horn's much larger audible range. */
export const HORN_STARTLE_RADIUS = 160;
export const HORN_STARTLE_COOLDOWN = 3;

/** Reuse native wildlife escape/landing/recovery; ordinary walkers run straight away. */
export function reactToHorn(entity: Entity, vehicle: Entity): boolean {
  const ai = entity.wanderAI;
  if (
    !ai ||
    !entity.velocity ||
    entity.type === "player" ||
    entity.id === vehicle.id ||
    entity.deathTimer !== undefined ||
    entity.parentId !== undefined ||
    ai.state === "ridden" ||
    ai.state === "scared" ||
    entity.resident?.transferring ||
    entity.resident?.phase === "transfer" ||
    Math.abs((entity.wz ?? 0) - (vehicle.wz ?? 0)) > 48
  )
    return false;
  alarmPrey(entity, vehicle.position);
  if (!isWildlife(entity)) {
    // Keep the outward heading for the whole short escape, without ball-hit zigzags.
    ai.timer = ai.scaredTimer = 2;
    ai.scaredSpeed = ai.speed * 1.5;
    if (ai.dirX === 0 && ai.dirY === 0) ai.dirX = entity.id % 2 ? 1 : -1;
  }
  if (entity.resident) entity.resident.path = [];
  return true;
}
