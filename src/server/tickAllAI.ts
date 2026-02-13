import { ENTITY_ACTIVATION_DISTANCE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { updateBehaviorAI, updateWanderAI } from "../entities/wanderAI.js";

/**
 * Run AI for all entities: activation-distance culling, chase/follow, wander.
 *
 * No DOM deps — can run in Node headless.
 */
export function tickAllAI(
  entities: readonly Entity[],
  playerPos: { wx: number; wy: number },
  dt: number,
  rng: () => number,
): void {
  // Collect buddies for hostile AI targeting
  const buddies = entities.filter((e) => e.wanderAI?.following);
  for (const entity of entities) {
    if (entity.wanderAI) {
      const dx = Math.abs(entity.position.wx - playerPos.wx);
      const dy = Math.abs(entity.position.wy - playerPos.wy);
      if (dx > ENTITY_ACTIVATION_DISTANCE || dy > ENTITY_ACTIVATION_DISTANCE) {
        if (entity.velocity) {
          entity.velocity.vx = 0;
          entity.velocity.vy = 0;
        }
        continue;
      }
      if (entity.wanderAI.chaseRange || entity.wanderAI.following || entity.wanderAI.befriendable) {
        updateBehaviorAI(entity, dt, rng, playerPos, buddies);
      } else {
        updateWanderAI(entity, dt, rng);
      }
    }
  }
}
