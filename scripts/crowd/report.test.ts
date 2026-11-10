import assert from "node:assert/strict";
import { test } from "node:test";
import { assertComparable, compareOutcome, comparisonIssues, summarize } from "./report.js";

const report = {
  schemaVersion: 2,
  lane: "authority",
  workload: { rabbits: 1000, cars: 50, warmup: 180, ticks: 600 },
  environment: { node: "test", cpu: "test" },
  instrumentation: { profile: false },
  source: "before",
};
test("comparisons permit source changes but reject different workloads and measurement modes", () => {
  const nextSource = { ...report, source: "after" };
  assert.deepEqual(comparisonIssues(nextSource, report), []);
  for (const changed of [
    { schemaVersion: 1 },
    { lane: "render" },
    { workload: { ...report.workload, ticks: 300 } },
    { environment: { node: "other" } },
    { instrumentation: { profile: true } },
  ]) {
    assert.throws(() => assertComparable({ ...report, ...changed }, report, false), /Incompatible/);
    assert.equal(assertComparable({ ...report, ...changed }, report, true).length, 1);
  }
});
test("all samples contribute to percentile and count summaries", () => {
  const values = Array.from({ length: 600 }, (_, i) => i);
  assert.deepEqual(summarize(values), {
    count: 600,
    totalMs: 179700,
    mean: 299.5,
    p50: 300,
    p95: 570,
    p99: 594,
    max: 599,
  });
  assert.throws(() => summarize([]), /empty/);
});

test("equivalence assertions fail closed on changed or missing outcomes", () => {
  assert.equal(compareOutcome({ digest: "a" }, { digest: "a" }, true), true);
  assert.equal(compareOutcome({ digest: "a" }, { digest: "b" }, false), false);
  assert.throws(() => compareOutcome({ digest: "a" }, { digest: "b" }, true), /outcomes differ/);
  assert.throws(() => compareOutcome({ digest: "a" }, undefined, true), /missing/);
});
