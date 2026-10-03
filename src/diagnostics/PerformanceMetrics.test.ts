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
