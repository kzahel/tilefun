import { expect, it } from "vitest";
import { PlayerControls, playerMotionIntent } from "./PlayerControls.js";

it("coalesces burst axes, preserves a press/release jump edge and ignores command duration", () => {
  const controls = new PlayerControls();
  const { movement, ack } = controls.admit(
    [
      { seq: 1, dx: 1, dy: 0, jump: true, sprinting: false, dtMs: 100 },
      { seq: 2, dx: -1, dy: 0, jump: false, sprinting: false, dtMs: 100 },
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
