/** Sustained native route/liveness attribution. Preloaded ordinary Realm, no GPU,
 * network latency or physical-device claim. Default run is four simulated minutes. */
import { writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { performanceMetrics } from "../../src/diagnostics/PerformanceMetrics.js";
import { crowdedRoadTrafficRecipe } from "../../src/scenarios/RoadTrafficRecipe.js";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.js";

const recipe = crowdedRoadTrafficRecipe();
const s = await ScenarioSession.create(recipe);
const samples = [];
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
    s.tick();
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
  const report = {
    schema: 1,
    date: new Date().toISOString(),
    node: process.version,
    cpu: cpus()[0]?.model,
    scope:
      "Preloaded ordinary Realm, fixed manual clock; no browser, rendering, network or device timing. Four simulated minutes, samples every ten seconds; inclusive phases overlap.",
    samples,
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
  await s.close();
}
