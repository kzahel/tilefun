import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { CAMERA_CONTROLS, CAMERA_FAULT_CASES, compareCameraBasics } from "./camera-basics-case.js";

const results = [...CAMERA_CONTROLS, ...CAMERA_FAULT_CASES].map((config) => {
  const a = compareCameraBasics(config);
  if (JSON.stringify(a) !== JSON.stringify(compareCameraBasics(config)))
    throw Error("Nonrepeatable camera trace");
  return { ...a, repeatIdentical: true };
});
const report = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope:
    "Four rider-free numeric fixtures: remote train locked/smoothed camera and local 768px/s player with/without noclip. Explicit clocks, real codec/replica/predictor/GameLoop/camera/projection. Delivery gaps model delayed consumption, not skipped authority simulation. Render gaps model absent callbacks, not allocation/GC measurement. No Realm, renderer, browser or reconciliation.",
  results,
};
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.table(results.map(({ config, summary }) => ({ ...config, ...summary })));
if (
  process.argv.includes("--assert-continuous") &&
  results.some(
    (r) =>
      r.config.fault !== "render-gap-600ms" &&
      (r.summary.maxWorldStepErrorPx > 0.05 ||
        r.summary.maxWorldDeviationPx > 0.05 ||
        r.summary.maxCameraDeviationPx > 0.05),
  )
) {
  throw Error("Basic presentation continuity failure; inspect numeric trace");
}
