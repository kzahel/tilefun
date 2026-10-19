import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { World } from "../world/World.js";
import { drivenCarPose } from "./Driving.js";
import { createVehicle } from "./Vehicle.js";

it("reverses along the nose at half speed, brakes on release and stops at unavailable ground", () => {
  const world = new World(new FlatStrategy());
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) world.getChunk(x, y);
  let car = createVehicle("compact-1", 0, 0, Direction.Right);
  for (let n = 0; n < 60; n++) {
    const next = drivenCarPose(
      car,
      { dx: 0, dy: 0, reversing: true, sprinting: true },
      1 / 60,
      world,
      [],
      [],
    );
    if (!next) throw Error("Missing reverse pose");
    car = next;
  }
  expect(car.position.wx).toBeLessThan(-40);
  expect(car.velocity?.vx).toBeCloseTo(-56);
  expect(car.sprite?.direction).toBe(Direction.Right);
  for (let n = 0; n < 30; n++) {
    const next = drivenCarPose(car, { dx: 0, dy: 0 }, 1 / 60, world, [], []);
    if (!next) throw Error("Missing braking pose");
    car = next;
  }
  expect(car.velocity?.vx).toBe(0);
  expect(car.sprite?.direction).toBe(Direction.Right);
  const empty = new World(new FlatStrategy());
  expect(
    drivenCarPose(car, { dx: 0, dy: 0, reversing: true }, 1 / 60, empty, [], []),
  ).toBeUndefined();
});

it("keeps the nose steady while accelerating forward out of reverse", () => {
  const world = new World(new FlatStrategy());
  world.getChunk(0, 0);
  let car = createVehicle("compact-1", 64, 64, Direction.Right);
  car.velocity = { vx: -56, vy: 0 };
  for (let n = 0; n < 30; n++) {
    const next = drivenCarPose(car, { dx: 1, dy: 0 }, 1 / 60, world, [], []);
    if (!next) throw Error("Missing forward pose");
    car = next;
    expect(car.sprite?.direction).toBe(Direction.Right);
  }
  expect(car.velocity?.vx).toBeGreaterThan(0);
});
