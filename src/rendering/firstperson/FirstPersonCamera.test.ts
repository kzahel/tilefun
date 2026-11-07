import { describe, expect, it } from "vitest";
import { Direction } from "../../entities/Entity.js";
import {
  angleDelta,
  apparentDirection,
  cameraRelativeMovement,
  cameraRight,
  chaseEye,
  lookDirection,
  NORTH_YAW,
} from "./FirstPersonCamera.js";

const close = (actual: { dx: number; dy: number }, dx: number, dy: number) => {
  expect(actual.dx).toBeCloseTo(dx, 9);
  expect(actual.dy).toBeCloseTo(dy, 9);
};

describe("camera-relative movement", () => {
  it("is the identity when facing north, matching the fixed view", () => {
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [-0.6, 0.8],
    ] as const)
      close(cameraRelativeMovement(dx, dy, NORTH_YAW), dx, dy);
  });

  it("sends forward along the heading and right to its clockwise side", () => {
    close(cameraRelativeMovement(0, -1, 0), 1, 0); // facing east, forward → east
    close(cameraRelativeMovement(1, 0, 0), 0, 1); // facing east, right → south
    close(cameraRelativeMovement(0, -1, Math.PI / 2), 0, 1); // facing south, forward → south
    close(cameraRelativeMovement(0, 1, Math.PI), 1, 0); // facing west, back → east
  });

  it("preserves analog magnitude for every heading", () => {
    for (let yaw = -Math.PI; yaw <= Math.PI; yaw += 0.37) {
      const turned = cameraRelativeMovement(0.3, -0.4, yaw);
      expect(Math.hypot(turned.dx, turned.dy)).toBeCloseTo(0.5, 9);
    }
  });
});

describe("look vectors", () => {
  it("agree with movement axes and the camera right vector", () => {
    const dir = lookDirection(0.7, 0);
    const forward = cameraRelativeMovement(0, -1, 0.7);
    expect(dir.x).toBeCloseTo(forward.dx, 9);
    expect(dir.y).toBeCloseTo(forward.dy, 9);
    const right = cameraRight(0.7);
    const strafe = cameraRelativeMovement(1, 0, 0.7);
    expect(right.x).toBeCloseTo(strafe.dx, 9);
    expect(right.y).toBeCloseTo(strafe.dy, 9);
    expect(lookDirection(0, Math.PI / 4).z).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it("wraps signed turns into (-π, π]", () => {
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2, 9);
    expect(angleDelta(0.25, 0.1)).toBeCloseTo(0.15, 9);
  });

  it("places the chase camera behind and above its target", () => {
    const eye = chaseEye({ x: 100, y: 100, z: 10 }, { yaw: 0, pitch: 0 }, 96, 28);
    expect(eye.x).toBeLessThan(100);
    expect(eye.y).toBeCloseTo(100, 9);
    expect(eye.z).toBeGreaterThan(38);
    expect(eye.pitch).toBeLessThan(0);
  });
});

describe("Doom-style sprite rows", () => {
  it("keeps the authored row when looking north, like the fixed view", () => {
    for (const facing of [Direction.Down, Direction.Up, Direction.Left, Direction.Right])
      expect(apparentDirection(facing, NORTH_YAW)).toBe(facing);
  });

  it("shows the side that faces the viewer", () => {
    // Looking east at an actor facing east: its back.
    expect(apparentDirection(Direction.Right, 0)).toBe(Direction.Up);
    // Looking east at an actor facing west: its front.
    expect(apparentDirection(Direction.Left, 0)).toBe(Direction.Down);
    // Looking east at an actor facing south: it faces the viewer's right.
    expect(apparentDirection(Direction.Down, 0)).toBe(Direction.Right);
    // Looking south at an actor facing north: its front.
    expect(apparentDirection(Direction.Up, Math.PI / 2)).toBe(Direction.Down);
  });
});
