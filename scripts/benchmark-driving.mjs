// Fixed clear-road and native queued-traffic workloads, on the shared lab/game
// Worker, predictor and renderer. Each cell gets a fresh world and GPU caches.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { openCdpTab } from "./cdp-tab.mjs";
import { drivingCapture } from "./driving/capture.mjs";
import { assertComparable, qualify, summarize } from "./driving/report.mjs";
import { allocationSummary } from "./instrumentation/allocation-summary.mjs";

const option = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (process.argv.includes("--help")) {
  console.log(`Repeatable driving benchmark (fresh page/world per cell)
  --fixtures=clear,jam --seconds=30 --trials=3 --headed --viewport=1280x800
  --output=/tmp/driving.json --compare=/tmp/before.json --zoom=1
  --allocations  Separate main-thread allocation sampling run; saves heap profiles
  --profile --trace  Main-thread CPU profile (1 ms) and all-thread Chrome trace
  --cdp=http://127.0.0.1:9223 --port=4188 --device=pixel7a
  --base=http://localhost:4174/tilefun  Use a rebuilt production origin
Clear: east at ordinary compact-car throttle on a prepared flat road, following camera.
Jam: 32 ordinary autonomous cars behind four parked leaders, plus the driver; fixed camera, 0.25x.
No ambient AI or city art. Pre-admitted flat roads isolate driving/rendering from regional generation.
Reports retain raw frame intervals, named checkpoints, simulation progress and invalid runs.
Headless runs check the workload; use --headed or a physical device for display cadence.`);
  process.exit(0);
}
const fixtures = option("fixtures", "clear,jam").split(",");
const seconds = Number(option("seconds", "30")),
  trials = Number(option("trials", "3"));
const zoomOverride = option("zoom", "");
if (
  fixtures.some((s) => !["clear", "jam"].includes(s)) ||
  new Set(fixtures).size !== fixtures.length
)
  throw Error("--fixtures must contain clear and/or jam without duplicates");
if (
  !Number.isFinite(seconds) ||
  seconds < 5 ||
  seconds > 60 ||
  !Number.isInteger(trials) ||
  trials < 1 ||
  trials > 10
)
  throw Error("--seconds must be 5–60 and --trials 1–10");
if (
  zoomOverride &&
  (!Number.isFinite(Number(zoomOverride)) || Number(zoomOverride) < 0.1 || Number(zoomOverride) > 2)
)
  throw Error("--zoom must be 0.1–2");
const endpoint = option("cdp", ""),
  base = option("base", "").replace(/\/$/, ""),
  port = Number(option("port", "0"));
if (endpoint && !base && !port) throw Error("--cdp needs a dedicated --port or --base");
const [width, height] = option("viewport", "1280x800").split("x").map(Number);
if (![width, height].every((n) => Number.isInteger(n) && n >= 200 && n <= 4096))
  throw Error("Invalid viewport");
const headed = !!endpoint || process.argv.includes("--headed");
const allocations = process.argv.includes("--allocations");
const profile = process.argv.includes("--profile"),
  trace = process.argv.includes("--trace");
if (allocations && (profile || trace))
  throw Error("Keep allocation sampling separate from CPU/trace captures");
const output = path.resolve(option("output", path.join(os.tmpdir(), "tilefun-driving.json")));
const compare = option("compare", "");
if (compare && path.resolve(compare) === output)
  throw Error("--compare and --output must be different files");
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-driving-"));
let server, browser, page, origin;
const errors = [],
  cells = [];
const sourceDigest = createHash("sha256");
for (const directory of ["src", "scripts/driving"]) {
  for (const file of (await readdir(directory, { recursive: true })).sort()) {
    if (!/\.(ts|tsx|json|mjs)$/.test(file) || file.includes(".test.")) continue;
    const name = `${directory}/${file}`;
    sourceDigest
      .update(name)
      .update("\0")
      .update(await readFile(name));
  }
}
for (const name of ["scripts/benchmark-driving.mjs", "package-lock.json", "driving-bench.html"])
  sourceDigest
    .update(name)
    .update("\0")
    .update(await readFile(name));
const git = (args) =>
  execFileSync(
    process.platform === "win32" ? "wsl" : "git",
    process.platform === "win32" ? ["git", ...args] : args,
    { encoding: "utf8" },
  ).trim();
const source = {
  revision: git(["rev-parse", "HEAD"]),
  dirty: !!git(["status", "--porcelain"]),
  sha256: sourceDigest.digest("hex"),
};
await mkdir(path.dirname(output), { recursive: true });
try {
  if (!base) {
    server = await createServer({
      configFile: false,
      base: "/tilefun/",
      cacheDir: path.join(temp, "vite"),
      plugins: [react()],
      optimizeDeps: { entries: ["driving-bench.html"] },
      server: { host: "127.0.0.1", port, strictPort: !!port, hmr: false, watch: null },
      logLevel: "error",
    });
    await server.listen();
  }
  origin = base || `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  if (endpoint) page = await openCdpTab(endpoint);
  else {
    browser = await chromium.launch({ channel: "chromium", headless: !headed });
    page = await browser.newPage({ viewport: { width, height } });
  }
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = endpoint ? page : await page.context().newCDPSession(page);
  const capture = drivingCapture(cdp, { profile, trace });
  let device, measurementVersion;
  for (let trial = 0; trial < trials; trial++)
    for (const fixture of trial % 2 ? [...fixtures].reverse() : fixtures) {
      await page.goto("about:blank");
      await page.goto(
        `${origin}/driving-bench.html?fixture=${fixture}${zoomOverride ? `&zoom=${zoomOverride}` : ""}`,
      );
      await page.waitForFunction(
        () => document.querySelector("#driving-bench")?.dataset.ready === "true",
        undefined,
        { timeout: 120_000 },
      );
      await page.waitForFunction(
        () => {
          const d = window.__drivingBench.diagnostics().terrain;
          const assets = Object.values(d?.gpu?.vehicleAssets ?? {});
          return (
            d?.pending === 0 &&
            d?.rowsLastFrame === 0 &&
            assets.length > 0 &&
            assets.every((a) => a.state === "ready")
          );
        },
        undefined,
        { timeout: 60_000, polling: 100 },
      );
      device ??= await page.evaluate(() => {
        const canvas = document.querySelector('canvas[data-renderer="gpu"]');
        const gl = canvas?.getContext("webgl2");
        const info = gl?.getExtension("WEBGL_debug_renderer_info");
        return {
          userAgent: navigator.userAgent,
          cores: navigator.hardwareConcurrency,
          width: innerWidth,
          height: innerHeight,
          devicePixelRatio,
          gpu: gl ? gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
        };
      });
      const recipe = await page.evaluate(() => window.__drivingBench.recipe);
      measurementVersion ??= await page.evaluate(() => window.__drivingBench.measurementVersion);
      const entry = await page.evaluate(async () => {
        const url = [...document.scripts].find(
          (s) => s.type === "module" && s.src && !s.src.endsWith("/@vite/client"),
        )?.src;
        if (!url) throw Error("Missing benchmark module");
        const response = await fetch(url);
        if (!response.ok) throw Error("Cannot fingerprint benchmark module");
        return { path: new URL(url).pathname, text: await response.text() };
      });
      const recipeSha256 = createHash("sha256").update(JSON.stringify(recipe)).digest("hex");
      const idleFrames = await page.evaluate(() => window.__drivingBench.calibrate());
      if (allocations)
        await cdp.send("HeapProfiler.startSampling", {
          samplingInterval: 32768,
          includeObjectsCollectedByMajorGC: true,
          includeObjectsCollectedByMinorGC: true,
        });
      const stopCapture =
        profile || trace
          ? await capture.start(`${output.replace(/\.json$/, "")}.${fixture}-${trial}`)
          : undefined;
      let sample, diagnostic;
      try {
        sample = await page.evaluate((duration) => window.__drivingBench.run(duration), seconds);
      } finally {
        diagnostic = await stopCapture?.();
      }
      if (allocations) {
        const { profile } = await cdp.send("HeapProfiler.stopSampling");
        sample.allocations = {
          ...allocationSummary(profile),
          samplingInterval: 32768,
          scope:
            "Main-thread estimated allocations, including collected objects, cadence setup, pause fence/diagnostics and benchmark bookkeeping. Excludes warm-up and idle calibration. Instrumented timings; not a retained heap or GC-cause diagnosis.",
        };
        await writeFile(
          `${output.replace(/\.json$/, "")}.${fixture}-${trial}.main.heapprofile`,
          JSON.stringify(profile),
        );
      }
      const frames = summarize(sample.frames);
      const idleFrameMs = summarize(idleFrames).p50;
      const cell = {
        fixture,
        trial,
        recipeSha256,
        servedEntry: {
          path: entry.path,
          sha256: createHash("sha256").update(entry.text).digest("hex"),
        },
        ...sample,
        ...(diagnostic ? { diagnostic } : {}),
        idleFrames,
        frameMs: frames,
        idleFrameMs,
        missed: sample.frames.filter((v) => v > idleFrameMs * 1.5).length,
        qualification: qualify(fixture, sample),
      };
      cells.push(cell);
      console.log(
        `${fixture} trial ${trial + 1}: ${cell.qualification.valid ? "qualified" : "INVALID"}, ${cell.qualification.ticks} ticks, ${cell.distance.toFixed(1)} px; frame p50/p95 ${frames.p50.toFixed(1)}/${frames.p95.toFixed(1)} ms, missed ${cell.missed}/${frames.count}; render ${sample.performance["lab.render"]?.p50Ms.toFixed(2)} ms; wheel queries ${cell.qualification.wheelQueries}`,
      );
      for (const reason of cell.qualification.reasons) console.log(`  ${reason}`);
    }
  const report = {
    schemaVersion: 1,
    date: new Date().toISOString(),
    source,
    browser: endpoint ? page.browserVersion : browser.version(),
    headed,
    runtime: base ? "production origin" : "vite dev modules",
    seconds,
    trials,
    fixtures,
    zoomOverride,
    allocationSampled: allocations,
    profiled: profile,
    traced: trace,
    measurementVersion,
    label: option("device", endpoint ? "attached device" : os.cpus()[0]?.model),
    device,
    cells,
    errors,
    scope:
      "Fixed placements and eastward input; wall-time windows with simulation/distance qualification, not a bit-exact live replay. Jam has real autonomous lane decisions and wheel physics. Flat roads pre-admitted before timing; excludes city art, regional generation and persistence. Physics timing percentiles retain the latest 512 samples; counters cover the full cadence window plus its pause fence. Native lab.update/render timers include benchmark input and ordinary presentation. Each cell owns a fresh page/Worker. No frame-rate performance gate.",
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${output}`);
  if (compare) {
    const before = JSON.parse(await readFile(compare, "utf8"));
    assertComparable(before, report);
    for (const cell of cells) {
      const old = before.cells.find((c) => c.fixture === cell.fixture && c.trial === cell.trial);
      console.log(
        `${cell.fixture} trial ${cell.trial + 1}: render p50 ${old.performance["lab.render"].p50Ms.toFixed(2)} → ${cell.performance["lab.render"].p50Ms.toFixed(2)} ms; missed ${old.missed} → ${cell.missed}`,
      );
    }
  }
  if (errors.length || cells.some((c) => !c.qualification.valid))
    throw Error("Driving workload failed qualification; retained in report");
} catch (error) {
  await writeFile(
    `${output}.failure.json`,
    JSON.stringify({ source, errors, cells, failure: String(error) }, null, 2),
  );
  throw error;
} finally {
  if (endpoint && page) {
    await page.goto("about:blank").catch(() => {});
    await page.close().catch(() => {});
  }
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}
