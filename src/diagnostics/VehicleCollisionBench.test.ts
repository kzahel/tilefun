import { describe, expect, it } from "vitest";
import { aabbsOverlap } from "../entities/collision.js";
import {
  type BoxPose,
  boxBounds,
  boxesOverlap,
  COLLISION_LANES,
  COLLISION_MODES,
  COLLISION_SCENES,
  collisionPose,
  createCollisionFixture,
  localPoint,
  measureCollisionCase,
  sweepSteps,
} from "./VehicleCollisionBench.js";

const box = (changes: Partial<BoxPose> = {}): BoxPose => ({
  x: 0,
  y: 0,
  yaw: 0,
  halfLength: 28,
  halfWidth: 10,
  z: 0,
  height: 24,
  ...changes,
});
type Point = { x: number; y: number };
function corners(p: BoxPose): Point[] {
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x = 0, y = 0]) => localPoint(p, p.halfLength * x, p.halfWidth * y));
}

/** Independent convex polygon clipping/area oracle; does not use SAT or boxBounds. */
function polygonOverlap(a: BoxPose, b: BoxPose): boolean {
  if (Math.min(a.z + a.height, b.z + b.height) <= Math.max(a.z, b.z)) return false;
  let polygon = corners(a);
  const clip = corners(b);
  for (let i = 0; i < clip.length; i++) {
    const start = clip[i],
      end = clip[(i + 1) % clip.length];
    if (!start || !end) throw Error("Missing clipping edge");
    const side = (p: Point) =>
      (end.x - start.x) * (p.y - start.y) - (end.y - start.y) * (p.x - start.x);
    const output: Point[] = [];
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j],
        q = polygon[(j + 1) % polygon.length];
      if (!p || !q) throw Error("Missing polygon edge");
      const ps = side(p),
        qs = side(q);
      if (ps >= 0) output.push(p);
      if (ps >= 0 !== qs >= 0) {
        const t = ps / (ps - qs);
        output.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
      }
    }
    polygon = output;
  }
  let twiceArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i],
      q = polygon[(i + 1) % polygon.length];
    if (p && q) twiceArea += p.x * q.y - p.y * q.x;
  }
  return Math.abs(twiceArea) > 1e-7;
}

describe("diagnostic oriented vehicle geometry", () => {
  it("matches an independent polygon oracle over 4,096 seeded pairs and is symmetric", () => {
    let state = 2026;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    for (let i = 0; i < 4096; i++) {
      const pose = () =>
        box({
          x: random() * 160 - 80,
          y: random() * 160 - 80,
          yaw: random() * Math.PI * 2,
          halfLength: 2 + random() * 35,
          halfWidth: 2 + random() * 20,
          z: random() * 32,
          height: 2 + random() * 30,
        });
      const a = pose(),
        b = pose();
      expect(boxesOverlap(a, b)).toBe(polygonOverlap(a, b));
      expect(boxesOverlap(a, b)).toBe(boxesOverlap(b, a));
      for (const p of corners(a)) {
        const bounds = boxBounds(a);
        expect(p.x).toBeGreaterThanOrEqual(bounds.left - 1e-9);
        expect(p.x).toBeLessThanOrEqual(bounds.right + 1e-9);
        expect(p.y).toBeGreaterThanOrEqual(bounds.top - 1e-9);
        expect(p.y).toBeLessThanOrEqual(bounds.bottom + 1e-9);
      }
    }
  });
  it("agrees with native AABB overlap at cardinal orientations, including touching edges", () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      for (let x = -64; x <= 64; x += 4)
        for (let y = -64; y <= 64; y += 4) {
          const a = box({ yaw }),
            b = box({ x, y, halfLength: 4, halfWidth: 4 });
          expect(boxesOverlap(a, b)).toBe(
            aabbsOverlap(boxBounds(collisionPose(a, "cardinal-aabb")), boxBounds(b)),
          );
        }
    }
    expect(boxesOverlap(box(), box({ z: 24 }))).toBe(false);
    expect(boxesOverlap(box(), box({ z: 23.9 }))).toBe(true);
  });
  it("rejects the empty corners of a diagonal broad-phase box", () => {
    const a = box({ yaw: Math.PI / 4 }),
      b = box({ x: 24, y: -24, halfLength: 1, halfWidth: 1 });
    expect(aabbsOverlap(boxBounds(a), boxBounds(b))).toBe(true);
    expect(boxesOverlap(a, b)).toBe(false);
  });
  it("detects a rotation-only corner contact between clear endpoints", () => {
    const a = box(),
      b = box({ yaw: Math.PI / 2 }),
      obstacle = box({ x: 18, y: 18, halfLength: 1, halfWidth: 1 });
    expect(boxesOverlap(a, obstacle)).toBe(false);
    expect(boxesOverlap(b, obstacle)).toBe(false);
    const steps = sweepSteps(a, b);
    expect(
      Array.from({ length: steps + 1 }, (_, i) =>
        boxesOverlap(box({ yaw: (b.yaw * i) / steps }), obstacle),
      ).some(Boolean),
    ).toBe(true);
    expect(sweepSteps(a, box({ x: 20 }))).toBe(5);
    expect(() => sweepSteps(a, box({ yaw: Math.PI * 10 }))).toThrow(/budget/);
  });
  it("rotates a roof-local passenger into a tall obstacle and rejects ground-only contact", () => {
    const car = box({ yaw: Math.PI / 2 }),
      point = localPoint(car, 18, 0);
    const rider = box({ ...point, yaw: 0, halfLength: 5, halfWidth: 3, z: 24, height: 16 });
    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(18);
    expect(boxesOverlap(rider, box({ x: 0, y: 18, halfLength: 2, halfWidth: 2, height: 20 }))).toBe(
      false,
    );
    expect(boxesOverlap(rider, box({ x: 0, y: 18, halfLength: 2, halfWidth: 2, height: 48 }))).toBe(
      true,
    );
  });
});

describe("collision benchmark demand and indexing", () => {
  const cases = COLLISION_SCENES.flatMap((scene) =>
    COLLISION_MODES.flatMap((mode) =>
      COLLISION_LANES.flatMap((lane) =>
        [1, 8, 32, 128].map((vehicles) => ({ scene, mode, lane, vehicles })),
      ),
    ),
  );
  it.each(cases)(
    "$scene/$mode/$lane/$vehicles agrees with brute-force queries and repeats",
    ({ scene, mode, lane, vehicles }) => {
      const fixture = createCollisionFixture(scene, vehicles, mode, lane);
      const indexed = fixture.run(),
        reference = fixture.run(true);
      expect(indexed.hits).toBe(reference.hits);
      expect(indexed.narrowTests).toBe(reference.narrowTests);
      expect(indexed).toEqual(fixture.run());
      expect(indexed.poses).toBe(64 * 3 * (lane === "authority-all" ? vehicles : 6));
      expect(indexed.riderTests).toBe(scene === "roof-riders" ? indexed.poses * 2 : 0);
      expect(indexed.queries).toBe(indexed.poses + indexed.riderTests);
      expect(indexed.candidates).toBeGreaterThan(0);
    },
  );
  it("refuses invalid fixture populations", () => {
    for (const vehicles of [0, -1, 1.5, 129, NaN]) {
      expect(() =>
        createCollisionFixture("cruise", vehicles, "yaw-obb", "authority-all"),
      ).toThrow();
    }
  });
  it("retains identical traces across alternating timing batches without imposing hardware timing gates", async () => {
    const report = await measureCollisionCase("tight-turn", 1, "controlled-replay-6", 4);
    expect(report.policies.map((p) => p.mode)).toEqual(COLLISION_MODES);
    for (const policy of report.policies) {
      expect(policy.batchesMs).toHaveLength(4);
      expect(policy.batchAmortizedMsPerStep.median).toBeGreaterThan(0);
      expect(policy.countsPerTrace?.queries).toBe(1152);
    }
  });
});
