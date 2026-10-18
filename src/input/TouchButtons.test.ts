import { afterEach, expect, it, vi } from "vitest";
import { TouchButtons } from "./TouchButtons.js";

afterEach(() => vi.unstubAllGlobals());
it("shows mouse-usable driving controls on desktop and releases boost on blur", () => {
  const canvas = new EventTarget() as EventTarget & {
    width: number;
    height: number;
    getBoundingClientRect(): { left: number; top: number };
  };
  Object.assign(canvas, {
    width: 800,
    height: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  });
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { maxTouchPoints: 0 });
  const buttons = new TouchButtons(canvas as unknown as HTMLCanvasElement);
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
  };
  buttons.draw(ctx as unknown as CanvasRenderingContext2D);
  expect(ctx.fillText).not.toHaveBeenCalled();
  buttons.driving = true;
  buttons.draw(ctx as unknown as CanvasRenderingContext2D);
  expect(ctx.fillText.mock.calls.map((call) => call[0])).toEqual([
    "Fast",
    "hold · Shift",
    "Horn",
    "honk · H",
  ]);
  buttons.emergency = true;
  buttons.emergencyState = 5;
  ctx.fillText.mockClear();
  buttons.draw(ctx as unknown as CanvasRenderingContext2D);
  expect(ctx.fillText.mock.calls.map((call) => call[0])).toContain("US");
  expect(ctx.fillText.mock.calls.map((call) => call[0])).toContain("Siren On");
  buttons.emergency = false;
  buttons.warning = true;
  buttons.emergencyState = 1;
  ctx.fillText.mockClear();
  buttons.draw(ctx as unknown as CanvasRenderingContext2D);
  expect(ctx.fillText.mock.calls.map((call) => call[0])).toEqual([
    "Beacon On",
    "toggle · B",
    "Fast",
    "hold · Shift",
    "Horn",
    "honk · H",
  ]);
  buttons.train = true;
  ctx.fillText.mockClear();
  buttons.draw(ctx as unknown as CanvasRenderingContext2D);
  expect(ctx.fillText.mock.calls.map((call) => call[0])).toContain("Whistle");
  buttons.attach();
  const horn = new Event("mousedown", { cancelable: true });
  Object.assign(horn, { button: 0, clientX: 748, clientY: 548 });
  canvas.dispatchEvent(horn);
  expect(buttons.hornPressed).toBe(true);
  win.dispatchEvent(new Event("mouseup"));
  expect(buttons.hornPressed).toBe(false);
  expect(buttons.consumeHornPress()).toBe(true);
  expect(buttons.consumeHornPress()).toBe(false);
  const down = new Event("mousedown", { cancelable: true });
  Object.assign(down, { button: 0, clientX: 680, clientY: 548 });
  canvas.dispatchEvent(down);
  expect(buttons.sprintPressed).toBe(true);
  win.dispatchEvent(new Event("blur"));
  expect(buttons.sprintPressed).toBe(false);
  buttons.detach();
});
