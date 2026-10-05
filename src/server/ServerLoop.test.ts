import { afterEach, expect, it, vi } from "vitest";
import { ServerLoop } from "./ServerLoop.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each([30, 60, 120])("keeps %iHz wall-time cadence with integer timer delays", (hz) => {
  vi.useFakeTimers();
  const ticks: { at: number; dt: number }[] = [];
  const loop = new ServerLoop((dt) => ticks.push({ at: performance.now(), dt }), hz);
  loop.start();
  loop.start();
  vi.advanceTimersByTime(10_000);
  // Fractional deadlines can differ by floating-point rounding at the endpoint,
  // but not accumulate clock drift (the former 60Hz interval produced 625 ticks).
  expect(ticks.length).toBeGreaterThanOrEqual(hz * 10 - 1);
  expect(ticks.length).toBeLessThanOrEqual(hz * 10);
  ticks.forEach((tick, i) => {
    expect(tick.dt).toBe(1 / hz);
    expect(tick.at - ((i + 1) * 1000) / hz).toBeGreaterThanOrEqual(-0.000001);
    expect(tick.at - ((i + 1) * 1000) / hz).toBeLessThanOrEqual(1.000001);
  });
  loop.stop();
  expect(vi.getTimerCount()).toBe(0);
});

/** Drive a late OS timer while performance.now measures the actual wake. */
function lateClock(hz = 60) {
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const tick = vi.fn();
  const loop = new ServerLoop(tick, hz);
  loop.start();
  return {
    loop,
    tick,
    wake(at: number) {
      now = at;
      vi.advanceTimersToNextTimer();
    },
  };
}

it("catches up delayed wakes without shifting subsequent deadlines", () => {
  const { loop, tick, wake } = lateClock();
  wake(50);
  expect(tick).toHaveBeenCalledTimes(3);
  wake(66);
  expect(tick).toHaveBeenCalledTimes(3);
  wake(67);
  expect(tick).toHaveBeenCalledTimes(4);
  expect(tick.mock.calls.every(([dt]) => dt === 1 / 60)).toBe(true);
  loop.stop();
});

it("bounds long stalls and drops debt instead of replaying hidden time", () => {
  const { loop, tick, wake } = lateClock();
  wake(10_000);
  expect(tick.mock.calls.length).toBeGreaterThanOrEqual(14);
  expect(tick.mock.calls.length).toBeLessThanOrEqual(15);
  const count = tick.mock.calls.length;
  wake(10_017);
  expect(tick).toHaveBeenCalledTimes(count + 1);
  loop.stop();
});

it.each([30, 60, 120])("caps catch-up simulation time at 250ms at %iHz", (hz) => {
  const { loop, tick, wake } = lateClock(hz);
  wake(250 + 1000 / hz + 0.1);
  const simulated = tick.mock.calls.reduce((sum, [dt]) => sum + dt, 0);
  expect(simulated).toBeLessThanOrEqual(0.250001);
  expect(simulated).toBeGreaterThanOrEqual(0.25 - 1 / hz - 0.000001);
  loop.stop();
});

it("starts fresh on visibility stop/resume with no hidden-time catch-up", () => {
  const { loop, tick, wake } = lateClock();
  wake(17);
  loop.stop();
  wake(10_000);
  expect(tick).toHaveBeenCalledTimes(1);
  loop.start();
  wake(10_016);
  expect(tick).toHaveBeenCalledTimes(1);
  wake(10_017);
  expect(tick).toHaveBeenCalledTimes(2);
  loop.stop();
});

it("accounts for callback work without adding its duration to every interval", () => {
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const tick = vi.fn(() => {
    now += 5;
  });
  const loop = new ServerLoop(tick);
  loop.start();
  for (let i = 1; i <= 120; i++) {
    now = Math.ceil((i * 1000) / 60) + 1;
    vi.advanceTimersToNextTimer();
  }
  expect(tick).toHaveBeenCalledTimes(120);
  loop.stop();
});

it("changes 60→30→60Hz inside callbacks without extra old-rate catch-up or duplicate timers", () => {
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const dts: number[] = [];
  const loop = new ServerLoop((dt) => {
    dts.push(dt);
    if (dts.length === 1) loop.setTickRate(30);
    if (dts.length === 2) loop.setTickMs(1000 / 60);
  });
  loop.start();
  now = 100;
  vi.advanceTimersToNextTimer();
  expect(dts).toEqual([1 / 60]);
  expect(vi.getTimerCount()).toBe(1);
  now = 134;
  vi.advanceTimersToNextTimer();
  expect(dts).toEqual([1 / 60, 1 / 30]);
  expect(vi.getTimerCount()).toBe(1);
  now = 151;
  vi.advanceTimersToNextTimer();
  expect(dts).toEqual([1 / 60, 1 / 30, 1 / 60]);
  loop.stop();
});

it("can stop or stop/restart inside a tick without retaining the old timer generation", () => {
  vi.useFakeTimers();
  const tick = vi.fn(() => {
    loop.stop();
    if (tick.mock.calls.length === 1) loop.start();
  });
  const loop = new ServerLoop(tick);
  loop.start();
  vi.advanceTimersByTime(17);
  expect(tick).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(17);
  expect(tick).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("reports tick errors and honors a lifecycle stop from the error handler", () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("tick failure");
  const onError = vi.fn(() => loop.stop());
  const loop = new ServerLoop(
    () => {
      throw error;
    },
    60,
    onError,
  );
  loop.start();
  vi.advanceTimersByTime(100);
  expect(onError).toHaveBeenCalledExactlyOnceWith(error);
  expect(vi.getTimerCount()).toBe(0);
});

it("continues the same schedule after a recoverable tick error", () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const tick = vi.fn(() => {
    if (tick.mock.calls.length === 1) throw new Error("recoverable");
  });
  const onError = vi.fn();
  const loop = new ServerLoop(tick, 60, onError);
  loop.start();
  vi.advanceTimersByTime(101);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(tick).toHaveBeenCalledTimes(6);
  loop.stop();
});
