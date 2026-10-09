import type { Entity, PositionComponent } from "../entities/Entity.js";
import { setSpriteClip } from "../entities/spriteAnimation.js";
import { directionFromVelocity } from "../entities/wanderAI.js";

export const MALLARD_BOUNCE_VZ = 95;

/** Rebuild transient presentation from durable behavior after residency/reload. */
export function restoreMallardPose(duck: Entity): void {
  const ai = duck.mallard;
  if (!ai || !duck.sprite) return;
  const moving = ai.state === "travel" || ai.state === "flight";
  duck.sprite.moving = moving;
  if (moving) {
    duck.sprite.direction = directionFromVelocity(
      ai.target.wx - duck.position.wx,
      ai.target.wy - duck.position.wy,
    );
    duck.sprite.frameRow = duck.sprite.direction;
  }
  setSpriteClip(
    duck,
    ai.state === "flight"
      ? 5
      : ai.state === "startle" || ai.state === "quack"
        ? 4
        : ai.state === "flap"
          ? 3
          : ai.state === "travel"
            ? 1
            : 0,
  );
}

/** Authority-only reaction; a single alarm lasts through flight and settling. */
export function startleMallard(duck: Entity, from: PositionComponent): boolean {
  const ai = duck.mallard;
  if (!ai || ai.state === "startle" || ai.state === "flight" || ai.state === "recover")
    return false;
  ai.state = "startle";
  ai.timer = 0.64;
  ai.alarmFrom = { ...from };
  if (duck.velocity) duck.velocity.vx = duck.velocity.vy = 0;
  if (duck.wanderAI) duck.wanderAI.state = "scared";
  if (duck.sprite) duck.sprite.moving = false;
  setSpriteClip(duck, 4);
  return true;
}

/** Physics-time flight arc. Ordinary EntityManager collision still owns XY movement. */
export function prepareMallardFlight(duck: Entity, dt: number): void {
  const ai = duck.mallard,
    flight = ai?.flight;
  if (ai?.state !== "flight" || !flight || !duck.velocity) return;
  const remaining = Math.max(0, flight.duration - flight.elapsed);
  const fraction = Math.min(1, dt / Math.max(0.0001, remaining));
  duck.velocity.vx = ((ai.target.wx - duck.position.wx) * fraction) / dt;
  duck.velocity.vy = ((ai.target.wy - duck.position.wy) * fraction) / dt;
  flight.elapsed = Math.min(flight.duration, flight.elapsed + dt);
  const t = flight.elapsed / flight.duration;
  duck.wz = flight.startZ + (flight.endZ - flight.startZ) * t + Math.sin(Math.PI * t) * 34;
  duck.jumpZ = Math.sin(Math.PI * t) * 34;
  duck.noShadow = false;
}

/** Settle at the actual collision-resolved position, never teleport to a blocked target. */
export function settleMallard(duck: Entity, groundZ: number, water: boolean): void {
  const ai = duck.mallard;
  if (!ai) return;
  ai.state = "recover";
  ai.timer = 2;
  delete ai.flight;
  delete ai.alarmFrom;
  duck.wz = groundZ;
  delete duck.jumpZ;
  duck.noShadow = water;
  if (duck.velocity) duck.velocity.vx = duck.velocity.vy = 0;
  if (duck.sprite) duck.sprite.moving = false;
  setSpriteClip(duck, 0);
}
