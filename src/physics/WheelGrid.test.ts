import { expect, it } from "vitest";
import type { SceneBody } from "./SceneBody.js";
import { WheelGrid } from "./WheelGrid.js";

it("offers every body whose bounding sphere a wheel ray can touch", () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const bodies = Array.from({ length: 400 }, (_, i) => ({
    queryCenter: { x: random() * 80 - 40, y: random() * 2, z: random() * 80 - 40 },
    // Mostly small actors, a few long vehicles.
    queryRadius: i % 40 === 0 ? 6 : 0.3 + random(),
  })) as unknown as SceneBody[];
  const grid = new WheelGrid();
  let touched = 0,
    offered = 0;
  for (let i = 0; i < 300; i++) {
    const origin = { x: random() * 80 - 40, y: 1, z: random() * 80 - 40 };
    const tilt = i % 3 ? 0 : random() * 4 - 2;
    const norm = Math.hypot(tilt, 1, tilt / 2);
    const direction = { x: tilt / norm, y: -1 / norm, z: tilt / 2 / norm };
    const length = 0.4 + random() * 3;
    const near = new Set(grid.near(bodies, origin, direction, length));
    offered += near.size;
    for (const body of bodies) {
      const p = body.queryCenter,
        dx = p.x - origin.x,
        dy = p.y - origin.y,
        dz = p.z - origin.z;
      const t = Math.max(
        0,
        Math.min(length, dx * direction.x + dy * direction.y + dz * direction.z),
      );
      const gap = Math.hypot(dx - direction.x * t, dy - direction.y * t, dz - direction.z * t);
      if (gap > body.queryRadius) continue;
      touched++;
      expect(near.has(body)).toBe(true);
    }
  }
  expect(touched).toBeGreaterThan(50);
  // The point of the grid: a ray is offered a small share of the scene.
  expect(offered / 300).toBeLessThan(40);
});

it("rebuilds from the new poses after a reset", () => {
  const body = { queryCenter: { x: 0, y: 0, z: 0 }, queryRadius: 0.5 } as unknown as SceneBody;
  const grid = new WheelGrid();
  const down = { x: 0, y: -1, z: 0 };
  expect([...grid.near([body], { x: 0, y: 1, z: 0 }, down, 1)]).toEqual([body]);
  body.queryCenter = { x: 30, y: 0, z: 0 };
  expect([...grid.near([body], { x: 30, y: 1, z: 0 }, down, 1)]).toEqual([]);
  grid.reset();
  expect([...grid.near([body], { x: 30, y: 1, z: 0 }, down, 1)]).toEqual([body]);
  expect([...grid.near([body], { x: 0, y: 1, z: 0 }, down, 1)]).toEqual([]);
});

it("retires travelled cells and releases borrowed body lists on reset", () => {
  const body = { queryCenter: { x: 0, y: 0, z: 0 }, queryRadius: 0.5 } as unknown as SceneBody;
  const grid = new WheelGrid(),
    direction = { x: 0, y: -1, z: 0 };
  const old = grid.near([body], { x: 0, y: 1, z: 0 }, direction, 1);
  expect([...old]).toEqual([body]);
  grid.reset();
  expect([...old]).toEqual([]);
  for (let i = 0; i < 500; i++) {
    body.queryCenter.x = i * 30;
    grid.reset();
    expect([...grid.near([body], { x: i * 30, y: 1, z: 0 }, direction, 1)]).toEqual([body]);
  }
  // Empty residency after retirement must not retain old bodies anywhere in the grid.
  grid.reset();
  expect([...grid.near([], { x: 499 * 30, y: 1, z: 0 }, direction, 1)]).toEqual([]);
});
