// Summarize a benchmark-streaming --trace-stage capture without publishing raw
// browser metadata. Times describe Chrome thread work, not GPU hardware counters.
import { readFile, writeFile } from "node:fs/promises";

const input = process.argv[2];
if (!input) throw Error("Usage: node scripts/analyze-streaming-trace.mjs TRACE.json [OUTPUT.json]");
const events = JSON.parse(await readFile(input, "utf8")).traceEvents;
const start = events.find((e) => e.name === "tilefun.sample.start");
const end = events.find((e) => e.name === "tilefun.sample.end");
if (!start || !end) throw Error("Missing Tilefun sample markers");
const threads = new Map(
  events
    .filter((e) => e.ph === "M" && e.name === "thread_name")
    .map((e) => [`${e.pid}:${e.tid}`, e.args.name]),
);
const complete = events.filter((e) => e.ph === "X" && e.ts < end.ts && e.ts + e.dur > start.ts);
const main = complete.filter((e) => e.pid === start.pid && e.tid === start.tid);
const tasks = main.filter((e) => e.name === "RunTask");
const gc = main.filter((e) => e.name === "MajorGC" || e.name === "MinorGC");
const gpu = complete.filter((e) => threads.get(`${e.pid}:${e.tid}`) === "CrGpuMain");
const requests = gpu.filter((e) => e.name === "GpuChannel::ExecuteDeferredRequest");
const rasters = gpu.filter((e) => e.name === "RasterDecoderImpl::DoEndRasterCHROMIUM");
const round = (n) => Math.round(n * 1000) / 1000;
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p) => round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0);
  return {
    count: sorted.length,
    totalMs: round(sorted.reduce((a, b) => a + b, 0)),
    p50Ms: q(0.5),
    p95Ms: q(0.95),
    maxMs: q(1),
  };
};
const durations = (es) => stats(es.map((e) => e.dur / 1000));
const frames = [];
const pending = new Map();
for (const event of events
  .filter((e) => e.name === "tilefun.frame" && e.pid === start.pid)
  .sort((a, b) => a.ts - b.ts)) {
  const id = JSON.stringify(event.id2);
  if (event.ph === "b") pending.set(id, event.ts);
  else if (event.ph === "e" && pending.has(id)) {
    frames.push({ start: pending.get(id), end: event.ts });
    pending.delete(id);
  }
}
const overlapping = (es, frame) => es.filter((e) => e.ts < frame.end && e.ts + e.dur > frame.start);
const maxDuration = (es, key = "dur") => round(Math.max(0, ...es.map((e) => (e[key] ?? 0) / 1000)));
const summary = {
  schema: "tilefun-streaming-trace/v1",
  durationMs: round((end.ts - start.ts) / 1000),
  frameIntervals: stats(frames.map((f) => (f.end - f.start) / 1000)),
  mainThreadTasks: durations(tasks),
  mainThreadGC: durations(gc),
  gpuProcessRequests: durations(requests),
  gpuProcessRequestCpu: stats(
    requests.filter((e) => e.tdur !== undefined).map((e) => e.tdur / 1000),
  ),
  rasterBatchCount: rasters.length,
  slowFrames: frames.flatMap((frame, index) =>
    frame.end - frame.start > 25000
      ? [
          {
            index,
            startMs: round((frame.start - start.ts) / 1000),
            intervalMs: round((frame.end - frame.start) / 1000),
            overlappingMainTaskMaxMs: maxDuration(overlapping(tasks, frame)),
            overlappingMainGcMaxMs: maxDuration(overlapping(gc, frame)),
            overlappingGpuRequestMaxMs: maxDuration(overlapping(requests, frame)),
            overlappingGpuRequestCpuMaxMs: maxDuration(overlapping(requests, frame), "tdur"),
          },
        ]
      : [],
  ),
  rasterBatchesPerSecond: Array.from(
    { length: Math.ceil((end.ts - start.ts) / 1000000) },
    (_, second) => ({
      second,
      count: rasters.filter(
        (e) => e.ts >= start.ts + second * 1000000 && e.ts < start.ts + (second + 1) * 1000000,
      ).length,
    }),
  ),
};
const json = `${JSON.stringify(summary, null, 2)}\n`;
if (process.argv[3]) await writeFile(process.argv[3], json);
else process.stdout.write(json);
