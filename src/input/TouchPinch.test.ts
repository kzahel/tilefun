import { afterEach, describe, expect, it, vi } from "vitest";
import { TouchButtons } from "./TouchButtons.js";
import { TouchJoystick } from "./TouchJoystick.js";
import { TouchPinch } from "./TouchPinch.js";
import { TouchTap } from "./TouchTap.js";

afterEach(() => vi.restoreAllMocks());
function harness() {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const listeners = new Map<string, EventListener[]>();
  const canvas = {
    width: 800,
    height: 600,
    addEventListener: (name: string, fn: EventListener) => {
      listeners.set(name, [...(listeners.get(name) ?? []), fn]);
    },
    removeEventListener: (name: string, fn: EventListener) => {
      listeners.set(
        name,
        (listeners.get(name) ?? []).filter((f) => f !== fn),
      );
    },
  } as unknown as HTMLCanvasElement;
  const buttons = new TouchButtons(canvas);
  const joystick = new TouchJoystick(canvas);
  joystick.claimedTouches = buttons.claimedTouches;
  let enabled = true;
  let zoom = 1;
  const setZoom = vi.fn((value: number) => {
    zoom = value;
  });
  const tap = vi.fn();
  const worldTap = new TouchTap(
    canvas,
    buttons.claimedTouches,
    () => ({ wx: 0, wy: 0, wz: 0 }),
    tap,
  );
  const begin = vi.fn(() => {
    joystick.reset();
    worldTap.reset();
  });
  const pinch = new TouchPinch(
    canvas,
    buttons.claimedTouches,
    () => enabled,
    () => {
      const m = joystick.getMovement();
      return m.dx !== 0 || m.dy !== 0;
    },
    () => zoom,
    setZoom,
    begin,
  );
  buttons.attach();
  pinch.attach();
  worldTap.attach();
  joystick.attach();
  const touch = (id: number, x = 100, y = 100, target: EventTarget = canvas) => ({
    identifier: id,
    clientX: x,
    clientY: y,
    target,
  });
  const event = (name: string, touches: ReturnType<typeof touch>[], changed = touches) => {
    const e = { type: name, touches, changedTouches: changed, preventDefault: vi.fn() };
    for (const fn of listeners.get(name) ?? []) fn(e as unknown as Event);
  };
  return {
    pinch,
    joystick,
    buttons,
    setZoom,
    begin,
    tap,
    touch,
    event,
    time: (n: number) => {
      now = n;
    },
    enabled: (value: boolean) => {
      enabled = value;
    },
  };
}

describe("world pinch arbitration", () => {
  it("takes over a quick neutral touch, zooms both ways and suppresses release taps/movement", () => {
    const h = harness();
    h.event("touchstart", [h.touch(1)]);
    expect(h.joystick.isActive()).toBe(true);
    h.time(100);
    h.event("touchstart", [h.touch(1), h.touch(2, 200)], [h.touch(2, 200)]);
    expect(h.begin).toHaveBeenCalledOnce();
    expect(h.joystick.isActive()).toBe(false);
    h.event("touchmove", [h.touch(1), h.touch(2, 300)], [h.touch(2, 300)]);
    expect(h.setZoom).toHaveBeenLastCalledWith(2);
    h.event("touchmove", [h.touch(1), h.touch(2, 150)], [h.touch(2, 150)]);
    expect(h.setZoom).toHaveBeenLastCalledWith(0.5);
    h.event("touchend", [h.touch(1)], [h.touch(2, 150)]);
    h.event("touchmove", [h.touch(1, 150)]);
    expect(h.joystick.isActive()).toBe(false);
    h.event("touchend", [], [h.touch(1, 150)]);
    expect(h.tap).not.toHaveBeenCalled();
    expect(h.buttons.claimedTouches.size).toBe(0);
    h.event("touchstart", [h.touch(3)]);
    h.event("touchmove", [h.touch(3, 150)]);
    expect(h.joystick.getMovement().dx).toBe(1);
  });
  it("accepts simultaneous fingers and clamps zoom to the existing camera range", () => {
    const h = harness();
    h.event("touchstart", [h.touch(1), h.touch(2, 200)]);
    h.event("touchmove", [h.touch(1), h.touch(2, 700)]);
    expect(h.setZoom).toHaveBeenLastCalledWith(3);
    h.event("touchmove", [h.touch(1), h.touch(2, 101)]);
    expect(h.setZoom).toHaveBeenLastCalledWith(0.05);
  });
  it.each(["moving", "held", "dragged back"])("does not reclaim a %s joystick", (reason) => {
    const h = harness();
    h.event("touchstart", [h.touch(1)]);
    if (reason === "held") h.time(300);
    else h.event("touchmove", [h.touch(1, 150)]);
    if (reason === "dragged back") h.event("touchmove", [h.touch(1)]);
    h.event("touchstart", [h.touch(1), h.touch(2, 250)], [h.touch(2, 250)]);
    h.event("touchmove", [h.touch(1), h.touch(2, 350)]);
    expect(h.begin).not.toHaveBeenCalled();
    expect(h.setZoom).not.toHaveBeenCalled();
    expect(h.joystick.isActive()).toBe(true);
  });
  it.each(["button first", "button second", "DOM UI", "disabled", "too close"])(
    "rejects %s contacts",
    (reason) => {
      const h = harness();
      if (reason === "disabled") h.enabled(false);
      const a = reason === "button first" ? h.touch(1, 748, 548) : h.touch(1);
      const b =
        reason === "button second"
          ? h.touch(2, 748, 548)
          : reason === "DOM UI"
            ? h.touch(2, 200, 100, {} as EventTarget)
            : h.touch(2, reason === "too close" ? 110 : 200);
      h.event("touchstart", [a]);
      h.event("touchstart", [a, b], [b]);
      h.event("touchmove", [a, { ...b, clientX: b.clientX + 50 }]);
      expect(h.begin).not.toHaveBeenCalled();
      expect(h.setZoom).not.toHaveBeenCalled();
    },
  );
  it.each(["third finger", "cancel", "blocked", "reset", "detach"])(
    "stops on %s and requires fresh contacts",
    (reason) => {
      const h = harness();
      h.event("touchstart", [h.touch(1), h.touch(2, 200)]);
      if (reason === "third finger")
        h.event("touchstart", [h.touch(1), h.touch(2, 200), h.touch(3, 300)], [h.touch(3, 300)]);
      if (reason === "cancel") h.event("touchcancel", [h.touch(1)], [h.touch(2, 200)]);
      if (reason === "blocked") h.enabled(false);
      if (reason === "reset") h.pinch.reset();
      if (reason === "detach") h.pinch.detach();
      h.event("touchmove", [h.touch(1), h.touch(2, 300)]);
      expect(h.setZoom).not.toHaveBeenCalled();
      if (reason === "reset" || reason === "detach") expect(h.buttons.claimedTouches.size).toBe(0);
    },
  );
});
