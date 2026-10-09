import type { Entity, PositionComponent } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";

export const RABBIT_BOUNCE_VZ = 85;
export const RABBIT_HOP_DURATION = 1;
// Native sheet: gather, push, lift/apex, fore-first contact, hind contact, settle.
const PUSH_OFF = 0.25;
const LANDING = 0.625;
export function restoreRabbitPose(rabbit: Entity): void {
  const ai = rabbit.rabbit;
  if (!ai || !rabbit.sprite) return;
  rabbit.sprite.moving = ai.state === "hop";
  if (rabbit.sprite.moving) {
    rabbit.sprite.direction = directionFromVelocity(
      ai.target.wx - rabbit.position.wx,
      ai.target.wy - rabbit.position.wy,
    );
    rabbit.sprite.frameRow = rabbit.sprite.direction;
  }
  setSpriteClip(rabbit, ai.state === "hop" ? 1 : ai.state === "action" ? 2 : 0);
  setSpriteClipElapsed(
    rabbit,
    ai.state === "hop" ? Math.round((ai.hop?.elapsed ?? 0) * 1000) : undefined,
  );
}
/** One alarm per escape; preserve an airborne trajectory and recover before another. */
export function startleRabbit(rabbit: Entity, from: PositionComponent): boolean {
  const ai = rabbit.rabbit;
  if (!ai || ai.alarmFrom || ai.state === "recover") return false;
  ai.alarmFrom = { ...from };
  if (rabbit.wanderAI) rabbit.wanderAI.state = "scared";
  if (ai.state !== "hop") {
    ai.state = "startle";
    ai.timer = 0.15;
    if (rabbit.velocity) rabbit.velocity.vx = rabbit.velocity.vy = 0;
    restoreRabbitPose(rabbit);
  }
  return true;
}
export function prepareRabbitHop(rabbit: Entity, dt: number): void {
  const ai = rabbit.rabbit,
    hop = ai?.hop;
  if (ai?.state !== "hop" || !hop || !rabbit.velocity || dt <= 0) return;
  const old = hop.elapsed;
  hop.elapsed = Math.min(RABBIT_HOP_DURATION, old + dt);
  const moveEnd = Math.min(LANDING, hop.elapsed);
  const moveStart = Math.max(PUSH_OFF, old);
  const fraction = Math.max(0, moveEnd - moveStart) / Math.max(0.0001, LANDING - moveStart);
  rabbit.velocity.vx = ((ai.target.wx - rabbit.position.wx) * fraction) / dt;
  rabbit.velocity.vy = ((ai.target.wy - rabbit.position.wy) * fraction) / dt;
  const t = Math.max(0, Math.min(1, (hop.elapsed - PUSH_OFF) / (LANDING - PUSH_OFF)));
  const height = Math.sin(Math.PI * t) * 10;
  rabbit.wz = hop.startZ + (hop.endZ - hop.startZ) * t + height;
  rabbit.jumpZ = height;
  rabbit.noShadow = false;
}
/** Actual collision-resolved ground/XY win, including obstacles edited mid-hop. */
export function settleRabbit(rabbit: Entity, groundZ: number): void {
  const ai = rabbit.rabbit;
  if (!ai) return;
  const alarm = !!ai.alarmFrom;
  const queuedEscape = alarm && ai.hop?.escaping === false;
  ai.state = queuedEscape ? "startle" : alarm ? "recover" : "rest";
  ai.timer = queuedEscape ? 0.15 : alarm ? 2.5 : 0.7;
  delete ai.hop;
  if (!queuedEscape) delete ai.alarmFrom;
  rabbit.wz = groundZ;
  delete rabbit.jumpZ;
  if (rabbit.velocity) rabbit.velocity.vx = rabbit.velocity.vy = 0;
  if (rabbit.wanderAI) rabbit.wanderAI.state = alarm ? "scared" : "idle";
  restoreRabbitPose(rabbit);
}
