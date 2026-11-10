import type { Entity } from "../entities/Entity.js";
import { setSpriteClipElapsed, spriteHolds } from "../entities/spriteAnimation.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { prepareRabbitHop, rabbitHopHolds } from "./rabbitInteractions.js";

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

/** A hop under way: its gather and landing ticks only run the hop clock, which also
 * times the picture on every client. */
function hopping(rabbit: Entity) {
  const ai = rabbit.rabbit;
  return ai?.state === "hop" ? ai.hop : undefined;
}

/** Coming decisions, up to `limit`, that change nothing but clocks: a hop's gather or
 * landing, or a rest with both clocks still running or a goal the planner is certain
 * to refuse meanwhile. */
export function rabbitWaits(
  rabbit: Entity,
  dt: number,
  limit: number,
  planning: AiPlanningScheduler,
): number {
  const hop = hopping(rabbit);
  if (hop) {
    let elapsed = hop.elapsed,
      held = 0;
    for (; held < limit && rabbitHopHolds(elapsed, dt); held++) elapsed += dt;
    return held;
  }
  const clocks = waiting(rabbit);
  // A resting picture must itself be still: no client advances it.
  if (!clocks || !spriteHolds(rabbit)) return 0;
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
  if (hopping(rabbit)) {
    // The skipped preparations, then what the readback of a standing body and the
    // finished tick leave behind.
    for (let i = 0; i < ticks; i++) prepareRabbitHop(rabbit, dt);
    rabbit.jumpZ = 0;
    setSpriteClipElapsed(rabbit, Math.round((rabbit.rabbit?.hop?.elapsed ?? 0) * 1000));
    return;
  }
  const clocks = waiting(rabbit);
  if (!clocks) return;
  for (let i = 0; i < ticks; i++) {
    clocks.task.elapsed += dt;
    clocks.task.cooldown = Math.max(0, clocks.task.cooldown - dt);
    clocks.ai.timer -= dt;
  }
}
