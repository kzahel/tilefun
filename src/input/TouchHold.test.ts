import { afterEach, describe, expect, it, vi } from "vitest";
import type { TapTarget } from "./TapMovement.js";
import { TouchHold } from "./TouchHold.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
afterEach(() => vi.unstubAllGlobals());

function harness() {
  const canvas = new EventTarget() as HTMLCanvasElement;
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  const claimed = new Set<number>();
  const resolve = vi.fn((x: number, y: number): TapTarget | null => ({
    wx: x,
    wy: y,
    wz: 0,
    screenSide: x < 0 ? (-1 as const) : (1 as const),
  }));
  const hold = new TouchHold(canvas, claimed, resolve);
  hold.attach();
  const touch = (id: number, x = 100, y = 0) => ({ identifier: id, clientX: x, clientY: y });
  const event = (type: string, changed: ReturnType<typeof touch>[], touches = changed) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { changedTouches: changed, touches });
    canvas.dispatchEvent(e);
  };
  const sample = (manual = idle, train = false) => hold.sample({ wx: 0, wy: 0 }, manual, train);
  return { canvas, win, hold, resolve, claimed, touch, event, sample };
}

describe("hold movement", () => {
  it("starts on down, keeps steering indefinitely with a live projection, and stops on release", () => {
    const h = harness();
    h.event("touchstart", [h.touch(1)]);
    for (let i = 0; i < 120; i++) expect(h.sample().dx).toBe(1);
    h.resolve.mockReturnValue({ wx: 0, wy: -100, wz: 0, screenSide: 1 });
    expect(h.sample()).toEqual({ ...idle, dy: -1 });
    h.event("touchend", [h.touch(1)], []);
    expect(h.sample()).toEqual(idle);
  });

  it("uses newest finger, updates drags without changing priority, and resumes the remaining finger", () => {
    const h = harness();
    h.event("touchstart", [h.touch(1)]);
    h.event("touchstart", [h.touch(2, -100)], [h.touch(1), h.touch(2, -100)]);
    expect(h.sample().dx).toBe(-1);
    h.event("touchmove", [h.touch(1, 0, 100)]);
    expect(h.sample().dx).toBe(-1);
    h.event("touchmove", [h.touch(2, 0, -100)]);
    expect(h.sample().dy).toBe(-1);
    h.event("touchend", [h.touch(2)], [h.touch(1)]);
    expect(h.sample().dy).toBe(1);
    h.event("touchend", [h.touch(1)], []);
    expect(h.sample()).toEqual(idle);
  });

  it("ignores claimed buttons and DOM fingers while preserving Jump and Sprint", () => {
    const h = harness();
    h.claimed.add(2);
    h.event("touchstart", [h.touch(2)]);
    expect(h.resolve).not.toHaveBeenCalled();
    h.event("touchstart", [h.touch(1)], [h.touch(1), h.touch(2), h.touch(3, -100)]);
    expect(h.sample({ ...idle, jump: true, sprinting: true })).toEqual({
      ...idle,
      dx: 1,
      jump: true,
      sprinting: true,
    });
    h.event("touchend", [h.touch(1)], [h.touch(2), h.touch(3)]);
    expect(h.sample()).toEqual(idle);
  });

  it.each(["cancel", "reset", "manual", "teleport", "lock", "detach"])(
    "requires a fresh down after %s",
    (reason) => {
      const h = harness();
      h.event("touchstart", [h.touch(1)]);
      expect(h.sample().dx).toBe(1);
      if (reason === "cancel") h.event("touchcancel", [h.touch(1)]);
      if (reason === "reset") h.hold.reset();
      if (reason === "manual") expect(h.sample({ ...idle, dx: -1 }).dx).toBe(-1);
      if (reason === "teleport") expect(h.hold.sample({ wx: 100, wy: 0 }, idle)).toEqual(idle);
      if (reason === "lock") {
        h.resolve.mockReturnValueOnce(null);
        expect(h.sample()).toEqual(idle);
      }
      if (reason === "detach") {
        h.hold.detach();
        h.hold.attach();
      }
      h.event("touchmove", [h.touch(1)]);
      expect(h.sample()).toEqual(idle);
      h.event("touchend", [h.touch(1)], []);
      h.event("touchstart", [h.touch(4)]);
      expect(h.sample().dx).toBe(1);
    },
  );

  it("stays neutral near the feet and can move out of the dead zone without lifting", () => {
    const h = harness();
    h.event("touchstart", [h.touch(1, 4, 4)]);
    expect(h.sample()).toEqual(idle);
    h.event("touchmove", [h.touch(1)]);
    expect(h.sample().dx).toBe(1);
  });

  it("holds train direction until release with newest-finger takeover", () => {
    const h = harness();
    h.event("touchstart", [h.touch(1)]);
    expect(h.sample(idle, true)).toEqual({ ...idle, dx: 1 });
    h.event("touchstart", [h.touch(2, -1)]);
    expect(h.sample(idle, true)).toEqual({ ...idle, dx: -1 });
    h.event("touchend", [h.touch(2)]);
    expect(h.sample(idle, true).dx).toBe(1);
    h.event("touchend", [h.touch(1)]);
    expect(h.sample(idle, true)).toEqual(idle);
  });

  it("supports primary mouse holds and window release, suppressing touch compatibility presses", () => {
    const h = harness();
    const mouse = (target: EventTarget, type: string, x: number, buttons: number) => {
      const e = new Event(type, { cancelable: true });
      Object.assign(e, { clientX: x, clientY: 0, button: 0, buttons });
      target.dispatchEvent(e);
    };
    mouse(h.canvas, "mousedown", 100, 1);
    expect(h.sample().dx).toBe(1);
    mouse(h.win, "mousemove", -100, 1);
    expect(h.sample().dx).toBe(-1);
    mouse(h.win, "mouseup", -100, 0);
    expect(h.sample()).toEqual(idle);
    h.event("touchstart", [h.touch(1)]);
    h.event("touchend", [h.touch(1)], []);
    mouse(h.canvas, "mousedown", 100, 1);
    expect(h.sample()).toEqual(idle);
  });
});
