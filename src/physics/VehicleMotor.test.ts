import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import type { Movement } from "../shared/Movement.js";
import { createVehicle, vehicleNoseHeading } from "../traffic/Vehicle.js";
import { PhysicsScene } from "./PhysicsScene.js";
import { vehicleMotionIntent } from "./PlayerControls.js";
import { vehicleMotor } from "./VehicleMotor.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const geometry = {
  getCollision: () => 0,
  getHeight: () => 0,
  queryProps: () => [],
  geometryVersion: () => ({ identity: 1, revision: 0 }),
};

it("rolls into a perpendicular turn instead of strafing or pivoting at rest", async () => {
  const scene = await PhysicsScene.create(),
    car = createVehicle("compact-1", 100, 100, Direction.Right);
  car.id = 1;
  const step = (input: Movement = idle) => {
    scene.synchronize([car]);
    scene.step(new Map([[1, vehicleMotionIntent(car, input)]]), geometry);
  };
  try {
    for (let i = 0; i < 60; i++) step({ ...idle, dx: 1, relativeDriving: true });
    expect(Math.abs(vehicleNoseHeading(car))).toBeLessThan(0.001);
    step({ ...idle, dy: -1 });
    expect(car.velocity?.vx).toBeGreaterThan(3);
    // Tire forces can start the turn immediately, but cannot redirect travel sideways.
    expect(Math.abs((car.velocity?.vy ?? Infinity) / (car.velocity?.vx ?? 0))).toBeLessThan(0.05);
    for (let i = 0; i < 120; i++) step({ ...idle, dy: -1 });
    expect(Math.abs(vehicleNoseHeading(car) + Math.PI / 2)).toBeLessThan(0.06);
    expect(car.position.wx).toBeGreaterThan(120);
    expect(car.position.wy).toBeLessThan(0);
  } finally {
    scene.dispose();
  }
});

it("brakes through zero before reversing, retains its nose and stops after release", async () => {
  const scene = await PhysicsScene.create(),
    car = createVehicle("compact-1", 100, 100, Direction.Right);
  car.id = 1;
  const step = (dx: number) => {
    scene.synchronize([car]);
    scene.step(new Map([[1, vehicleMotionIntent(car, { ...idle, dx })]]), geometry);
  };
  try {
    for (let i = 0; i < 60; i++) step(1);
    expect(car.velocity?.vx).toBeGreaterThan(110);
    step(-1);
    expect(car.velocity?.vx).toBeGreaterThan(100);
    for (let i = 0; i < 90; i++) step(-1);
    expect(car.velocity?.vx).toBeCloseTo(-56, 0);
    expect(Math.abs(vehicleNoseHeading(car))).toBeLessThan(0.01);
    for (let i = 0; i < 60; i++) step(0);
    const x = car.position.wx;
    for (let i = 0; i < 30; i++) step(0);
    expect(Math.abs(car.position.wx - x)).toBeLessThan(0.02);
  } finally {
    scene.dispose();
  }
});

it("does not apply ground traction or steering while airborne", () => {
  expect(
    vehicleMotor("vehicle-v1:compact-1", 0, 80, 4, false, {
      vx: 0,
      vy: 0,
      driveSpeed: 0,
      steering: 1,
    }),
  ).toEqual({ vx: 80, vy: 4 });
});
