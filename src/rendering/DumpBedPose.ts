import type { AABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import { type BedVertex, solidOccludes } from "../traffic/BedSolid.js";
import type { EquipmentPose } from "./EquipmentPose.js";
import { isTransporterSurface, transporterOccludes } from "./TransporterSurfacePose.js";

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
  hinge: { x: -3.12 * scale, z: 1.1 * scale },
  gateHinge: { x: -3.1 * scale, z: 2.425 * scale },
  maxTilt: (Math.PI * 48) / 180,
  floorZ: 1.25 * scale,
  center: { x: -1.17 * scale, y: 0 },
  parts: [
    part(
      "chassis",
      { left: -51.5, right: 51.5, top: -14, bottom: 14 },
      { left: -51.5, right: 51.5, top: -14, bottom: 14 },
      0,
      0.7,
    ),
    part("floor", floor, floor, 1.17, 1.25),
    part(
      "cab",
      sourceRect(-3.07, -0.84, -1.27, 1.27),
      sourceRect(-3.07, -0.84, -1.27, 1.27),
      0.43,
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
    ...[-2.3, 1.12, 2.4].flatMap((axle) =>
      [-1, 1].map((side) => {
        const rect = sourceRect(axle - 0.5, axle + 0.5, side * 1.04 - 0.18, side * 1.04 + 0.18);
        return part(`wheel-${axle}-${side}`, rect, rect, 0, 1);
      }),
    ),
  ],
} as const;
export function bedPartMoves(part: BedPart) {
  return (
    part.name === "floor" ||
    part.name.startsWith("side-") ||
    part.name === "front-wall" ||
    part.name === "tailgate"
  );
}
export function bedTilt(e: EquipmentPose): number {
  return Math.max(0, Math.min(DUMP_BED.maxTilt, e.vehicleBedTilt ?? 0));
}
export function bedGateAngle(e: EquipmentPose): number {
  return (Math.min(1, bedTilt(e) / (Math.PI / 12)) * Math.PI * 80) / 180;
}

function pitch(x: number, z: number, hinge: { x: number; z: number }, angle: number) {
  const dx = x - hinge.x,
    dz = z - hinge.z,
    c = Math.cos(angle),
    s = Math.sin(angle);
  return { x: hinge.x + c * dx - s * dz, z: hinge.z + s * dx + c * dz };
}
export function bedFramePoint(e: EquipmentPose, x: number, y: number, z = DUMP_BED.floorZ) {
  const p = pitch(x, z, DUMP_BED.hinge, bedTilt(e));
  return { ...bedWorldPoint(e, p.x, y), wz: (e.wz ?? 0) + p.z };
}

/** Recover the rest-floor XY anchor without treating an upright person's feet as a rotating body. */

/** World convex contact vertices, using the same two pivots as the visible v2 rig. */
export function bedPartVertices(e: EquipmentPose, part: BedPart): BedVertex[] {
  return [part.bottom, part.top].flatMap((r, i) =>
    [
      [r.left, r.top],
      [r.right, r.top],
      [r.right, r.bottom],
      [r.left, r.bottom],
    ].map(([x = 0, y = 0]) => {
      let z = i ? part.z1 : part.z0;
      if (bedPartMoves(part)) {
        if (part.name === "tailgate")
          ({ x, z } = pitch(x, z, DUMP_BED.gateHinge, -bedGateAngle(e)));
        ({ x, z } = pitch(x, z, DUMP_BED.hinge, bedTilt(e)));
      }
      const p = bedWorldPoint(e, x, y);
      return { x: p.wx, y: p.wy, z: (e.wz ?? 0) + z };
    }),
  );
}

/** Grounded movement can follow the same incline it already stands on. It cannot
 * step through a bed wall, acquire a remote floor, or lift an airborne body. */

export function bedHeading(e: EquipmentPose): number {
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
export function bedWorldPoint(e: EquipmentPose, x: number, y: number) {
  const a = bedHeading(e),
    c = Math.cos(a),
    s = Math.sin(a);
  return { wx: e.position.wx + x * c - y * s, wy: e.position.wy + x * s + y * c };
}
export function bedLocalPoint(e: EquipmentPose, position: Entity["position"]) {
  const a = bedHeading(e),
    c = Math.cos(a),
    s = Math.sin(a);
  const x = position.wx - e.position.wx,
    y = position.wy - e.position.wy;
  return { x: x * c + y * s, y: -x * s + y * c };
}
/** Ray toward the fixed camera (+world Y,+Z); used only by sprite fallback clips. */
export function bedOccludesPoint(e: EquipmentPose, wx: number, wy: number, wz: number): boolean {
  if (isTransporterSurface(e)) return transporterOccludes(e, wx, wy, wz);
  if (bedTilt(e) > 0)
    return DUMP_BED.parts.some((part) =>
      solidOccludes(bedPartVertices(e, part), { x: wx, y: wy, z: wz }),
    );
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

/** Keep in-group depth while the player overlaps the truck at any jump height. */
