import type { Entity, PositionComponent } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";

export const FROG_BOUNCE_VZ = 75;
export const FROG_HOP_DURATION = 1.12;
// Two crouch/push frames, then airborne frames, then fore-first landing/recovery.
const PUSH_OFF = 0.28;
const LANDING = 0.84;

export function restoreFrogPose(frog: Entity): void {
  const ai = frog.frog;
  if (!ai || !frog.sprite) return;
  frog.sprite.moving = ai.state === "hop" || ai.state === "swim";
  if (frog.sprite.moving) {
    frog.sprite.direction = directionFromVelocity(
      ai.target.wx - frog.position.wx,
      ai.target.wy - frog.position.wy,
    );
    frog.sprite.frameRow = frog.sprite.direction;
  }
  setSpriteClip(
    frog,
    ai.state === "hop"
      ? 1
      : ai.state === "swim"
        ? 2
        : ai.state === "blink" || ai.state === "startle"
          ? 3
          : 0,
  );
  setSpriteClipElapsed(
    frog,
    ai.state === "hop" ? Math.round((ai.hop?.elapsed ?? 0) * 1000) : undefined,
  );
}

/** Keep an existing hop intact; react once, then finish escape and recover. */
export function startleFrog(frog: Entity, from: PositionComponent): boolean {
  const ai = frog.frog;
  if (!ai || ai.alarmFrom || ai.state === "recover") return false;
  ai.alarmFrom = { ...from };
  if (frog.wanderAI) frog.wanderAI.state = "scared";
  if (ai.state !== "hop") {
    ai.state = "startle";
    ai.timer = 0.28;
    if (frog.velocity) frog.velocity.vx = frog.velocity.vy = 0;
    restoreFrogPose(frog);
  }
  return true;
}

/** Physics-time displacement/height follows the authored push, flight and landing phases. */
export function prepareFrogHop(frog: Entity, dt: number): void {
  const ai = frog.frog,
    hop = ai?.hop;
  if (ai?.state !== "hop" || !hop || !frog.velocity || dt <= 0) return;
  const old = hop.elapsed;
  hop.elapsed = Math.min(FROG_HOP_DURATION, old + dt);
  const moveEnd = Math.min(LANDING, hop.elapsed);
  const moveStart = Math.max(PUSH_OFF, old);
  const fraction = Math.max(0, moveEnd - moveStart) / Math.max(0.0001, LANDING - moveStart);
  frog.velocity.vx = ((ai.target.wx - frog.position.wx) * fraction) / dt;
  frog.velocity.vy = ((ai.target.wy - frog.position.wy) * fraction) / dt;
  const t = Math.max(0, Math.min(1, (hop.elapsed - PUSH_OFF) / (LANDING - PUSH_OFF)));
  const height = Math.sin(Math.PI * t) * 8;
  frog.wz = hop.startZ + (hop.endZ - hop.startZ) * t + height;
  frog.jumpZ = height;
  frog.noShadow = false;
}

/** Collision owns the landing position; never snap XY through an obstacle. */
export function settleFrog(frog: Entity, groundZ: number, water: boolean): void {
  const ai = frog.frog;
  if (!ai) return;
  const alarm = !!ai.alarmFrom;
  ai.state = alarm ? "recover" : "rest";
  ai.timer = alarm ? 2 : 0.7;
  delete ai.hop;
  delete ai.alarmFrom;
  frog.wz = groundZ;
  delete frog.jumpZ;
  frog.noShadow = water;
  if (frog.velocity) frog.velocity.vx = frog.velocity.vy = 0;
  if (frog.wanderAI) frog.wanderAI.state = alarm ? "scared" : "idle";
  restoreFrogPose(frog);
}
