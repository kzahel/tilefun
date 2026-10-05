import { afterEach, expect, it, vi } from "vitest";
import { GameLoop } from "./GameLoop.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("presents intermediate frames at 120 Hz while updating at 60 Hz and bounds long gaps", () => {
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const update = vi.fn(),
    render = vi.fn();
  const loop = new GameLoop({ update, render });
  loop.start();
  loop.stop();
  loop.externalTick(1000 / 120);
  expect(update).not.toHaveBeenCalled();
  expect(render).toHaveBeenLastCalledWith(0.5);
  loop.externalTick(1000 / 60);
  expect(update).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenLastCalledWith(0);
  loop.externalTick(25);
  expect(update).toHaveBeenCalledTimes(1);
  expect(render.mock.lastCall?.[0]).toBeCloseTo(0.5);
  loop.externalTick(10000);
  expect(update.mock.calls.length).toBeLessThanOrEqual(16);
  expect(render.mock.lastCall?.[0]).toBeLessThan(1);
});

it("changes rate inside an update without negative alpha or phantom command steps", () => {
  const dts: number[] = [],
    alphas: number[] = [];
  const loop = new GameLoop({
    update(dt) {
      dts.push(dt);
      if (dts.length === 1) loop.setTickRate(30);
      if (dts.length === 2) loop.setTickRate(60);
    },
    render(alpha) {
      alphas.push(alpha);
    },
  });
  loop.externalTick(1000 / 60);
  expect(dts).toEqual([1 / 60]);
  expect(alphas.at(-1)).toBe(0);
  loop.externalTick(25);
  expect(alphas.at(-1)).toBeCloseTo(0.25);
  loop.externalTick(50);
  expect(dts).toEqual([1 / 60, 1 / 30]);
  expect(alphas.at(-1)).toBe(0);
  loop.externalTick((1000 / 120) * 7);
  expect(alphas.at(-1)).toBeCloseTo(0.5);
  expect(alphas.every((a) => a >= 0 && a < 1)).toBe(true);
});
