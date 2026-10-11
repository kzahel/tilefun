// Production city/Worker/IndexedDB/renderer profiling. No simulation-policy controls.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { readAndroidThermals, waitForAndroidCool } from "../android-thermal-gate.mjs";
import { cityReady, installCityAuthority, sampleCityClient } from "./city-audit-profile.mjs";
import { startWorkerCpu, summarizeWorkerCpu } from "./worker-cpu.mjs";

const option = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const root = path.resolve(option("root", path.resolve(import.meta.dirname, "../..")));
const output = path.resolve(option("output", path.join(os.tmpdir(), "tilefun-city-audit")));
const endpoint = option("cdp", ""),
  port = Number(option("port", "0"));
const seconds = Number(option("seconds", "12")),
  warmSeconds = Number(option("warm-seconds", "8"));
const renderer = option("renderer", "gpu"),
  meshes = option("meshes", "true") === "true";
const overviewZoom = Number(option("overview-zoom", "0.1"));
const arrivalKind = option("arrival", "gateway");
const driveModel = option("drive-model", "native");
if (!["native", "compact-1"].includes(driveModel)) throw Error("Invalid drive model");
if (!["gateway", "core"].includes(arrivalKind) || ![0.05, 0.1, 0.25].includes(overviewZoom))
  throw Error("Invalid arrival/overview zoom");
const jobs = option("stages", "standing,walk,drive,overview,overview-drive").split(",");
const deep = option("deep", "false") === "true",
  cpu = option("cpu", "false") === "true";
const touch = option("touch", endpoint ? "true" : "false") === "true";
const androidCli = option("android-device-cli", ""),
  maxC = Number(option("max-battery-c", "32"));
const cooldown = Number(option("cooldown-seconds", "60"));
if (endpoint && !port) throw Error("Physical CDP requires a dedicated --port");
if (!["canvas", "gpu"].includes(renderer)) throw Error("Unknown renderer");
if (
  jobs.some(
    (j) => !["standing", "walk", "drive", "overview", "overview-drive", "zoom-entry"].includes(j),
  )
)
  throw Error("Unknown stage");
for (const [k, v] of Object.entries({ seconds, warmSeconds, cooldown }))
  if (!Number.isFinite(v) || v < 2 || v > 60) throw Error(`Invalid ${k}: expected 2–60`);
if (!Number.isFinite(maxC) || maxC < 15 || maxC > 34) throw Error("Invalid thermal gate");
await mkdir(output, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-city-data-"));
for (const key of [
  "WORKSHOP_AUTH_DIR",
  "WORKSHOP_DATA_DIR",
  "ART_NOTES_DIR",
  "INTERIOR_REVIEW_DIR",
])
  process.env[key] = path.join(temp, key);
const report = {
  date: new Date().toISOString(),
  source:
    option("revision", "") ||
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  physical: !!endpoint,
  renderer,
  meshes,
  touch,
  deep,
  cpu,
  seconds,
  warmSeconds,
  overviewZoom,
  arrivalKind,
  driveModel,
  limits:
    "Native game Worker/IndexedDB/current seed-2026 city; normal traffic/pedestrians. Inclusive opt-in timers add overhead. Driver setup boards an existing native car (or an explicit one-for-one production-factory model replacement) after a diagnostic pose/stop; subsequent input is native. CPU and deep census are attribution lanes, not clean timing controls. rAF measures callback cadence, not displayed GPU presentation.",
  probesSHA256: {},
  cases: [],
};
for (const file of ["city-audit.mjs", "city-audit-profile.mjs", "worker-cpu.mjs"])
  report.probesSHA256[file] = createHash("sha256")
    .update(await readFile(path.join(import.meta.dirname, file)))
    .digest("hex");
report.sourcesSHA256 = {};
for (const file of [
  "src/server/Realm.ts",
  "src/server/RealmActivity.ts",
  "src/entities/EntityManager.ts",
  "src/traffic/TrafficSystem.ts",
  "src/traffic/MovingSupport.ts",
  "src/traffic/Driving.ts",
  "src/scenarios/NaturalLandscapeRecipe.ts",
  "src/generation/regional/DenseDistrictPlanner.ts",
])
  report.sourcesSHA256[file] = createHash("sha256")
    .update(await readFile(path.join(root, file)))
    .digest("hex");
const server = await createServer({
  root,
  configFile: false,
  base: "/tilefun/",
  optimizeDeps: { entries: ["index.html"] },
  plugins: [
    react(),
    {
      name: "city-authority-probe",
      enforce: "pre",
      transform(code, id) {
        const file = id.split("?")[0];
        const replace = (from, to) => {
          if (code.split(from).length !== 2) throw Error(`City probe marker changed: ${file}`);
          code = code.replace(from, to);
        };
        if (file.endsWith("/src/server/local-server.worker.ts"))
          replace(
            "let initialized = false;",
            "globalThis.__diagnosticAuthority = runtime.server;\nlet initialized = false;",
          );
        if (file.endsWith("/src/server/Realm.ts")) {
          replace(
            "        tickAllAI(",
            "        const __cityAIStart = performance.now();\n        tickAllAI(",
          );
          replace(
            "        // ── TickService.preSimulation",
            '        globalThis.__cityPhase?.("ai", performance.now() - __cityAIStart);\n        // ── TickService.preSimulation',
          );
        }
        if (deep && file.endsWith("/src/traffic/Driving.ts")) {
          replace(
            "  const length = Math.hypot(input.dx, input.dy);",
            "  globalThis.__cityDrivingLists?.(props.length, entities.length);\n  const length = Math.hypot(input.dx, input.dy);",
          );
        }
        return code;
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
  logLevel: "error",
});
let browser, page, context, cdp, profiler;
const errors = [];
const save = () => writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = endpoint
    ? await chromium.connectOverCDP(endpoint, { noDefaults: true })
    : await chromium.launch({ channel: "chromium", headless: true });
  report.browser = browser.version();
  for (const stage of jobs) {
    const gate = androidCli ? await waitForAndroidCool(androidCli, maxC, cooldown) : undefined;
    context = endpoint
      ? browser.contexts()[0]
      : await browser.newContext({ viewport: { width: 411, height: 789 }, hasTouch: touch });
    page = await context.newPage();
    await page.bringToFront();
    cdp = await context.newCDPSession(page);
    errors.length = 0;
    page.on("pageerror", (e) => errors.push(e.message));
    await cdp.send("Storage.clearDataForOrigin", {
      origin: new URL(origin).origin,
      storageTypes: "all",
    });
    await page.goto(`${origin}/tools.html`);
    const arrival = await page.evaluate(async (kind) => {
      const { naturalLandscapeRecipe } = await import(
        "/tilefun/src/scenarios/NaturalLandscapeRecipe.ts"
      );
      const r = naturalLandscapeRecipe("city-center", "thicket");
      let y = r.player.position.wy / 16;
      if (kind === "core") {
        const { DenseDistrictSource } = await import(
          "/tilefun/src/generation/regional/DenseDistrictPlanner.ts"
        );
        const { regionalWorld } = await import(
          "/tilefun/src/generation/regional/WorldDescriptor.ts"
        );
        const plan = new DenseDistrictSource(regionalWorld(2026), true).owner(0, 0);
        y = (plan.bounds.minY + plan.bounds.maxY) / 2;
      }
      return { x: r.player.position.wx / 16, y, generation: r.generation };
    }, arrivalKind);
    await page.goto(
      `${origin}/?perf&nogamepad&renderer=${renderer}&${meshes ? "meshes&" : ""}generation=${encodeURIComponent(JSON.stringify(arrival.generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.waitForFunction(
      () => {
        const g = document.querySelector("#game").__game;
        return (
          g.stateView.playerEntity.id > 0 &&
          !g.mainMenu.visible &&
          g.renderer.getDiagnostics().pending === 0
        );
      },
      null,
      { timeout: 60000 },
    );
    const worker = page.workers().find((w) => w.url().includes("local-server.worker"));
    if (!worker) throw Error("Missing authority Worker");
    await worker.evaluate(installCityAuthority, { deep });
    let driver;
    if (stage.includes("drive")) {
      await worker.evaluate(async () => {
        const deadline = performance.now() + 10000;
        for (;;) {
          const traffic = globalThis.__diagnosticAuthority.activeRealm.traffic;
          if (
            [...traffic.states.values()].some(
              (c) =>
                !c.turn &&
                c.driverId === undefined &&
                c.lane.a.y === c.lane.b.y &&
                !c.lane.intercity,
            )
          )
            return;
          if (performance.now() >= deadline)
            throw Error("Native horizontal traffic did not populate");
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      });
      driver = await worker.evaluate((model) => {
        const r = globalThis.__diagnosticAuthority.activeRealm,
          s = [...r.sessions.values()][0];
        const px = s.player.position.wx;
        const cars = [...r.traffic.states.values()].filter(
          (c) => !c.turn && !c.driverId && c.lane.a.y === c.lane.b.y && !c.lane.intercity,
        );
        cars.sort((a, b) => {
          // Prefer a car heading toward the city center, then the nearest one.
          const aToward = (a.lane.b.x - a.lane.a.x) * (px - a.entity.position.wx) > 0;
          const bToward = (b.lane.b.x - b.lane.a.x) * (px - b.entity.position.wx) > 0;
          return (
            Number(bToward) - Number(aToward) ||
            Math.abs(a.entity.position.wx - px) - Math.abs(b.entity.position.wx - px)
          );
        });
        let car = cars[0];
        if (!car) throw Error("No native horizontal traffic car available");
        const originalModel = car.entity.type;
        if (model !== "native") {
          const old = car;
          r.entityManager.remove(old.entity.id, false);
          car = r.traffic.add(
            model,
            old.lane,
            old.distance,
            true,
            {
              x: old.entity.position.wx,
              y: old.entity.position.wy,
              direction: old.entity.sprite.direction,
            },
            old.entity.wz ?? 0,
          );
        }
        car.speed = 0;
        car.entity.velocity = { vx: 0, vy: 0 };
        s.player.position = { ...car.entity.position };
        s.player.wz = s.player.groundZ = car.entity.wz ?? 0;
        r.entityManager.spatialHash.update(s.player);
        r.vehicles.enter(s, car.entity.id);
        return {
          model: car.entity.type,
          originalModel,
          replacement: model !== "native",
          key: car.lane.b.x > car.lane.a.x ? "ArrowRight" : "ArrowLeft",
          position: { ...car.entity.position },
          lane: car.lane.id,
        };
      }, driveModel);
    }
    const zoom = stage.startsWith("overview") ? overviewZoom : 1;
    await page.evaluate((z) => document.querySelector("#game").__game.debugPanel.setZoom(z), zoom);
    await page.waitForFunction(
      (z) => document.querySelector("#game").__game.camera.zoom === z,
      zoom,
    );
    await page.waitForFunction(cityReady, null, { timeout: 60000 });
    await page.waitForTimeout(warmSeconds * 1000);
    const thermalStart = androidCli ? readAndroidThermals(androidCli) : undefined;
    if (thermalStart && (thermalStart.batteryC > maxC || thermalStart.thermalStatus !== 0))
      throw Error("Thermal gate lost during setup");
    const begin = await worker.evaluate(() => globalThis.__cityRead().population);
    await worker.evaluate(() => globalThis.__cityReset());
    let points;
    const key = driver?.key ?? "ArrowRight";
    const moving = ["walk", "drive", "overview-drive"].includes(stage);
    if (moving) {
      if (touch) {
        points = await page.evaluate(() => {
          const b = document.querySelector("#game").getBoundingClientRect();
          return { id: 0, x: b.x + Math.min(140, b.width * 0.35), y: b.y + b.height * 0.6 };
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [points] });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ ...points, x: points.x + (key === "ArrowRight" ? 50 : -50) }],
        });
      } else await page.keyboard.down(key);
    }
    if (stage === "zoom-entry")
      await page.evaluate(
        (z) => document.querySelector("#game").__game.debugPanel.setZoom(z),
        overviewZoom,
      );
    if (cpu) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
      await cdp.send("Profiler.start");
      profiler = await startWorkerCpu(browser, worker.url());
    }
    const data = await page.evaluate(sampleCityClient, seconds);
    const authority = await worker.evaluate(() => globalThis.__cityRead());
    let cpuSummary, mainCpu;
    if (profiler) {
      const profile = await profiler.stop();
      profiler = undefined;
      await writeFile(
        path.join(output, `${report.cases.length}-${stage}.cpuprofile`),
        JSON.stringify(profile),
      );
      cpuSummary = summarizeWorkerCpu(profile);
      const main = (await cdp.send("Profiler.stop")).profile;
      await writeFile(
        path.join(output, `${report.cases.length}-${stage}-main.cpuprofile`),
        JSON.stringify(main),
      );
      mainCpu = summarizeWorkerCpu(main);
    }
    if (moving) {
      if (touch) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else await page.keyboard.up(key);
    }
    const thermalEnd = androidCli ? readAndroidThermals(androidCli) : undefined;
    const row = {
      stage,
      arrival,
      driver,
      gate,
      thermalStart,
      thermalEnd,
      begin,
      ...data,
      authority,
      cpu: cpuSummary,
      mainCpu,
      errors: [...errors],
    };
    report.cases.push(row);
    await save();
    await page.screenshot({ path: path.join(output, `${report.cases.length}-${stage}.png`) });
    console.log(
      JSON.stringify({
        stage,
        renderer,
        deep,
        cpu,
        begin,
        end: authority.population,
        tick: authority.timing.tick,
        traffic: authority.timing.traffic,
        driving: authority.timing.driving,
        frames: data.frames,
        render: data.render,
        travel: data.maxTravel,
        thermalStart,
        thermalEnd,
        errors,
      }),
    );
    await page.goto("about:blank");
    await cdp.send("Storage.clearDataForOrigin", {
      origin: new URL(origin).origin,
      storageTypes: "all",
    });
    await cdp.detach();
    cdp = undefined;
    await page.close();
    page = undefined;
    if (!endpoint) await context.close();
    context = undefined;
    if (errors.length) throw Error("Page errors captured");
    if (thermalEnd && thermalEnd.thermalStatus !== 0)
      throw Error("Thermal status changed; stopping after retained case");
  }
} catch (error) {
  report.failure = { message: String(error), errors: [...errors] };
  await save();
  throw error;
} finally {
  if (profiler) await profiler.close().catch(() => {});
  if (page) {
    await page.keyboard.up("ArrowRight").catch(() => {});
    await page.keyboard.up("ArrowLeft").catch(() => {});
    await cdp
      ?.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      .catch(() => {});
    await page.goto("about:blank").catch(() => {});
    await cdp
      ?.send("Storage.clearDataForOrigin", {
        origin: `http://127.0.0.1:${server.httpServer.address()?.port}`,
        storageTypes: "all",
      })
      .catch(() => {});
  }
  await cdp?.detach().catch(() => {});
  await page?.close().catch(() => {});
  if (!endpoint) await context?.close().catch(() => {});
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}
