import { type BedVertex, solidOccludes } from "../traffic/BedSolid.js";
import type { EquipmentPose } from "./EquipmentPose.js";
import { TRANSPORTER, transporterWorld } from "./TransporterPose.js";

export const isTransporterSurface = (e: Pick<EquipmentPose, "type">) => e.type === TRANSPORTER.type;
type Shape = readonly [number, number, number, number, number, number, number?];
const cache = new WeakMap<EquipmentPose, { key: string; solids: BedVertex[][] }>();
/** The retained v2 platform, low guides and cab guard. Ramp tracks are each
 * 13px wide at Y ±16, leaving the real 19px central gap open for pedestrians. */
export function transporterSolids(e: EquipmentPose): BedVertex[][] {
  const key = `${e.position.wx}:${e.position.wy}:${e.wz}:${e.vehicleHeading}:${e.sprite?.direction}:${e.vehicleRamp}`;
  const old = cache.get(e);
  if (old?.key === key) return old.solids;
  const shapes: Shape[] = [
    [-76, 34, -24, 24, 0, 24.65],
    [36, 78, -26, 26, 0, 42],
    [34, 36, -24, 24, 22, 34],
    [-75, 37, -26, -24, 22.5, 25.5],
    [-75, 37, 24, 26, 22.5, 25.5],
  ];
  if (e.vehicleRamp === 1)
    for (const side of [-1, 1])
      shapes.push([-152, -76, side * 16 - 6.5, side * 16 + 6.5, -0.5, 0, 24.65]);
  const solids = shapes.map(([x0, x1, y0, y1, z0, z1, rise = 0]) =>
    [z0, z1].flatMap((z) =>
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ].map(([x = 0, y = 0]) => {
        const p = transporterWorld(e, x, y);
        return { x: p.wx, y: p.wy, z: (e.wz ?? 0) + z + (rise * (x - x0)) / (x1 - x0) };
      }),
    ),
  );
  cache.set(e, { key, solids });
  return solids;
}

export function transporterOccludes(e: EquipmentPose, wx: number, wy: number, wz: number) {
  return transporterSolids(e).some((s) => solidOccludes(s, { x: wx, y: wy, z: wz }));
}
