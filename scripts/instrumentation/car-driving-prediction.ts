import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { CAR_DRIVING_PROFILES, runCarDrivingCase } from "./car-driving-prediction-case.js";

const results = [];
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
for (const hz of [60, 30] as const)
  for (const profile of CAR_DRIVING_PROFILES) {
    const a = await runCarDrivingCase(hz, profile),
      b = await runCarDrivingCase(hz, profile);
    if (hash(a) !== hash(b)) throw Error(`Non-repeatable ${hz}/${profile}`);
    results.push({ ...a, repeatIdentical: true, traceHash: hash(a) });
  }
console.table(results.map((r) => ({ serverHz: r.serverHz, profile: r.profile, ...r.summary })));
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
if (output)
  await writeFile(
    output,
    `${JSON.stringify(
      {
        scope:
          "Four seconds of native clear-ground driving; 30/60Hz authority, 120Hz controlled presentation. No browser, GPU, timers or physical display measurement.",
        results,
      },
      null,
      2,
    )}\n`,
  );
if (process.argv.includes("--assert-continuous"))
  for (const result of results)
    if (
      result.summary.maxReconcileShiftPx > 0.001 ||
      result.summary.maxWorldStepPx - result.summary.minWorldStepPx > 0.001
    )
      throw Error(`Driving discontinuity: ${result.serverHz}/${result.profile}`);
