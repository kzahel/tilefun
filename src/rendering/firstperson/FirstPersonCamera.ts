import { Direction } from "../../entities/Entity.js";

/**
 * First-person camera math (tactical 229). Game axes throughout: X east, Y south,
 * Z up, in world pixels. Yaw is a world heading: 0 faces east, +π/2 faces south,
 * so increasing yaw turns right when seen from above. Pitch > 0 looks up.
 */
export const NORTH_YAW = -Math.PI / 2;
export const PITCH_LIMIT = 1.25;

export interface FirstPersonLook {
  yaw: number;
  pitch: number;
}

export interface FirstPersonEye extends FirstPersonLook {
  x: number;
  y: number;
  z: number;
}

/**
 * Rotate screen-style movement (dy < 0 forward, dx > 0 right) into world axes
 * for a camera heading. Facing north is the identity, so the fixed oblique view
 * and an unturned first-person camera send identical input.
 */
export function cameraRelativeMovement(
  dx: number,
  dy: number,
  yaw: number,
): { dx: number; dy: number } {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const forward = -dy;
  return { dx: forward * c - dx * s, dy: forward * s + dx * c };
}

export function lookDirection(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const c = Math.cos(pitch);
  return { x: c * Math.cos(yaw), y: c * Math.sin(yaw), z: Math.sin(pitch) };
}

/** Horizontal camera right vector: facing east, right is south. */
export function cameraRight(yaw: number): { x: number; y: number } {
  return { x: -Math.sin(yaw), y: Math.cos(yaw) };
}

export function clampPitch(pitch: number): number {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
}

/** Signed shortest turn from `from` to `to`, in (-π, π]. */
export function angleDelta(to: number, from: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Third-person camera behind and above a target, looking slightly down at it. */
export function chaseEye(
  target: { x: number; y: number; z: number },
  look: FirstPersonLook,
  distance: number,
  height: number,
): FirstPersonEye {
  const pitch = clampPitch(look.pitch - 0.3);
  const dir = lookDirection(look.yaw, pitch);
  return {
    x: target.x - dir.x * distance,
    y: target.y - dir.y * distance,
    z: target.z + height - dir.z * distance,
    yaw: look.yaw,
    pitch,
  };
}

export function directionHeading(direction: Direction): number {
  switch (direction) {
    case Direction.Down:
      return Math.PI / 2;
    case Direction.Up:
      return -Math.PI / 2;
    case Direction.Left:
      return Math.PI;
    default:
      return 0;
  }
}

/**
 * Doom-style row selection for four-direction sprites, which are drawn as seen
 * from the south. `viewAngle` is the heading from the eye to the sprite; looking
 * north at a sprite returns its own facing unchanged.
 */
export function apparentDirection(facing: Direction, viewAngle: number): Direction {
  const apparent = directionHeading(facing) - viewAngle - Math.PI / 2;
  const quarter = Math.round(angleDelta(apparent, 0) / (Math.PI / 2));
  switch (quarter) {
    case 1:
      return Direction.Down;
    case -1:
      return Direction.Up;
    case 2:
    case -2:
      return Direction.Left;
    default:
      return Direction.Right;
  }
}

/**
 * Fog end for this frame: the draw radius, pulled in to the nearest in-reach chunk
 * that has not arrived, so the world's edge never shows while streaming widens
 * (230). Pulls in at once; eases back out as chunks arrive.
 */
export function nextFogEnd(
  previous: number | undefined,
  drawRadius: number,
  nearestMissing: number | undefined,
  minimum = 0,
): number {
  const target = Math.max(minimum, Math.min(drawRadius, nearestMissing ?? Infinity));
  if (previous === undefined || target <= previous) return target;
  const eased = previous + (target - previous) * 0.08;
  return target - eased < 1 ? target : eased;
}
