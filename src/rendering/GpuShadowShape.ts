import type { Entity } from "../entities/Entity.js";
import { type BodyRotation, rotateBodyVector, yawRotation } from "../physics/BodyRotation.js";
import { physicsBodyDimensions } from "../physics/PhysicsBodies.js";
import { shadowFootprint } from "./ProjectedDecals.js";
import type { SurfaceMesh } from "./SurfaceReceivers.js";

/** One caster for the GPU depth shadow pass (236), in world pixels: a footprint
 * parallelogram (centre and two half-extent axes) with a soft mask, and the
 * heights it may shade: receivers at most `band` below the `plane`. */
export interface GpuShadow {
  x: number;
  y: number;
  ux: number;
  uy: number;
  vx: number;
  vy: number;
  /** Upper limit for receivers, z = a·x + b·y + c. */
  plane: readonly [number, number, number];
  band: number;
  mask: "oval" | "vehicle";
  /** A mesh body's shadow: drawn only when that body was drawn this frame
   * (sprite fallbacks already contain a baked shadow). */
  casterId?: number;
}

/** The actor oval of `shadowFootprint` around the surface under its centre.
 * The slack covers a slope inside the footprint; upright bodies are rejected by
 * facing in the pass, so it never darkens a sprite. */
export function ovalShadow(e: Entity, x: number, y: number, supportZ: number): GpuShadow {
  const d = physicsBodyDimensions(e),
    rx = d.width / 2,
    ry = Math.max(d.depth * 0.4, d.width * 0.175),
    slack = 2 + Math.max(rx, ry) * 0.6;
  return {
    x: x + d.offsetX,
    y: y + d.offsetY,
    ux: rx,
    uy: 0,
    vx: 0,
    vy: ry,
    plane: [0, 0, supportZ + slack],
    band: slack * 2,
    mask: "oval",
  };
}

const VEHICLE_SLACK = 4;
/** A vehicle's oriented footprint under its body. The limit is the body's
 * underside plane, so its own roof and bonnet never receive the shadow; the
 * band reaches down to the surface under its centre (a jump or a drop). */
export function vehicleShadow(
  e: Entity,
  x: number,
  y: number,
  z: number,
  supportZ: number,
  mesh?: SurfaceMesh,
  rotation?: BodyRotation,
): GpuShadow | undefined {
  const [p0, p1, , p3] = shadowFootprint(e, x, y, mesh, rotation);
  if (!p0 || !p1 || !p3) return;
  const ux = (p1.x - p0.x) / 2,
    uy = (p1.y - p0.y) / 2,
    vx = (p3.x - p0.x) / 2,
    vy = (p3.y - p0.y) / 2;
  if (Math.abs(ux * vy - vx * uy) < 1e-6) return;
  const q = rotation ?? e.bodyRotation ?? yawRotation(physicsBodyDimensions(e).yaw),
    up = rotateBodyVector(q, 0, 0, 1),
    // A body on its side has no underside plane over the ground: use its root height.
    a = up.z > 0.3 ? -up.x / up.z : 0,
    b = up.z > 0.3 ? -up.y / up.z : 0;
  return {
    x: p0.x + ux + vx,
    y: p0.y + uy + vy,
    ux,
    uy,
    vx,
    vy,
    plane: [a, b, z - a * x - b * y + VEHICLE_SLACK],
    band: VEHICLE_SLACK * 2 + Math.max(0, z - supportZ),
    mask: "vehicle",
    casterId: e.id,
  };
}
