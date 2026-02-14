import type { Entity } from "../entities/Entity.js";
import { updateBehaviorAI, updateWanderAI } from "../entities/wanderAI.js";

/**
 * Run AI for all entities: tick-tier culling, chase/follow, wander.
 *
 * @param entityTickDts Map of entities to their effective dt for this frame.
 *   Entities not in the map are frozen (velocity zeroed).
 *
 * No DOM deps — can run in Node headless.
 */
export function tickAllAI(
  entities: readonly Entity[],
  playerPos: { wx: number; wy: number },
  entityTickDts: ReadonlyMap<Entity, number>,
  rng: () => number,
): void {
  // Collect buddies for hostile AI targeting (need all, not just ticked)
  const buddies = entities.filter((e) => e.wanderAI?.following);
  for (const entity of entities) {
    if (!entity.wanderAI) continue;
    const dt = entityTickDts.get(entity);
    if (dt === undefined) {
      // Frozen: zero velocity so entity stops
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
