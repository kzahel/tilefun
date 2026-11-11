// CPU/source attribution of an already-captured window; never influences timing.
import { readFile, writeFile } from "node:fs/promises";
import { SourceMap } from "node:module";
import path from "node:path";
import { analyzeDrivingTrace } from "./driving/trace.mjs";

const option = (key, fallback) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const input = option("report", "");
if (!input)
  throw Error("Use --report=<driving.json> [--maps=dist/assets] [--output=<summary.json>]");
const output = option("output", input.replace(/\.json$/, ".attribution.json"));
if (path.resolve(output) === path.resolve(input))
  throw Error("Keep the input report and attribution output separate");
const directory = path.dirname(input),
  maps = path.resolve(option("maps", "dist/assets"));
const report = JSON.parse(await readFile(input, "utf8")),
  sources = new Map();
async function loadMap(url) {
  if (!url || sources.has(url)) return;
  const file = path.join(maps, `${path.basename(new URL(url).pathname)}.map`);
  try {
    sources.set(url, new SourceMap(JSON.parse(await readFile(file, "utf8"))));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    sources.set(url, null);
  }
}
const location = (frame) => {
  const entry = sources.get(frame.url)?.findEntry(frame.lineNumber, frame.columnNumber);
  if (entry?.originalSource) {
    // Vite's repo/library source paths stay valid when maps are archived elsewhere.
    const original = entry.originalSource.replaceAll("\\", "/");
    const source = original.match(/(?:^|\/)((?:src|node_modules)\/.*)$/)?.[1] ?? original;
    return {
      function: entry.name || frame.functionName,
      source,
      line: entry.originalLine + 1,
    };
  }
  return {
    function: frame.functionName,
    ...(frame.url ? { source: new URL(frame.url).pathname, line: frame.lineNumber + 1 } : {}),
  };
};
const cells = [];
for (const cell of report.cells) {
  if (!cell.diagnostic?.trace) continue;
  const trace = JSON.parse(
    await readFile(path.join(directory, cell.diagnostic.trace.file), "utf8"),
  );
  const cpu = cell.diagnostic.profile
    ? JSON.parse(await readFile(path.join(directory, cell.diagnostic.profile.file), "utf8"))
    : undefined;
  for (const url of new Set([
    ...(cpu?.nodes.map((n) => n.callFrame.url) ?? []),
    ...trace.traceEvents.filter((e) => e.name === "FunctionCall").map((e) => e.args?.data?.url),
  ]))
    await loadMap(url);
  const analysis = analyzeDrivingTrace(cell, trace.traceEvents, cpu, location);
  cells.push({
    fixture: cell.fixture,
    trial: cell.trial,
    qualification: cell.qualification,
    ...analysis,
  });
  console.log(
    `${cell.fixture} trial ${cell.trial + 1}: ${analysis.frames.length} missed intervals, ${analysis.mainGc.length} main-thread GC slices`,
  );
  for (const frame of analysis.frames) {
    console.log(
      `  at ${frame.atMs} ms: ${frame.frameMs} ms; main task wall ${frame.interval.mainTaskWallMs} ms, GC ${frame.interval.mainGcWallMs} ms`,
    );
    console.log(
      JSON.stringify(
        {
          main: frame.interval.main.slice(0, 5),
          self: frame.interval.profile?.self.slice(0, 8),
          gpu: frame.interval.gpu.slice(0, 3),
        },
        null,
        2,
      ),
    );
  }
}
if (!cells.length)
  throw Error("No captured trace cells; run driving:bench with --trace [--profile]");
await writeFile(
  output,
  `${JSON.stringify({ description: "Temporal correlations, not automatic causal labels. Nested synchronous durations use interval unions; profile weights estimate sampled wall time, not exact CPU time. Context includes one idle cadence interval on either side.", cells }, null, 2)}\n`,
);
console.log(`Attribution: ${output}`);
