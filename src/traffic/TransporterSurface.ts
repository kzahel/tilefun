import { STEP_UP_THRESHOLD } from "../config/constants.js";
import { type AABB, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntitySurface } from "../physics/surfaceHeight.js";
import { type BedVertex, solidOccludes, solidOverlaps, solidTop } from "./BedSolid.js";
import { TRANSPORTER, transporterLocal, transporterWorld } from "./CarTransporter.js";

export const isTransporterSurface = (e: Pick<EntitySurface, "type">) => e.type === TRANSPORTER.type;
type Shape = readonly [number, number, number, number, number, number, number?];
const cache = new WeakMap<EntitySurface, { key: string; solids: BedVertex[][] }>();
/** The retained v2 platform, low guides and cab guard. Ramp tracks are each
 * 13px wide at Y ±16, leaving the real 19px central gap open for pedestrians. */
export function transporterSolids(e: EntitySurface): BedVertex[][] {
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
export function transporterSurfaceTops(e: EntitySurface, box: AABB) {
  return transporterSolids(e).flatMap((s) => {
    const z = solidTop(s, box);
    return z === undefined ? [] : [z];
  });
}
export function transporterStepZ(e: EntitySurface, box: AABB, actor: Entity) {
  const z = actor.wz ?? 0;
  if (actor.jumpVZ !== undefined) return z;
  return Math.max(
    z,
    ...transporterSurfaceTops(e, box).filter((top) => top <= z + STEP_UP_THRESHOLD),
  );
}
export function transporterBlocks(e: EntitySurface, box: AABB, z: number, height: number) {
  return transporterSolids(e).some((s) => solidOverlaps(s, box, z, height));
}
export function transporterBounds(e: EntitySurface): AABB {
  const vertices = transporterSolids(e).flat();
  return {
    left: Math.min(...vertices.map((p) => p.x)),
    right: Math.max(...vertices.map((p) => p.x)),
    top: Math.min(...vertices.map((p) => p.y)),
    bottom: Math.max(...vertices.map((p) => p.y)),
  };
}
export function transporterOccludes(e: EntitySurface, wx: number, wy: number, wz: number) {
  return transporterSolids(e).some((s) => solidOccludes(s, { x: wx, y: wy, z: wz }));
}
export function transporterRampOccupied(truck: Entity, actors: readonly Entity[]) {
  return actors.some((e) => {
    if (e.id === truck.id || !e.collider || e.parentId !== undefined) return false;
    const box = getEntityAABB(e.position, e.collider);
    const at = transporterLocal(truck, e.position);
    return (
      at.x < TRANSPORTER.rear &&
      at.x > TRANSPORTER.toe - 12 &&
      transporterSolids(truck)
        .slice(5)
        .some((s) => solidOverlaps(s, box, (e.wz ?? 0) - 1, (e.collider?.physicalHeight ?? 12) + 2))
    );
  });
}
