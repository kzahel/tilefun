import { expect, it } from "vitest";
import { PerformanceMetrics } from "./PerformanceMetrics.js";

it("keeps bounded samples while preserving lifetime totals and extrema", () => {
  const metrics = new PerformanceMetrics();
  metrics.record("disabled", 1);
  expect(metrics.snapshot()).toEqual({});
  metrics.enabled = true;
  metrics.record("work", 1000);
  for (let i = 0; i < 10000; i++) metrics.record("work", 2);
  expect(metrics.snapshot().work).toEqual({
    count: 10001,
    totalMs: 21000,
    maxMs: 1000,
    retained: 512,
    p50Ms: 2,
    p95Ms: 2,
    p99Ms: 2,
  });
  metrics.reset();
  expect(metrics.snapshot()).toEqual({});
});

it("retains a complete benchmark window and restores the live bound on ordinary reset", () => {
  const metrics = new PerformanceMetrics();
  metrics.enabled = true;
  metrics.reset(600);
  for (let i = 0; i < 600; i++) metrics.record("work", i);
  expect(metrics.snapshot().work).toMatchObject({ count: 600, retained: 600, p50Ms: 300 });
  metrics.reset();
  for (let i = 0; i < 600; i++) metrics.record("work", i);
  expect(metrics.snapshot().work).toMatchObject({ count: 600, retained: 512 });
  expect(() => metrics.reset(0)).toThrow();
  expect(() => metrics.reset(Infinity)).toThrow();
});
