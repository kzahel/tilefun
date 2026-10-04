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
        thermals: {
          before: { batteryC: 29, thermalStatus: 0, deviceId: "secret" },
          after: { batteryC: 30, thermalStatus: 0 },
          gateMaxBatteryC: 31,
          secret: "secret",
        },
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

test("Android thermal gate parses exact readings and fails closed on missing values", async () => {
  const { parseAndroidThermals } = await import("./android-thermal-gate.mjs");
  assert.deepEqual(parseAndroidThermals("  temperature: 287", "Thermal Status: 0"), {
    batteryC: 28.7,
    thermalStatus: 0,
  });
  assert.throws(() => parseAndroidThermals("unavailable", "Thermal Status: 0"));
  assert.throws(() => parseAndroidThermals("  temperature: 287", "unavailable"));
});

test("CPU profile summary excludes origins and weights sampled functions", async () => {
  const { summarizeCpuProfile } = await import("./streaming-profile.mjs");
  const result = summarizeCpuProfile({
    nodes: [
      {
        id: 1,
        callFrame: {
          url: "http://private/src/rendering/Draw.ts?token=secret",
          functionName: "draw",
        },
      },
    ],
    samples: [1, 1],
    timeDeltas: [1000, 2000],
  });
  assert.deepEqual(result, [{ functionName: "/src/rendering/Draw.ts:draw", selfMs: 3 }]);
});

test("uncached GPU control fails closed when the production branch changes", async () => {
  const { disableImageDimensionCache } = await import("./streaming-dimension-control.mjs");
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../src/rendering/GpuRasterSurface.ts", import.meta.url),
    "utf8",
  );
  assert.match(disableImageDimensionCache(source), /if \(false\) \{/);
  assert.throws(() => disableImageDimensionCache("unexpected source"));
  assert.throws(() => disableImageDimensionCache(source + source));
});
