// Paired ordinary Realm/Worker/rendering workloads, in bundled Chromium or an
// already-running dedicated device browser. CDP mode owns only its new tabs.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const option = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const output = option("output", path.join(os.tmpdir(), "tilefun-realm-physics"));
const counts = option("counts", "0,24,96,384").split(",").map(Number);
const modes = option("modes", "legacy,rapier").split(",");
const trials = Number(option("trials", "2")),
  seconds = Number(option("seconds", "6")),
  warmup = Number(option("warmup", "4"));
if (
  counts.some((n) => !Number.isInteger(n) || n < 0 || n > 384) ||
  ![seconds, warmup, trials].every((n) => Number.isFinite(n) && n > 0 && n <= 30) ||
  modes.some((m) => !["legacy", "rapier"].includes(m))
)
  throw Error("Invalid workload options");
const base = option("base", "http://localhost:4174/tilefun/");
const cdp = option("cdp", "");
const browser = cdp
  ? await chromium.connectOverCDP(cdp)
  : await chromium.launch({ channel: "chromium" });
const context = cdp
  ? browser.contexts()[0]
  : await browser.newContext({ viewport: { width: 1280, height: 900 } });
const git = (args) =>
  process.platform === "win32"
    ? execFileSync("wsl", ["git", ...args], { encoding: "utf8" }).trim()
    : execFileSync("git", args, { encoding: "utf8" }).trim();
const report = {
  revision: git(["rev-parse", "HEAD"]),
  dirty: !!git(["status", "--porcelain"]),
  date: new Date().toISOString(),
  browser: browser.version(),
  lane: cdp ? "dedicated physical browser via CDP" : "bundled full Chromium",
  seconds,
  warmup,
  trials,
  cases: [],
};
await mkdir(output, { recursive: true });
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  return {
    count: sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: sorted.at(-1) ?? 0,
    over25ms: sorted.filter((v) => v > 25).length,
    over50ms: sorted.filter((v) => v > 50).length,
  };
};
let failed = false;
try {
  for (let trial = 0; trial < trials; trial++)
    for (const population of counts)
      for (const mode of trial % 2 ? [...modes].reverse() : modes) {
        const page = await context.newPage(),
          errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        try {
          const url = new URL("workshop.html", base);
          url.searchParams.set("geometry", "realm");
          url.searchParams.set("crowd", String(population));
          url.searchParams.set("physics", mode === "rapier" ? "rapier-world" : "legacy");
          url.hash = "/tool/world-geometry";
          await page.goto(url.href, { waitUntil: "domcontentloaded" });
          await page.waitForSelector('canvas[data-ready="true"]', { timeout: 60000 });
          await page.bringToFront();
          await page.waitForTimeout(warmup * 1000);
          const start = await page.evaluate(async () => {
            const c = document.querySelector('canvas[data-ready="true"]');
            const diagnostics = await c.__physicsSample(true);
            window.__realmBenchFrames = [];
            let previous = performance.now();
            const frame = (now) => {
              window.__realmBenchFrames.push(now - previous);
              previous = now;
              window.__realmBenchFrame = requestAnimationFrame(frame);
            };
            window.__realmBenchFrame = requestAnimationFrame(frame);
            return {
              diagnostics,
              device: {
                userAgent: navigator.userAgent,
                cores: navigator.hardwareConcurrency,
                memoryGiB: navigator.deviceMemory,
                viewport: { width: innerWidth, height: innerHeight },
                pixelRatio: devicePixelRatio,
              },
            };
          });
          await page.waitForTimeout(seconds * 1000);
          const end = await page.evaluate(async () => {
            const c = document.querySelector('canvas[data-ready="true"]');
            const diagnostics = await c.__physicsSample();
            cancelAnimationFrame(window.__realmBenchFrame);
            return {
              diagnostics,
              frames: window.__realmBenchFrames,
              scene: c.__presentationDiagnostics(),
            };
          });
          const row = {
            trial,
            population,
            mode,
            device: start.device,
            diagnostics: end.diagnostics,
            frames: summary(end.frames),
            scene: end.scene,
            errors,
          };
          report.cases.push(row);
          if (!end.diagnostics?.timings?.["realm.tick"]?.count || errors.length) failed = true;
          console.log(
            JSON.stringify({
              trial,
              population,
              mode,
              tick: end.diagnostics?.timings?.["realm.tick"],
              frames: row.frames,
              errors,
            }),
          );
          await page.screenshot({ path: path.join(output, `${trial}-${population}-${mode}.png`) });
          await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
        } finally {
          await page.close();
        }
      }
} finally {
  if (cdp) {
    // Closing an unowned device browser is forbidden. Exiting the controller
    // disconnects CDP after our tabs have been closed.
    await writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  } else {
    await context.close();
    await browser.close();
  }
}
if (cdp) process.exit(failed ? 1 : 0);
if (failed) process.exitCode = 1;
