import type { Entity } from "../entities/Entity.js";
import { updateRouteAI } from "../entities/routeAI.js";
import { updateBehaviorAI, updateWanderAI } from "../entities/wanderAI.js";

/**
 * Run AI for all entities: tick-tier culling, chase/follow, wander.
 *
 * @param playerPositions One or more player positions. In multiplayer each
 *   entity uses the nearest player for chase/follow/befriend behavior.
 * @param entityTickDts Map of entities to their effective dt for this frame.
 *   Entities not in the map receive no decision work; velocity is preserved.
 *
 * No DOM deps — can run in Node headless.
 */
export function tickAllAI(
  entities: readonly Entity[],
  playerPositions: readonly { wx: number; wy: number }[],
  entityTickDts: ReadonlyMap<Entity, number>,
  rng: () => number,
): void {
  // Collect buddies for hostile AI targeting (need all, not just ticked)
  const buddies = entities.filter((e) => e.wanderAI?.following);
  for (const [entity, dt] of entityTickDts) {
    if (!entity.wanderAI) continue;
    // Skip ridden entities — their velocity is controlled by the rider's input
    if (entity.wanderAI.state === "ridden") continue;
    if (entity.routeAI && !entity.wanderAI.following && entity.wanderAI.state !== "scared") {
      updateRouteAI(entity, dt);
      continue;
    }
    if (entity.wanderAI.chaseRange || entity.wanderAI.following || entity.wanderAI.befriendable) {
      const nearest = nearestPlayerPos(entity.position, playerPositions);
      updateBehaviorAI(entity, dt, rng, nearest, buddies);
    } else {
      updateWanderAI(entity, dt, rng);
    }
  }
}

/** Find the nearest player position to a given world position. */
function nearestPlayerPos(
  pos: { wx: number; wy: number },
  playerPositions: readonly { wx: number; wy: number }[],
): { wx: number; wy: number } {
  if (playerPositions.length === 1) return playerPositions[0] as { wx: number; wy: number };
  let best = playerPositions[0] as { wx: number; wy: number };
  let bestDist = Number.MAX_VALUE;
  for (const pp of playerPositions) {
    const dx = pp.wx - pos.wx;
    const dy = pp.wy - pos.wy;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = pp;
    }
  }
  return best;
}
