import type { Entity, PositionComponent } from "../entities/Entity.js";
import { wake } from "../entities/naps.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";

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
  rabbit.motionIntent ??= { vx: 0, vy: 0 };
  const ai = rabbit.rabbit;
  if (!ai || ai.alarmFrom || ai.state === "recover") return false;
  wake(rabbit);
  ai.alarmFrom = { ...from };
  if (rabbit.wanderAI) rabbit.wanderAI.state = "scared";
  if (ai.state !== "hop") {
    ai.state = "startle";
    ai.timer = 0.15;
    if (rabbit.motionIntent) rabbit.motionIntent.vx = rabbit.motionIntent.vy = 0;
    restoreRabbitPose(rabbit);
  }
  return true;
}
/** A tick of the hop in which the rabbit only gathers or holds its landing: no travel,
 * no lift, and not the tick that settles it. */
export function rabbitHopHolds(elapsed: number, dt: number): boolean {
  const next = Math.min(RABBIT_HOP_DURATION, elapsed + dt);
  return (next <= PUSH_OFF || elapsed >= LANDING) && next < RABBIT_HOP_DURATION;
}
export function prepareRabbitHop(rabbit: Entity, dt: number): void {
  rabbit.motionIntent ??= { vx: 0, vy: 0 };
  const ai = rabbit.rabbit,
    hop = ai?.hop;
  if (ai?.state !== "hop" || !hop || !rabbit.motionIntent || dt <= 0) return;
  const old = hop.elapsed;
  hop.elapsed = Math.min(RABBIT_HOP_DURATION, old + dt);
  const moveEnd = Math.min(LANDING, hop.elapsed);
  const moveStart = Math.max(PUSH_OFF, old);
  const fraction = Math.max(0, moveEnd - moveStart) / Math.max(0.0001, LANDING - moveStart);
  rabbit.motionIntent.vx = ((ai.target.wx - rabbit.position.wx) * fraction) / dt;
  rabbit.motionIntent.vy = ((ai.target.wy - rabbit.position.wy) * fraction) / dt;
  const t = Math.max(0, Math.min(1, (hop.elapsed - PUSH_OFF) / (LANDING - PUSH_OFF)));
  const height = Math.sin(Math.PI * t) * 10;
  const altitude = hop.startZ + (hop.endZ - hop.startZ) * t + height;
  // Standing on the ground the hop starts or ends at, the prescribed height asks the
  // motor for nothing (BodyMotor leaves solved support alone): the intent is idle and
  // the body may rest through the gather and the landing.
  const standing =
    (t === 0 || t === 1) &&
    rabbit.jumpVZ === undefined &&
    altitude <= (rabbit.groundZ ?? rabbit.wz ?? 0) + 0.15;
  if (standing) delete rabbit.motionIntent.altitude;
  else rabbit.motionIntent.altitude = altitude;
  rabbit.jumpZ = height;
  rabbit.noShadow = false;
}
/** Actual collision-resolved ground/XY win, including obstacles edited mid-hop. */
export function settleRabbit(rabbit: Entity, _groundZ: number): void {
  rabbit.motionIntent ??= { vx: 0, vy: 0 };
  delete rabbit.motionIntent.altitude;
  const ai = rabbit.rabbit;
  if (!ai) return;
  const alarm = !!ai.alarmFrom;
  const queuedEscape = alarm && ai.hop?.escaping === false;
  ai.state = queuedEscape ? "startle" : alarm ? "recover" : "rest";
  ai.timer = queuedEscape ? 0.15 : alarm ? 2.5 : 0.7;
  delete ai.hop;
  if (!queuedEscape) delete ai.alarmFrom;

  // As the readback of a grounded body leaves it.
  rabbit.jumpZ = 0;
  if (rabbit.motionIntent) rabbit.motionIntent.vx = rabbit.motionIntent.vy = 0;
  if (rabbit.wanderAI) rabbit.wanderAI.state = alarm ? "scared" : "idle";
  restoreRabbitPose(rabbit);
}
