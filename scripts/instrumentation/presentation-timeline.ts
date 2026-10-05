import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { PRESENTATION_CASES, runPresentationCase } from "./presentation-timeline-case.js";

const results = PRESENTATION_CASES.map((config) => {
  const a = runPresentationCase(config),
    b = runPresentationCase(config);
  if (JSON.stringify(a) !== JSON.stringify(b)) throw Error("Nonrepeatable presentation trace");
  return { ...a, repeatIdentical: true };
});
const report = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope:
    "Analytic 192px/s authority, one idle rider, ordered binary snapshots, production replica/predictor/GameLoop/interpolation/camera/projection, injected timestamps; one late snapshot vs on-time control. No browser, renderer, Realm, wall-time timers or visual judgment.",
  results,
};
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.table(
  results.map(({ serverHz, renderHz, lateSnapshot, summary }) => ({
    serverHz,
    renderHz,
    lateSnapshot,
    ...summary,
  })),
);
if (
  process.argv.includes("--assert-continuous") &&
  results.some(
    (r) =>
      r.summary.maxWorldStepErrorPx > 0.05 ||
      r.summary.maxScreenStepPx > 1 ||
      r.summary.roofOffsetRangePx > 0.001,
  )
)
  throw Error("Presentation continuity failure; inspect trace");
