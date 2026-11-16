import type { GrassItem, ParticleItem } from "./SceneItem.js";

/**
 * The 3D top-down view's sampling rule (renderer film, 2026-11-16): the camera,
 * every body and every grass blade stand on one grid of screen pixels in world
 * space, and the ground is sampled once per pixel as cards are. The picture then
 * steps as one while the camera moves or settles, instead of each layer stepping
 * on its own phase. `scale` is screen pixels per world pixel.
 */
export function onPixelGrid(value: number, scale: number): number {
  return Math.round(value * scale) / scale;
}

/** Places collected blades on the grid, in place. */
export function bladesOnPixelGrid(blades: readonly GrassItem[], scale: number): void {
  for (const blade of blades) {
    blade.wx = onPixelGrid(blade.wx, scale);
    blade.wy = onPixelGrid(blade.wy, scale);
  }
}

/** Places collected particles (and their heights) on the grid, in place. */
export function particlesOnPixelGrid(items: readonly { kind: string }[], scale: number): void {
  for (const item of items) {
    if (item.kind !== "particle") continue;
    const particle = item as ParticleItem;
    particle.wx = onPixelGrid(particle.wx, scale);
    particle.wy = onPixelGrid(particle.wy, scale);
    particle.z = onPixelGrid(particle.z, scale);
  }
}
