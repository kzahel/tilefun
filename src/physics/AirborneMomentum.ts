import type { Entity } from "../entities/Entity.js";

/** Reset passive flight state at discontinuous moves/mounting or after landing. */
export function clearAirMomentum(entity: Entity): void {
  delete entity.airMomentumX;
  delete entity.airMomentumY;
}

export function inheritAirMomentum(entity: Entity, velocity: { vx: number; vy: number }): void {
  if (!entity.velocity) return;
  entity.airMomentumX = velocity.vx;
  entity.airMomentumY = velocity.vy;
  entity.velocity.vx += velocity.vx;
  entity.velocity.vy += velocity.vy;
}

/** Only passive-flight players opt into clipping; legacy NPC/ground policy stays intact. */
export function clipAirMomentum(entity: Entity, axis: "x" | "y"): void {
  const key = axis === "x" ? "airMomentumX" : "airMomentumY";
  if (entity[key] === undefined || !entity.velocity) return;
  entity[key] = 0;
  if (axis === "x") entity.velocity.vx = 0;
  else entity.velocity.vy = 0;
}
