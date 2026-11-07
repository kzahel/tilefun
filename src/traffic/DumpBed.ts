import type { AABB } from "../entities/collision.js";

/** Articulated dump-bed geometry shared by the physics body, authority and presentation.
 * Source: retained dump-truck v1/v2 geometry.py and family.json, scale 400/23.
 * Vehicle-local axes: +x is the nose, +y lateral, z up from the body's ground datum.
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
  /** Seconds from level to fully raised, as in the authored v2 rig review. */
  raiseSeconds: 3.2,
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
  ] as readonly BedPart[],
} as const;

export const DUMP_TRUCK_TYPE = "vehicle-v1:dump-truck";
export function hasDumpBed(entity: { type?: string }): boolean {
  return entity.type === DUMP_TRUCK_TYPE;
}
/** Shared fixed-step angular rate; authority and replay advance the same clock. */
export const DUMP_BED_RATE = DUMP_BED.maxTilt / DUMP_BED.raiseSeconds;

export function bedPartMoves(part: BedPart) {
  return (
    part.name === "floor" ||
    part.name.startsWith("side-") ||
    part.name === "front-wall" ||
    part.name === "tailgate"
  );
}
export function clampBedTilt(tilt: number | undefined): number {
  return Math.max(0, Math.min(DUMP_BED.maxTilt, tilt ?? 0));
}
/** The upper-hinged tailgate opens fully during the first 15 degrees of tilt. */
export function gateAngleForTilt(tilt: number): number {
  return (Math.min(1, clampBedTilt(tilt) / (Math.PI / 12)) * Math.PI * 80) / 180;
}
export function pitchAbout(x: number, z: number, hinge: { x: number; z: number }, angle: number) {
  const dx = x - hinge.x,
    dz = z - hinge.z,
    c = Math.cos(angle),
    s = Math.sin(angle);
  return { x: hinge.x + c * dx - s * dz, z: hinge.z + s * dx + c * dz };
}
/** Eight vehicle-local convex vertices (bottom ring, then top ring) for one posed part. */
export function bedPartLocalVertices(
  part: BedPart,
  tilt: number,
  minZ = 0,
): { x: number; y: number; z: number }[] {
  const angle = clampBedTilt(tilt),
    gate = gateAngleForTilt(angle);
  return [part.bottom, part.top].flatMap((r, i) =>
    [
      [r.left, r.top],
      [r.right, r.top],
      [r.right, r.bottom],
      [r.left, r.bottom],
    ].map(([x = 0, y = 0]) => {
      let z = Math.max(minZ, i ? part.z1 : part.z0);
      if (bedPartMoves(part)) {
        if (part.name === "tailgate") ({ x, z } = pitchAbout(x, z, DUMP_BED.gateHinge, -gate));
        ({ x, z } = pitchAbout(x, z, DUMP_BED.hinge, angle));
      }
      return { x, y, z };
    }),
  );
}

/** Presentation grouping: an unparented actor inside the open tub's volume (any tilt). */
export function insideDumpBed(
  truck: { position: { wx: number; wy: number }; wz?: number; vehicleHeading?: number },
  actor: { position: { wx: number; wy: number }; wz?: number },
  heading = truck.vehicleHeading ?? 0,
): boolean {
  const dx = actor.position.wx - truck.position.wx,
    dy = actor.position.wy - truck.position.wy,
    c = Math.cos(heading),
    s = Math.sin(heading);
  const x = dx * c + dy * s,
    y = -dx * s + dy * c,
    z = (actor.wz ?? 0) - (truck.wz ?? 0);
  return x >= -60 && x <= 16 && Math.abs(y) <= 24 && z >= 12 && z <= 110;
}

/** Durable dump-bed angle and target; omitted while level and at rest. */
export function savedBed(e: { vehicleBedTilt?: number; vehicleBedTarget?: number }): {
  bed?: readonly [number, number];
} {
  return e.vehicleBedTilt || e.vehicleBedTarget
    ? { bed: [e.vehicleBedTilt ?? 0, e.vehicleBedTarget ?? 0] }
    : {};
}
export function validSavedBed(model: string, bed: unknown): boolean {
  return (
    bed === undefined ||
    (`vehicle-v1:${model}` === DUMP_TRUCK_TYPE &&
      Array.isArray(bed) &&
      bed.length === 2 &&
      bed.every((n) => typeof n === "number" && n >= 0 && n <= DUMP_BED.maxTilt + 1e-6))
  );
}
export function restoreSavedBed(
  e: { vehicleBedTilt?: number; vehicleBedTarget?: number },
  bed: readonly [number, number] | undefined,
) {
  if (bed?.[0]) e.vehicleBedTilt = bed[0];
  if (bed?.[1]) e.vehicleBedTarget = bed[1];
}

/** Lab diagnostics: the dump truck's angle and how many balls ride inside its tub. */
export function recordDumpBed(
  dataset: DOMStringMap,
  entities: readonly {
    id: number;
    type: string;
    position: { wx: number; wy: number };
    wz?: number;
    vehicleHeading?: number;
    vehicleBedTilt?: number;
  }[],
  truckId: number | undefined,
) {
  const truck = entities.find((e) => e.id === truckId);
  dataset.bedTilt = String(truck?.vehicleBedTilt ?? 0);
  dataset.bedCargo = String(
    truck
      ? entities.filter((e) => e.type === "ball" && insideDumpBed(truck, e, truck.vehicleHeading))
          .length
      : 0,
  );
}
