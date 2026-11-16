import { describe, expect, it, vi } from "vitest";
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

function touchHarness() {
  const canvas = Object.assign(new EventTarget(), {
    width: 1600,
    height: 1200,
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 20, top: 30 }),
  }) as unknown as HTMLCanvasElement;
  const joy = new TouchJoystick(canvas);
  let fps = true;
  joy.lookEnabled = () => fps;
  joy.onLook = vi.fn();
  joy.onTap = vi.fn();
  joy.attach();
  const finger = (id: number, x: number, y = 200) => ({
    identifier: id,
    clientX: x + 20,
    clientY: y + 30,
  });
  const event = (type: string, ...changedTouches: ReturnType<typeof finger>[]) =>
    canvas.dispatchEvent(Object.assign(new Event(type), { changedTouches }));
  return { joy, finger, event, setFps: (value: boolean) => (fps = value) };
}

describe("first-person touch roles", () => {
  it.each([true, false])("moves and looks independently, look finger first: %s", (lookFirst) => {
    const { joy, finger, event } = touchHarness();
    const left = finger(1, 100);
    const right = finger(2, 500);
    event("touchstart", ...(lookFirst ? [right, left] : [left, right]));
    // Both fingers move in one event, including across the original dividing line.
    event("touchmove", finger(1, 450), finger(2, 350, 140));
    expect(joy.getMovement()).toEqual({ dx: 1, dy: 0 });
    expect(joy.onLook).toHaveBeenCalledExactlyOnceWith(-150 / 600, -60 / 600);
    event("touchend", finger(2, 350, 140));
    expect(joy.isActive()).toBe(true);
    event("touchend", finger(1, 450));
    expect(joy.isActive()).toBe(false);
    expect(joy.onTap).not.toHaveBeenCalled();
  });

  it("a right-only drag never activates movement or a release tap", () => {
    const { joy, finger, event } = touchHarness();
    event("touchstart", finger(1, 500));
    event("touchmove", finger(1, 560));
    expect(joy.getMovement()).toEqual({ dx: 0, dy: 0 });
    expect(joy.isActive()).toBe(false);
    expect(joy.onLook).toHaveBeenCalledExactlyOnceWith(0.1, 0);
    event("touchend", finger(1, 560));
    expect(joy.onTap).not.toHaveBeenCalled();
  });

  it("keeps button contacts and extra fingers out of look", () => {
    const { joy, finger, event } = touchHarness();
    joy.claimedTouches = new Set([1]);
    event("touchstart", finger(1, 500));
    event("touchmove", finger(1, 560));
    expect(joy.onLook).not.toHaveBeenCalled();
    event("touchstart", finger(2, 500), finger(3, 600));
    event("touchmove", finger(3, 650));
    expect(joy.onLook).not.toHaveBeenCalled();
    event("touchmove", finger(2, 560));
    expect(joy.onLook).toHaveBeenCalledExactlyOnceWith(0.1, 0);
  });

  it("splits only the host's CSS view, with sensitivity relative to its size", () => {
    const { joy, finger, event } = touchHarness();
    joy.region = { x: 100, y: 50, width: 400, height: 500 };
    event("touchstart", finger(1, 50), finger(2, 550));
    event("touchmove", finger(1, 100), finger(2, 600));
    expect(joy.onLook).not.toHaveBeenCalled();
    expect(joy.isActive()).toBe(false);
    event("touchstart", finger(3, 300)); // midpoint belongs to look
    event("touchmove", finger(3, 340));
    expect(joy.onLook).toHaveBeenCalledExactlyOnceWith(0.1, 0);
  });

  it.each(["reset", "cancel", "disable", "detach", "view change"])(
    "%s discards both roles and requires fresh contacts",
    (reason) => {
      const { joy, finger, event, setFps } = touchHarness();
      event("touchstart", finger(1, 100), finger(2, 500));
      if (reason === "reset") joy.reset();
      if (reason === "cancel") event("touchcancel", finger(2, 500));
      if (reason === "disable") joy.enabled = false;
      if (reason === "detach") joy.detach();
      if (reason === "view change") setFps(false);
      event("touchmove", finger(1, 150), finger(2, 560));
      expect(joy.getMovement()).toEqual({ dx: 0, dy: 0 });
      expect(joy.onLook).not.toHaveBeenCalled();
    },
  );

  it("top-down keeps a full-view joystick and tap interaction", () => {
    const { joy, finger, event, setFps } = touchHarness();
    setFps(false);
    event("touchstart", finger(1, 500));
    event("touchmove", finger(1, 550));
    expect(joy.getMovement()).toEqual({ dx: 1, dy: 0 });
    event("touchend", finger(1, 550));
    event("touchstart", finger(2, 500));
    event("touchend", finger(2, 500));
    expect(joy.onTap).toHaveBeenCalledExactlyOnceWith(520, 230);
    expect(joy.onLook).not.toHaveBeenCalled();
  });
});
