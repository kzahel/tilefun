import type { Entity, PositionComponent } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";

export function robinMotionPhase(state: string, elapsed: number, duration: number): number {
  return state === "hop"
    ? Math.max(0, Math.min(1, (elapsed - 0.24) / 0.36))
    : Math.max(0, Math.min(1, elapsed / duration));
}
export function robinMotionZ(state: string, start: number, end: number, t: number): number {
  return start + (end - start) * t + Math.sin(Math.PI * t) * (state === "hop" ? 5 : 44);
}
export function restoreRobinPose(bird: Entity): void {
  const ai = bird.robin;
  if (!ai || !bird.sprite) return;
  bird.sprite.moving = ai.state === "hop" || ai.state === "flight";
  if (bird.sprite.moving) {
    bird.sprite.direction = directionFromVelocity(
      ai.target.wx - bird.position.wx,
      ai.target.wy - bird.position.wy,
    );
    bird.sprite.frameRow = bird.sprite.direction;
  }
  setSpriteClip(
    bird,
    ai.state === "hop" ? 1 : ai.state === "flight" ? 2 : ai.state === "action" ? 3 : 0,
  );
  setSpriteClipElapsed(bird, ai.motion ? Math.round(ai.motion.elapsed * 1000) : undefined);
}
export function startleRobin(bird: Entity, from: PositionComponent): boolean {
  const ai = bird.robin;
  if (!ai || ai.alarmFrom || ai.state === "recover") return false;
  ai.alarmFrom = { ...from };
  if (bird.wanderAI) bird.wanderAI.state = "scared";
  if (!ai.motion) {
    ai.state = "startle";
    ai.timer = 0.12;
    if (bird.velocity) bird.velocity.vx = bird.velocity.vy = 0;
    restoreRobinPose(bird);
  }
  return true;
}
/** Ordinary collision owns XY; the authority timeline owns elevation and wing/hop phase. */
export function prepareRobinMotion(bird: Entity, dt: number): void {
  const ai = bird.robin,
    motion = ai?.motion;
  if (!ai || !motion || !bird.velocity || dt <= 0) return;
  const old = robinMotionPhase(ai.state, motion.elapsed, motion.duration);
  motion.elapsed = Math.min(motion.duration, motion.elapsed + dt);
  const t = robinMotionPhase(ai.state, motion.elapsed, motion.duration);
  const fraction = Math.max(0, t - old) / Math.max(0.0001, 1 - old);
  bird.velocity.vx = ((ai.target.wx - bird.position.wx) * fraction) / dt;
  bird.velocity.vy = ((ai.target.wy - bird.position.wy) * fraction) / dt;
  bird.wz = robinMotionZ(ai.state, motion.startZ, motion.endZ, t);
  bird.jumpZ = Math.sin(Math.PI * t) * (ai.state === "hop" ? 5 : 44);
}
export function settleRobin(bird: Entity, groundZ: number): void {
  const ai = bird.robin;
  if (!ai) return;
  const alarm = !!ai.alarmFrom,
    queued = alarm && ai.motion?.escaping === false;
  ai.state = queued ? "startle" : alarm ? "recover" : groundZ > 4 ? "perch" : "rest";
  ai.timer = queued ? 0.12 : alarm ? 2.5 : groundZ > 4 ? 3 : 0.7;
  delete ai.motion;
  if (!queued) delete ai.alarmFrom;
  bird.wz = groundZ;
  delete bird.jumpZ;
  if (bird.velocity) bird.velocity.vx = bird.velocity.vy = 0;
  if (bird.wanderAI) bird.wanderAI.state = alarm ? "scared" : "idle";
  restoreRobinPose(bird);
}
