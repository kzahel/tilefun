import type { Entity } from "../entities/Entity.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";

/** Resting with no meadow duty: every decision runs these clocks down (rabbitAI and
 * MeadowWork), and once one has run out asks the planner for a start. */
function waiting(rabbit: Entity) {
  const ai = rabbit.rabbit,
    task = rabbit.animalWork,
    intent = rabbit.motionIntent;
  return ai?.state === "rest" &&
    !ai.alarmFrom &&
    !ai.hop &&
    task?.state === "idle" &&
    intent?.vx === 0 &&
    intent.vy === 0 &&
    !rabbit.wanderAI?.following &&
    rabbit.wanderAI?.state !== "ridden"
    ? { ai, task }
    : undefined;
}

/** Coming decisions, up to `limit`, that change nothing but clocks: both clocks still
 * running, or a goal the planner is certain to refuse meanwhile. */
export function rabbitWaits(
  rabbit: Entity,
  dt: number,
  limit: number,
  planning: AiPlanningScheduler,
): number {
  const clocks = waiting(rabbit);
  if (!clocks) return 0;
  let timer = clocks.ai.timer,
    cooldown = clocks.task.cooldown,
    ticks = 0;
  for (; ticks < limit; ticks++) {
    timer -= dt;
    cooldown = Math.max(0, cooldown - dt);
    if (timer <= 0 || cooldown === 0) break;
  }
  return ticks || planning.refusals(rabbit, dt, limit);
}

/** The skipped decisions' whole effect, with the arithmetic they would have used. */
export function rabbitIdles(rabbit: Entity, dt: number, ticks: number): void {
  const clocks = waiting(rabbit);
  if (!clocks) return;
  for (let i = 0; i < ticks; i++) {
    clocks.task.elapsed += dt;
    clocks.task.cooldown = Math.max(0, clocks.task.cooldown - dt);
    clocks.ai.timer -= dt;
  }
}
