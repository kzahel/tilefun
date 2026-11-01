import { afterEach, expect, it, vi } from "vitest";
import { OrderedLatency } from "./OrderedLatency.js";

afterEach(() => vi.useRealTimers());
it("preserves order through changing jitter/delay, bounds memory and cancels delivery", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const seen: number[] = [];
  const queue = new OrderedLatency<number>((value) => seen.push(value));
  queue.delayMs = 100;
  queue.jitterMs = 20;
  for (let i = 0; i < 10; i++) queue.push(i, 100);
  queue.delayMs = 0;
  queue.jitterMs = 0;
  queue.push(10, 100);
  vi.advanceTimersByTime(200);
  expect(seen).toEqual(Array.from({ length: 11 }, (_, i) => i));
  queue.delayMs = 100;
  queue.push(12, 10 * 1024 * 1024);
  expect(() => queue.push(13, 10 * 1024 * 1024)).toThrow("bound");
  queue.close();
  vi.advanceTimersByTime(200);
  expect(seen).toHaveLength(11);
  expect(queue.pending).toBe(0);
});
