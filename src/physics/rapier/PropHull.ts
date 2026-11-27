import RAPIER from "@dimforge/rapier3d-compat";
import {
  type BuildingSection,
  buildingElevation,
  clippedSection,
  localFootprint,
  rectangularSection,
} from "../../buildings/BuildingSection.js";
import type { AABB } from "../../entities/collision.js";
import type { Prop, PropCollider } from "../../entities/Prop.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "../PhysicsDefaults.js";
import { surfaceZAt } from "../SurfacePatch.js";
import type { CollisionGeometrySource } from "./CollisionGeometry.js";

/** Same local solids as the textured mesh. Clip them to the resident physics
 * chunk, in local coordinates before conversion to Rapier's floating origin. */
function buildingCollision(
  section: BuildingSection,
  wx: number,
  wy: number,
  elevation: number,
  bounds: AABB,
  origin: RAPIER.Vector,
): RAPIER.ColliderDesc | undefined {
  if (rectangularSection(section)) {
    const { left, right, top, bottom } = bounds;
    return RAPIER.ColliderDesc.cuboid(
      (right - left) / 2 / SCALE,
      (section.top - section.base) / 2 / SCALE,
      (bottom - top) / 2 / SCALE,
    ).setTranslation(
      (left + right) / 2 / SCALE - origin.x,
      (elevation + (section.top + section.base) / 2) / SCALE - origin.y,
      (top + bottom) / 2 / SCALE - origin.z,
    );
  }
  const points = clippedSection(section, localFootprint(bounds, { wx, wy }));
  if (!points.length) return;
  const hull = RAPIER.ColliderDesc.convexHull(
    Float32Array.from(points.flatMap(([x, y, z]) => [x / SCALE, z / SCALE, y / SCALE])),
  );
  return hull?.setTranslation(
    wx / SCALE - origin.x,
    elevation / SCALE - origin.y,
    wy / SCALE - origin.z,
  );
}

export function propHull(
  c: PropCollider,
  position: Prop["position"],
  authored: AABB,
  b: AABB,
  source: CollisionGeometrySource,
  origin: RAPIER.Vector,
) {
  if (c.buildingSection)
    return buildingCollision(
      c.buildingSection,
      position.wx,
      position.wy,
      buildingElevation(position, (x, y) => source.getHeight(x, y)),
      b,
      origin,
    );
  if (!c.surface) return;
  const vertices: number[] = [];
  for (const down of [0, c.surface.thickness])
    for (const [x, z] of [
      [b.left, b.top],
      [b.right, b.top],
      [b.right, b.bottom],
      [b.left, b.bottom],
    ])
      vertices.push(
        (x ?? 0) / SCALE - origin.x,
        (surfaceZAt(c.surface, authored, x ?? 0, z ?? 0) - down) / SCALE - origin.y,
        (z ?? 0) / SCALE - origin.z,
      );
  const descriptor = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
  if (!descriptor) throw Error("Invalid authored surface hull");
  return descriptor;
}
