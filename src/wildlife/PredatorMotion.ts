import type { Entity } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import { predatorProfile } from "./Predator.js";

export function restorePredatorPose(e: Entity): void {
  const ai = e.predator;
  if (!ai || !e.sprite) return;
  const fierce = predatorProfile(e.type)?.fierce;
  const moving = ["patrol", "stalk", "chase", "pounce", "evade", "flight"].includes(ai.state);
  e.sprite.moving = moving;
  if (e.wanderAI)
    e.wanderAI.state =
      ai.state === "scared"
        ? "scared"
        : ai.state === "chase" || ai.state === "pounce"
          ? "chasing"
          : moving
            ? "walking"
            : "idle";
  setSpriteClip(
    e,
    ai.flight
      ? 6
      : (ai.state === "sleep" || ai.state === "ambush") && fierce
        ? 5
        : ai.state === "feed"
          ? 2
          : ai.state === "display" || ai.state === "scared" || (ai.state === "pounce" && !fierce)
            ? 3
            : ai.state === "chase" || ai.state === "evade" || (ai.state === "pounce" && fierce)
              ? 4
              : moving
                ? 1
                : 0,
  );
  setSpriteClipElapsed(e, Math.round((ai.flight?.elapsed ?? ai.elapsed) * 1000));
}
export function predatorFlightZ(start: number, end: number, t: number, lift: number): number {
  return start + (end - start) * t + Math.sin(Math.PI * t) * lift;
}
/** Collision owns XY. This only supplies a bounded velocity and the committed arc. */
export function preparePredatorFlight(e: Entity, dt: number): void {
  const ai = e.predator,
    f = ai?.flight,
    speed = predatorProfile(e.type)?.chaseSpeed;
  if (!ai || !f || !speed || !e.velocity || dt <= 0) return;
  f.elapsed = Math.min(f.duration, f.elapsed + dt);
  const t = f.elapsed / f.duration,
    target = {
      wx: f.from.wx + (f.to.wx - f.from.wx) * t,
      wy: f.from.wy + (f.to.wy - f.from.wy) * t,
    };
  const dx = target.wx - e.position.wx,
    dy = target.wy - e.position.wy,
    d = Math.hypot(dx, dy);
  const step = Math.min(speed, d / dt);
  e.velocity.vx = d > 0.001 ? (dx / d) * step : 0;
  e.velocity.vy = d > 0.001 ? (dy / d) * step : 0;
  f.previousZ = e.wz ?? f.startZ;
  e.wz = predatorFlightZ(f.startZ, f.endZ, t, f.lift);
  e.jumpZ = Math.sin(Math.PI * t) * f.lift;
  if (e.sprite && d > 0.001) e.sprite.frameRow = e.sprite.direction = directionFromVelocity(dx, dy);
  restorePredatorPose(e);
}
export function settlePredatorFlight(e: Entity, groundZ: number): void {
  const ai = e.predator,
    f = ai?.flight;
  if (!ai || !f) return;
  const attack = f.attack && !!ai.targetId && !ai.alarmFrom;
  delete ai.flight;
  delete e.jumpZ;
  e.wz = groundZ;
  ai.state = attack ? "chase" : groundZ > 4 ? "perch" : "rest";
  ai.timer = attack ? 0 : groundZ > 4 ? 2 : 1;
  ai.elapsed = 0;
  if (!attack) {
    delete ai.targetId;
    delete ai.huntElapsed;
    delete ai.aim;
  }
  if (e.velocity) e.velocity.vx = e.velocity.vy = 0;
  restorePredatorPose(e);
}
