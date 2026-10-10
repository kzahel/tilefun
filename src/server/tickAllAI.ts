import type { Entity } from "../entities/Entity.js";
import { updateRouteAI } from "../entities/routeAI.js";
import { updateBehaviorAI, updateWanderAI } from "../entities/wanderAI.js";
import { updateDeerAI } from "../wildlife/deerAI.js";
import { updateFaunaAI } from "../wildlife/faunaAI.js";
import { updateFrogAI } from "../wildlife/frogAI.js";
import { updateMallardAI, type WildlifeEnvironment } from "../wildlife/mallardAI.js";
import { robinWorkBudget } from "../wildlife/RobinWorkBudget.js";
import { updateRabbitAI } from "../wildlife/rabbitAI.js";
import { updateRobinAI } from "../wildlife/robinAI.js";

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
  wildlife?: WildlifeEnvironment,
  robinTurn = 0,
): void {
  // Collect buddies for hostile AI targeting (need all, not just ticked)
  const buddies = entities.filter((e) => e.wanderAI?.following);
  const robins: [Entity, number][] = [];
  for (const [entity, dt] of entityTickDts) {
    if (entity.fauna && wildlife) {
      updateFaunaAI(entity, dt, wildlife, entities, playerPositions);
      continue;
    }
    if (entity.deer && wildlife) {
      updateDeerAI(entity, dt, wildlife, entities, playerPositions);
      continue;
    }
    if (entity.robin && wildlife) {
      robins.push([entity, dt]);
      continue;
    }
    if (entity.rabbit && wildlife) {
      updateRabbitAI(entity, dt, wildlife, entities, playerPositions);
      continue;
    }
    if (entity.frog && wildlife) {
      updateFrogAI(entity, dt, wildlife, entities, playerPositions);
      continue;
    }
    if (entity.mallard && wildlife) {
      updateMallardAI(entity, dt, wildlife, entities, playerPositions);
      continue;
    }
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
  if (wildlife && robins.length) {
    const budget = robinWorkBudget();
    const rotated = robins
      .slice(robinTurn % robins.length)
      .concat(robins.slice(0, robinTurn % robins.length));
    // Alarms have priority, then proximity. Rotation preserves fair admission
    // within each class even when many timers expire together.
    const rank = (entity: Entity) =>
      entity.robin?.alarmFrom
        ? 0
        : playerPositions.some(
              (p) => Math.hypot(p.wx - entity.position.wx, p.wy - entity.position.wy) < 192,
            )
          ? 1
          : 2;
    const priorities = new Map(rotated.map(([entity]) => [entity, rank(entity)]));
    rotated.sort((a, b) => (priorities.get(a[0]) ?? 2) - (priorities.get(b[0]) ?? 2));
    for (const [entity, dt] of rotated)
      updateRobinAI(entity, dt, wildlife, entities, playerPositions, budget);
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
