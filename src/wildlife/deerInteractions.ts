import type { Entity, PositionComponent } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";

export const DEER_WALK_SPEED = 18;
export const DEER_FLEE_SPEED = 36;
export function restoreDeerPose(deer: Entity): void {
  const ai = deer.deer;
  if (!ai || !deer.sprite) return;
  deer.sprite.moving = !!ai.motion;
  if (ai.motion) {
    deer.sprite.direction = directionFromVelocity(
      ai.target.wx - deer.position.wx,
      ai.target.wy - deer.position.wy,
    );
    deer.sprite.frameRow = deer.sprite.direction;
  }
  setSpriteClip(
    deer,
    ai.state === "travel"
      ? 1
      : ai.state === "flee"
        ? 3
        : ai.state === "action" || ai.state === "startle"
          ? 2
          : 0,
  );
  setSpriteClipElapsed(deer, ai.motion ? Math.round(ai.motion.elapsed * 1000) : undefined);
}
/** One alarm through alert, escape and recovery; preserve any already committed walk. */
export function startleDeer(deer: Entity, from: PositionComponent): boolean {
  const ai = deer.deer;
  if (!ai || ai.alarmFrom || ai.state === "recover") return false;
  ai.alarmFrom = { ...from };
  if (deer.wanderAI) deer.wanderAI.state = "scared";
  if (!ai.motion) {
    ai.state = "startle";
    ai.timer = 0.4;
    if (deer.velocity) deer.velocity.vx = deer.velocity.vy = 0;
    restoreDeerPose(deer);
  }
  return true;
}
/** Fixed-speed grounded movement. Collision always owns actual XY; no catch-up teleport. */
export function prepareDeerTravel(deer: Entity, dt: number): void {
  const ai = deer.deer,
    motion = ai?.motion;
  if (!ai || !motion || !deer.velocity || dt <= 0) return;
  motion.elapsed = Math.min(motion.duration, motion.elapsed + dt);
  const dx = ai.target.wx - deer.position.wx,
    dy = ai.target.wy - deer.position.wy;
  const distance = Math.hypot(dx, dy);
  const speed = Math.min(motion.escaping ? DEER_FLEE_SPEED : DEER_WALK_SPEED, distance / dt);
  deer.velocity.vx = distance > 0.001 ? (dx / distance) * speed : 0;
  deer.velocity.vy = distance > 0.001 ? (dy / distance) * speed : 0;
}
export function settleDeer(deer: Entity): void {
  const ai = deer.deer;
  if (!ai) return;
  const alarm = !!ai.alarmFrom,
    queued = alarm && ai.motion?.escaping === false;
  ai.state = queued ? "startle" : alarm ? "recover" : "rest";
  ai.timer = queued ? 0.4 : alarm ? 3 : 0.8;
  delete ai.motion;
  if (!queued) delete ai.alarmFrom;
  if (deer.velocity) deer.velocity.vx = deer.velocity.vy = 0;
  if (deer.wanderAI) deer.wanderAI.state = alarm ? "scared" : "idle";
  restoreDeerPose(deer);
}
