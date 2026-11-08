import { afterEach, describe, expect, it, vi } from "vitest";
import { TouchButtons } from "./TouchButtons.js";
import { TouchJoystick } from "./TouchJoystick.js";
import {
  canvasPoint,
  canvasScale,
  cssRegion,
  pageInset,
  regionPoint,
  viewAt,
  wholeCanvas,
} from "./ViewRect.js";

afterEach(() => vi.unstubAllGlobals());

/** A 960×640 lab canvas shown at 480×320 CSS pixels, 100 px from the left. */
function labCanvas() {
  return Object.assign(new EventTarget(), {
    width: 960,
    height: 640,
    clientWidth: 480,
    clientHeight: 320,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 480, height: 320 }),
  }) as unknown as HTMLCanvasElement;
}

function recordingContext() {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push(
        `${name}(${args.map((a) => (typeof a === "number" ? Math.round(a) : a)).join(",")})`,
      );
  return {
    calls,
    ctx: new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) => (key in target ? target[key] : record(key)),
      set: (target, key: string, value) => {
        target[key] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D,
  };
}

function touch(type: string, id: number, clientX: number, clientY: number): Event {
  const t = { identifier: id, clientX, clientY };
  return Object.assign(new Event(type, { cancelable: true }), {
    changedTouches: [t],
    touches: type === "touchend" ? [] : [t],
  });
}

describe("view rectangles", () => {
  it("maps client points into canvas CSS pixels and finds the view under them", () => {
    const canvas = labCanvas();
    expect(canvasPoint(canvas, 150, 100)).toEqual({ x: 50, y: 50 });
    expect(canvasScale(canvas)).toEqual({ x: 2, y: 2 });
    expect(wholeCanvas(canvas)).toEqual({ x: 0, y: 0, width: 480, height: 320 });
    const halves = [
      { x: 0, y: 0, width: 240, height: 320 },
      { x: 240, y: 0, width: 240, height: 320 },
    ];
    expect(viewAt(halves, { x: 10, y: 10 })).toBe(0);
    expect(viewAt(halves, { x: 240, y: 10 })).toBe(1);
    expect(viewAt(halves, { x: 480, y: 10 })).toBe(-1);
    // Later regions win where they overlap (draw order).
    expect(
      viewAt([halves[0], { x: 0, y: 0, width: 480, height: 320 }] as never, { x: 1, y: 1 }),
    ).toBe(1);
  });

  it("reads a view's render region in CSS pixels, as client points and as page insets (226)", () => {
    const canvas = labCanvas(); // 960×640 canvas pixels shown at 480×320, at (100, 50)
    const right = { x: 480, y: 0, width: 480, height: 640 }; // the right half
    expect(cssRegion(canvas, right)).toEqual({ x: 240, y: 0, width: 240, height: 320 });
    // A click at CSS (250, 10) of the canvas is canvas pixel (500, 20): 20 into the region.
    expect(regionPoint(canvas, right, 100 + 250, 50 + 10)).toEqual({ x: 20, y: 20 });
    expect(regionPoint(canvas, right, 100 + 230, 50 + 10)).toBeUndefined();
    expect(regionPoint(canvas, right, 100 + 480, 50 + 10)).toBeUndefined();
    // In a 1000×600 page the right half's box spans CSS x 340..580 and y 50..370.
    expect(pageInset(canvas, right, { width: 1000, height: 600 })).toEqual({
      left: 340,
      right: 420,
      bottom: 230,
    });
  });

  it("a joystick in a scaled, offset canvas steers by finger travel and draws under the finger", () => {
    const canvas = labCanvas();
    const joystick = new TouchJoystick(canvas);
    const taps: [number, number][] = [];
    joystick.onTap = (x, y) => taps.push([x, y]);
    joystick.attach();
    canvas.dispatchEvent(touch("touchstart", 1, 150, 100));
    canvas.dispatchEvent(touch("touchmove", 1, 200, 100));
    expect(joystick.getMovement()).toEqual({ dx: 1, dy: 0 });
    const { ctx, calls } = recordingContext();
    joystick.draw(ctx);
    // CSS pixels scaled into the 2× canvas: base at (50, 50), thumb clamped 50 px right.
    expect(calls).toContain("scale(2,2)");
    expect(calls).toContain("arc(50,50,60,0,6)");
    expect(calls).toContain("arc(100,50,28,0,6)");
    canvas.dispatchEvent(touch("touchend", 1, 200, 100));
    // A short tap reports client coordinates, as callers map those themselves.
    canvas.dispatchEvent(touch("touchstart", 2, 160, 120));
    canvas.dispatchEvent(touch("touchend", 2, 160, 120));
    expect(taps).toEqual([[160, 120]]);
  });

  it("a joystick limited to a region ignores fingers that start outside it", () => {
    const canvas = labCanvas();
    const joystick = new TouchJoystick(canvas);
    joystick.region = { x: 240, y: 0, width: 240, height: 320 };
    joystick.attach();
    canvas.dispatchEvent(touch("touchstart", 1, 150, 100)); // canvas x 50: left half
    expect(joystick.isActive()).toBe(false);
    canvas.dispatchEvent(touch("touchstart", 2, 450, 100)); // canvas x 350: right half
    expect(joystick.isActive()).toBe(true);
  });

  it("touch buttons hit where they are drawn in a scaled canvas and follow their region", () => {
    const canvas = labCanvas();
    vi.stubGlobal("window", new EventTarget());
    const buttons = new TouchButtons(canvas);
    const [jump] = buttons.getPositions();
    // Bottom-right of the 480×320 CSS box: 480 − 24 − 28, 320 − 24 − 28.
    expect(jump).toEqual({ x: 428, y: 268 });
    const { ctx, calls } = recordingContext();
    buttons.draw(ctx);
    expect(calls).toContain("scale(2,2)");
    expect(calls).toContain("roundRect(396,242,64,52,14)");
    buttons.attach();
    canvas.dispatchEvent(touch("touchstart", 3, 100 + 428, 50 + 268));
    expect(buttons.jumpPressed).toBe(true);
    buttons.detach();

    buttons.region = { x: 0, y: 0, width: 240, height: 320 };
    expect(buttons.getPositions()[0]).toEqual({ x: 188, y: 268 });
  });
});
