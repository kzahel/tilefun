import { Direction, type Entity } from "../entities/Entity.js";
import { type BedVertex, solidOccludes } from "../traffic/BedSolid.js";
import {
  type BedPart,
  bedPartLocalVertices,
  clampBedTilt,
  DUMP_BED,
  gateAngleForTilt,
  hasDumpBed,
  pitchAbout,
} from "../traffic/DumpBed.js";
import type { EquipmentPose } from "./EquipmentPose.js";
import { isTransporterSurface, transporterOccludes } from "./TransporterSurfacePose.js";

export { bedPartMoves, DUMP_BED } from "../traffic/DumpBed.js";
export function bedTilt(e: EquipmentPose): number {
  return clampBedTilt(e.vehicleBedTilt);
}
export function bedGateAngle(e: EquipmentPose): number {
  return gateAngleForTilt(bedTilt(e));
}

/** The articulated tub and tailgate pose for a dump truck's mesh; empty otherwise. */
export function dumpBedMeshPose(entity: { type: string; vehicleBedTilt?: number }) {
  if (!hasDumpBed(entity)) return {};
  const tilt = clampBedTilt(entity.vehicleBedTilt);
  return { bedTilt: tilt, bedGateAngle: gateAngleForTilt(tilt) };
}

export function bedFramePoint(e: EquipmentPose, x: number, y: number, z = DUMP_BED.floorZ) {
  const p = pitchAbout(x, z, DUMP_BED.hinge, bedTilt(e));
  return { ...bedWorldPoint(e, p.x, y), wz: (e.wz ?? 0) + p.z };
}

/** World convex contact vertices, using the same two pivots as the visible v2 rig. */
export function bedPartVertices(e: EquipmentPose, part: BedPart): BedVertex[] {
  return bedPartLocalVertices(part, bedTilt(e)).map(({ x, y, z }) => {
    const p = bedWorldPoint(e, x, y);
    return { x: p.wx, y: p.wy, z: (e.wz ?? 0) + z };
  });
}

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
