// Reversible diagnostic controls in an isolated game origin; never production policies.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { readAndroidThermals } from "../android-thermal-gate.mjs";
import { startWorkerCpu, summarizeWorkerCpu } from "./worker-cpu.mjs";

const option = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const endpoint = option("cdp", "");
const port = Number(option("port", "0"));
const seconds = Number(option("seconds", "15"));
const motion = option("motion", "idle");
const physicsProfile = option("physics-profile", "false") === "true";
const workerCpu = option("worker-cpu", "false") === "true";
if (!["idle", "walk"].includes(motion)) throw Error("--motion must be idle or walk");
const output = option("output", path.join(os.tmpdir(), "tilefun-mobile-authority"));
const androidCli = option("android-device-cli", "");
const robinReferencePath = option("robin-reference", "");
const robinReference = robinReferencePath ? await readFile(robinReferencePath, "utf8") : undefined;
const realmReferencePath = option("realm-reference", "");
const realmReference = realmReferencePath ? await readFile(realmReferencePath, "utf8") : undefined;
const aiReferencePath = option("ai-reference", "");
const aiReference = aiReferencePath ? await readFile(aiReferencePath, "utf8") : undefined;
const controls = option("controls", "baseline,visible-ai,sleep-hidden,no-ai,baseline").split(",");
const scenes = option("scenes", "dog").split(",");
if (endpoint && !port) throw Error("Physical CDP requires a dedicated --port");
if (!Number.isFinite(seconds) || seconds < 2 || seconds > 60) throw Error("--seconds must be 2–60");
if (
  controls.some(
    (control) =>
      ![
        "baseline",
        "visible-ai",
        "sleep-hidden",
        "no-ai",
        "query-cache",
        "sleep-hidden-cache",
      ].includes(control),
  )
)
  throw Error("Unknown diagnostic control");
await mkdir(output, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-authority-data-"));
for (const key of [
  "WORKSHOP_AUTH_DIR",
  "WORKSHOP_DATA_DIR",
  "ART_NOTES_DIR",
  "INTERIOR_REVIEW_DIR",
])
  process.env[key] = path.join(temp, key);
const server = await createServer({
  root: path.resolve(import.meta.dirname, "../.."),
  configFile: false,
  base: "/tilefun/",
  optimizeDeps: { entries: ["index.html"] },
  plugins: [
    react(),
    {
      name: "diagnostic-authority-access",
      enforce: "pre",
      transform(code, id) {
        if (realmReference && id.split("?")[0].endsWith("/src/server/Realm.ts")) {
          if (!physicsProfile) return realmReference;
          code = realmReference;
        }
        const replaceOnce = (from, to) => {
          if (code.split(from).length !== 2) throw Error(`Physics probe marker changed in ${id}`);
          code = code.replace(from, to);
        };
        if (physicsProfile && id.split("?")[0].endsWith("/src/entities/EntityManager.ts")) {
          replaceOnce(
            "const playerSet = new Set(players);",
            `let __phase = "setup", __start = performance.now();
            const __mark = (next) => {
              globalThis.__diagnosticProfile?.record("physics." + __phase, performance.now() - __start);
              __phase = next; globalThis.__diagnosticPhysicsPhase = next; __start = performance.now();
            };
            globalThis.__diagnosticPhysicsPhase = "setup";
            const playerSet = new Set(players);`,
          );
          for (const [marker, phase] of [
            ["// --- Phase 1:", "passive-player-movement"],
            ["// --- Phase 2:", "npc-movement"],
            ["// --- Phase 2.5:", "ground-tracking"],
            ["// Update spatial hash after all movement", "first-index"],
            ["// --- Phase 3:", "separation"],
            ["// --- Phase 4:", "attachments-index"],
            ["// --- Phase 5:", "animation"],
          ])
            replaceOnce(marker, `__mark("${phase}"); ${marker}`);
          replaceOnce(
            "    }\n  }\n\n  /**\n   * Resolve world positions",
            '    }\n    __mark("outside");\n  }\n\n  /**\n   * Resolve world positions',
          );
          replaceOnce(
            "const blocked = resolveCollision(",
            "globalThis.__diagnosticProfile?.recordMovement(dx, dy);\n        const blocked = resolveCollision(",
          );
          return code;
        }
        if (physicsProfile && id.split("?")[0].endsWith("/src/server/Realm.ts")) {
          replaceOnce(
            "// ── Phase 1: Process player inputs",
            'const __inputStart = performance.now();\n    globalThis.__diagnosticPhysicsPhase = "player-input";\n    // ── Phase 1: Process player inputs',
          );
          replaceOnce(
            "// ── Phase 2: AI + Physics",
            'globalThis.__diagnosticProfile?.record("player.input-phase", performance.now() - __inputStart);\n    globalThis.__diagnosticPhysicsPhase = "outside";\n    // ── Phase 2: AI + Physics',
          );
          replaceOnce(
            "const p = session.player;\n          const nearbyProps",
            'const p = session.player;\n          const __jumpStart = performance.now();\n          globalThis.__diagnosticPhysicsPhase = "player-jump";\n          const nearbyProps',
          );
          replaceOnce(
            "          this.handlePlayerStepOutcome(\n",
            '          globalThis.__diagnosticProfile?.record("player.jump-support", performance.now() - __jumpStart);\n          globalThis.__diagnosticPhysicsPhase = "outside";\n          this.handlePlayerStepOutcome(\n',
          );
          return code;
        }
        if (robinReference && id.split("?")[0].endsWith("/src/wildlife/robinAI.ts"))
          return robinReference;
        if (id.split("?")[0].endsWith("/src/server/local-server.worker.ts"))
          return code.replace(
            "let initialized = false;",
            "globalThis.__diagnosticAuthority = runtime.server;\nlet initialized = false;",
          );
        if (id.split("?")[0].endsWith("/src/server/tickAllAI.ts")) {
          code = aiReference ?? code;
          const names = [
            "updateFaunaAI",
            "updateDeerAI",
            "updateRobinAI",
            "updateRabbitAI",
            "updateFrogAI",
            "updateMallardAI",
          ];
          for (const name of names)
            code = code.replaceAll(`${name}(entity,`, `__diagnosticAI("${name}", ${name}, entity,`);
          return (
            code +
            `\nfunction __diagnosticAI(name, fn, ...args) { const p = globalThis.__diagnosticProfile; if (!p) return fn(...args); const start = performance.now(); try { return fn(...args); } finally { p.record(name, performance.now() - start); } }`
          );
        }
        if (id.split("?")[0].endsWith("/src/wildlife/robinPerches.ts")) {
          return (
            code.replace(
              "export function robinTreePerches(",
              "function __originalRobinTreePerches(",
            ) +
            `\nexport function robinTreePerches(props) { const cache = globalThis.__diagnosticPerchCache; if (!cache) return __originalRobinTreePerches(props); let perches = cache.get(props); if (!perches) { perches = __originalRobinTreePerches(props); cache.set(props, perches); } return perches; }`
          );
        }
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
  logLevel: "error",
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
const browser = endpoint
  ? await chromium.connectOverCDP(endpoint, { noDefaults: true })
  : await chromium.launch({ channel: "chromium", headless: true });
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  physical: !!endpoint,
  instrumented: true,
  motion,
  physicsProfile,
  workerCpu,
  robinReference: !!robinReference,
  realmReference: !!realmReference,
  aiReference: !!aiReference,
  cases: [],
};
let page;
let currentErrors = [];
let profiler;
try {
  for (const scene of scenes)
    for (const control of controls) {
      const thermalsBefore = androidCli ? readAndroidThermals(androidCli) : undefined;
      const context = endpoint
        ? browser.contexts()[0]
        : await browser.newContext({ viewport: { width: 411, height: 789 }, hasTouch: true });
      page = await context.newPage();
      await page.bringToFront();
      const cdp = await context.newCDPSession(page);
      const errors = [];
      currentErrors = errors;
      page.on("pageerror", (e) => errors.push(e.message));
      await cdp.send("Storage.clearDataForOrigin", {
        origin: new URL(origin).origin,
        storageTypes: "all",
      });
      await page.goto(`${origin}/tools.html`);
      const arrival = await page.evaluate(async (scene) => {
        const { naturalLandscapeRecipe } = await import(
          "/tilefun/src/scenarios/NaturalLandscapeRecipe.ts"
        );
        const recipe = naturalLandscapeRecipe(scene, "thicket");
        return {
          x: recipe.player.position.wx / 16,
          y: recipe.player.position.wy / 16,
          generation: recipe.generation,
        };
      }, scene);
      await page.goto(
        `${origin}/?perf&nogamepad&generation=${encodeURIComponent(JSON.stringify(arrival.generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
      );
      await page.getByRole("button", { name: "New World", exact: true }).click();
      await page.waitForFunction(() => {
        const g = document.querySelector("#game").__game;
        return (
          g.stateView.playerEntity.id > 0 &&
          !g.mainMenu.visible &&
          g.renderer.getDiagnostics().pending === 0
        );
      });
      const worker = page.workers().find((w) => w.url().includes("local-server.worker"));
      if (!worker) throw Error("No authority Worker");
      const diagnosticOptions = { control, physicsProfile };
      await worker.evaluate((settings) => {
        const { control, physicsProfile } = settings;
        const server = globalThis.__diagnosticAuthority,
          realm = server.activeRealm;
        const timings = {};
        const tickTimes = [];
        const record = (name, ms) => {
          timings[name] ??= { values: [], count: 0, totalMs: 0, max: 0 };
          const t = timings[name];
          t.count++;
          t.totalMs += ms;
          t.max = Math.max(t.max, ms);
          t.values[(t.count - 1) % 6000] = ms;
        };
        const movementCounts = { stationary: 0, moving: 0 };
        globalThis.__diagnosticProfile = {
          record,
          recordMovement: (dx, dy) => {
            movementCounts[dx === 0 && dy === 0 ? "stationary" : "moving"]++;
          },
        };
        const summary = () =>
          Object.fromEntries(
            Object.entries(timings).map(([name, t]) => {
              const s = t.values.slice().sort((a, b) => a - b);
              return [
                name,
                {
                  count: t.count,
                  totalMs: t.totalMs,
                  max: t.max,
                  p50: s[Math.floor(s.length * 0.5)] ?? 0,
                  p95: s[Math.floor(s.length * 0.95)] ?? 0,
                  p99: s[Math.floor(s.length * 0.99)] ?? 0,
                },
              ];
            }),
          );
        const queryCounts = {};
        if (physicsProfile) {
          for (const [owner, key, label] of [
            [realm.propManager, "getPropsInChunkRange", "props"],
            [realm.entityManager.spatialHash, "queryRange", "entities"],
            [realm.entityManager.spatialHash, "update", "index"],
          ]) {
            const original = owner[key];
            owner[key] = function (...args) {
              const result = original.apply(this, args);
              const name = `${globalThis.__diagnosticPhysicsPhase ?? "outside"}.${label}`;
              queryCounts[name] ??= { calls: 0, candidates: 0, maxCandidates: 0 };
              const counts = queryCounts[name];
              counts.calls++;
              counts.candidates += result?.length ?? 0;
              counts.maxCandidates = Math.max(counts.maxCandidates, result?.length ?? 0);
              return result;
            };
          }
        }
        const sessions = [...realm.sessions.values()];
        const visible = (e, halo) => {
          const wx = e.position.wx,
            wy = e.position.wy;
          const cx = Math.floor(wx / 256),
            cy = Math.floor(wy / 256);
          return sessions.some((s) => {
            const r = s.visibleRange;
            const dx = wx - s.player.position.wx,
              dy = wy - s.player.position.wy;
            return (
              e.type === "player" ||
              e.parentId !== undefined ||
              dx * dx + dy * dy < 128 * 128 ||
              (cx >= r.minCx - halo &&
                cx <= r.maxCx + halo &&
                cy >= r.minCy - halo &&
                cy <= r.maxCy + halo)
            );
          });
        };
        if (control.startsWith("sleep-hidden")) {
          const original = realm.computeEntityTickDtsMulti;
          realm.computeEntityTickDtsMulti = function (...args) {
            const selected = original.apply(this, args);
            for (const e of selected.keys())
              if (
                (e.fauna || e.deer || e.robin || e.frog || e.mallard || e.rabbit) &&
                !visible(e, 1)
              )
                selected.delete(e);
            return selected;
          };
        }
        if (control.includes("cache")) {
          const query = realm.propManager.getPropsInChunkRange;
          const cache = new Map();
          realm.propManager.getPropsInChunkRange = function (...args) {
            const key = args.join(",");
            let props = cache.get(key);
            if (!props) {
              props = query.apply(this, args);
              cache.set(key, props);
            }
            return props;
          };
          const tick = server.tick;
          server.tick = function (...args) {
            cache.clear();
            globalThis.__diagnosticPerchCache = new WeakMap();
            return tick.apply(this, args);
          };
        }
        let decisionCount = 0,
          activeCount = 0;
        const decisions = realm.decisionDts;
        realm.decisionDts = function (...args) {
          const chosen = decisions.apply(this, args);
          if (control === "no-ai") chosen.clear();
          if (control === "visible-ai")
            for (const e of chosen.keys())
              if (e.type !== "player" && !visible(e, 0)) chosen.delete(e);
          decisionCount = chosen.size;
          activeCount = args[0].size;
          return chosen;
        };
        for (const [owner, key, name] of [
          [server, "tick", "tick"],
          [realm.entityManager, "update", "physics"],
          [realm, "computeEntityTickDtsMulti", "selection"],
          realm.propActivity
            ? [realm.propActivity, "select", "prop-selection"]
            : [realm.propManager.props, "filter", "prop-selection"],
          [realm.worldAPI.tick, "firePre", "pre-hooks"],
          [realm.streaming, "update", "streaming"],
          [realm, "decisionDts", "decision-selection"],
          [realm, "replicate", "replication"],
          [realm.worldAPI.overlap, "tick", "overlap"],
          [realm.worldAPI.tags, "tick", "tags"],
        ]) {
          const original = owner[key];
          owner[key] = function (...args) {
            const start = performance.now();
            if (name === "tick") {
              tickTimes.push(start);
              if (tickTimes.length > 6000) tickTimes.shift();
            }
            try {
              return original.apply(this, args);
            } finally {
              record(name, performance.now() - start);
            }
          };
        }
        const tickCounts = [];
        const pre = realm.worldAPI.tick.firePre;
        realm.worldAPI.tick.firePre = function (...args) {
          tickCounts.push({ active: activeCount, decisions: decisionCount });
          if (tickCounts.length > 6000) tickCounts.shift();
          return pre.apply(this, args);
        };
        globalThis.__diagnosticRead = () => ({
          measuredTickHz:
            tickTimes.length > 1
              ? ((tickTimes.length - 1) * 1000) / (tickTimes.at(-1) - tickTimes[0])
              : 0,
          tickTimes,
          timings: summary(),
          queryCounts,
          movementCounts,
          tickCounts,
          resident: realm.entityManager.entities.length,
          props: realm.propManager.props.length,
          visible: realm.entityManager.entities.filter((e) => visible(e, 0)).length,
          halo: realm.entityManager.entities.filter((e) => visible(e, 1)).length,
          ticks: server.completedTicks,
          view: [...realm.sessions.values()].map((s) => ({ ...s.visibleRange })),
          species: Object.fromEntries(
            [...new Set(realm.entityManager.entities.map((e) => e.type))].map((type) => [
              type,
              realm.entityManager.entities.filter((e) => e.type === type).length,
            ]),
          ),
        });
        globalThis.__diagnosticReset = () => {
          for (const key of Object.keys(timings)) delete timings[key];
          tickCounts.length = 0;
          tickTimes.length = 0;
          for (const key of Object.keys(queryCounts)) delete queryCounts[key];
          movementCounts.stationary = 0;
          movementCounts.moving = 0;
        };
      }, diagnosticOptions);
      await page.waitForTimeout(2000);
      await worker.evaluate(() => globalThis.__diagnosticReset());
      if (motion === "walk") await page.keyboard.down("ArrowRight");
      if (workerCpu) {
        profiler = await startWorkerCpu(browser, worker.url());
        await worker.evaluate(() => globalThis.__diagnosticReset());
      }
      const data = await page.evaluate(async (seconds) => {
        const g = document.querySelector("#game").__game;
        g.performanceMetrics.reset();
        await g.transport.resetDiagnostics();
        const samples = [],
          renders = [],
          updates = [],
          acks = new Map(),
          ackTimes = [];
        let maxReplay = 0,
          maxResim = 0,
          maxTravel = 0,
          lastAck = g.stateView.lastProcessedInputSeq,
          lastFrame = performance.now();
        const initialPosition = { ...g.stateView.playerEntity.position };
        const callbacks = g.loop.callbacks,
          render = callbacks.render,
          update = callbacks.update,
          send = g.transport.send;
        g.transport.send = function (message) {
          if (message.type === "player-input") acks.set(message.seq, performance.now());
          return send.call(this, message);
        };
        callbacks.update = (...args) => {
          const start = performance.now();
          const result = update(...args);
          const p = g.stateView.playerEntity.position;
          maxTravel = Math.max(
            maxTravel,
            Math.hypot(p.wx - initialPosition.wx, p.wy - initialPosition.wy),
          );
          updates.push(performance.now() - start);
          const d = g.remoteView._predictor?.lastReconcileDiagnostics;
          if (d) {
            maxReplay = Math.max(maxReplay, d.replayCount);
            maxResim = Math.max(maxResim, d.resimPosErr);
          }
          const ack = g.stateView.lastProcessedInputSeq;
          if (ack !== lastAck && acks.has(ack)) ackTimes.push(performance.now() - acks.get(ack));
          lastAck = ack;
          for (const seq of acks.keys()) if (seq <= ack) acks.delete(seq);
          return result;
        };
        callbacks.render = (...args) => {
          const start = performance.now();
          const result = render(...args);
          renders.push(performance.now() - start);
          return result;
        };
        const start = performance.now();
        try {
          while (performance.now() - start < seconds * 1000) {
            const now = await new Promise(requestAnimationFrame);
            samples.push(now - lastFrame);
            lastFrame = now;
          }
        } finally {
          callbacks.render = render;
          callbacks.update = update;
          g.transport.send = send;
        }
        const summary = (values) => {
          values.sort((a, b) => a - b);
          return {
            count: values.length,
            p50: values[Math.floor(values.length * 0.5)] ?? 0,
            p95: values[Math.floor(values.length * 0.95)] ?? 0,
            p99: values[Math.floor(values.length * 0.99)] ?? 0,
            max: values.at(-1) ?? 0,
          };
        };
        return {
          elapsedMs: performance.now() - start,
          frames: summary(samples),
          framesOver25: samples.filter((x) => x > 25).length,
          renderMs: summary(renders),
          updateMs: summary(updates),
          ackMs: summary(ackTimes),
          maxReplay,
          maxResim,
          initialPosition,
          finalPosition: { ...g.stateView.playerEntity.position },
          maxTravel,
          replicatedEntities: g.stateView.entities.length,
          host: await g.transport.getDiagnostics(),
          viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        };
      }, seconds);
      // Read timings before Profiler.stop can pause the Worker for profile export.
      const authority = await worker.evaluate(() => globalThis.__diagnosticRead());
      let cpu;
      if (profiler) {
        const profile = await profiler.stop();
        profiler = undefined;
        const file = `${scene}-${motion}-${report.cases.length + 1}.cpuprofile`;
        await writeFile(path.join(output, file), JSON.stringify(profile));
        cpu = { file, ...summarizeWorkerCpu(profile) };
      }
      if (motion === "walk") await page.keyboard.up("ArrowRight");
      const thermalsAfter = androidCli ? readAndroidThermals(androidCli) : undefined;
      const row = {
        scene,
        control,
        motion,
        thermalsBefore,
        thermalsAfter,
        cpu,
        ...data,
        authority,
        authorityHz: authority.measuredTickHz,
        errors,
      };
      report.cases.push(row);
      console.log(
        JSON.stringify({
          scene,
          control,
          authorityHz: row.authorityHz,
          frameP95: data.frames.p95,
          missed: data.framesOver25,
          ackP95: data.ackMs.p95,
          tick: authority.timings.tick,
          physics: authority.timings.physics,
          fauna: authority.timings.updateFaunaAI,
          active: authority.tickCounts.at(-1)?.active,
          resident: authority.resident,
          visible: authority.visible,
          halo: authority.halo,
          thermal: thermalsAfter,
        }),
      );
      await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
      if (endpoint) {
        await page.goto("about:blank");
        await cdp.send("Storage.clearDataForOrigin", {
          origin: new URL(origin).origin,
          storageTypes: "all",
        });
      }
      await page.close();
      page = undefined;
      if (!endpoint) await context.close();
    }
} catch (error) {
  await writeFile(
    path.join(output, "failure.json"),
    JSON.stringify(
      {
        message: String(error),
        errors: currentErrors,
        body: await page
          ?.locator("body")
          .innerText({ timeout: 2000 })
          .catch(() => "unavailable"),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (profiler) await profiler.close().catch(() => {});
  if (page && motion === "walk") await page.keyboard.up("ArrowRight").catch(() => {});
  if (page && endpoint) {
    const cleanup = await page
      .context()
      .newCDPSession(page)
      .catch(() => undefined);
    await page.goto("about:blank").catch(() => {});
    await cleanup
      ?.send("Storage.clearDataForOrigin", {
        origin: new URL(origin).origin,
        storageTypes: "all",
      })
      .catch(() => {});
    await cleanup?.detach().catch(() => {});
  }
  await page?.close().catch(() => {});
  await browser.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}
