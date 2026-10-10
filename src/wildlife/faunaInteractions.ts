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
  const swim = p.habitat === "shore" && ai.water;
  const named = (name: string) => p.clips.findIndex((c) => c.name === name);
  setSpriteClip(
    animal,
    ai.state === "travel"
      ? swim
        ? named("swim")
        : 1
      : ai.state === "flee"
        ? named(swim ? "flee-swim" : "flee")
        : ai.state === "action" || ai.state === "startle"
          ? named("action")
          : 0,
  );
  animal.noShadow = !!ai.water;
  setSpriteClipElapsed(
    animal,
    ai.motion
      ? Math.round(ai.motion.elapsed * 1000)
      : ai.actionElapsed !== undefined
        ? Math.round(ai.actionElapsed * 1000)
        : undefined,
  );
}
/** One alarm through alert, escape and recovery; preserve any already committed walk. */
export function startleFauna(animal: Entity, from: PositionComponent): boolean {
  const ai = animal.fauna;
  if (!ai || animal.wanderAI?.state === "ridden" || ai.alarmFrom || ai.state === "recover")
    return false;
  ai.alarmFrom = { ...from };
  if (animal.wanderAI) animal.wanderAI.state = "scared";
  if (!ai.motion) {
    ai.state = "startle";
    ai.actionElapsed = 0;
    ai.timer = 0.4;
    if (animal.velocity) animal.velocity.vx = animal.velocity.vy = 0;
    restoreFaunaPose(animal);
  }
  return true;
}

/** Suspend native travel while controlled; resume around the actual dismount. */
export function setFaunaRidden(animal: Entity, ridden: boolean): void {
  const ai = animal.fauna;
  if (!ai) return;
  delete ai.motion;
  delete ai.actionElapsed;
  delete ai.alarmFrom;
  ai.state = "rest";
  ai.timer = 1;
  ai.target = { ...animal.position };
  if (!ridden) {
    ai.home = { ...animal.position };
    ai.shelter = { ...animal.position };
    delete ai.habitatBounds;
    delete ai.groupId;
  }
  if (animal.wanderAI) animal.wanderAI.state = ridden ? "ridden" : "idle";
  restoreFaunaPose(animal);
}
/** Fixed-speed grounded movement. Collision always owns actual XY; no catch-up teleport. */
export function prepareFaunaTravel(animal: Entity, dt: number): void {
  const ai = animal.fauna,
    p = faunaProfile(animal.type),
    motion = ai?.motion;
  if (!ai || !motion || !p || !animal.velocity || dt <= 0) return;
  const old = motion.elapsed;
  motion.elapsed = Math.min(motion.duration, old + dt);
  if (p.hop) {
    const scale = motion.duration / p.hop.duration,
      push = p.hop.push * scale,
      land = p.hop.land * scale;
    const start = Math.max(push, old),
      end = Math.min(land, motion.elapsed);
    const fraction = Math.max(0, end - start) / Math.max(0.0001, land - start);
    animal.velocity.vx = ((ai.target.wx - animal.position.wx) * fraction) / dt;
    animal.velocity.vy = ((ai.target.wy - animal.position.wy) * fraction) / dt;
    const t = Math.max(0, Math.min(1, (motion.elapsed - push) / (land - push)));
    const height = Math.sin(Math.PI * t) * p.hop.height;
    animal.wz = (motion.startZ ?? 0) + ((motion.endZ ?? 0) - (motion.startZ ?? 0)) * t + height;
    animal.jumpZ = height;
    return;
  }
  const dx = ai.target.wx - animal.position.wx,
    dy = ai.target.wy - animal.position.wy;
  const distance = Math.hypot(dx, dy);
  const speed = Math.min(
    (ai.water ? (p.swimSpeed ?? p.speed) : p.speed) * (motion.escaping ? 2 : 1),
    distance / dt,
  );
  animal.velocity.vx = distance > 0.001 ? (dx / distance) * speed : 0;
  animal.velocity.vy = distance > 0.001 ? (dy / distance) * speed : 0;
}
export function settleFauna(animal: Entity, groundZ?: number): void {
  const ai = animal.fauna;
  if (!ai) return;
  const alarm = !!ai.alarmFrom,
    queued = alarm && ai.motion?.escaping === false;
  ai.state = queued ? "startle" : alarm ? "recover" : "rest";
  if (queued) ai.actionElapsed = 0;
  else delete ai.actionElapsed;
  ai.timer = queued ? 0.4 : alarm ? 3 : 0.8;
  if (animal.jumpZ !== undefined) {
    animal.wz = groundZ ?? ai.motion?.endZ ?? 0;
    delete animal.jumpZ;
  }
  delete ai.motion;
  if (!queued) delete ai.alarmFrom;
  if (animal.velocity) animal.velocity.vx = animal.velocity.vy = 0;
  if (animal.wanderAI) animal.wanderAI.state = alarm ? "scared" : "idle";
  restoreFaunaPose(animal);
}

/** Gait changes at the resolved position; phase remains tied to the durable motion clock. */
export function syncFaunaWater(animal: Entity, water: boolean): void {
  const p = faunaProfile(animal.type),
    ai = animal.fauna;
  if (!p || !ai || !["pond", "shore", "deep"].includes(p.habitat)) return;
  const actual = p.habitat === "shore" ? water : true;
  animal.noShadow = actual;
  if (ai.water !== actual) {
    ai.water = actual;
    restoreFaunaPose(animal);
  }
}
