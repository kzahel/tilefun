import assert from "node:assert/strict";
import test from "node:test";
import { markdownReport, planMatrix, sanitizeReport } from "./streaming-matrix-lib.mjs";

test("matrix covers every pair twice and reverses the second repeat", () => {
  const plan = planMatrix(["desktop", "phone"], 2);
  assert.equal(plan.length, 16);
  assert.equal(new Set(plan.map((p) => p.id)).size, 16);
  const shape = (r) => `${r.target}/${r.renderer}/${r.pacing}`;
  assert.deepEqual(plan.slice(0, 8).map(shape), plan.slice(8).map(shape).reverse());
  for (const target of ["desktop", "phone"])
    for (const renderer of ["canvas", "gpu"])
      for (const pacing of ["throughput", "responsive"])
        assert.equal(
          plan.filter((r) => r.target === target && r.renderer === renderer && r.pacing === pacing)
            .length,
          2,
        );
});

function raw() {
  return {
    renderer: "gpu",
    privateValue: "secret",
    fixtures: [
      {
        version: "current",
        zoom: 0.1,
        displayCadenceMs: 8.33,
        failures: ["entry-catchup: timeout"],
        errors: ["secret URL"],
        arrival: { x: 300, y: 519 },
        display: { canvas: { width: 1280, height: 900 }, secret: "secret" },
        samples: [
          {
            name: "motion",
            frames: { count: 100, p95: 33, p99: 50 },
            renderMs: { p95: 10 },
            framesOverDisplayCadence: 40,
            framesOverCadence: 0,
            missingDataFrames: 1,
            incompleteCacheFrames: 2,
            travelledPx: 800,
            host: { worldId: "secret" },
            before: { wx: 1, wy: 2, secret: "secret" },
            cache: { resident: 100, gpu: { uploadedBytes: 42, secret: "secret" } },
          },
        ],
      },
    ],
  };
}

test("sanitizer excludes raw messages, host IDs and unknown nested fields", () => {
  const report = sanitizeReport(raw());
  assert.equal(JSON.stringify(report).includes("secret"), false);
  assert.equal(report.fixtures[0].pageErrorCount, 1);
  assert.equal(report.fixtures[0].samples[0].cache.gpu.uploadedBytes, 42);
});

test("table retains failed fixtures and uses calibrated display misses", () => {
  const text = markdownReport({
    fingerprint: "test",
    plan: [{}, {}],
    runs: [
      {
        target: "desktop",
        renderer: "gpu",
        pacing: "responsive",
        repeat: 1,
        status: "failed",
        report: sanitizeReport(raw()),
      },
      {
        target: "phone",
        renderer: "canvas",
        pacing: "throughput",
        repeat: 1,
        status: "interrupted",
      },
    ],
  });
  assert.match(text, /40 \/ 100/);
  assert.match(text, /FAIL/);
  assert.match(text, /interrupted/);
  assert.doesNotMatch(text, /secret/);
});
