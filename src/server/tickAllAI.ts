import type { Entity } from "../entities/Entity.js";
import { robinWorkBudget } from "../wildlife/RobinWorkBudget.js";
import { updateRobinAI } from "../wildlife/robinAI.js";
import { duringDecisions } from "../wildlife/SolidNeighbours.js";
import type { WildlifeEnvironment } from "../wildlife/WildlifeEnvironment.js";
import { isWildlife, wildlifeBrain, wildlifeKind } from "../wildlife/WildlifeKinds.js";
import { WILDLIFE_SPECIES } from "../wildlife/WildlifeSpecies.js";
import type { AiPlanningScheduler } from "./AiPlanningScheduler.js";
import { updateOrdinaryAI } from "./ordinaryAI.js";

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
  let entries: [Entity, number][] = [];
  for (const [e, dt] of entityTickDts)
    if (
      (!e.resident || e.wanderAI?.state === "scared") &&
      // Every predator also carries wanderAI, so this admits exactly the old set.
      (e.wanderAI || isWildlife(e))
    )
      entries.push([e, dt]);
  const budget = planning?.budget ?? robinWorkBudget();
  if (planning) {
    planning.begin();
    // Stable order: long-waiting offers, urgent alarms, other offers, near, far.
    const ranks: [Entity, number][][] = [[], [], [], [], []];
    for (const entry of entries) {
      const entity = entry[0];
      planning.advance(entity, entry[1], playerPositions);
      ranks[planning.priority(entity, !!wildlifeBrain(entity)?.alarmFrom)]?.push(entry);
    }
    entries = ranks.flat();
  }
  const robins: [Entity, number][] = [];
  // Poses stay fixed while decisions run; planners share one index of solid bodies.
  duringDecisions(entities, () => {
    for (const [entity, dt] of entries) {
      const kind = wildlifeKind(entity);
      if (kind && wildlife) {
        if (kind === "robin" && !planning) robins.push([entity, dt]);
        else
          WILDLIFE_SPECIES[kind].update(
            entity,
            dt,
            wildlife,
            entities,
            playerPositions,
            planning,
            budget,
          );
      } else updateOrdinaryAI(entity, dt, rng, playerPositions, buddies, planning);
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
  });
}
