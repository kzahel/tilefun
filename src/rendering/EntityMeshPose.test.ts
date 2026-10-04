import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { EntityMeshPose } from "./EntityMeshPose.js";
import { poseOrientation } from "./MeshPresentation.js";

it("smooths shortest heading, reuses storage and never changes physical state", () => {
  const car = createVehicle("compact-1", 10, 20, Direction.Left),
    poses = new EntityMeshPose();
  car.velocity = { vx: -10, vy: 0.1 };
  const first = poses.evaluate(car, 1);
  if (!first) throw Error("Missing car pose");
  const before = structuredClone(car);
  car.velocity.vy = -0.1;
  const updated = structuredClone(car);
  const second = poses.evaluate(car, 1.01);
  expect(second).toBe(first);
  expect(Math.abs(second?.orientation[2] ?? 0)).toBeGreaterThan(0.99);
  expect(car).toEqual(updated);
  expect(car.collider).toEqual(before.collider);
  car.velocity = { vx: 10, vy: 0 };
  poses.evaluate(car, 1.02);
  expect(Math.abs(first.orientation[2])).toBeGreaterThan(0.99);
  const sameTime = [...first.orientation];
  poses.evaluate(car, 1.02);
  expect(first.orientation).toEqual(sameTime);
  poses.clear();
  expect(poses.evaluate(car, 1.02)).not.toBe(first);
});
it("normalizes full visual pose with explicit yaw/pitch/roll composition", () => {
  expect(poseOrientation(0, 0, 0)).toEqual([0, 0, 0, 1]);
  expect(poseOrientation(Math.PI / 2)[2]).toBeCloseTo(Math.SQRT1_2);
  expect(Math.hypot(...poseOrientation(0.7, 0.3, -0.2))).toBeCloseTo(1);
});
