import assert from "node:assert/strict";
import { test } from "node:test";
import { assertComparable, qualify, summarize } from "./report.mjs";

const state = { tick: 180, x: 0, y: 32, speed: 0, seated: true, vehicles: 1 };
const sample = () => ({
  start: { ...state },
  end: { ...state, tick: 1980, x: 3300 },
  checkpoints: [],
  distance: 3300,
  maxLateral: 0,
  physics: { collision: { wheelQueries: 8000 } },
  physicsBefore: { collision: { wheelQueries: 720 } },
});
test("qualifies actual simulated progress and rejects blocked clear runs, empty jams and wrong populations", () => {
  assert.equal(qualify("clear", sample()).valid, true);
  const blocked = sample();
  blocked.end.x = 100;
  assert.equal(qualify("clear", blocked).valid, false);
  const lost = sample();
  lost.end.vehicles = 2;
  assert.equal(qualify("clear", lost).valid, false);
  const stalled = sample();
  stalled.end.tick = state.tick;
  assert.equal(qualify("clear", stalled).valid, false);
  const jam = sample();
  jam.start.vehicles = jam.end.vehicles = 37;
  jam.end.x = 235;
  jam.end.poses = Array.from({ length: 32 }, (_, i) => ({ name: `queue:${i}`, speed: 0 }));
  assert.equal(qualify("jam", jam).valid, true);
  jam.end.speed = 20;
  assert.equal(qualify("jam", jam).valid, false);
  jam.end.speed = 0;
  jam.end.poses.forEach((p) => {
    p.speed = 20;
  });
  assert.equal(qualify("jam", jam).valid, false);
  jam.end.poses.forEach((p) => {
    p.speed = 0;
  });
  jam.end.x = 0;
  assert.equal(qualify("jam", jam).valid, false);
});
test("comparisons reject changed workloads, instrumentation and materially different work", () => {
  const report = () => ({
    schemaVersion: 1,
    browser: "Chromium test",
    headed: true,
    seconds: 30,
    runtime: "production origin",
    device: { width: 411, height: 789 },
    fixtures: ["clear"],
    zoomOverride: "",
    errors: [],
    cells: [
      {
        fixture: "clear",
        trial: 0,
        recipeSha256: "recipe",
        distance: 3300,
        qualification: { valid: true, ticks: 1800 },
        start: { poses: [] },
      },
    ],
  });
  assert.doesNotThrow(() => assertComparable(report(), report()));
  for (const mutate of [
    (r) => (r.headed = false),
    (r) => (r.allocationSampled = true),
    (r) => (r.cells[0].recipeSha256 = "changed"),
    (r) => (r.cells[0].qualification.valid = false),
    (r) => (r.cells[0].qualification.ticks = 800),
    (r) => (r.cells[0].distance = 1000),
    (r) => r.cells[0].start.poses.push({ name: "extra", x: 0, y: 0, z: 0 }),
  ]) {
    const changed = report();
    mutate(changed);
    assert.throws(() => assertComparable(report(), changed));
  }
  assert.deepEqual(summarize([1, 2, 3, 100]), { count: 4, p50: 3, p95: 100, p99: 100, max: 100 });
});
