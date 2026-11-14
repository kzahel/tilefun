// Tactical 252 evidence: play in a real headset. Runs the game in Quest Browser
// over adb and DevTools with nobody wearing the headset, starts a session in
// each mode, and records the headset's frame pacing and what the compositor
// showed.
//
// Run it inside a Quest lease from the machine-control checkout, which holds the
// headset awake, forwards the port and restores everything afterwards:
//
//   <machine-control>/platforms/quest/bin/quest session --reverse tcp:4197=tcp:4197 -- \
//     node scripts/first-person/xr-quest.mjs [--out=DIR] [--scenes=city,woods] \
//       [--modes=eye,tabletop,screen] [--seconds=10] [--query=a=b] [--profile] \
//       [--rate=72] [--distance=near|medium|far] [--no-page]
//
// An isolated Vite server (development modules, as the phone's render bench
// uses) is reached from the headset as http://localhost:4197, a secure origin.
// DevTools grants that origin the browser's "immersive experiences" permission
// for this run, in place of the prompt a wearer would answer.
//
// Measures frame pacing only. Comfort and the controller mapping need a wearer.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { openCdpTab } from "../cdp-tab.mjs";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const PORT = 4197,
  DEVTOOLS = 9339;
// The render bench's scenes (tactical 236).
const SCENES = { city: [300, 519], woods: [-380, -364] };
const scenes = option("scenes", "city,woods").split(",");
for (const name of scenes) if (!SCENES[name]) throw Error(`Unknown scene ${name}`);
const modes = option("modes", "eye,tabletop,screen").split(",");
const seconds = Number(option("seconds", "10"));
const query = option("query", "");
// The display rate to ask the headset for, and first person's view distance.
const rate = Number(option("rate", "0"));
const distance = option("distance", "");
// A sampled CPU profile of the page's main thread over each measurement.
const profile = process.argv.includes("--profile");
const serial = process.env.ANDROID_SERIAL ?? process.env.QUEST_TESTBED_SERIAL;
if (!serial || !process.env.QUEST_TESTBED_SESSION_ACTIVE)
  throw Error("Run inside `quest session --reverse tcp:4197=tcp:4197 -- …` (see the header)");
const adbPath = process.env.QUEST_TESTBED_ADB || "adb";
const adb = (...args) => execFileSync(adbPath, ["-s", serial, ...args], { maxBuffer: 1 << 28 });
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-xr-quest-"));
const output = path.resolve(option("out", path.join(os.tmpdir(), "tilefun-xr-quest")));
await mkdir(output, { recursive: true });

const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(temp, "vite-cache"),
  optimizeDeps: { entries: ["index.html"] },
  plugins: [react()],
  server: { host: "127.0.0.1", port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: "error",
});
const report = {
  output,
  date: new Date().toISOString(),
  seconds,
  rate: rate || "the game's default (72)",
  distance: distance || "medium",
  errors: [],
  shots: {},
  cells: [],
};
let tab;
/** Top self-time frames of a DevTools CPU profile, as shares of sampled time. */
function topSelfTime(cpuProfile, limit = 24) {
  const nodes = new Map(cpuProfile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  let total = 0;
  cpuProfile.samples.forEach((id, i) => {
    const frame = nodes.get(id).callFrame;
    const name = `${frame.functionName || "(anonymous)"} ${frame.url.split("/").pop().split("?")[0]}:${frame.lineNumber + 1}`;
    const dt = cpuProfile.timeDeltas[i] ?? 0;
    self.set(name, (self.get(name) ?? 0) + dt);
    total += dt;
  });
  return [...self]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, time]) => ({ name, percent: Math.round((time / total) * 1000) / 10 }));
}

/** The compositor's own once-a-second line, when the headset logs it. */
function compositor() {
  try {
    const lines = adb("logcat", "-d", "-s", "VrApi:V").toString().split("\n");
    return lines
      .filter((line) => line.includes("FPS="))
      .slice(-Math.max(1, seconds - 2))
      .map((line) => line.slice(line.indexOf("FPS=")).trim());
  } catch {
    return [];
  }
}
try {
  await server.listen();
  const origin = `http://localhost:${PORT}`;
  adb(
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    "about:blank",
    "com.oculus.browser",
  );
  await new Promise((resolve) => setTimeout(resolve, 6000));
  adb("forward", `tcp:${DEVTOOLS}`, "localabstract:chrome_devtools_remote");
  tab = await openCdpTab(`http://127.0.0.1:${DEVTOOLS}`);
  report.browser = tab.browserVersion;
  tab.on("pageerror", (error) => report.errors.push(error.message));
  await tab.send("Browser.setPermission", {
    permission: { name: "xr" },
    setting: "granted",
    origin,
  });
  const generation = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "-e",
        'import("./src/generation/GenerationDescriptor.ts").then((m) => console.log(JSON.stringify(m.createDescriptor("regional", 2026))))',
      ],
      { encoding: "utf8" },
    ),
  );
  const game = (fn, arg) =>
    tab.evaluate(
      `(${fn})(document.querySelector("#game").__game${arg === undefined ? "" : `, ${JSON.stringify(arg)}`})`,
    );
  /** `fn` as the result of a user's gesture, which starting a session needs. */
  const gesture = async (fn, arg) => {
    const result = await tab.send("Runtime.evaluate", {
      expression: `(${fn})(document.querySelector("#game").__game, ${JSON.stringify(arg)})`,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  for (const name of scenes) {
    const [x, y] = SCENES[name];
    const arrival = { x, y, generation };
    await tab.goto("about:blank");
    await tab.goto(
      `${origin}/tilefun/?perf&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(
        JSON.stringify(arrival),
      )}${query ? `&${query}` : ""}`,
    );
    const newWorld = () =>
      [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "New World");
    await tab.waitForFunction(newWorld, undefined, { timeout: 180_000 });
    await tab.evaluate(`(${newWorld})().click()`);
    await tab.waitForFunction(
      () => {
        const canvas = document.querySelector("#game");
        return canvas?.dataset.ready === "true" && !canvas.__game.mainMenu.visible;
      },
      undefined,
      { timeout: 180_000 },
    );
    await tab.waitForTimeout(4000);
    report.page ??= await game((g) => ({
      canvas: [g.canvas.width, g.canvas.height],
      supported: g.xr.supported,
      modes: g.xr.modes,
      userAgent: navigator.userAgent,
    }));
    // --no-page skips it: the session then streams its ground in itself.
    if (!report.shots[name] && !process.argv.includes("--no-page")) {
      // First person on the headset's flat page, for comparison with the eyes.
      await game((g) => g.firstPerson.setActive(true));
      await tab
        .waitForFunction(
          () => document.querySelector("#game").__game.firstPerson.viewStats?.builds === 0,
          undefined,
          { timeout: 60_000, polling: 500 },
        )
        .catch(() => {});
      await tab.waitForTimeout(3000);
      await tab.screenshot({ path: path.join(output, `${name}-page.png`) });
      report.shots[name] = await game((g) => g.firstPerson.viewStats);
      await game((g) => g.firstPerson.setActive(false));
    }
    // The headset lies on a desk: set the tabletop where its cameras point.
    await game((g) => Object.assign(g.xr.table, { drop: 0.15, distance: 0.9 }));
    await game(
      (g, wanted) => {
        if (wanted.rate) g.xr.frameRate = wanted.rate;
        if (wanted.distance) g.firstPerson.viewDistance = wanted.distance;
      },
      { rate, distance },
    );
    for (const mode of modes) {
      const cell = { scene: name, mode };
      report.cells.push(cell);
      if (!report.page.modes.includes(mode)) {
        cell.offered = false;
        continue;
      }
      cell.entered = await gesture((g, m) => g.xr.enter(m), mode);
      if (!cell.entered) {
        report.errors.push(`${name} ${mode}: the session did not start`);
        continue;
      }
      await tab
        .waitForFunction(
          `(() => { const g = document.querySelector("#game").__game; return g.xr.stats.frames > 60 && (${JSON.stringify(mode)} === "screen" || g.firstPerson.viewStats?.builds === 0); })()`,
          undefined,
          { timeout: 90_000, polling: 500 },
        )
        .catch(() => report.errors.push(`${name} ${mode}: did not settle`));
      await tab.waitForTimeout(3000);
      adb("logcat", "-c");
      if (profile) {
        await tab.send("Profiler.enable");
        await tab.send("Profiler.setSamplingInterval", { interval: 200 });
        await tab.send("Profiler.start");
      }
      const ended = await game((g) => {
        g.xr.resetPacing();
        return g.xr.stats.ended;
      });
      await tab.waitForTimeout(seconds * 1000);
      if (profile) cell.profile = topSelfTime((await tab.send("Profiler.stop")).profile);
      Object.assign(
        cell,
        await game((g) => ({
          pacing: g.xr.pacing(),
          stats: { ...g.xr.stats },
          view: g.firstPerson.viewStats,
          focus: document.hasFocus(),
          canvas: [
            g.renderHost.renderer.surface.canvas.width,
            g.renderHost.renderer.surface.canvas.height,
          ],
          mode: g.xr.mode,
        })),
      );
      // A session that died during the measurement has no pacing to report.
      if (cell.mode !== mode || cell.stats.ended !== ended)
        report.errors.push(`${name} ${mode}: the session ended during the measurement`);
      if (mode !== "screen" && !(cell.stats.posed > 0 && cell.view?.calls > 0))
        report.errors.push(`${name} ${mode}: nothing was drawn to the eyes`);
      cell.compositor = compositor();
      await writeFile(path.join(output, `${name}-${mode}.png`), adb("exec-out", "screencap", "-p"));
      await game((g) => g.xr.exit());
      await tab.waitForFunction(() => !document.querySelector("#game").__game.xr.mode, undefined, {
        timeout: 15_000,
      });
      await tab.waitForTimeout(1500);
      const round = (n) => Math.round(n * 10) / 10;
      const { interval, work, missed, frames } = cell.pacing;
      console.log(
        `${name} ${mode}: ${frames} frames, interval p50 ${round(interval.p50)} p95 ${round(interval.p95)} p99 ${round(interval.p99)} max ${round(interval.max)} ms, missed ${missed}; page work p50 ${round(work.p50)} p95 ${round(work.p95)} ms; draws ${cell.view?.calls ?? "-"}; controllers ${cell.stats.inputs}`,
      );
      for (const line of cell.compositor.slice(-2)) console.log(`  ${line}`);
      for (const row of cell.profile ?? [])
        console.log(`    ${String(row.percent).padStart(5)}%  ${row.name}`);
    }
  }
} finally {
  await writeFile(path.join(output, "xr-quest.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport and headset pictures: ${output}`);
  if (report.errors.length) {
    console.log(`FAILED:\n  ${[...new Set(report.errors)].join("\n  ")}`);
    process.exitCode = 1;
  }
  // Take back the immersive permission this run granted its origin.
  await tab?.send("Browser.resetPermissions").catch(() => {});
  await tab?.close().catch(() => {});
  try {
    adb("forward", "--remove", `tcp:${DEVTOOLS}`);
  } catch {}
  server.httpServer?.closeAllConnections?.();
  await server.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}
