import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** Includes committed and in-flight executable inputs, excludes unrelated docs. */
export function sourceFingerprint() {
  const paths = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "src",
      "scripts",
      "public",
      "package.json",
      "package-lock.json",
      "vite.config.ts",
    ],
    { encoding: "utf8" },
  );
  const hash = createHash("sha256");
  for (const path of [...new Set(paths.split("\0").filter(Boolean))].sort()) {
    hash.update(path).update("\0");
    try {
      hash.update(readFileSync(path));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      hash.update("<deleted>");
    }
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function planMatrix(targets, repeats) {
  const cases = targets.flatMap((target) =>
    ["throughput", "responsive"].flatMap((pacing) =>
      ["canvas", "gpu"].map((renderer) => ({ target, pacing, renderer })),
    ),
  );
  return Array.from({ length: repeats }, (_, i) =>
    (i % 2 ? [...cases].reverse() : cases).map((c) => ({
      ...c,
      repeat: i + 1,
      id: `${c.target}-${c.renderer}-${c.pacing}-r${i + 1}`,
    })),
  ).flat();
}

function pick(value, keys) {
  return Object.fromEntries(
    keys.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]]),
  );
}

/** Allowlist only: raw host diagnostics contain private world IDs. */
export function sanitizeReport(report) {
  return {
    ...pick(report, [
      "revision",
      "dirty",
      "date",
      "platform",
      "cpu",
      "device",
      "browser",
      "headed",
      "input",
      "renderer",
      "terrainPacing",
      "diagnosticUncachedImageSizes",
      "noclip",
      "meshes",
      "motionZooms",
      "movementSeconds",
      "settleSeconds",
      "warmSeconds",
      "viewport",
    ]),
    fixtures: report.fixtures.map((f) => ({
      ...pick(f, ["version", "zoom", "displayCadenceMs", "failures"]),
      pageErrorCount: f.errors.length,
      ...(f.thermals
        ? {
            thermals: {
              ...pick(f.thermals, ["gateMaxBatteryC"]),
              before: pick(f.thermals.before, ["batteryC", "thermalStatus"]),
              after: pick(f.thermals.after, ["batteryC", "thermalStatus"]),
            },
          }
        : {}),
      arrival: pick(f.arrival, ["x", "y", "generation"]),
      display: pick(f.display, ["viewport", "canvas", "devicePixelRatio"]),
      samples: f.samples.map((s) => ({
        ...pick(s, [
          "name",
          "zoom",
          "terrainPacing",
          "frames",
          "renderMs",
          "updateMs",
          "cadenceMs",
          "displayCadenceMs",
          "framesOverDisplayCadence",
          "framesOverCadence",
          "framesOver25Ms",
          "framesOver50Ms",
          "renderedFrames",
          "elapsedMs",
          "travelledPx",
          "maxStationaryMs",
          "displacement",
          "missingDataFrames",
          "incompleteCacheFrames",
          "staleCacheFrames",
          "maxIncomplete",
          "longestGapFrames",
          "firstReadyFrame",
          "finalMissing",
          "finalIncomplete",
          "finalStale",
          "settled",
          "maxTerrainRows",
          "totalTerrainRows",
          "peakPending",
          "textureUploadedBytes",
          "vertexUploadedBytes",
          "drawCalls",
          "maxLoaded",
          "entities",
          "props",
        ]),
        before: pick(s.before, ["wx", "wy"]),
        after: pick(s.after, ["wx", "wy"]),
        cache: {
          ...pick(s.cache, [
            "resident",
            "building",
            "pending",
            "oldestMs",
            "rowsLastFrame",
            "surfaceBytes",
          ]),
          ...(s.cache?.gpu
            ? {
                gpu: pick(s.cache.gpu, [
                  "textureBytes",
                  "textures",
                  "uploads",
                  "uploadedBytes",
                  "vertexUploadedBytes",
                  "drawCalls",
                  "recoveries",
                ]),
              }
            : {}),
        },
      })),
    })),
  };
}

const n = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : "—");
export function markdownReport(matrix) {
  const lines = [
    "# Renderer performance matrix",
    "",
    `Source fingerprint: \`${matrix.fingerprint}\`. ${matrix.runs.length}/${matrix.plan.length} configurations recorded.`,
    "",
    "Sequential real-game runs; each zoom starts in a fresh seeded world. Motion uses noclip and a fixed wall duration. Misses are rAF intervals >1.5× the idle-page display cadence, not hardware presentation counts. Compare within device and zoom. Every repeat is shown separately; percentiles are not averaged. A failed row remains evidence, not a passed result.",
    "",
    "| Device | Renderer | Pacing | Repeat | Zoom | Motion p95 / p99 ms | Misses / samples | Data-gap / terrain-gap frames | Travel px | Entry / recovery s | Result |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const run of matrix.runs) {
    if (!run.report) {
      lines.push(
        `| ${run.target} | ${run.renderer} | ${run.pacing} | ${run.repeat} | — | — | — | — | — | — | ${run.status} |`,
      );
      continue;
    }
    for (const f of run.report.fixtures) {
      const motion = f.samples.find((s) => s.name === "motion");
      const entry = f.samples.find((s) => s.name === "entry-catchup");
      const recovery = f.samples.find((s) => s.name === "recovery-catchup");
      const time = (s) => (s ? `${n(s.elapsedMs / 1000)}${s.settled ? "" : " (timeout)"}` : "—");
      const complete = [
        "entry-catchup",
        "stationary",
        "motion",
        "recovery-catchup",
        "recovery-warm",
      ].every((name) => f.samples.some((s) => s.name === name));
      const status =
        f.failures?.length || f.pageErrorCount
          ? "FAIL"
          : complete && ["passed", "failed"].includes(run.status)
            ? "pass"
            : "incomplete";
      lines.push(
        `| ${run.target} | ${run.renderer} | ${run.pacing} | ${run.repeat} | ${f.zoom} | ${n(motion?.frames.p95)} / ${n(motion?.frames.p99)} | ${motion?.framesOverDisplayCadence ?? "—"} / ${motion?.frames.count ?? "—"} | ${motion?.missingDataFrames ?? "—"} / ${motion?.incompleteCacheFrames ?? "—"} | ${n(motion?.travelledPx, 0)} | ${time(entry)} / ${time(recovery)} | ${status} |`,
      );
    }
  }
  lines.push(
    "",
    "## Stationary cost and recovery reuse",
    "",
    "| Device | Renderer | Pacing | Repeat | Zoom | Stationary render p95 ms | Recovery render p95 ms | Recovery raster rows | Recovery texture MiB |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const run of matrix.runs)
    for (const f of run.report?.fixtures ?? []) {
      const a = f.samples.find((s) => s.name === "stationary"),
        b = f.samples.find((s) => s.name === "recovery-warm");
      lines.push(
        `| ${run.target} | ${run.renderer} | ${run.pacing} | ${run.repeat} | ${f.zoom} | ${n(a?.renderMs.p95)} | ${n(b?.renderMs.p95)} | ${b?.totalTerrainRows ?? "—"} | ${b?.textureUploadedBytes == null ? "—" : n(b.textureUploadedBytes / 2 ** 20, 2)} |`,
      );
    }
  lines.push(
    "",
    "See matrix.json for per-stage readiness, stale replacements, surface memory, uploads, frame counts, device viewports and validation failures. Raw reports/logs remain in each run directory and may contain private world IDs. Entry is post-ready, not navigation cold start.",
    "",
  );
  return lines.join("\n");
}
