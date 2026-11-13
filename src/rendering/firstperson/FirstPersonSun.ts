import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import { type GpuShadow, VEHICLE_SLACK } from "../GpuShadowShape.js";

/**
 * Sun shadow projection for the first-person view (tactical 247). Game axes: X
 * east, Y south, Z up, world pixels.
 *
 * The shadow map is the ground seen along the sun's rays: a point lands on the
 * texel of the ground position its shadow falls on, and the texel keeps the
 * highest point on that ray. The map therefore stays aligned with the world's
 * pixel grid (one texel is one world pixel) and never rotates, so shadow edges
 * are stable under any camera motion. Its origin moves in whole steps.
 */

/** Unit vector toward the sun: 30° east of south, 52° above the horizon. South,
 * east and top faces are lit, matching the fixed view's brightest sides. */
export const SUN = { x: 0.3078, y: 0.5332, z: 0.788 } as const;
export const SUN_MAP_SIZE = 2048;
/** Half the side of the ground square the map covers. */
export const SUN_RADIUS = 1024;
/** The origin moves in steps this size; the map is redrawn on each step. */
export const SUN_SNAP = 128;
/** Heights the map resolves. */
export const SUN_Z_MIN = -32;
export const SUN_Z_MAX = 992;
/** Shadows fade out between these distances from the eye. The far end leaves the
 * map's edge a snap step plus a margin away. */
export const SUN_FADE_START = 760;
export const SUN_FADE_END = SUN_RADIUS - SUN_SNAP - 24;
/** Farthest a caster outside the covered square can throw a shadow into it. */
export const SUN_REACH = 256;

const CHUNK_PX = CHUNK_SIZE * TILE_SIZE;

/** Ground offset of a shadow per unit of caster height. */
export const SUN_SLOPE = { x: -SUN.x / SUN.z, y: -SUN.y / SUN.z } as const;

/** Horizontal unit vector across the sun's direction: static cards (trees) face
 * the sun in the shadow map along this axis. */
export function sunCardRight(): { x: number; y: number } {
  const length = Math.hypot(SUN.x, SUN.y);
  return { x: -SUN.y / length, y: SUN.x / length };
}

/** The map's origin for an eye position, on the snap grid. */
export function sunOrigin(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x / SUN_SNAP) * SUN_SNAP, y: Math.round(y / SUN_SNAP) * SUN_SNAP };
}

/**
 * Clip coordinates of a point relative to the origin, in the view's scene axes
 * (X east, Y north, Z up: game Y mirrored once, as the view's roots do). Row-major.
 * Depth runs from −1 at `SUN_Z_MAX` to +1 at `SUN_Z_MIN`, so the usual "nearer
 * wins" depth test keeps the highest point.
 */
export function sunProjection(): number[] {
  const range = SUN_Z_MAX - SUN_Z_MIN;
  const r = 1 / SUN_RADIUS;
  // Scene Y is north, so the sun's southward component changes sign.
  return [
    r,
    0,
    (-SUN.x / SUN.z) * r,
    0,
    0,
    r,
    (SUN.y / SUN.z) * r,
    0,
    0,
    0,
    -2 / range,
    (SUN_Z_MAX + SUN_Z_MIN) / range,
    0,
    0,
    0,
    1,
  ];
}

/** Clip coordinates of a point given in game axes relative to the origin. */
export function sunClip(dx: number, dy: number, z: number): { x: number; y: number; z: number } {
  const m = sunProjection();
  const at = (row: number) =>
    (m[row * 4] ?? 0) * dx +
    (m[row * 4 + 1] ?? 0) * -dy +
    (m[row * 4 + 2] ?? 0) * z +
    (m[row * 4 + 3] ?? 0);
  return { x: at(0), y: at(1), z: at(2) };
}

/**
 * How far from the eye a change to static content redraws the map at once.
 * Shadows end at the fade distance, and a caster beyond it reaches at most
 * `SUN_REACH` back in. Nothing past the fog's end is redrawn for: such content is
 * hidden, and what little of its shadow reaches thinner fog arrives with the
 * map's next step.
 */
export function sunCasterRange(fogEnd: number): number {
  return Math.min(fogEnd, SUN_FADE_END + SUN_REACH);
}

/** True when a chunk has ground within `range` of the eye. Chunks beyond it are
 * drawn into the map at its next step instead of forcing a redraw of their own. */
export function chunkNearSun(
  cx: number,
  cy: number,
  eye: { x: number; y: number },
  range: number,
): boolean {
  const nx = Math.max(cx * CHUNK_PX, Math.min(eye.x, (cx + 1) * CHUNK_PX));
  const ny = Math.max(cy * CHUNK_PX, Math.min(eye.y, (cy + 1) * CHUNK_PX));
  return Math.hypot(nx - eye.x, ny - eye.y) <= range;
}

/** Mask coordinates of a blob's four corners (−1…1 across the footprint). */
export const BLOB_LOCAL = [-1, -1, 1, -1, 1, 1, -1, 1] as const;
/** Height above the receiving surface, against depth fighting. */
const BLOB_LIFT = 0.4;

/**
 * Writes a caster's contact shadow as four corners (x, y, z in game axes) at
 * `offset`, in `BLOB_LOCAL` order. `support` is the height of the surface under
 * its centre. An actor's oval lies flat on it, round. A vehicle's footprint follows the body's
 * underside plane (so it lies along a ramp); once the body is clear of the ground
 * it falls level onto the support.
 */
export function writeBlob(
  out: Float32Array | number[],
  offset: number,
  shadow: GpuShadow,
  support = shadow.support,
): void {
  const vehicle = shadow.mask === "vehicle";
  const a = shadow.plane[0],
    b = shadow.plane[1],
    c = shadow.plane[2] - VEHICLE_SLACK;
  const gap = vehicle ? Math.max(0, a * shadow.x + b * shadow.y + c - support) : 0;
  const tilted = vehicle && gap < 6;
  // The fixed view squashes an actor's oval north–south; on the ground it is round.
  const vy = shadow.upright ? shadow.ux : shadow.vy;
  for (let i = 0; i < 4; i++) {
    const u = BLOB_LOCAL[i * 2] ?? 0,
      v = BLOB_LOCAL[i * 2 + 1] ?? 0;
    const x = shadow.x + shadow.ux * u + shadow.vx * v,
      y = shadow.y + shadow.uy * u + vy * v;
    out[offset + i * 3] = x;
    out[offset + i * 3 + 1] = y;
    out[offset + i * 3 + 2] = (tilted ? a * x + b * y + c - gap : support) + BLOB_LIFT;
  }
}
