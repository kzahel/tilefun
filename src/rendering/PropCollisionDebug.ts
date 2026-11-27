import { buildingElevation, sectionCorners } from "../buildings/BuildingSection.js";
import { type AABB, getEntityAABB } from "../entities/collision.js";
import type { Prop, PropCollider } from "../entities/Prop.js";
import { surfaceZAt } from "../physics/SurfacePatch.js";
import type { CollisionDebugShape, CollisionPoint } from "./CollisionDebug.js";

const corners = (b: AABB) =>
  [
    [b.left, b.top],
    [b.right, b.top],
    [b.right, b.bottom],
    [b.left, b.bottom],
  ] as const;
export function prism(b: AABB, low: number, high: number): CollisionPoint[] {
  return [low, high].flatMap((z) => corners(b).map(([x, y]) => ({ x, y, z })));
}

function colliderVertices(
  c: PropCollider,
  position: Prop["position"],
  bounds: AABB,
  getHeight?: (tx: number, ty: number) => number,
) {
  if (c.buildingSection) {
    const base = buildingElevation(position, getHeight);
    return sectionCorners(c.buildingSection).map(([x, y, z]) => ({
      x: position.wx + x,
      y: position.wy + y,
      z: base + z,
    }));
  }
  const surface = c.surface;
  if (!surface) return prism(bounds, c.zBase ?? 0, (c.zBase ?? 0) + (c.zHeight ?? 48));
  return [false, true].flatMap((top) =>
    corners(bounds).map(([x, y]) => ({
      x,
      y,
      z: surfaceZAt(surface, bounds, x, y) - (top ? 0 : surface.thickness),
    })),
  );
}
export function propCollisionDebugShapes(
  p: Prop,
  getHeight?: (tx: number, ty: number) => number,
): CollisionDebugShape[] {
  const shapes: CollisionDebugShape[] = [];
  for (const [i, c] of (p.walls ?? (p.collider ? [p.collider] : [])).entries()) {
    const bounds = getEntityAABB(p.position, c),
      name = c.surface?.id ?? (p.walls ? `wall ${i + 1}` : "body");
    const vertices = colliderVertices(c, p.position, bounds, getHeight);
    if (!c.passable)
      shapes.push({
        layer: "walking",
        name: `${name}${!c.surface && c.zHeight === undefined ? " (height unlimited)" : ""}`,
        vertices,
        ...(!c.surface && c.zHeight === undefined ? { unlimitedHeight: true } : {}),
      });
    if (c.surface || (c.walkableTop && c.zHeight !== undefined))
      shapes.push({ layer: "support", name: `${name} top`, vertices: vertices.slice(4) });
  }
  const colliders = [...(p.walls ?? []), ...(p.collider ? [p.collider] : [])];
  if (colliders.length) {
    const boxes = colliders.map((c) => getEntityAABB(p.position, c));
    shapes.push({
      layer: "bounds",
      name: "search bounds",
      vertices: prism(
        {
          left: Math.min(...boxes.map((b) => b.left)),
          right: Math.max(...boxes.map((b) => b.right)),
          top: Math.min(...boxes.map((b) => b.top)),
          bottom: Math.max(...boxes.map((b) => b.bottom)),
        },
        0,
        0,
      ),
    });
  }
  return shapes;
}
