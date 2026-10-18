import type { Entity } from "../entities/Entity.js";
import { updateRouteAI } from "../entities/routeAI.js";
import { updateBehaviorAI, updateWanderAI } from "../entities/wanderAI.js";
import { updateDeerAI } from "../wildlife/deerAI.js";
import { updateFaunaAI } from "../wildlife/faunaAI.js";
import { updateFrogAI } from "../wildlife/frogAI.js";
import { updateMallardAI, type WildlifeEnvironment } from "../wildlife/mallardAI.js";
import { updatePredatorAI } from "../wildlife/predatorAI.js";
import { robinWorkBudget } from "../wildlife/RobinWorkBudget.js";
import { updateRabbitAI } from "../wildlife/rabbitAI.js";
import { updateRobinAI } from "../wildlife/robinAI.js";
import type { AiPlanningScheduler } from "./AiPlanningScheduler.js";

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
  planning?: AiPlanningScheduler,
): void {
  const buddies = entities.filter((e) => e.wanderAI?.following);
  let entries = [...entityTickDts].filter(
    ([e]) => e.wanderAI || e.fauna || e.deer || e.robin || e.rabbit || e.frog || e.mallard,
  );
  const budget = planning?.budget ?? robinWorkBudget();
  if (planning) {
    planning.begin();
    let due = false;
    for (const [entity, dt] of entries) {
      planning.advance(entity, dt, playerPositions);
      const ai =
        entity.predator ??
        entity.fauna ??
        entity.deer ??
        entity.robin ??
        entity.rabbit ??
        entity.frog ??
        entity.mallard;
      if (ai) {
        if (
          ai.timer <= dt &&
          !("motion" in ai && ai.motion) &&
          ai.state !== "hop" &&
          ai.state !== "flight"
        )
          due = true;
      } else if (
        entity.wanderAI &&
        !entity.routeAI &&
        entity.wanderAI.state !== "ridden" &&
        entity.wanderAI.state !== "chasing" &&
        entity.wanderAI.state !== "scared" &&
        !entity.wanderAI.following &&
        entity.wanderAI.timer <= dt
      )
        due = true;
    }
    // Ordinary committed movement/rest waits need neither priority maps nor sorting.
    if (due && entries.length) {
      const priorities = new Map(
        entries.map(([entity]) => {
          const ai =
            entity.predator ??
            entity.fauna ??
            entity.deer ??
            entity.robin ??
            entity.rabbit ??
            entity.frog ??
            entity.mallard;
          return [entity, planning.priority(entity, !!ai?.alarmFrom)] as const;
        }),
      );
      const start = robinTurn % entries.length;
      entries = entries.slice(start).concat(entries.slice(0, start));
      entries.sort((a, b) => (priorities.get(a[0]) ?? 2) - (priorities.get(b[0]) ?? 2));
    }
  }
  const robins: [Entity, number][] = [];
  for (const [entity, dt] of entries) {
    if (entity.predator && wildlife) {
      updatePredatorAI(entity, dt, wildlife, entities, playerPositions, planning);
    } else if (entity.fauna && wildlife) {
      updateFaunaAI(entity, dt, wildlife, entities, playerPositions, planning);
    } else if (entity.deer && wildlife) {
      updateDeerAI(entity, dt, wildlife, entities, playerPositions, planning);
    } else if (entity.robin && wildlife) {
      if (planning)
        updateRobinAI(entity, dt, wildlife, entities, playerPositions, budget, planning);
      else robins.push([entity, dt]);
    } else if (entity.rabbit && wildlife) {
      updateRabbitAI(entity, dt, wildlife, entities, playerPositions, planning);
    } else if (entity.frog && wildlife) {
      updateFrogAI(entity, dt, wildlife, entities, playerPositions, planning);
    } else if (entity.mallard && wildlife) {
      updateMallardAI(entity, dt, wildlife, entities, playerPositions, planning);
    } else if (entity.wanderAI && entity.wanderAI.state !== "ridden") {
      if (entity.routeAI && !entity.wanderAI.following && entity.wanderAI.state !== "scared") {
        updateRouteAI(entity, dt);
      } else if (
        entity.wanderAI.chaseRange ||
        entity.wanderAI.following ||
        entity.wanderAI.befriendable
      ) {
        const nearest = nearestPlayerPos(entity.position, playerPositions);
        updateBehaviorAI(entity, dt, rng, nearest, buddies, planning);
      } else updateWanderAI(entity, dt, rng, planning);
    }
  }
  // Direct diagnostic callers without a Realm scheduler retain the robin quota.
  if (wildlife && robins.length) {
    const start = robinTurn % robins.length;
    const rotated = robins.slice(start).concat(robins.slice(0, start));
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
