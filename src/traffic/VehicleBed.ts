import { type AABB, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntitySurface } from "../physics/surfaceHeight.js";

/** Plain physics geometry; opt-in per vehicle, shared by authority/prediction/debug.
 * Source: retained dump-truck/v1/geometry.py and family.json, scale 400/23.
 * Matches dump-truck-v1.glb eda05b91; its current game height registration is 1.
 * Bottom/top rectangles describe the actual outward-sloping tub walls.
 */
export interface BedPart {
  name: string;
  bottom: AABB;
  top: AABB;
  z0: number;
  z1: number;
}
const scale = 400 / 23;
function sourceRect(x0: number, x1: number, y0: number, y1: number): AABB {
  return { left: -x1 * scale, right: -x0 * scale, top: -y1 * scale, bottom: -y0 * scale };
}
function part(name: string, bottom: AABB, top: AABB, z0: number, z1: number): BedPart {
  return { name, bottom, top, z0: z0 * scale, z1: z1 * scale };
}
const floor = sourceRect(-0.64, 2.98, -0.93, 0.93);
export const DUMP_BED = {
  floorZ: 1.25 * scale,
  center: { x: -1.17 * scale, y: 0 },
  parts: [
    part(
      "chassis",
      { left: -56, right: 56, top: -23, bottom: 23 },
      { left: -56, right: 56, top: -23, bottom: 23 },
      0,
      1.17,
    ),
    part("floor", floor, floor, 1.17, 1.25),
    part(
      "cab",
      sourceRect(-3.07, -0.84, -1.27, 1.27),
      sourceRect(-3.07, -0.84, -1.27, 1.27),
      1.17,
      2.8,
    ),
    ...([-1, 1] as const).map((side) =>
      part(
        side === -1 ? "side-a" : "side-b",
        sourceRect(-0.65, 2.99, side < 0 ? -1 : 0.86, side < 0 ? -0.86 : 1),
        sourceRect(-0.78, 3.1, side < 0 ? -1.3 : 1.1, side < 0 ? -1.1 : 1.3),
        1.25,
        2.46,
      ),
    ),
    part(
      "front-wall",
      sourceRect(-0.69, -0.56, -1, 1),
      sourceRect(-0.85, -0.67, -1.24, 1.24),
      1.25,
      2.46,
    ),
    part("tailgate", sourceRect(2.9, 2.99, -1, 1), sourceRect(2.99, 3.15, -1.24, 1.24), 1.25, 2.46),
  ],
} as const;

export function hasVehicleBed(e: Pick<EntitySurface, "type" | "vehicleBed">): boolean {
  return e.vehicleBed === true && e.type === "vehicle-v1:dump-truck";
}
export function bedHeading(e: EntitySurface): number {
  return (
    e.vehicleHeading ??
    (e.sprite?.direction === Direction.Left
      ? Math.PI
      : e.sprite?.direction === Direction.Up
        ? -Math.PI / 2
        : e.sprite?.direction === Direction.Down
          ? Math.PI / 2
          : 0)
  );
}
export function bedWorldPoint(e: EntitySurface, x: number, y: number) {
  const a = bedHeading(e),
    c = Math.cos(a),
    s = Math.sin(a);
  return { wx: e.position.wx + x * c - y * s, wy: e.position.wy + x * s + y * c };
}
export function bedLocalPoint(e: EntitySurface, position: Entity["position"]) {
  const a = bedHeading(e),
    c = Math.cos(a),
    s = Math.sin(a);
  const x = position.wx - e.position.wx,
    y = position.wy - e.position.wy;
  return { x: x * c + y * s, y: -x * s + y * c };
}
function atHeight(part: BedPart, z: number): AABB {
  const t = Math.max(0, Math.min(1, (z - part.z0) / (part.z1 - part.z0)));
  return {
    left: part.bottom.left + (part.top.left - part.bottom.left) * t,
    right: part.bottom.right + (part.top.right - part.bottom.right) * t,
    top: part.bottom.top + (part.top.top - part.bottom.top) * t,
    bottom: part.bottom.bottom + (part.top.bottom - part.bottom.bottom) * t,
  };
}
/** SAT between a world axis-aligned footprint and a vehicle-local rectangle. */
export function bedRectOverlaps(e: EntitySurface, local: AABB, footprint: AABB): boolean {
  const a = bedHeading(e),
    c = Math.cos(a),
    s = Math.sin(a);
  const center = bedWorldPoint(e, (local.left + local.right) / 2, (local.top + local.bottom) / 2);
  const dx = (footprint.left + footprint.right) / 2 - center.wx;
  const dy = (footprint.top + footprint.bottom) / 2 - center.wy;
  const x = (local.right - local.left) / 2,
    y = (local.bottom - local.top) / 2;
  const w = (footprint.right - footprint.left) / 2,
    h = (footprint.bottom - footprint.top) / 2;
  const ac = Math.abs(c),
    as = Math.abs(s),
    epsilon = 1e-6;
  return (
    Math.abs(dx) < w + x * ac + y * as - epsilon &&
    Math.abs(dy) < h + x * as + y * ac - epsilon &&
    Math.abs(dx * c + dy * s) < x + w * ac + h * as - epsilon &&
    Math.abs(-dx * s + dy * c) < y + w * as + h * ac - epsilon
  );
}
export function vehicleBedBlocks(
  e: EntitySurface,
  footprint: AABB,
  wz: number,
  height: number,
): boolean {
  const base = e.wz ?? 0;
  for (const part of DUMP_BED.parts) {
    const z0 = Math.max(part.z0, wz - base),
      z1 = Math.min(part.z1, wz + height - base);
    if (z1 - z0 < 0.001) continue;
    const lo = atHeight(part, z0),
      hi = atHeight(part, z1);
    if (
      bedRectOverlaps(
        e,
        {
          left: Math.min(lo.left, hi.left),
          right: Math.max(lo.right, hi.right),
          top: Math.min(lo.top, hi.top),
          bottom: Math.max(lo.bottom, hi.bottom),
        },
        footprint,
      )
    )
      return true;
  }
  return false;
}
/** Ray toward the fixed camera (+world Y,+Z); used only by sprite fallback clips. */
export function bedOccludesPoint(e: EntitySurface, wx: number, wy: number, wz: number): boolean {
  const p = bedLocalPoint(e, { wx, wy }),
    a = bedHeading(e);
  const dx = Math.sin(a),
    dy = Math.cos(a),
    z = wz - (e.wz ?? 0);
  for (const part of DUMP_BED.parts) {
    let enter = 0.0001,
      leave = Infinity;
    const planes = [
      [0, 0, -1, -part.z0],
      [0, 0, 1, part.z1],
    ];
    for (const [axis, key, sign] of [
      [0, "left", -1],
      [0, "right", 1],
      [1, "top", -1],
      [1, "bottom", 1],
    ] as const) {
      const slope = (part.top[key] - part.bottom[key]) / (part.z1 - part.z0);
      planes.push([
        axis === 0 ? sign : 0,
        axis === 1 ? sign : 0,
        -sign * slope,
        sign * (part.bottom[key] - slope * part.z0),
      ]);
    }
    for (const [nx = 0, ny = 0, nz = 0, limit = 0] of planes) {
      const value = nx * p.x + ny * p.y + nz * z - limit;
      const rate = nx * dx + ny * dy + nz;
      if (Math.abs(rate) < 1e-9) {
        if (value > 0) leave = -1;
      } else if (rate > 0) leave = Math.min(leave, -value / rate);
      else enter = Math.max(enter, -value / rate);
    }
    if (leave > enter) return true;
  }
  return false;
}
/** All actual support tops under the foot, including the recessed floor. */
export function entitySupportTops(e: EntitySurface, footprint: AABB): number[] {
  if (!e.collider) return [];
  if (hasVehicleBed(e))
    return DUMP_BED.parts
      .filter((part) => bedRectOverlaps(e, part.top, footprint))
      .map((part) => (e.wz ?? 0) + part.z1);
  return aabbsOverlap(footprint, getEntityAABB(e.position, e.collider)) &&
    e.collider.physicalHeight !== undefined
    ? [(e.wz ?? 0) + e.collider.physicalHeight]
    : [];
}
export function movingSupportZ(
  support: EntitySurface,
  rider: Pick<Entity, "collider" | "position" | "wz">,
): number {
  if (hasVehicleBed(support) && rider.collider) {
    const tops = entitySupportTops(support, getEntityAABB(rider.position, rider.collider)).filter(
      (z) => z <= (rider.wz ?? 0) + 0.1,
    );
    if (tops.length) return Math.max(...tops);
  }
  return (support.wz ?? 0) + (support.collider?.physicalHeight ?? 0);
}

/** Keep in-group depth while the player overlaps the truck at any jump height. */
export function bedVisualOwner(actor: Entity, vehicles: readonly Entity[]): Entity | undefined {
  if (!actor.collider || actor.parentId !== undefined) return;
  const footprint = getEntityAABB(actor.position, actor.collider);
  return vehicles.find(
    (e) =>
      hasVehicleBed(e) &&
      e.collider &&
      aabbsOverlap(footprint, getEntityAABB(e.position, e.collider)),
  );
}
