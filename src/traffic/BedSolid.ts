import type { AABB } from "../entities/collision.js";

export interface BedVertex {
  x: number;
  y: number;
  z: number;
}
export const BED_FACES = [
  [0, 3, 2, 1],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
];
function sub(a: BedVertex, b: BedVertex): BedVertex {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function cross(a: BedVertex, b: BedVertex): BedVertex {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function dot(a: BedVertex, b: BedVertex) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function vertex(vertices: readonly BedVertex[], index: number): BedVertex {
  const value = vertices[index];
  if (!value) throw Error("Invalid bed convex geometry");
  return value;
}
function normal(vertices: readonly BedVertex[], face: number[]) {
  const a = vertex(vertices, face[0] ?? 0),
    b = vertex(vertices, face[1] ?? 0),
    c = vertex(vertices, face[2] ?? 0);
  return cross(sub(b, a), sub(c, a));
}
/** Exact convex-frustum/AABB SAT, including the edge cross-product axes. Touching is free. */
export function solidOverlaps(
  vertices: readonly BedVertex[],
  box: AABB,
  z: number,
  height: number,
) {
  const axes: BedVertex[] = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];
  const basis = [...axes];
  for (const face of BED_FACES) {
    axes.push(normal(vertices, face));
    for (let i = 0; i < 4; i++) {
      const edge = sub(vertex(vertices, face[(i + 1) % 4] ?? 0), vertex(vertices, face[i] ?? 0));
      for (const axis of basis) axes.push(cross(edge, axis));
    }
  }
  const center = {
    x: (box.left + box.right) / 2,
    y: (box.top + box.bottom) / 2,
    z: z + height / 2,
  };
  for (const axis of axes) {
    const length = Math.hypot(axis.x, axis.y, axis.z);
    if (length < 1e-8) continue;
    let lo = Infinity,
      hi = -Infinity;
    for (const v of vertices) {
      const p = dot(v, axis);
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
    }
    const mid = dot(center, axis),
      r =
        ((box.right - box.left) / 2) * Math.abs(axis.x) +
        ((box.bottom - box.top) / 2) * Math.abs(axis.y) +
        (height / 2) * Math.abs(axis.z);
    if (mid + r <= lo + 0.001 * length || mid - r >= hi - 0.001 * length) return false;
  }
  return true;
}
/** Highest point on the upward-facing authored top intersecting a foot rectangle. */
export function solidTop(vertices: readonly BedVertex[], box: AABB): number | undefined {
  let polygon = vertices.slice(4);
  for (const [axis, limit, sign] of [
    ["x", box.left, 1],
    ["x", box.right, -1],
    ["y", box.top, 1],
    ["y", box.bottom, -1],
  ] as const) {
    const next: BedVertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = vertex(polygon, i),
        b = vertex(polygon, (i + 1) % polygon.length);
      const da = (a[axis] - limit) * sign,
        db = (b[axis] - limit) * sign;
      if (da >= 0) next.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        next.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
      }
    }
    polygon = next;
  }
  return polygon.length >= 3 ? Math.max(...polygon.map((v) => v.z)) : undefined;
}
export function solidOccludes(vertices: readonly BedVertex[], point: BedVertex) {
  let enter = 0.0001,
    leave = Infinity;
  const center = vertices.reduce(
    (c, v) => ({ x: c.x + v.x / 8, y: c.y + v.y / 8, z: c.z + v.z / 8 }),
    { x: 0, y: 0, z: 0 },
  );
  for (const face of BED_FACES) {
    const n = normal(vertices, face),
      a = vertex(vertices, face[0] ?? 0);
    const sign = dot(n, sub(center, a)) > 0 ? -1 : 1;
    const value = dot(n, sub(point, a)) * sign,
      rate = (n.y + n.z) * sign;
    if (Math.abs(rate) < 1e-9) {
      if (value > 0) return false;
    } else if (rate > 0) leave = Math.min(leave, -value / rate);
    else enter = Math.max(enter, -value / rate);
  }
  return leave > enter;
}
