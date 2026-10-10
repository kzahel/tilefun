import { afterEach, describe, expect, it, vi } from "vitest";
import { TouchTap } from "./TouchTap.js";

afterEach(() => vi.restoreAllMocks());
function harness() {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const listeners = new Map<string, EventListener>();
  const canvas = {
    addEventListener: (name: string, handler: EventListener) => listeners.set(name, handler),
    removeEventListener: (name: string) => listeners.delete(name),
  } as unknown as HTMLCanvasElement;
  const claimed = new Set<number>();
  const tap = vi.fn();
  const resolve = vi.fn(() => ({ wx: 100, wy: 200, wz: 0 }));
  const c = new TouchTap(canvas, claimed, resolve, tap);
  c.attach();
  const touch = (id: number, x = 50, y = 50) => ({ identifier: id, clientX: x, clientY: y });
  const event = (name: string, touches: ReturnType<typeof touch>[], changed = touches) => {
    const preventDefault = vi.fn();
    listeners.get(name)?.({ touches, changedTouches: changed, preventDefault } as unknown as Event);
  };
  return {
    c,
    claimed,
    tap,
    resolve,
    touch,
    event,
    time: (n: number) => {
      now = n;
    },
  };
}
describe("completed world taps", () => {
  it("accepts slower taps with wobble, using the target captured at touch start", () => {
    const h = harness();
    h.event("touchstart", [h.touch(1)]);
    h.time(600);
    h.event("touchmove", [h.touch(1, 60, 55)]);
    h.event("touchend", [], [h.touch(1, 60, 55)]);
    expect(h.tap).toHaveBeenCalledExactlyOnceWith({ wx: 100, wy: 200, wz: 0 });
    expect(h.resolve).toHaveBeenCalledTimes(1);
  });
  it.each(["touchcancel", "drag", "long", "second finger"])(
    "rejects %s and accepts a later fresh tap",
    (reason) => {
      const h = harness();
      h.event("touchstart", [h.touch(1)]);
      if (reason === "touchcancel") h.event("touchcancel", [], [h.touch(1)]);
      if (reason === "drag") {
        h.event("touchmove", [h.touch(1, 90)]);
        h.event("touchmove", [h.touch(1)]);
      }
      if (reason === "long") h.time(1000);
      if (reason === "second finger") h.event("touchstart", [h.touch(1), h.touch(2)], [h.touch(2)]);
      h.event("touchend", [], [h.touch(1), h.touch(2)]);
      expect(h.tap).not.toHaveBeenCalled();
      h.event("touchstart", [h.touch(3)]);
      h.event("touchend", [], [h.touch(3)]);
      expect(h.tap).toHaveBeenCalledTimes(1);
    },
  );
  it("allows a world tap while an action button is held, but never taps the button", () => {
    const h = harness();
    h.claimed.add(1);
    h.event("touchstart", [h.touch(1)]);
    expect(h.resolve).not.toHaveBeenCalled();
    h.event("touchstart", [h.touch(1), h.touch(2)], [h.touch(2)]);
    h.event("touchend", [h.touch(1)], [h.touch(2)]);
    expect(h.tap).toHaveBeenCalledTimes(1);
    h.event("touchend", [], [h.touch(1)]);
    expect(h.tap).toHaveBeenCalledTimes(1);
  });
  it("does not finish a gesture after reset or teardown", () => {
    const h = harness();
    h.event("touchstart", [h.touch(1)]);
    h.c.reset();
    h.event("touchend", [], [h.touch(1)]);
    expect(h.tap).not.toHaveBeenCalled();
    h.c.detach();
    h.event("touchstart", [h.touch(2)]);
    h.event("touchend", [], [h.touch(2)]);
    expect(h.tap).not.toHaveBeenCalled();
  });
});
