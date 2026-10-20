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

function clearGround() {
  const world = new World(new FlatStrategy());
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) world.getChunk(x, y);
  return world;
}

it("rolls forward into a curved turn rather than pivoting or sliding sideways", () => {
  const world = clearGround();
  let car = createVehicle("compact-1", 0, 0, Direction.Right);
  const first = drivenCarPose(car, { dx: 0, dy: 1 }, 1 / 60, world, [], []);
  if (!first) throw Error("Missing first turn");
  expect(first.position.wx).toBeGreaterThan(0.06);
  expect(first.position.wy).toBeLessThan(0.001);
  expect(first.vehicleHeading).toBeGreaterThan(0);
  expect(first.vehicleHeading).toBeLessThan(0.002);
  expect(first.sprite?.direction).toBe(Direction.Right);
  car = first;
  for (let n = 0; n < 90; n++) {
    const next = drivenCarPose(car, { dx: 0, dy: 1 }, 1 / 60, world, [], []);
    if (!next) throw Error("Missing turn pose");
    // Velocity stays on the car's longitudinal axis, without lateral strafing.
    expect(Math.atan2(next.velocity?.vy ?? 0, next.velocity?.vx ?? 0)).toBeCloseTo(
      next.vehicleHeading ?? 0,
      6,
    );
    car = next;
  }
  expect(car.position.wx).toBeGreaterThan(35);
  expect(car.position.wy).toBeGreaterThan(65);
  expect(car.vehicleHeading).toBeGreaterThan(1.4);
  expect(car.sprite?.direction).toBe(Direction.Down);
});

it("reverses the steering effect with signed travel and passes through zero without a nose flip", () => {
  const world = clearGround();
  const car = createVehicle("compact-1", 0, 0, Direction.Right);
  car.velocity = { vx: 30, vy: 0 };
  const forward = drivenCarPose(car, { dx: 0, dy: 1 }, 1 / 60, world, [], []);
  car.velocity.vx = -30;
  const reverse = drivenCarPose(car, { dx: 0, dy: 1, reversing: true }, 1 / 60, world, [], []);
  expect(forward?.vehicleHeading).toBeGreaterThan(0);
  expect(reverse?.vehicleHeading).toBeCloseTo(-(forward?.vehicleHeading ?? 1), 6);
  expect(reverse?.position.wx).toBeLessThan(0);
  expect(reverse?.sprite?.direction).toBe(Direction.Right);
  car.velocity.vx = -224 / 60;
  const stopped = drivenCarPose(car, { dx: 0, dy: 1 }, 1 / 60, world, [], []);
  expect(stopped?.vehicleHeading).toBe(0);
  expect(stopped?.position).toEqual(car.position);
  expect(stopped?.velocity).toEqual({ vx: 0, vy: 0 });
});

it("holds a diagonal nose at rest and rejects blocked turns without changing the original car", () => {
  const world = clearGround();
  const car = createVehicle("compact-1", 0, 0, Direction.Right);
  car.vehicleHeading = Math.fround(Math.PI / 6);
  const atRest = drivenCarPose(car, { dx: 0, dy: 0 }, 1 / 60, world, [], []);
  expect(atRest?.vehicleHeading).toBe(car.vehicleHeading);
  const before = structuredClone(car);
  const obstacle = createVehicle("compact-1", 1, 0);
  obstacle.id = 2;
  expect(drivenCarPose(car, { dx: 0, dy: 1 }, 1 / 60, world, [], [obstacle])).toBeUndefined();
  expect(car).toEqual(before);
});

it("turns less at crawling speed and gives long vehicles a wider turning circle", () => {
  const world = clearGround();
  const small = createVehicle("compact-1", 0, 0, Direction.Right);
  small.velocity = { vx: 10, vy: 0 };
  const slow = drivenCarPose(small, { dx: 0, dy: 1 }, 1 / 60, world, [], []);
  small.velocity.vx = 40;
  const fast = drivenCarPose(small, { dx: 0, dy: 1 }, 1 / 60, world, [], []);
  const bus = createVehicle("bus-1", 0, 0, Direction.Right);
  bus.velocity = { vx: 40, vy: 0 };
  const wide = drivenCarPose(bus, { dx: 0, dy: 1 }, 1 / 60, world, [], []);
  expect(slow?.vehicleHeading).toBeLessThan((fast?.vehicleHeading ?? 0) / 2);
  expect(wide?.vehicleHeading).toBeLessThan((fast?.vehicleHeading ?? 0) * 0.8);
});

it("chooses reverse for rearward aim, scales near-target throttle and leaves sideways aim as a turn", () => {
  const world = clearGround();
  const car = createVehicle("compact-1", 0, 0, Direction.Right);
  const rear = drivenCarPose(car, { dx: -1, dy: 0 }, 1 / 60, world, [], []);
  expect(rear?.position.wx).toBeLessThan(0);
  expect(rear?.vehicleHeading).toBeCloseTo(0);
  const side = drivenCarPose(car, { dx: 0, dy: 1 }, 1 / 60, world, [], []);
  expect(side?.position.wx).toBeGreaterThan(0);
  expect(side?.vehicleHeading).toBeGreaterThan(0);
  let moving = car;
  for (let n = 0; n < 60; n++)
    moving = drivenCarPose(moving, { dx: -0.1, dy: 0 }, 1 / 60, world, [], []) ?? moving;
  expect(moving.velocity?.vx).toBeCloseTo(-5.6);
});

it("relative keys steer left/right, use Down to reverse, and cannot pivot at rest", () => {
  const world = clearGround();
  const car = createVehicle("compact-1", 0, 0, Direction.Right);
  const stopped = drivenCarPose(
    car,
    { dx: 1, dy: 0, relativeDriving: true },
    1 / 60,
    world,
    [],
    [],
  );
  expect(stopped?.position).toEqual(car.position);
  expect(stopped?.vehicleHeading).toBe(0);
  const forward = drivenCarPose(
    car,
    { dx: -1, dy: -1, relativeDriving: true },
    1 / 60,
    world,
    [],
    [],
  );
  const reverse = drivenCarPose(
    car,
    { dx: -1, dy: 1, relativeDriving: true },
    1 / 60,
    world,
    [],
    [],
  );
  expect(forward?.position.wx).toBeGreaterThan(0);
  expect(forward?.vehicleHeading).toBeLessThan(0);
  expect(reverse?.position.wx).toBeLessThan(0);
  expect(reverse?.vehicleHeading).toBeGreaterThan(0);
});
