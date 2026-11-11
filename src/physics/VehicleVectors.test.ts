import type RAPIER from "@dimforge/rapier3d-compat";
import { expect, it } from "vitest";
import { VehicleChassis } from "./VehicleChassis.js";
import { VehicleVectors } from "./VehicleVectors.js";

it("keeps the previous vector arithmetic's exact rounding and chassis-local lifetime", () => {
  const scratch = new VehicleVectors();
  const cross = (a: RAPIER.Vector, b: RAPIER.Vector) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const mul = (a: RAPIER.Vector, n: number) => ({ x: a.x * n, y: a.y * n, z: a.z * n });
  const add = (a: RAPIER.Vector, b: RAPIER.Vector) => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  });
  for (let i = 0; i < 100; i++) {
    const q = {
      x: Math.sin(i) * 0.2,
      y: Math.cos(i) * 0.3,
      z: Math.sin(i * 3) * 0.4,
      w: Math.cos(i * 2),
    };
    const p = { x: i * 0.17, y: -i / 7, z: i * 101.23 };
    const t = mul(cross(q, p), 2),
      expected = add(p, add(mul(t, q.w), cross(q, t)));
    scratch.reset();
    const actual = scratch.rotate(q, p);
    expect(actual).toEqual(expected);
    const saved = { ...actual };
    scratch.add(actual, p);
    scratch.cross(actual, p);
    scratch.mul(actual, -2);
    new VehicleVectors().rotate(q, p);
    expect(actual).toEqual(saved);
  }
});

it("keeps other chassis' prepared impulses intact and clears obsolete support references", () => {
  const body = () =>
    ({
      isSleeping: () => false,
      wakeUp: () => {},
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      translation: () => ({ x: 0, y: 0, z: 0 }),
      linvel: () => ({ x: 1, y: 0, z: 0 }),
      angvel: () => ({ x: 0, y: 0, z: 0 }),
      mass: () => 100,
    }) as unknown as RAPIER.RigidBody;
  const a = new VehicleChassis(body(), "vehicle-v1:compact-1", 48, 24, 24),
    b = new VehicleChassis(body(), "vehicle-v1:compact-1", 48, 24, 24);
  const support = { velocityAtPoint: () => ({ x: 0, y: 0, z: 0 }) } as unknown as RAPIER.RigidBody;
  const query = () => ({ distance: 0.2, normal: { x: 0, y: 1, z: 0 }, body: support });
  const prepared = a.prepare({ vx: 0, vy: 0, driveSpeed: 100, steering: 0.3 }, 0, query);
  expect(prepared).toHaveLength(4);
  const saved = prepared.map((p) => ({ point: { ...p.point }, impulse: { ...p.impulse } }));
  b.prepare({ vx: 0, vy: 0, driveSpeed: -50, steering: -0.8 }, 0, query);
  expect(prepared.map(({ point, impulse }) => ({ point, impulse }))).toEqual(saved);
  expect(a.prepare({ vx: 0, vy: 0 }, 0, () => undefined)).toHaveLength(0);
  const again = a.prepare({ vx: 0, vy: 0 }, 0, () => ({
    distance: 0.2,
    normal: { x: 0, y: 1, z: 0 },
  }));
  expect(again).toHaveLength(4);
  expect(again.every((p) => p.support === undefined)).toBe(true);
});
