import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { updateDeerAI } from "./deerAI.js";
import { startleDeer } from "./deerInteractions.js";
import { updateFaunaAI } from "./faunaAI.js";
import { startleFauna } from "./faunaInteractions.js";
import { updateFrogAI } from "./frogAI.js";
import { startleFrog } from "./frogInteractions.js";
import { updateMallardAI } from "./mallardAI.js";
import { startleMallard } from "./mallardInteractions.js";
import { startlePredator, updatePredatorAI } from "./predatorAI.js";
import type { RobinWorkBudget } from "./RobinWorkBudget.js";
import { updateRabbitAI } from "./rabbitAI.js";
import { startleRabbit } from "./rabbitInteractions.js";
import { updateRobinAI } from "./robinAI.js";
import { startleRobin } from "./robinInteractions.js";
import type { WildlifeEnvironment } from "./WildlifeEnvironment.js";
import { type WildlifeKind, wildlifeKind } from "./WildlifeKinds.js";

/** Pure per-kind dispatch shared by the AI tick and authority startles. */
interface WildlifeSpecies {
  update(
    entity: Entity,
    dt: number,
    environment: WildlifeEnvironment,
    entities: readonly Entity[],
    players: readonly PositionComponent[],
    planning: AiPlanningScheduler | undefined,
    budget: RobinWorkBudget,
  ): void;
  /** Player landing or ball contact; not a predator alarm (see `alarmPrey`). */
  startle(entity: Entity, from: PositionComponent): void;
}

export const WILDLIFE_SPECIES = {
  predator: { update: updatePredatorAI, startle: startlePredator },
  fauna: { update: updateFaunaAI, startle: startleFauna },
  deer: { update: updateDeerAI, startle: startleDeer },
  robin: {
    update: (entity, dt, environment, entities, players, planning, budget) =>
      updateRobinAI(entity, dt, environment, entities, players, budget, planning),
    startle: startleRobin,
  },
  rabbit: { update: updateRabbitAI, startle: startleRabbit },
  frog: { update: updateFrogAI, startle: startleFrog },
  mallard: { update: updateMallardAI, startle: startleMallard },
} satisfies Record<WildlifeKind, WildlifeSpecies>;

/** Startle the first native brain in dispatch order; false for non-wildlife. */
export function startleWildlife(entity: Entity, from: PositionComponent): boolean {
  const kind = wildlifeKind(entity);
  if (!kind) return false;
  WILDLIFE_SPECIES[kind].startle(entity, from);
  return true;
}
