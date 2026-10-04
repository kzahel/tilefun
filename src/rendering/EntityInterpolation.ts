import type { Entity, PositionComponent } from "../entities/Entity.js";

/** Shared displayed position for bodies and observer-dependent overlays. */
export function interpolatePosition(
  pos: PositionComponent,
  prev: PositionComponent | undefined,
  alpha: number,
): PositionComponent {
  if (prev) {
    return {
      wx: prev.wx + (pos.wx - prev.wx) * alpha,
      wy: prev.wy + (pos.wy - prev.wy) * alpha,
    };
  }
  return pos;
}

/** Undefined retains the scene collector's legacy terrain/jump-height fallback. */
export function interpolateWz(entity: Entity, alpha: number): number | undefined {
  if (entity.wz === undefined) return undefined;
  const prev = entity.prevWz ?? entity.wz;
  return prev + (entity.wz - prev) * alpha;
}
