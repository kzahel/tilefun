import type { Entity } from "../entities/Entity.js";
import { updateRouteAI } from "../entities/routeAI.js";
import { updateBehaviorAI, updateWanderAI } from "../entities/wanderAI.js";
import type { AiPlanningScheduler } from "./AiPlanningScheduler.js";

type Point = { wx: number; wy: number };

/** One non-wildlife actor's decision: its route, chase/follow/befriend behaviour or wander. */
export function updateOrdinaryAI(
  entity: Entity,
  dt: number,
  rng: () => number,
  playerPositions: readonly Point[],
  buddies: Entity[],
  planning?: AiPlanningScheduler,
): void {
  const ai = entity.wanderAI;
  if (!ai || ai.state === "ridden") return;
  if (entity.routeAI && !ai.following && ai.state !== "scared") updateRouteAI(entity, dt);
  else if (ai.chaseRange || ai.following || ai.befriendable) {
    const nearest = nearestPlayerPos(entity.position, playerPositions);
    updateBehaviorAI(entity, dt, rng, nearest, buddies, planning);
  } else updateWanderAI(entity, dt, rng, planning);
}

/** Find the nearest player position to a given world position. */
function nearestPlayerPos(pos: Point, playerPositions: readonly Point[]): Point {
  if (playerPositions.length === 1) return playerPositions[0] as Point;
  let best = playerPositions[0] as Point;
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
