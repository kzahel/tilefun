import { type AABB, aabbsOverlap } from "../entities/collision.js";
import type { SurfaceFace, SurfaceVertex } from "./SurfaceReceivers.js";

// Convex polygon clipping for projected decals, and the receiver partition:
// each receiver face keeps only the part of a shadow that no higher face covers.

const EPS = 1e-6;
export function polygonBounds(p: readonly { x: number; y: number }[]): AABB {
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const { x, y } of p) {
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  return { left, right, top, bottom };
}
export function rectangle(b: AABB): SurfaceVertex[] {
  return [
    { x: b.left, y: b.top, u: 0, v: 0 },
    { x: b.right, y: b.top, u: 1, v: 0 },
    { x: b.right, y: b.bottom, u: 1, v: 1 },
    { x: b.left, y: b.bottom, u: 0, v: 1 },
  ];
}
export function polygonArea(p: readonly SurfaceVertex[]) {
  const origin = p[0];
  if (!origin) return 0;
  let area = 0;
  for (let i = 1; i + 1 < p.length; i++) {
    const a = p[i],
      b = p[i + 1];
    if (a && b) area += (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  }
  return area / 2;
}
/** Clip a convex polygon, preserving decal UVs through every cut. */
export function clipPlane(
  p: readonly SurfaceVertex[],
  a: number,
  b: number,
  c: number,
): SurfaceVertex[] {
  const out: SurfaceVertex[] = [];
  for (let i = 0; i < p.length; i++) {
    const s = p[i],
      e = p[(i + 1) % p.length];
    if (!s || !e) continue;
    const ds = a * s.x + b * s.y + c,
      de = a * e.x + b * e.y + c;
    if (ds >= -EPS) out.push(s);
    if ((ds > EPS && de < -EPS) || (ds < -EPS && de > EPS)) {
      const t = ds / (ds - de);
      out.push({
        x: s.x + (e.x - s.x) * t,
        y: s.y + (e.y - s.y) * t,
        u: s.u + (e.u - s.u) * t,
        v: s.v + (e.v - s.v) * t,
      });
    }
  }
  return out.length >= 3 && Math.abs(polygonArea(out)) > EPS ? out : [];
}
export function edges(p: readonly SurfaceVertex[]) {
  const sign = polygonArea(p) >= 0 ? 1 : -1;
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length] ?? a;
    const x = (a.y - b.y) * sign,
      y = (b.x - a.x) * sign;
    return [x, y, -x * a.x - y * a.y] as const;
  });
}
export function intersect(p: readonly SurfaceVertex[], cutter: readonly SurfaceVertex[]) {
  let result = [...p];
  for (const [a, b, c] of edges(cutter)) {
    result = clipPlane(result, a, b, c);
    if (!result.length) break;
  }
  return result;
}
type Edges = ReturnType<typeof edges>;
/** True when the cutter's box or one of its edges separates `p` from it. */
function separated(p: readonly SurfaceVertex[], box: AABB, cutterEdges: Edges) {
  const b = polygonBounds(p);
  if (b.left >= box.right || b.right <= box.left || b.top >= box.bottom || b.bottom <= box.top)
    return true;
  outer: for (const [a, bb, c] of cutterEdges) {
    for (const v of p) if (a * v.x + bb * v.y + c > EPS) continue outer;
    return true;
  }
  return false;
}
/** Disjoint convex pieces outside a convex cutter: no double-darkened seams.
 * A cutter that misses `p` leaves it whole: splitting it along the edge lines
 * of every nearby mesh triangle multiplied pieces without changing their union. */
export function subtract(
  p: SurfaceVertex[],
  cutter: readonly SurfaceVertex[],
  box = polygonBounds(cutter),
  cutterEdges = edges(cutter),
): SurfaceVertex[][] {
  if (separated(p, box, cutterEdges)) return [p];
  const out: SurfaceVertex[][] = [];
  let rest = [...p];
  for (const [a, b, c] of cutterEdges) {
    const outside = clipPlane(rest, -a, -b, -c);
    if (outside.length) out.push(outside);
    rest = clipPlane(rest, a, b, c);
    if (!rest.length) return [p];
  }
  return out;
}
export interface ClippedReceiver {
  face: SurfaceFace;
  polygon: SurfaceVertex[];
  bounds: AABB;
}
export type Partition = { index: number; vertices: SurfaceVertex[] }[];
/** Each receiver keeps only what no higher receiver covers. */
export function partition(valid: readonly ClippedReceiver[]): Partition {
  const out: Partition = [];
  for (const [i, r] of valid.entries()) {
    let pieces = [r.polygon];
    for (const [j, other] of valid.entries()) {
      // Clipped pieces whose boxes do not overlap cannot cover each other.
      if (i === j || !aabbsOverlap(r.bounds, other.bounds)) continue;
      const a = other.face.plane[0] - r.face.plane[0],
        b = other.face.plane[1] - r.face.plane[1],
        c = other.face.plane[2] - r.face.plane[2];
      let cutter: SurfaceVertex[];
      if (Math.abs(a) + Math.abs(b) < EPS) {
        if (c < -EPS || (Math.abs(c) < EPS && j > i)) continue;
        cutter = other.polygon;
      } else cutter = clipPlane(other.polygon, a, b, c);
      if (!cutter.length) continue;
      const box = polygonBounds(cutter),
        cutterEdges = edges(cutter);
      pieces = pieces.flatMap((p) => subtract(p, cutter, box, cutterEdges));
      if (!pieces.length) break;
    }
    for (const vertices of pieces) out.push({ index: i, vertices });
  }
  return out;
}
/** Partitions of recent casters. Parked cars beside meshed bodies repeat the
 * same clipped receivers every frame (about 2 ms each against ~170 triangles).
 * Exact: a hit needs bit-equal planes and clipped polygons, which are all the
 * partition reads; fragments rebind to the current frame's faces. */
const recent = new Map<number, { key: Float64Array; partition: Partition }[]>();
const RECENT_PER_CASTER = 4,
  RECENT_RECEIVERS = 8,
  RECENT_BUDGET = 1 << 20;
let recentSize = 0;
function partitionKey(valid: readonly ClippedReceiver[]) {
  let n = 0;
  for (const v of valid) n += 4 + v.polygon.length * 4;
  const key = new Float64Array(n);
  let i = 0;
  for (const { face, polygon } of valid) {
    key[i++] = face.plane[0];
    key[i++] = face.plane[1];
    key[i++] = face.plane[2];
    key[i++] = polygon.length;
    for (const v of polygon) {
      key[i++] = v.x;
      key[i++] = v.y;
      key[i++] = v.u;
      key[i++] = v.v;
    }
  }
  return key;
}
function sameKey(a: Float64Array, b: Float64Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
/** Terrain tiles never overlap one another; only other receivers (props, bodies)
 * make a caster's partition worth remembering. */
export function partitionReceivers(
  valid: readonly ClippedReceiver[],
  caster: number | undefined,
): Partition {
  let receivers = 0;
  for (const { face } of valid) if (!face.id.startsWith("terrain:")) receivers++;
  return receivers >= RECENT_RECEIVERS && caster !== undefined
    ? recentPartition(caster, valid)
    : partition(valid);
}
export function recentPartition(caster: number, valid: readonly ClippedReceiver[]): Partition {
  const key = partitionKey(valid),
    entries = recent.get(caster) ?? [];
  const hit = entries.find((e) => sameKey(e.key, key));
  if (hit) return hit.partition;
  const result = partition(valid);
  entries.push({ key, partition: result });
  recentSize += key.length;
  if (entries.length > RECENT_PER_CASTER) recentSize -= entries.shift()?.key.length ?? 0;
  recent.delete(caster);
  recent.set(caster, entries);
  for (const [id, old] of recent) {
    if (recentSize <= RECENT_BUDGET || id === caster) break;
    for (const e of old) recentSize -= e.key.length;
    recent.delete(id);
  }
  return result;
}
export function contains(p: readonly SurfaceVertex[], x: number, y: number) {
  return edges(p).every(([a, b, c]) => a * x + b * y + c >= -EPS);
}
