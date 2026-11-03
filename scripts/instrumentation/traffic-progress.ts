/** Sustained native route/liveness attribution. Preloaded ordinary Realm, no GPU,
 * network latency or physical-device claim. Default run is four simulated minutes. */
import { writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { PerformanceObserver } from "node:perf_hooks";
import { setImmediate as yieldEventLoop } from "node:timers/promises";
import { performanceMetrics } from "../../src/diagnostics/PerformanceMetrics.js";
import { crowdedRoadTrafficRecipe } from "../../src/scenarios/RoadTrafficRecipe.js";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.js";

const recipe = crowdedRoadTrafficRecipe();
const s = await ScenarioSession.create(recipe);
const samples = [];
const gc: { at: number; ms: number }[] = [];
const observer = new PerformanceObserver((list) => {
  for (const e of list.getEntries())
    if (gc.length < 128) gc.push({ at: e.startTime, ms: e.duration });
});
observer.observe({ entryTypes: ["gc"] });
const slowTicks: {
  tick: number;
  at: number;
  ms: number;
  stepMs: number;
  geometryBuildMs: number;
  newSections: number;
  rebuilds: number;
  newBodies: number;
}[] = [];
const registry = s.realm.vehicleRegistry;
const traffic = registry?.traffic;
if (!traffic) throw Error("Missing ordinary traffic");
const plan = traffic.plan.bind(traffic);
traffic.plan = (...args) => {
  const start = performanceMetrics.start();
  const intents = plan(...args);
  performanceMetrics.end("realm.traffic", start);
  return intents;
};
try {
  await s.ready({ minCx: -5, maxCx: 5, minCy: -5, maxCy: 5 });
  performanceMetrics.reset();
  for (let tick = 0; tick < 14400; tick++) {
    const before = s.realm.collisionDiagnostics,
      at = performance.now();
    s.tick();
    const ms = performance.now() - at;
    if (ms > 8 && slowTicks.length < 20) {
      const after = s.realm.collisionDiagnostics;
      slowTicks.push({
        tick: tick + 1,
        at,
        ms,
        stepMs: after?.stepMs ?? 0,
        geometryBuildMs:
          (after?.geometryRebuilds ?? 0) > (before?.geometryRebuilds ?? 0)
            ? (after?.geometryBuildMs ?? 0)
            : 0,
        newSections: (after?.geometryBuilds ?? 0) - (before?.geometryBuilds ?? 0),
        rebuilds: (after?.geometryRebuilds ?? 0) - (before?.geometryRebuilds ?? 0),
        newBodies: (after?.bodyCreates ?? 0) - (before?.bodyCreates ?? 0),
      });
    }
    if (tick % 600 === 599)
      samples.push({
        tick: tick + 1,
        cars: [...(s.realm.vehicleRegistry?.states.values() ?? [])]
          .filter((s) => s.autonomous)
          .map((s) => ({
            id: s.entity.id,
            type: s.entity.type,
            position: { ...s.entity.position },
            speed: Math.hypot(s.entity.velocity?.vx ?? 0, s.entity.velocity?.vy ?? 0),
            choices: s.route?.choices ?? 0,
          })),
      });
  }
  await yieldEventLoop();
  await yieldEventLoop();
  observer.disconnect();
  const report = {
    schema: 1,
    date: new Date().toISOString(),
    node: process.version,
    cpu: cpus()[0]?.model,
    scope:
      "Preloaded ordinary Realm, fixed manual clock; no browser, rendering, network or device timing. Four simulated minutes, samples every ten seconds; inclusive phases overlap.",
    samples,
    slowTicks: slowTicks.map((s) => ({
      ...s,
      gc: gc.filter((g) => g.at <= s.at + s.ms && g.at + g.ms >= s.at),
    })),
    gc,
    attribution:
      "Diagnostic overhead includes two timer reads and one small counter snapshot per tick; bounded GC events and the first 20 ticks over 8ms. Aggregated phase percentiles alone do not attribute a spike.",
    timings: performanceMetrics.snapshot(),
    collision: s.realm.collisionDiagnostics,
  };
  const output = process.argv[2] ?? "/tmp/tilefun-traffic-progress.json";
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      output,
      cars: samples[0]?.cars.length,
      finalChoices: samples.at(-1)?.cars.reduce((n, c) => n + c.choices, 0),
      timings: report.timings,
    }),
  );
} finally {
  observer.disconnect();
  await s.close();
}
