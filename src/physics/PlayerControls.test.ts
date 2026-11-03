import { expect, it } from "vitest";
import { carDrivingStyle, manualCarMovement } from "../traffic/CarControls.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { PlayerControls, playerMotionIntent, vehicleMotionIntent } from "./PlayerControls.js";

it("defaults manual cars to independent throttle/steering and preserves saved directional preference", () => {
  const car = createVehicle("compact-1", 0, 0);
  const input = manualCarMovement({ dx: 1, dy: -1, jump: true, sprinting: false });
  expect(carDrivingStyle(undefined)).toBe("steering");
  expect(carDrivingStyle("direction")).toBe("direction");
  const controls = new PlayerControls();
  const { movement } = controls.admit([{ ...input, seq: 1 }], 1);
  expect(vehicleMotionIntent(car, movement)).toMatchObject({ driveSpeed: 112, steering: 1 });
  expect(movement.jump).toBe(false);
  expect(vehicleMotionIntent(car, { ...movement, dy: 0 }).driveSpeed).toBeCloseTo(0);
  expect(vehicleMotionIntent(car, { ...movement, reversing: true })).toMatchObject({
    driveSpeed: -56,
    steering: 1,
  });
});

it("coalesces burst axes, preserves a press/release jump edge at one fixed tick", () => {
  const controls = new PlayerControls();
  const { movement, ack } = controls.admit(
    [
      { seq: 1, dx: 1, dy: 0, jump: true, sprinting: false },
      { seq: 2, dx: -1, dy: 0, jump: false, sprinting: false },
    ],
    1,
  );
  expect(ack).toBe(2);
  expect(playerMotionIntent(movement)).toEqual({ vx: -64, vy: 0, jump: false, jumpPressed: true });
  expect(controls.admit([], 2).movement.jumpPressed).toBe(false);
});

it("holds through a short input gap, expires on simulation time and cannot replay a duplicate", () => {
  const controls = new PlayerControls();
  const command = { seq: 1, dx: 1, dy: 0, jump: false, sprinting: false };
  controls.admit([command], 1);
  expect(controls.admit([], 3).movement.dx).toBe(1);
  expect(controls.admit([], 16).movement.dx).toBe(0);
  expect(controls.admit([command], 17).movement.dx).toBe(0);
  controls.reset(20);
  expect(controls.admit([{ ...command, seq: 19 }], 18)).toMatchObject({
    ack: 20,
    movement: { dx: 0 },
  });
});
