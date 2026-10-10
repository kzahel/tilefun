// Synthetic collision demand only; never launches the game or changes its physics.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { readAndroidThermals } from "./android-thermal-gate.mjs";

const option = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
if (process.argv.includes("--help")) {
  console.log(
    "vehicle-collision:bench [--counts=1,8,32,128] [--samples=12] [--output=DIR] [--headed] [--cdp=URL --port=PORT --device=LABEL --android-device-cli=PATH]\nCompares cardinal AABB and yaw OBB on identical prescribed traces, in a Worker and a six-replay main-thread demand lane. No gameplay or rendering. Samples report batch-amortized step cost, not whole-server tick p95. Physical CDP uses only its owned tab and leaves Chrome running.",
  );
  process.exit(0);
}
const endpoint = option("cdp", "");
const port = Number(option("port", "0"));
const samples = Number(option("samples", "12"));
const counts = option("counts", "1,8,32,128").split(",").map(Number);
if (!Number.isInteger(samples) || samples < 4 || samples > 50)
  throw Error("--samples must be 4–50");
if (
  counts.some((n) => !Number.isInteger(n) || n < 1 || n > 128) ||
  new Set(counts).size !== counts.length
)
  throw Error("--counts requires unique vehicle counts from 1–128");
if (!Number.isInteger(port) || port < 0 || port > 65535 || (endpoint && !port))
  throw Error("Physical CDP requires a dedicated --port");
const output = option("output", path.join(os.tmpdir(), "tilefun-vehicle-collision"));
const androidCli = option("android-device-cli", "");
await mkdir(output, { recursive: true });
const sourceFiles = [
  "src/diagnostics/VehicleCollisionBench.ts",
  "src/entities/SpatialHash.ts",
  "src/entities/collision.ts",
  "src/config/constants.ts",
  "scripts/benchmark-vehicle-collision.mjs",
  "scripts/instrumentation/vehicle-collision.worker.ts",
];
const hashes = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (file) => [
      file,
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    ]),
  ),
);
const git = (args) =>
  execFileSync(
    process.platform === "win32" ? "wsl.exe" : "git",
    process.platform === "win32" ? ["git", ...args] : args,
    { encoding: "utf8" },
  ).trim();
const report = {
  date: new Date().toISOString(),
  revision: git(["rev-parse", "HEAD"]),
  dirty: !!git(["status", "--porcelain"]),
  sourceHashes: hashes,
  scope:
    "Synthetic prescribed poses, native SpatialHash, candidate filtering, diagnostic SAT, sampled translation/rotation sweeps and two roof occupant clearance probes. No collision response, Realm, PlayerPredictor, transport, rendering, streaming or mesh triangles.",
  device: endpoint ? option("device", "unspecified physical device") : os.cpus()[0]?.model,
  platform: endpoint ? "physical-android" : `${os.platform()} ${os.release()} ${os.arch()}`,
  counts,
  samples,
  cases: [],
};
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
  logLevel: "error",
});
server.middlewares.use((req, res, next) => {
  if (req.url?.split("?")[0] !== "/tilefun/collision-probe") return next();
  res.setHeader("Content-Type", "text/html");
  res.end(
    "<!doctype html><title>Vehicle collision benchmark</title><p>Isolated vehicle collision diagnostic</p>",
  );
});
let browser, page;
const errors = [];
try {
  await server.listen();
  browser = endpoint
    ? await chromium.connectOverCDP(endpoint, { noDefaults: true })
    : await chromium.launch({ channel: "chromium", headless: !process.argv.includes("--headed") });
  report.browser = browser.version();
  page = endpoint ? await browser.contexts()[0].newPage() : await browser.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tilefun/collision-probe`);
  report.displayCadenceMs = await page.evaluate(async () => {
    let last = await new Promise(requestAnimationFrame);
    const times = [];
    for (let i = 0; i < 90; i++) {
      const now = await new Promise(requestAnimationFrame);
      if (i >= 30) times.push(now - last);
      last = now;
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  });
  report.environment = await page.evaluate(() => ({
    hardwareConcurrency: navigator.hardwareConcurrency,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    timerQuantumMs: (() => {
      let last = performance.now(),
        minimum = Infinity;
      for (let i = 0; i < 10000; i++) {
        const now = performance.now();
        if (now > last) minimum = Math.min(minimum, now - last);
        last = now;
      }
      return Number.isFinite(minimum) ? minimum : null;
    })(),
  }));
  await page.evaluate(async () => {
    const module = await import("/tilefun/src/diagnostics/VehicleCollisionBench.ts");
    const worker = new Worker(
      new URL("/tilefun/scripts/instrumentation/vehicle-collision.worker.ts", location.href),
      { type: "module" },
    );
    window.collisionBench = async (job) => {
      if (job.lane === "controlled-replay-6")
        return module.measureCollisionCase(job.scene, job.vehicles, job.lane, job.samples);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          worker.terminate();
          reject(Error("Collision Worker timed out"));
        }, 120000);
        worker.onmessage = ({ data }) => {
          clearTimeout(timer);
          data.error ? reject(Error(data.error)) : resolve(data.result);
        };
        worker.onerror = (error) => {
          clearTimeout(timer);
          reject(Error(error.message));
        };
        worker.postMessage(job);
      });
    };
    window.stopCollisionBench = () => worker.terminate();
  });
  for (const scene of ["cruise", "tight-turn", "roof-riders"])
    for (const vehicles of counts)
      for (const lane of ["authority-all", "controlled-replay-6"]) {
        const thermalsBefore = androidCli ? readAndroidThermals(androidCli) : undefined;
        const result = await page.evaluate((job) => window.collisionBench(job), {
          scene,
          vehicles,
          lane,
          samples,
        });
        const thermalsAfter = androidCli ? readAndroidThermals(androidCli) : undefined;
        report.cases.push({ ...result, ...(androidCli ? { thermalsBefore, thermalsAfter } : {}) });
        console.log(
          JSON.stringify({
            scene,
            vehicles,
            lane,
            msPerStep: result.policies.map((p) => p.batchAmortizedMsPerStep.median),
          }),
        );
        await writeFile(
          path.join(output, "report.json"),
          `${JSON.stringify({ ...report, errors }, null, 2)}\n`,
        );
      }
  if (errors.length) throw Error(`Page errors: ${errors.join("; ")}`);
} catch (error) {
  await writeFile(
    path.join(output, "failure.json"),
    JSON.stringify({ message: String(error), errors, completed: report.cases.length }, null, 2),
  );
  throw error;
} finally {
  await page?.evaluate(() => window.stopCollisionBench?.()).catch(() => {});
  await page?.close().catch(() => {});
  await browser?.close();
  await server.close();
}
