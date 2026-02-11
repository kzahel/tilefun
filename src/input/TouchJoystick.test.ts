import { describe, expect, it } from "vitest";
import { TouchJoystick } from "./TouchJoystick.js";

function makeCanvas(width = 800, height = 600): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement;
}

describe("TouchJoystick", () => {
  it("returns zero movement when no touch active", () => {
    const joy = new TouchJoystick(makeCanvas());
    const m = joy.getMovement();
    expect(m.dx).toBe(0);
    expect(m.dy).toBe(0);
  });

  it("isActive returns false initially", () => {
    const joy = new TouchJoystick(makeCanvas());
    expect(joy.isActive()).toBe(false);
  });

  it("isActive returns true during touch", () => {
    const joy = new TouchJoystick(makeCanvas());
    joy.simulateTouchStart(100, 300);
    expect(joy.isActive()).toBe(true);
  });

  it("returns zero after touch end", () => {
    const joy = new TouchJoystick(makeCanvas());
    joy.simulateTouchStart(100, 300);
    joy.simulateTouchMove(150, 300);
    joy.simulateTouchEnd();
    expect(joy.isActive()).toBe(false);
    expect(joy.getMovement().dx).toBe(0);
    expect(joy.getMovement().dy).toBe(0);
  });

  it("returns rightward movement for thumb pushed right", () => {
    const joy = new TouchJoystick(makeCanvas());
    joy.simulateTouchStart(100, 300);
    joy.simulateTouchMove(150, 300);
    const m = joy.getMovement();
    expect(m.dx).toBeGreaterThan(0);
    expect(m.dy).toBe(0);
  });

  it("returns upward movement for thumb pushed up", () => {
    const joy = new TouchJoystick(makeCanvas());
    joy.simulateTouchStart(100, 300);
    joy.simulateTouchMove(100, 260);
    const m = joy.getMovement();
    expect(m.dx).toBe(0);
    expect(m.dy).toBeLessThan(0);
  });

  it("applies dead zone for tiny movements", () => {
    const joy = new TouchJoystick(makeCanvas());
    joy.simulateTouchStart(100, 300);
    joy.simulateTouchMove(105, 303); // 5px right, 3px down — within dead zone
    const m = joy.getMovement();
    expect(m.dx).toBe(0);
    expect(m.dy).toBe(0);
  });

  it("clamps magnitude to 1", () => {
    const joy = new TouchJoystick(makeCanvas());
    joy.simulateTouchStart(100, 300);
    joy.simulateTouchMove(300, 300); // 200px right — far beyond max
    const m = joy.getMovement();
    expect(Math.hypot(m.dx, m.dy)).toBeCloseTo(1, 5);
  });

  it("normalizes diagonal movement to magnitude <= 1", () => {
    const joy = new TouchJoystick(makeCanvas());
    joy.simulateTouchStart(100, 300);
    joy.simulateTouchMove(200, 400); // diagonal, far
    const m = joy.getMovement();
    expect(Math.hypot(m.dx, m.dy)).toBeLessThanOrEqual(1.001);
  });

  it("provides analog magnitude between 0 and 1", () => {
    const joy = new TouchJoystick(makeCanvas());
    joy.simulateTouchStart(100, 300);
    // Move 25px right — half of MAX_DISTANCE (50)
    joy.simulateTouchMove(125, 300);
    const m = joy.getMovement();
    expect(m.dx).toBeCloseTo(0.5, 1);
    expect(m.dy).toBe(0);
  });
});
