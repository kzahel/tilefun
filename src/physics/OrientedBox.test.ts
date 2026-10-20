import { expect, it } from "vitest";
import { boxesOverlap } from "../diagnostics/VehicleCollisionBench.js";
import { boxBounds, boxDepth, boxMotion, type OrientedBox } from "./OrientedBox.js";

const box = (changes: Partial<OrientedBox> = {}): OrientedBox => ({
  x: 0,
  y: 0,
  angle: 0,
  halfLength: 28,
  halfWidth: 10,
  low: 0,
  high: 24,
  ...changes,
});
it("agrees with the independently qualified diagnostic geometry across seeded poses", () => {
  let state = 2026;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const pose = () =>
    box({
      x: random() * 100,
      y: random() * 100,
      angle: random() * Math.PI * 2,
      low: random() * 10,
      high: 10 + random() * 30,
    });
  for (let i = 0; i < 4096; i++) {
    const a = pose(),
      b = pose();
    const diagnostic = (p: OrientedBox) => ({
      ...p,
      yaw: p.angle,
      z: p.low,
      height: p.high - p.low,
    });
    expect(boxDepth(a, b) > 1e-7).toBe(boxesOverlap(diagnostic(a), diagnostic(b)));
  }
});
it("sweeps through a thin obstacle between clear endpoints and respects touching/height", () => {
  const a = box({ x: -80 }),
    b = box({ x: 80 });
  const obstacle = box({ halfLength: 0.0001, halfWidth: 1 });
  expect(boxDepth(a, obstacle)).toBeLessThan(0);
  expect(boxDepth(b, obstacle)).toBeLessThan(0);
  expect(boxMotion(a, b).contact(obstacle)).toBe(true);
  expect(boxMotion(a, b).contact({ ...obstacle, low: 24, high: 40 })).toBe(false);
  expect(boxMotion(a, b).contact({ ...obstacle, y: 11 })).toBe(false);
});
it("catches rotation-only contact between clear endpoints, including a thin corner obstacle", () => {
  const a = box(),
    b = box({ angle: Math.PI / 2 });
  const obstacle = box({ x: 18, y: 18, halfLength: 0.00001, halfWidth: 0.00001 });
  expect(boxDepth(a, obstacle)).toBeLessThan(0);
  expect(boxDepth(b, obstacle)).toBeLessThan(0);
  expect(boxMotion(a, b).contact(obstacle)).toBe(true);
  expect(boxMotion(a, b).contact({ ...obstacle, x: 50 })).toBe(false);
});
it("encloses a rolling arc and its corners across angle wrap in either direction", () => {
  for (const sign of [-1, 1]) {
    const startAngle = sign * 3,
      delta = sign * 0.8,
      radius = 40;
    const pose = (t: number) =>
      box({
        x: radius * Math.sin(startAngle + delta * t),
        y: -radius * Math.cos(startAngle + delta * t),
        angle: Math.atan2(Math.sin(startAngle + delta * t), Math.cos(startAngle + delta * t)),
      });
    const start = pose(0),
      end = pose(1),
      motion = boxMotion(start, end, true);
    for (let i = 0; i <= 100; i++) {
      const current = pose(i / 100),
        bounds = boxBounds(current);
      expect(bounds.left).toBeGreaterThanOrEqual(motion.bounds.left - 1e-8);
      expect(bounds.right).toBeLessThanOrEqual(motion.bounds.right + 1e-8);
      expect(bounds.top).toBeGreaterThanOrEqual(motion.bounds.top - 1e-8);
      expect(bounds.bottom).toBeLessThanOrEqual(motion.bounds.bottom + 1e-8);
    }
    const middle = pose(0.5);
    expect(motion.contact(box({ ...middle, halfLength: 0.001, halfWidth: 0.001 }))).toBe(true);
  }
});
it("allows overlap escape but blocks deeper motion, stationary contact and a new obstacle", () => {
  const a = box(),
    obstacle = box({ x: 50 });
  expect(boxMotion(a, box({ x: -1 })).contact(obstacle, true)).toBe(false);
  expect(boxMotion(a, box({ x: 1 })).contact(obstacle, true)).toBe(true);
  expect(boxMotion(a, a).contact(obstacle, true)).toBe(true);
  expect(boxMotion(a, box({ x: -1 })).contact(box({ x: -56.5 }), true)).toBe(true);
});
