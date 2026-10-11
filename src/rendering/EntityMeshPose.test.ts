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

it("keeps cosmetic travel across borrowed render clones, with independent cars and lifecycle eviction", () => {
  const car = createVehicle("compact-1", 10, 20);
  car.id = 1;
  car.velocity = { vx: 20, vy: 0 };
  const other = createVehicle("compact-1", 100, 20);
  other.id = 2;
  const poses = new EntityMeshPose();
  const original = structuredClone(car);
  const first = poses.evaluate(car, 1);
  const clone = structuredClone(car);
  clone.position.wx += 4;
  const before = structuredClone(clone);
  expect(poses.evaluate(clone, 1.1)).toBe(first);
  expect(first?.wheelTravel).toBeCloseTo(4);
  expect(car).toEqual(original);
  expect(clone).toEqual(before);
  expect(poses.evaluate(other, 1.1)?.wheelTravel).toBe(0);
  poses.retain([other]);
  expect(poses.evaluate(clone, 1.2)?.wheelTravel).toBe(0);
});

it("rolls from displayed signed distance, holds at rest and fences teleports and visibility gaps", () => {
  const car = createVehicle("compact-1", 0, 0);
  car.velocity = { vx: 10, vy: 0 };
  const poses = new EntityMeshPose();
  const pose = poses.evaluate(car, 1);
  poses.evaluate(car, 1.1, { wx: 4, wy: 0 });
  expect(pose?.wheelTravel).toBe(4);
  poses.evaluate(car, 1.2, { wx: 3, wy: 0 });
  expect(pose?.wheelTravel).toBe(3);
  poses.evaluate(car, 1.3, { wx: 3, wy: 0 });
  expect(pose?.wheelTravel).toBe(3);
  poses.evaluate(car, 1.4, { wx: 1000, wy: 0 });
  poses.evaluate(car, 2, { wx: 1010, wy: 0 });
  expect(pose?.wheelTravel).toBe(3);
  poses.evaluate(car, 2.1, { wx: 1012, wy: 0 });
  expect(pose?.wheelTravel).toBe(5);
});
