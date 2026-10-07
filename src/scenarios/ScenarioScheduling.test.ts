import { afterEach, expect, it, vi } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import type { ScenarioResponse } from "./ScenarioProtocol.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { ScenarioWorkerHost } from "./ScenarioWorkerHost.js";

const recipe: ScenarioRecipe = {
  version: 1,
  id: "authority-clock",
  generation: FLAT_SCENARIO,
  player: createPlayer(0, 0),
  props: [],
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const frame = (responses: ScenarioResponse[]) =>
  responses
    .flatMap((r) => r.frames)
    .map(decodeServerMessage)
    .filter((m) => m.type === "frame")
    .at(-1);

it("ticks independently of inputs and output pressure without awaiting a ready view", async () => {
  const responses: ScenarioResponse[] = [];
  let writable = true;
  const host = new ScenarioWorkerHost(
    (r) => responses.push(r),
    () => writable,
  );
  await host.request({ id: 1, kind: "open", recipe, mode: "realtime" });
  const ready = vi
    .spyOn(ScenarioSession.prototype, "ready")
    .mockRejectedValue(Error("must not wait"));
  vi.useFakeTimers();
  try {
    await host.request({ id: 2, kind: "clock", running: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(frame(responses)?.simulationTime).toBeCloseTo(1, 1);
    expect(ready).not.toHaveBeenCalled();
    const ticks = responses.at(-1)?.clock?.ticks ?? 0;
    // Several commands in one arrival are input time, never extra world ticks.
    for (let seq = 1; seq <= 4; seq++)
      host.input(
        encodeClientMessage({
          type: "player-input",
          seq,
          dx: 1,
          dy: 0,
          jump: false,
          sprinting: false,
          dtMs: 16.667,
        }),
      );
    await vi.advanceTimersByTimeAsync(1);
    expect(responses.at(-1)?.clock?.ticks).toBe(ticks);
    await vi.advanceTimersByTimeAsync(20);
    expect(frame(responses)?.lastProcessedInputSeq).toBe(4);
    expect((responses.at(-1)?.clock?.ticks ?? 0) - ticks).toBeLessThanOrEqual(2);
    writable = false;
    const delivered = responses.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(responses).toHaveLength(delivered);
    writable = true;
    await vi.advanceTimersByTimeAsync(20);
    expect(frame(responses)?.simulationTime).toBeGreaterThan(2);
    expect((responses.at(-1)?.clock?.ticks ?? 0) - ticks).toBeGreaterThan(60);
    expect(
      (
        await host.request({
          id: 3,
          kind: "step",
          input: { dx: 0, dy: 0, jump: false, sprinting: false },
          dt: 1 / 60,
        })
      ).error,
    ).toContain("Pause authority");
  } finally {
    ready.mockRestore();
    await host.request({ id: 4, kind: "clock", running: false });
    vi.useRealTimers();
    await host.request({ id: 5, kind: "close" });
  }
});

it("fences awaited commands and pause/resume without replaying stopped time", async () => {
  const publish = vi.fn();
  const host = new ScenarioWorkerHost(publish);
  await host.request({ id: 1, kind: "open", recipe, mode: "realtime" });
  vi.useFakeTimers();
  try {
    await host.request({ id: 2, kind: "clock", running: true });
    await vi.advanceTimersByTimeAsync(20);
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const command = vi.spyOn(ScenarioSession.prototype, "command").mockImplementation(() => gate);
    const pending = host.request({
      id: 3,
      kind: "command",
      command: { kind: "teleport", position: { wx: 0, wy: 0 } },
    });
    await Promise.resolve();
    const ticks = publish.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(publish).toHaveBeenCalledTimes(ticks);
    // Visibility can change while an asynchronous control is still in flight.
    const pause = host.request({ id: 4, kind: "clock", running: false });
    finish();
    await pending;
    expect((await pause).clock?.running).toBe(false);
    await vi.advanceTimersByTimeAsync(10000);
    expect(publish).toHaveBeenCalledTimes(ticks);
    expect(vi.getTimerCount()).toBe(0);
    command.mockRestore();
    await host.request({ id: 5, kind: "clock", running: true });
    await vi.advanceTimersByTimeAsync(17);
    expect(publish).toHaveBeenCalledTimes(ticks + 1);
  } finally {
    await host.request({ id: 6, kind: "clock", running: false });
    vi.useRealTimers();
    await host.request({ id: 7, kind: "close" });
  }
});

it("closes the running clock and keeps manual sessions timer-free", async () => {
  const host = new ScenarioWorkerHost();
  await host.request({ id: 1, kind: "open", recipe });
  vi.useFakeTimers();
  expect((await host.request({ id: 2, kind: "clock", running: true })).error).toContain(
    "Manual scenario",
  );
  await vi.advanceTimersByTimeAsync(10000);
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  await host.request({ id: 3, kind: "close" });
  await host.request({ id: 4, kind: "open", recipe, mode: "realtime" });
  vi.useFakeTimers();
  await host.request({ id: 5, kind: "clock", running: true });
  expect(vi.getTimerCount()).toBe(1);
  await host.request({ id: 6, kind: "close" });
  expect(vi.getTimerCount()).toBe(0);
});

it("never restarts a partially replaced world after reload fails", async () => {
  const publish = vi.fn();
  const host = new ScenarioWorkerHost(publish);
  await host.request({ id: 1, kind: "open", recipe, mode: "realtime" });
  vi.useFakeTimers();
  try {
    await host.request({ id: 2, kind: "clock", running: true });
    await vi.advanceTimersByTimeAsync(20);
    vi.spyOn(ScenarioSession.prototype, "reload").mockRejectedValue(Error("replacement failed"));
    const response = await host.request({ id: 3, kind: "reload" });
    expect(response.error).toContain("replacement failed");
    const count = publish.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(publish).toHaveBeenCalledTimes(count);
    expect(vi.getTimerCount()).toBe(0);
    expect((await host.request({ id: 4, kind: "clock", running: true })).error).toContain(
      "authority failed",
    );
  } finally {
    vi.useRealTimers();
    await host.request({ id: 5, kind: "close" });
  }
});
