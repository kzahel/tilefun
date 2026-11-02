import type { AABB } from "../../entities/collision.js";
import { type SurfacePatch, surfaceZAt } from "../SurfacePatch.js";

interface Point {
  x: number;
  y: number;
  z: number;
}
/** Exact convex intersection of a terrain column with authored excavation
 * half-spaces. Cell boundaries have already been split at patch footprint edges.
 * Clipping planes retain ramp slopes; sampling a cell's maximum creates stairs.
 */
export function clippedTerrainVertices(
  bounds: AABB,
  bottom: number,
  top: number,
  cuts: readonly { patch: SurfacePatch; bounds: AABB }[],
): Point[] {
  if (cuts.length > 8) throw Error("Experimental excavation plane budget exceeded");
  if (top <= bottom) return [];
  const v = [bottom, top].flatMap((y) => [
    { x: bounds.left, y, z: bounds.top },
    { x: bounds.right, y, z: bounds.top },
    { x: bounds.right, y, z: bounds.bottom },
    { x: bounds.left, y, z: bounds.bottom },
  ]);
  let faces = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ].map((indices) => indices.map((i) => v[i]).filter((p): p is Point => !!p));
  for (const cut of cuts) {
    const next: Point[][] = [],
      cap: Point[] = [];
    const distance = (p: Point) => p.y - surfaceZAt(cut.patch, cut.bounds, p.x, p.z);
    for (const face of faces) {
      const polygon: Point[] = [];
      for (let i = 0; i < face.length; i++) {
        const a = face[i],
          b = face[(i + 1) % face.length];
        if (!a || !b) continue;
        const da = distance(a),
          db = distance(b);
        if (da <= 0) polygon.push(a);
        if (da <= 0 !== db <= 0) {
          const t = da / (da - db);
          const p = {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            z: a.z + (b.z - a.z) * t,
          };
          polygon.push(p);
          cap.push(p);
        }
      }
      if (polygon.length >= 3) next.push(polygon);
    }
    const unique = [
      ...new Map(
        cap.map((p) => [`${p.x.toFixed(7)}:${p.y.toFixed(7)}:${p.z.toFixed(7)}`, p]),
      ).values(),
    ];
    if (unique.length >= 3) {
      const cx = unique.reduce((sum, p) => sum + p.x, 0) / unique.length,
        cz = unique.reduce((sum, p) => sum + p.z, 0) / unique.length;
      unique.sort((a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx));
      next.push(unique);
    }
    faces = next;
  }
  return faces.flat();
}
