// Native Node wall-time cadence; no world, replica, render or timer substitution.
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { ServerLoop } from "../../src/server/ServerLoop.js";

const results = [];
for (const hz of [30, 60, 120]) {
  const samples: { atMs: number; dt: number }[] = [];
  const start = performance.now();
  const loop = new ServerLoop((dt) => samples.push({ atMs: performance.now() - start, dt }), hz);
  loop.start();
  try {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } finally {
    loop.stop();
  }
  const elapsedMs = performance.now() - start;
  const expectedTicks = Math.floor((elapsedMs * hz) / 1000);
  const lateness = samples.map((s, i) => s.atMs - ((i + 1) * 1000) / hz).sort((a, b) => a - b);
  results.push({
    hz,
    elapsedMs,
    ticks: samples.length,
    expectedTicks,
    // First/last completed ticks avoid counting the final pending deadline as
    // a whole tick of drift in this short capture. Keep endpoint counts too.
    observedHz:
      ((samples.length - 1) * 1000) / ((samples.at(-1)?.atMs ?? 0) - (samples[0]?.atMs ?? 0)),
    minDeadlineLatenessMs: lateness[0],
    p95DeadlineLatenessMs: lateness[Math.floor(lateness.length * 0.95)],
    maxDeadlineLatenessMs: lateness.at(-1),
    samples,
  });
  if (
    Math.abs(samples.length - expectedTicks) > 1 ||
    samples.some((s) => s.dt !== 1 / hz) ||
    (lateness[0] ?? -1) < 0
  )
    throw Error(`Clock cadence drift at ${hz}Hz`);
}
const report = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope:
    "Production ServerLoop, native Node timers/monotonic time; 5s per 30/60/120Hz rate; requires fixed physics dt and within one wall-time tick; no browser or world inference",
  results,
};
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.table(results.map(({ samples: _, ...summary }) => summary));
