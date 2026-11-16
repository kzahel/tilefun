import type { Entity } from "../../entities/Entity.js";
import type { GrassItem } from "../SceneItem.js";

/**
 * Prototype for the top-down sampling rule (renderer film, 2026-11-16): the
 * camera, every entity and every grass blade placed on one grid of screen pixels
 * in world space. Together with ground sampled as cards are (`GROUND_NEAREST`),
 * the picture then steps as one while the camera moves, instead of each layer
 * stepping on its own frame. `scale` is screen pixels per world pixel.
 */
export function onPixelGrid(value: number, scale: number): number {
  return Math.round(value * scale) / scale;
}

/** Copies of entities placed on the grid; ones already on it are kept. */
export function entitiesOnPixelGrid(entities: readonly Entity[], scale: number): Entity[] {
  return entities.map((entity) => {
    const { wx, wy } = entity.position;
    const x = onPixelGrid(wx, scale),
      y = onPixelGrid(wy, scale);
    return x === wx && y === wy
      ? entity
      : { ...entity, position: { ...entity.position, wx: x, wy: y } };
  });
}

/** Places collected blades on the grid, in place. */
export function bladesOnPixelGrid(blades: readonly GrassItem[], scale: number): void {
  for (const blade of blades) {
    blade.wx = onPixelGrid(blade.wx, scale);
    blade.wy = onPixelGrid(blade.wy, scale);
  }
}
