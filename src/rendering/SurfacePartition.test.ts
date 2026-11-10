import { describe, expect, it } from "vitest";
import { aabbsOverlap } from "../entities/collision.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { poseOrientation } from "./MeshPresentation.js";
import {
  type ClippedReceiver,
  clipPlane,
  edges,
  intersect,
  type Partition,
  partition,
  polygonArea,
  polygonBounds,
  recentPartition,
  rectangle,
} from "./SurfacePartition.js";
import {
  type Plane,
  type SurfaceMesh,
  SurfaceReceivers,
  type SurfaceVertex,
} from "./SurfaceReceivers.js";

const EPS = 1e-6;
/** The partition before 235: whole-face box filter, and every cutter edge splits. */
function referencePartition(valid: readonly ClippedReceiver[]): Partition {
  const subtract = (p: readonly SurfaceVertex[], cutter: readonly SurfaceVertex[]) => {
    const out: SurfaceVertex[][] = [];
    let rest = [...p];
    for (const [a, b, c] of edges(cutter)) {
      const outside = clipPlane(rest, -a, -b, -c);
      if (outside.length) out.push(outside);
      rest = clipPlane(rest, a, b, c);
      if (!rest.length) break;
    }
    return out;
  };
  const out: Partition = [];
  for (const [i, r] of valid.entries()) {
    let pieces = [r.polygon];
    for (const [j, other] of valid.entries()) {
      if (i === j || !aabbsOverlap(r.face.bounds, other.face.bounds)) continue;
      const a = other.face.plane[0] - r.face.plane[0],
        b = other.face.plane[1] - r.face.plane[1],
        c = other.face.plane[2] - r.face.plane[2];
      let cutter: SurfaceVertex[];
      if (Math.abs(a) + Math.abs(b) < EPS) {
        if (c < -EPS || (Math.abs(c) < EPS && j > i)) continue;
        cutter = other.polygon;
      } else cutter = clipPlane(other.polygon, a, b, c);
      if (cutter.length) pieces = pieces.flatMap((p) => subtract(p, cutter));
      if (!pieces.length) break;
    }
    for (const vertices of pieces) out.push({ index: i, vertices });
  }
  return out;
}

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SHADOW = rectangle({ left: 0, right: 48, top: 0, bottom: 24 });
function receiver(id: string, polygon: SurfaceVertex[], plane: Plane): ClippedReceiver | undefined {
  const clipped = intersect(SHADOW, polygon);
  if (!clipped.length) return;
  const face = { id, plane, polygon, bounds: polygonBounds(polygon) };
  return { face, polygon: clipped, bounds: polygonBounds(clipped) };
}
/** Terrain tiles under a strip of small mesh triangles (some nearly vertical,
 * some coplanar duplicates) and a flat deck: a car's shadow over a neighbour. */
function scene(seed: number) {
  const next = random(seed),
    valid: ClippedReceiver[] = [];
  const add = (r: ClippedReceiver | undefined) => r && valid.push(r);
  for (let x = 0; x < 48; x += 16)
    for (let y = 0; y < 32; y += 16)
      add(
        receiver(
          `terrain:${x}:${y}:0`,
          rectangle({ left: x, right: x + 16, top: y, bottom: y + 16 }),
          [0, 0, 0],
        ),
      );
  add(receiver("deck", rectangle({ left: 36, right: 60, top: 4, bottom: 14 }), [0, 0, 6]));
  for (let i = 0; i < 40; i++) {
    const x = 18 + next() * 14,
      y = next() * 26 - 2,
      steep = next() < 0.3 ? 400 : 2;
    const triangle = [0, 1, 2].map(() => ({
      x: x + next() * 6 - 3,
      y: y + next() * 6 - 3,
      u: 0,
      v: 0,
    }));
    const a = (next() - 0.5) * steep,
      b = (next() - 0.5) * steep,
      previous = valid.at(-1)?.face;
    // Every seventh triangle shares the previous one's plane (coplanar tie rule).
    const plane: Plane =
      i % 7 === 6 && previous?.id.startsWith("body")
        ? previous.plane
        : [a, b, 2 + next() * 18 - a * x - b * y];
    add(receiver(`body:9:${i}`, triangle, plane));
  }
  return valid;
}
/** Receiver indices whose pieces strictly contain each sample point. */
function coverage(result: Partition) {
  const pieces = result.map((f) => ({ index: f.index, edges: edges(f.vertices) }));
  const out: number[][] = [];
  for (let x = 0.137; x < 48; x += 0.53)
    for (let y = 0.071; y < 24; y += 0.47)
      out.push(
        pieces
          .filter((p) => p.edges.every(([a, b, c]) => a * x + b * y + c > EPS))
          .map((p) => p.index),
      );
  return out;
}
function areas(result: Partition, count: number) {
  const out = Array<number>(count).fill(0);
  for (const f of result) out[f.index] = (out[f.index] ?? 0) + Math.abs(polygonArea(f.vertices));
  return out;
}

describe("receiver partition", () => {
  it("covers each point with the same receiver as the original algorithm, in fewer pieces", () => {
    let fewer = 0;
    for (const seed of [1, 2, 3, 4]) {
      const valid = scene(seed),
        expected = referencePartition(valid),
        actual = partition(valid);
      if (actual.length < expected.length) fewer++;
      expect(actual.length).toBeLessThanOrEqual(expected.length);
      const want = areas(expected, valid.length),
        got = areas(actual, valid.length);
      // The original also dropped sub-EPS slivers when it split a piece it missed.
      for (const [i, area] of want.entries())
        expect(Math.abs((got[i] ?? 0) - area)).toBeLessThan(1e-4);
      const covered = coverage(actual);
      expect(covered.every((c) => c.length <= 1)).toBe(true);
      expect(covered).toEqual(coverage(expected));
      const winners = new Set(covered.flat().map((i) => valid[i]?.face.id.split(":")[0]));
      expect(winners).toEqual(new Set(["terrain", "deck", "body"]));
      // Pieces are sub-polygons of the shadow: its UV map is unchanged.
      for (const f of actual)
        for (const v of f.vertices) {
          expect(v.u).toBeCloseTo(v.x / 48, 9);
          expect(v.v).toBeCloseTo(v.y / 24, 9);
        }
    }
    expect(fewer).toBeGreaterThan(0);
  });

  it("remembers a caster's partition only for bit-equal receivers", () => {
    const valid = scene(7),
      first = recentPartition(101, valid);
    expect(first).toEqual(partition(valid));
    expect(recentPartition(101, scene(7))).toBe(first);
    const moved = scene(7).map((r) =>
      r.face.id === "deck" ? { ...r, face: { ...r.face, plane: [0, 0, 6 + 1e-12] as Plane } } : r,
    );
    const again = recentPartition(101, moved);
    expect(again).not.toBe(first);
    expect(again).toEqual(partition(moved));
  });
});

it("binds remembered fragments to the current frame's faces", () => {
  // Two parked cars side by side: the caster's shadow reaches a dense neighbour mesh.
  const triangles: SurfaceMesh["triangles"][number][] = [];
  for (let x = -20; x < 20; x += 2)
    for (let y = -10; y < 10; y += 2) {
      const z = (px: number, py: number) => 14 + Math.sin(px / 5) + Math.cos(py / 4);
      triangles.push([
        [x, y, z(x, y)],
        [x + 2, y, z(x + 2, y)],
        [x + 2, y + 2, z(x + 2, y + 2)],
      ]);
      triangles.push([
        [x, y, z(x, y)],
        [x + 2, y + 2, z(x + 2, y + 2)],
        [x, y + 2, z(x, y + 2)],
      ]);
    }
  const mesh: SurfaceMesh = { min: [-20, -10, 0], max: [20, 10, 16], triangles };
  const frame = () => {
    const neighbour = createVehicle("compact-1", 40, 0);
    neighbour.id = 2;
    neighbour.bodyRotation = poseOrientation(0);
    return new SurfaceReceivers({ getHeightAt: () => 0 }, [], [neighbour], 1, {
      mesh: () => mesh,
    });
  };
  const shadow = rectangle({ left: 0, right: 30, top: -8, bottom: 8 });
  const a = frame(),
    b = frame();
  const first = a.project(shadow, 20, 1),
    second = b.project(shadow, 20, 1);
  expect(first.some((f) => f.face.owner?.id === 2)).toBe(true);
  expect(second.map((f) => [f.face.id, f.vertices])).toEqual(
    first.map((f) => [f.face.id, f.vertices]),
  );
  // Same pieces, but each frame's own receiver faces (and owners).
  expect(second.every((f, i) => f.vertices === first[i]?.vertices)).toBe(true);
  expect(second.some((f, i) => f.face !== first[i]?.face)).toBe(true);
});
