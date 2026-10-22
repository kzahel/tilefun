// Production city/Worker/IndexedDB/renderer profiling. No simulation-policy controls.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { readAndroidThermals, waitForAndroidCool } from "../android-thermal-gate.mjs";
import {
  cityReady,
  installCityAuthority,
  installCityMeshTargetReuse,
  installCityRenderProfile,
  sampleCityClient,
} from "./city-audit-profile.mjs";
import { courseDirection, prepareCityCourse, prepareDepotWalk } from "./city-course.mjs";
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
const parkedFleet = option("parked-fleet", "false") === "true";
if (parkedFleet && !arrivalKind.startsWith("racetrack"))
  throw Error("Synthetic parked fleet requires a racetrack arrival");
const viewport = option("viewport", "411x789").split("x").map(Number);
if (viewport.length !== 2 || viewport.some((v) => !Number.isInteger(v) || v < 200 || v > 3840))
  throw Error("Invalid viewport: expected WIDTHxHEIGHT, 200–3840 pixels per side");
const driveModel = option("drive-model", "native");
const course = option("course", "street");
const courseStrength = Number(option("course-strength", "1"));
const assertMoving = option("assert-moving", "false") === "true";
if (!Number.isFinite(courseStrength) || courseStrength < 0.1 || courseStrength > 1)
  throw Error("Course strength must be 0.1–1");
if (course !== "racetrack" && courseStrength !== 1)
  throw Error("Course strength applies only to the circuit");
if (!["street", "depot", "racetrack"].includes(course)) throw Error("Invalid driving course");
if (course !== "street" && (!arrivalKind.startsWith("racetrack") || driveModel !== "native"))
  throw Error("Depot/racetrack courses require a racetrack arrival and native vehicle");
const driveReverseAt = Number(option("drive-reverse-at", "0"));
if (!Number.isFinite(driveReverseAt) || driveReverseAt < 0 || driveReverseAt >= seconds)
  throw Error("Drive reverse time must be zero (disabled) or within the sampling window");
if (!["native", "compact-1"].includes(driveModel)) throw Error("Invalid drive model");
if (
  !["gateway", "core", "racetrack", "racetrack-north", "racetrack-center"].includes(arrivalKind) ||
  ![0.05, 0.1, 0.25].includes(overviewZoom)
)
  throw Error("Invalid arrival/overview zoom");
const jobs = option("stages", "standing,walk,drive,overview,overview-drive").split(",");
const deep = option("deep", "false") === "true",
  cpu = option("cpu", "false") === "true";
const trace = option("trace", "false") === "true",
  renderProfile = option("render-profile", "false") === "true";
const meshImageCache = option("mesh-image-cache", "true") === "true";
const batchTextures = Number(option("batch-textures", "8"));
const deferCachedImages = option("defer-cached-images", "true") === "true";
if (![1, 2, 4, 8].includes(batchTextures)) throw Error("Invalid batch texture limit");
const rasterReferencePath = option("raster-reference", "");
const rasterReference = rasterReferencePath
  ? await readFile(path.resolve(rasterReferencePath), "utf8")
  : null;
if (rasterReference && (batchTextures !== 1 || deferCachedImages))
  throw Error("Original raster control requires --batch-textures=1 --defer-cached-images=false");
const rasterReferenceSHA256 = rasterReference
  ? createHash("sha256").update(rasterReference).digest("hex")
  : null;
const presentationReferences = new Map();
for (const [optionName, file] of [
  ["backend-reference", "src/rendering/GpuRenderBackend.ts"],
  ["surface-scene-reference", "src/rendering/presentSurfaceScene.ts"],
]) {
  const source = option(optionName, "");
  if (source) presentationReferences.set(file, await readFile(path.resolve(source), "utf8"));
}
const meshTargetReuse = option("mesh-target-reuse", "false") === "true";
if (meshTargetReuse && (renderer !== "gpu" || !meshes))
  throw Error("Mesh target reuse requires GPU meshes");
if (trace && cpu) throw Error("Trace and CPU sampling must use separate attribution captures");
const touch = option("touch", endpoint ? "true" : "false") === "true";
if (course === "racetrack" && (!touch || driveReverseAt))
  throw Error("Circuit steering requires touch and no timed reverse");
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
for (const [k, v] of Object.entries({ seconds, warmSeconds }))
  if (!Number.isFinite(v) || v < 2 || v > 60) throw Error(`Invalid ${k}: expected 2–60`);
if (!Number.isFinite(cooldown) || cooldown < 2 || cooldown > 600)
  throw Error("Invalid cooldown: expected 2–600 seconds");
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
  trace,
  renderProfile,
  meshTargetReuse,
  meshImageCache,
  batchTextures,
  deferCachedImages,
  rasterReferenceSHA256,
  seconds,
  warmSeconds,
  overviewZoom,
  arrivalKind,
  parkedFleet,
  viewport,
  driveModel,
  course,
  courseStrength,
  assertMoving,
  driveReverseAt,
  limits:
    "Native game Worker/IndexedDB/current seed-2026 city; normal traffic/pedestrians. Inclusive opt-in timers add overhead. Driver setup boards an existing native car (or an explicit one-for-one production-factory model replacement) after a diagnostic pose/stop; subsequent input is native. CPU and deep census are attribution lanes, not clean timing controls. rAF measures callback cadence, not displayed GPU presentation.",
  probesSHA256: {},
  cases: [],
};
for (const file of [
  "city-audit.mjs",
  "city-audit-profile.mjs",
  "city-course.mjs",
  "worker-cpu.mjs",
])
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
  "src/traffic/DrivingQueries.ts",
  "src/client/PlayerPredictor.ts",
  "src/client/ClientStateView.ts",
  "src/rendering/GpuMeshBodies.ts",
  "src/rendering/CarBodyImageCache.ts",
  "src/rendering/CarMeshAsset.ts",
  "src/rendering/VehicleGeometryBatches.ts",
  "src/rendering/AuthoredVehicleMeshes.ts",
  "src/rendering/CarPixelOutline.ts",
  "src/rendering/GpuRasterSurface.ts",
  "src/rendering/GpuRenderBackend.ts",
  "src/rendering/GpuOverlayResources.ts",
  "src/rendering/presentSurfaceScene.ts",
  "src/rendering/TileRenderer.ts",
  "src/rendering/RasterRenderBackend.ts",
  "src/rendering/collectScene.ts",
  "src/scenarios/NaturalLandscapeRecipe.ts",
  "src/generation/regional/DenseDistrictPlanner.ts",
])
  try {
    report.sourcesSHA256[file] = createHash("sha256")
      .update(
        file === "src/rendering/GpuRasterSurface.ts" && rasterReference
          ? rasterReference
          : (presentationReferences.get(file) ?? (await readFile(path.join(root, file)))),
      )
      .digest("hex");
  } catch (error) {
    if (
      ["src/traffic/DrivingQueries.ts", "src/rendering/VehicleGeometryBatches.ts"].includes(file) &&
      error.code === "ENOENT"
    )
      report.sourcesSHA256[file] = null;
    else throw error;
  }
const server = await createServer({
  root,
  configFile: false,
  cacheDir: path.join(temp, "vite-cache"),
  base: "/tilefun/",
  optimizeDeps: { entries: ["index.html"] },
  plugins: [
    react(),
    {
      name: "city-authority-probe",
      enforce: "pre",
      transform(code, id) {
        const file = id.split("?")[0];
        for (const [module, source] of presentationReferences)
          if (file.endsWith(`/${module}`) && !id.includes("?raw")) return source;
        if (
          rasterReference &&
          file.endsWith("/src/rendering/GpuRasterSurface.ts") &&
          !id.includes("?raw")
        )
          return rasterReference;
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
            "        for (const [entity, elapsed] of entityTickDts)\n          if (entity.resident)",
            '        globalThis.__cityPhase?.("ai", performance.now() - __cityAIStart);\n        for (const [entity, elapsed] of entityTickDts)\n          if (entity.resident)',
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
let browser, page, context, cdp, profiler, activeTrace;
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
      : await browser.newContext({
          viewport: { width: viewport[0], height: viewport[1] },
          hasTouch: touch,
        });
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
      const r = naturalLandscapeRecipe(
        kind.startsWith("racetrack") ? "racetrack" : "city-center",
        "thicket",
      );
      if (kind === "racetrack-north") return { x: 462, y: 412, generation: r.generation };
      if (kind === "racetrack-center") return { x: 462, y: 455, generation: r.generation };
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
    let fleet;
    if (parkedFleet) {
      const models = await page.evaluate(async () => {
        const { VEHICLE_MODELS } = await import("/tilefun/src/traffic/Vehicle.ts");
        return VEHICLE_MODELS.slice(0, 45);
      });
      // Explicit diagnostic fixture: native parked placements around the track center.
      // The grid can obstruct racers. This characterizes rendering density,
      // not an owner's saved depot or unchanged race-simulation costs.
      fleet = await worker.evaluate((models) => {
        const r = globalThis.__diagnosticAuthority.activeRealm;
        const placed = [];
        for (const [index, model] of models.entries()) {
          const x = 462 * 16 + ((index % 9) - 4) * 176;
          const y = 455 * 16 + (Math.floor(index / 9) - 2) * 112 + 56;
          if (r.traffic.place(model, x, y, 3)) placed.push(model);
        }
        return { requested: models.length, placed };
      }, models);
      if (fleet.placed.length !== models.length)
        throw Error(
          `Incomplete synthetic fleet placement: ${fleet.placed.length}/${models.length}`,
        );
    }
    let driver;
    if (stage === "walk" && course === "depot") await worker.evaluate(prepareDepotWalk);
    if (stage.includes("drive") && course !== "street") {
      // Admit the real circuit/depot before selecting its native vehicle.
      await page.evaluate(() => document.querySelector("#game").__game.debugPanel.setZoom(0.1));
      await page.waitForFunction(cityReady, null, { timeout: 60000 });
      await worker.evaluate(async (course) => {
        const end = performance.now() + 10000;
        while (
          ![...globalThis.__diagnosticAuthority.activeRealm.traffic.states.values()].some((s) =>
            course === "racetrack"
              ? s.lane.race
              : s.entity.proceduralId?.includes(":vehicle-depot:bridge-car"),
          )
        ) {
          if (performance.now() > end) throw Error("Native course vehicles did not populate");
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }, course);
      driver = await worker.evaluate(prepareCityCourse, course);
    } else if (stage.includes("drive")) {
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
    await page.evaluate(
      ({ enabled, limit, defer }) => {
        const backend = document.querySelector("#game").__game.renderer;
        backend.surface?.setBatchTextureLimit?.(limit);
        const meshes = backend.meshes;
        if (meshes?.images) {
          meshes.images.clear();
          meshes.images.enabled = enabled;
          meshes.deferCachedImages = defer;
        }
      },
      { enabled: meshImageCache, limit: batchTextures, defer: deferCachedImages },
    );
    if (meshTargetReuse) await page.evaluate(installCityMeshTargetReuse);
    const zoom = stage.startsWith("overview") ? overviewZoom : 1;
    await page.evaluate((z) => document.querySelector("#game").__game.debugPanel.setZoom(z), zoom);
    await page.waitForFunction(
      (z) => document.querySelector("#game").__game.camera.zoom === z,
      zoom,
    );
    await page.waitForFunction(cityReady, null, { timeout: 60000 });
    await page.waitForTimeout(warmSeconds * 1000);
    const thermalStart = androidCli ? readAndroidThermals(androidCli) : undefined;
    if (thermalStart && (thermalStart.batteryC > maxC || thermalStart.thermalStatus !== 0)) {
      report.setupThermalFailure = { stage, gate, thermalStart };
      throw Error("Thermal gate lost during setup");
    }
    const begin = await worker.evaluate(() => globalThis.__cityRead().population);
    await worker.evaluate(() => globalThis.__cityReset());
    let points;
    const key = driver?.key ?? "ArrowRight";
    let heldKey = key;
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
    if (renderProfile) await page.evaluate(installCityRenderProfile);
    let traceComplete;
    if (trace) {
      traceComplete = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
      await cdp.send("Tracing.start", {
        transferMode: "ReturnAsStream",
        categories:
          "devtools.timeline,toplevel,blink.user_timing,cc,viz,gpu,v8,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.gc",
      });
      activeTrace = cdp;
      await page.evaluate(() => {
        window.__cityTrace = true;
      });
    }
    const inputAbort = new AbortController();
    const inputChanges = [];
    const reverseInput = async () => {
      if (!moving || !driveReverseAt) return;
      await delay(driveReverseAt * 1000, undefined, { signal: inputAbort.signal });
      heldKey = key === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
      if (touch)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ ...points, x: points.x + (heldKey === "ArrowRight" ? 50 : -50) }],
        });
      else {
        await page.keyboard.up(key);
        await page.keyboard.down(heldKey);
      }
      inputChanges.push({ afterSeconds: driveReverseAt, key: heldKey });
    };
    const steerCourse = async () => {
      if (!driver || course !== "racetrack") return;
      const end = Date.now() + seconds * 1000;
      while (!inputAbort.signal.aborted && Date.now() < end) {
        const position = await page.evaluate(
          () => document.querySelector("#game").__game.stateView.playerEntity.position,
        );
        const direction = courseDirection(driver.points, position);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              ...points,
              x: points.x + direction.x * 50 * courseStrength,
              y: points.y + direction.y * 50 * courseStrength,
            },
          ],
        });
        inputChanges.push({ elapsedMs: seconds * 1000 - (end - Date.now()), ...direction });
        await delay(100, undefined, { signal: inputAbort.signal });
      }
    };
    let data;
    try {
      [data] = await Promise.all([
        page.evaluate(sampleCityClient, seconds),
        reverseInput(),
        steerCourse(),
      ]);
    } finally {
      inputAbort.abort();
    }
    const authority = await worker.evaluate(() => globalThis.__cityRead());
    let cpuSummary, mainCpu;
    if (profiler) {
      const [profile, mainResult] = await Promise.all([profiler.stop(), cdp.send("Profiler.stop")]);
      profiler = undefined;
      await writeFile(
        path.join(output, `${report.cases.length}-${stage}.cpuprofile`),
        JSON.stringify(profile),
        { mode: 0o600 },
      );
      cpuSummary = summarizeWorkerCpu(profile);
      const main = mainResult.profile;
      await writeFile(
        path.join(output, `${report.cases.length}-${stage}-main.cpuprofile`),
        JSON.stringify(main),
        { mode: 0o600 },
      );
      mainCpu = summarizeWorkerCpu(main);
    }
    if (moving) {
      if (touch) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else await page.keyboard.up(heldKey);
    }
    const thermalEnd = androidCli ? readAndroidThermals(androidCli) : undefined;
    if (meshTargetReuse)
      data.meshTargetReuse = await page.evaluate(() => window.__cityMeshTargetReuse());
    if (trace) {
      await cdp.send("Tracing.end");
      const { stream } = await traceComplete;
      activeTrace = undefined;
      // Raw browser traces may contain unrelated browser metadata; keep them local.
      const file = await open(
        path.join(output, `${report.cases.length}-${stage}-trace.json`),
        "w",
        0o600,
      );
      try {
        for (;;) {
          const chunk = await cdp.send("IO.read", { handle: stream, size: 1024 * 1024 });
          await file.writeFile(
            chunk.base64Encoded ? Buffer.from(chunk.data, "base64") : chunk.data,
          );
          if (chunk.eof) break;
        }
      } finally {
        await file.close();
        await cdp.send("IO.close", { handle: stream });
      }
    }
    const row = {
      stage,
      arrival,
      driver,
      inputChanges,
      fleet,
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
    if (assertMoving && moving) {
      const stopped = data.motion.slice(1).filter((point, i) => {
        const previous = data.motion[i];
        return (
          point.elapsedMs - previous.elapsedMs >= 500 &&
          Math.hypot(point.wx - previous.wx, point.wy - previous.wy) <= 1
        );
      });
      if (stopped.length)
        throw Error(`Driving course stopped in ${stopped.length} motion intervals`);
    }
  }
} catch (error) {
  report.failure = { message: String(error), errors: [...errors] };
  await save();
  throw error;
} finally {
  if (activeTrace) await activeTrace.send("Tracing.end").catch(() => {});
  if (profiler) await profiler.close().catch(() => {});
  if (page) {
    await page
      .evaluate(() => {
        window.__cityRenderProfile?.();
        window.__cityMeshTargetReuse?.();
      })
      .catch(() => {});
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
