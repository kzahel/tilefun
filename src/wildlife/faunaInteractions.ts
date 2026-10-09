import type { Entity, PositionComponent } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";

import { faunaProfile } from "./Fauna.js";
export function restoreFaunaPose(animal: Entity): void {
  const ai = animal.fauna,
    p = faunaProfile(animal.type);
  if (!ai || !animal.sprite || !p) return;
  animal.sprite.moving = !!ai.motion;
  if (ai.motion) {
    animal.sprite.direction = directionFromVelocity(
      ai.target.wx - animal.position.wx,
      ai.target.wy - animal.position.wy,
    );
    animal.sprite.frameRow = animal.sprite.direction;
  }
  setSpriteClip(
    animal,
    ai.state === "travel"
      ? 1
      : ai.state === "flee"
        ? p.clips.length - 1
        : ai.state === "action" || ai.state === "startle"
          ? 2
          : 0,
  );
  setSpriteClipElapsed(animal, ai.motion ? Math.round(ai.motion.elapsed * 1000) : undefined);
}
/** One alarm through alert, escape and recovery; preserve any already committed walk. */
export function startleFauna(animal: Entity, from: PositionComponent): boolean {
  const ai = animal.fauna;
  if (!ai || ai.alarmFrom || ai.state === "recover") return false;
  ai.alarmFrom = { ...from };
  if (animal.wanderAI) animal.wanderAI.state = "scared";
  if (!ai.motion) {
    ai.state = "startle";
    ai.timer = 0.4;
    if (animal.velocity) animal.velocity.vx = animal.velocity.vy = 0;
    restoreFaunaPose(animal);
  }
  return true;
}
/** Fixed-speed grounded movement. Collision always owns actual XY; no catch-up teleport. */
export function prepareFaunaTravel(animal: Entity, dt: number): void {
  const ai = animal.fauna,
    p = faunaProfile(animal.type),
    motion = ai?.motion;
  if (!ai || !motion || !p || !animal.velocity || dt <= 0) return;
  motion.elapsed = Math.min(motion.duration, motion.elapsed + dt);
  const dx = ai.target.wx - animal.position.wx,
    dy = ai.target.wy - animal.position.wy;
  const distance = Math.hypot(dx, dy);
  const speed = Math.min(p.speed * (motion.escaping ? 2 : 1), distance / dt);
  animal.velocity.vx = distance > 0.001 ? (dx / distance) * speed : 0;
  animal.velocity.vy = distance > 0.001 ? (dy / distance) * speed : 0;
}
export function settleFauna(animal: Entity): void {
  const ai = animal.fauna;
  if (!ai) return;
  const alarm = !!ai.alarmFrom,
    queued = alarm && ai.motion?.escaping === false;
  ai.state = queued ? "startle" : alarm ? "recover" : "rest";
  ai.timer = queued ? 0.4 : alarm ? 3 : 0.8;
  delete ai.motion;
  if (!queued) delete ai.alarmFrom;
  if (animal.velocity) animal.velocity.vx = animal.velocity.vy = 0;
  if (animal.wanderAI) animal.wanderAI.state = alarm ? "scared" : "idle";
  restoreFaunaPose(animal);
}
