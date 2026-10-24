import { type AABB, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { surfaceZAt } from "../physics/SurfacePatch.js";
import type { PropSurface } from "../physics/surfaceHeight.js";
import { terrainBaseZ } from "../physics/TerrainExcavation.js";
import { vehicleNoseHeading } from "./Vehicle.js";
import profiles from "./vehicle-ground-contacts.json" with { type: "json" };

export interface WheelContact {
  name: string;
  x: number;
  y: number;
  z: number;
  surfaceZ: number;
}
export interface VehicleGroundPose {
  pitch: number;
  roll: number;
  /** Visual translation relative to the unchanged conservative physics base. */
  offsetZ: number;
  /** Support-plane slopes in vehicle-local heading coordinates. */
  riseX: number;
  riseY: number;
  contacts: WheelContact[];
}
const nearZero = (n: number) => (Math.abs(n) < 1e-8 ? 0 : n);

/** Point support on the occupied floor, never an unrelated bridge/ceiling above. */
function groundAt(
  x: number,
  y: number,
  ceiling: number,
  getHeight: (x: number, y: number) => number,
  props: readonly PropSurface[],
) {
  const foot: AABB = { left: x - 0.001, right: x + 0.001, top: y - 0.001, bottom: y + 0.001 };
  let z = terrainBaseZ(foot, getHeight, props);
  if (z > ceiling + 0.1) return;
  for (const p of props)
    for (const c of p.walls ?? (p.collider ? [p.collider] : [])) {
      if (!c.surface && !(c.walkableTop && c.zHeight !== undefined)) continue;
      const b = getEntityAABB(p.position, c);
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue;
      const top = c.surface ? surfaceZAt(c.surface, b, x, y) : (c.zBase ?? 0) + (c.zHeight ?? 0);
      if (top <= ceiling + 0.1) z = Math.max(z, top);
    }
  return z;
}

/** Read-only, measured-wheel grade pilot. Authority keeps its upright body and
 * level conservative roof. Presentation fits the visible rigid chassis to tyre
 * contacts; no pitched collision hull, suspension or independent animation clock.
 */
export function vehicleGroundPose(
  e: Entity,
  getHeight: (x: number, y: number) => number,
  props: readonly PropSurface[],
): VehicleGroundPose | undefined {
  if (!e.collider || e.towedBy !== undefined || e.transportedBy !== undefined) return;
  const profile = profiles[e.type.slice(11) as keyof typeof profiles];
  if (!e.type.startsWith("vehicle-v1:") || !profile) return;
  const footprint = getEntityAABB(e.position, e.collider);
  const nearby = props.filter((p) => {
    const supports = (c: NonNullable<PropSurface["collider"]>) => {
      if (!c.surface && !c.walkableTop) return false;
      const b = getEntityAABB(p.position, c);
      return (
        b.right >= footprint.left - 1 &&
        b.left <= footprint.right + 1 &&
        b.bottom >= footprint.top - 1 &&
        b.top <= footprint.bottom + 1
      );
    };
    return p.walls ? p.walls.some(supports) : p.collider ? supports(p.collider) : false;
  });
  // This pilot follows authored slabs. An unsupported/restored body or a flat
  // terrain plateau keeps the established level presentation and rider datum.
  if (!nearby.length) return;
  const heading = vehicleNoseHeading(e),
    c = Math.cos(heading),
    s = Math.sin(heading);
  let pitch = 0,
    roll = 0,
    centerZ = e.wz ?? 0,
    riseX = 0,
    riseY = 0;
  let points: { name: string; x: number; y: number; z: number; surfaceZ: number }[] = [];
  // Re-sample at the actual compressed/tilted wheel locations across ramp joins.
  for (let iteration = 0; iteration < 3; iteration++) {
    const cp = Math.cos(pitch),
      sp = Math.sin(pitch),
      cr = Math.cos(roll),
      sr = Math.sin(roll);
    points = [];
    for (const wheel of profile.contacts) {
      const x = cp * wheel.x - sp * (sr * wheel.y + cr * wheel.z);
      const y = cr * wheel.y - sr * wheel.z;
      const z = sp * wheel.x + cp * (sr * wheel.y + cr * wheel.z);
      const surfaceZ = groundAt(
        e.position.wx + x * c - y * s,
        e.position.wy + x * s + y * c,
        e.wz ?? 0,
        getHeight,
        nearby,
      );
      if (surfaceZ === undefined) return;
      points.push({ name: wheel.name, x, y, z, surfaceZ });
    }
    const n = points.length;
    const mx = points.reduce((v, p) => v + p.x, 0) / n,
      my = points.reduce((v, p) => v + p.y, 0) / n,
      mz = points.reduce((v, p) => v + p.surfaceZ, 0) / n;
    let xx = 0,
      yy = 0,
      xy = 0,
      xz = 0,
      yz = 0;
    for (const p of points) {
      xx += (p.x - mx) ** 2;
      yy += (p.y - my) ** 2;
      xy += (p.x - mx) * (p.y - my);
      xz += (p.x - mx) * (p.surfaceZ - mz);
      yz += (p.y - my) * (p.surfaceZ - mz);
    }
    const determinant = xx * yy - xy * xy;
    if (determinant < 0.0001) return;
    riseX = nearZero((xz * yy - yz * xy) / determinant);
    riseY = nearZero((yz * xx - xz * xy) / determinant);
    // Missing deck edges and stairs must not turn into extreme cosmetic slopes.
    if (Math.hypot(riseX, riseY) > 0.50001) return;
    for (const a of points)
      for (const b of points) {
        if (Math.abs(a.surfaceZ - b.surfaceZ) > Math.hypot(a.x - b.x, a.y - b.y) * 0.50001 + 0.001)
          return;
      }
    pitch = Math.atan(riseX);
    roll = Math.atan(riseY * Math.cos(pitch));
    centerZ = Math.max(...points.map((p) => p.surfaceZ - riseX * p.x - riseY * p.y));
  }
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  const contacts: WheelContact[] = [];
  // Re-establish wheel nonpenetration after the final orientation update.
  for (const wheel of profile.contacts) {
    const x = cp * wheel.x - sp * (sr * wheel.y + cr * wheel.z),
      y = cr * wheel.y - sr * wheel.z;
    const z = sp * wheel.x + cp * (sr * wheel.y + cr * wheel.z);
    const wx = e.position.wx + c * x - s * y,
      wy = e.position.wy + s * x + c * y;
    const surfaceZ = groundAt(wx, wy, e.wz ?? 0, getHeight, nearby);
    if (surfaceZ === undefined) return;
    centerZ = Math.max(centerZ, surfaceZ - z);
    contacts.push({ name: wheel.name, x: wx, y: wy, z, surfaceZ });
  }
  for (const p of contacts) p.z += centerZ;
  return { pitch, roll, riseX, riseY, offsetZ: nearZero(centerZ - (e.wz ?? 0)), contacts };
}

/** Visible roof plane at the rider, using the existing fitted-roof datum. */
export function gradeRoofOffset(
  pose: VehicleGroundPose,
  heading: number,
  dx: number,
  dy: number,
  roofHeight: number,
) {
  const x = dx * Math.cos(heading) + dy * Math.sin(heading),
    y = -dx * Math.sin(heading) + dy * Math.cos(heading);
  return (
    pose.offsetZ +
    pose.riseX * x +
    pose.riseY * y +
    roofHeight * (Math.hypot(1, pose.riseX, pose.riseY) - 1)
  );
}
