// Whole native ScenarioSession traces against a supplied pre-change TrafficSystem.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { transformSync } from "esbuild"; // compiler dependency of the repo's tsx runner
import { Direction } from "../../src/entities/Entity.ts";
import { createPlayer } from "../../src/entities/Player.ts";
import { encodeActor } from "../../src/persistence/ActorRecords.ts";
import { FLAT_SCENARIO } from "../../src/scenarios/ScenarioRecipe.ts";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.ts";
import { vehicleGeometryRecipe } from "../../src/scenarios/VehicleGeometryRecipe.ts";
import { serializeEntity } from "../../src/shared/serialization.ts";
import { buildLaneGraph, samplePath } from "../../src/traffic/LaneGraph.ts";

const option = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const referencePath = option("reference", "");
if (!referencePath) throw Error("Supply --reference=PATH to the original TrafficSystem.ts");
const output = option("output", path.join(os.tmpdir(), "tilefun-traffic-road-parity"));
await mkdir(output, { recursive: true });
const original = await readFile(referencePath, "utf8");
const source = original.replace(
  /from "(\.[^"]+)"/g,
  (_, relative) =>
    `from ${JSON.stringify(new URL(relative.replace(/\.js$/, ".ts"), new URL("../../src/traffic/TrafficSystem.ts", import.meta.url)).href)}`,
);
const reference = await import(
  `data:text/javascript;base64,${Buffer.from(transformSync(source, { loader: "ts", format: "esm", target: "es2022" }).code).toString("base64")}`
);
const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
// Authored flat loop avoids unrelated asynchronous retirement of the regional
// launcher's distant initial wildlife. Generated-road integration stays in tests.
function flatTrafficRecipe(model = "compact-1") {
  const graph = buildLaneGraph([
    { a: { x: 0, y: 0 }, b: { x: 40, y: 0 }, width: 8, intercity: false },
    { a: { x: 40, y: 0 }, b: { x: 40, y: 40 }, width: 8, intercity: false },
    { a: { x: 0, y: 40 }, b: { x: 40, y: 40 }, width: 8, intercity: false },
    { a: { x: 0, y: 0 }, b: { x: 0, y: 40 }, width: 8, intercity: false },
  ]);
  const lane = [...graph.lanes.values()].find((l) => l.direction === Direction.Right);
  assert(lane);
  const pose = samplePath(lane.path, 40);
  return {
    version: 1,
    id: "traffic-road-parity",
    generation: FLAT_SCENARIO,
    player: createPlayer(pose.x + 110, pose.y + 3),
    props: [],
    roads: [{ left: -128, top: -128, right: 768, bottom: 768 }],
    trafficLanes: [...graph.lanes.values()],
    traffic: [{ name: "car", model, laneId: lane.id, x: pose.x, y: pose.y, distance: 40 }],
  };
}
const fixtures = [
  {
    name: "crossing-then-roof",
    recipe: () => flatTrafficRecipe(),
    ticks: 3000,
    dt: 1 / 60,
    setup: async (s, i) => {
      if (i === 600) await s.command({ kind: "traffic-position", roof: true });
    },
  },
  {
    name: "bus-turns-roof-reload",
    recipe: () => flatTrafficRecipe("bus-1"),
    ticks: 3600,
    dt: 1 / 60,
    setup: async (s, i) => {
      if (i === 0) await s.command({ kind: "traffic-position", roof: true });
      if (i === 1800) await s.reload();
    },
  },
  {
    name: "road-edit-readiness",
    recipe: () => flatTrafficRecipe(),
    ticks: 900,
    dt: 1 / 60,
    setup: async (s, i) => {
      if (i === 0) await s.command({ kind: "traffic-position", roof: true });
      if (i === 300) {
        const read = s.realm.world.getRoadAt.bind(s.realm.world);
        s.realm.world.getRoadAt = () => 0;
        s.restoreRoad = () => {
          s.realm.world.getRoadAt = read;
        };
      }
      if (i === 600) s.restoreRoad();
    },
  },
  ...[false, true].flatMap((garage) =>
    [false, true].map((reverse) => ({
      name: `${garage ? "garage" : "bridge"}-${reverse ? "return" : "outbound"}`,
      recipe: () => vehicleGeometryRecipe(garage, reverse),
      ticks: 250,
      dt: 0.1,
      setup: async (s, i) => {
        if (i === 100) await s.reload();
      },
    })),
  ),
  {
    name: "bridge-roof",
    recipe: () => vehicleGeometryRecipe(false),
    ticks: 160,
    dt: 0.1,
    setup: async (s, i) => {
      if (i === 0) await s.command({ kind: "traffic-position", roof: true });
      if (i === 100) await s.reload();
    },
  },
  {
    name: "deleted-bridge",
    recipe: () => vehicleGeometryRecipe(false),
    ticks: 200,
    dt: 0.1,
    setup: async (s, i) => {
      if (i === 50)
        for (const p of [...s.realm.propManager.props])
          if (p.collider?.surface) s.realm.propManager.remove(p.id);
    },
  },
];
const attach = (s) => {
  const traffic = s.realm.traffic;
  assert(traffic);
  for (const name of Object.getOwnPropertyNames(reference.TrafficSystem.prototype))
    if (name !== "constructor") traffic[name] = reference.TrafficSystem.prototype[name];
};
const run = async (fixture, old) => {
  const random = Math.random;
  let seed = 0x125;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  let s;
  const trace = [];
  const state = createHash("sha256"),
    wire = createHash("sha256");
  let roadReads = 0,
    heightReads = 0,
    propQueries = 0,
    bodyQueries = 0,
    peakChoices = 0;
  let observedRealm;
  try {
    s = await ScenarioSession.create(fixture.recipe());
    for (let i = 0; i < fixture.ticks; i++) {
      await fixture.setup(s, i);
      if (s.realm !== observedRealm) {
        if (old) attach(s);
        observedRealm = s.realm;
        for (const [owner, method, count] of [
          [s.realm.propManager, "getPropsInChunkRange", () => propQueries++],
          [s.realm.entityManager.spatialHash, "queryRange", () => bodyQueries++],
        ]) {
          const query = owner[method].bind(owner);
          owner[method] = (...args) => {
            count();
            return query(...args);
          };
        }
        for (const [method, count] of [
          ["getRoadAt", () => roadReads++],
          ["getHeightAt", () => heightReads++],
        ]) {
          const read = s.realm.world[method].bind(s.realm.world);
          s.realm.world[method] = (...args) => {
            count();
            return read(...args);
          };
        }
      }
      await s.step(idle, fixture.dt);
      const traffic = s.realm.traffic;
      peakChoices = Math.max(peakChoices, ...[...traffic.states.values()].map((c) => c.choices));
      const sample = JSON.stringify({
        actors: s.realm.entityManager.entities.map(serializeEntity),
        durableActors: s.realm.entityManager.entities.map((e) => encodeActor(e)),
        traffic: [...traffic.states.values()].map((c) => ({
          ...traffic.snapshot(c),
          waiting: c.waiting,
          reservation: c.reservation,
        })),
        reservations: [...traffic.reservations],
      });
      trace.push(sample);
      state.update(sample);
      for (const frame of s.frames()) wire.update(Buffer.from(frame));
    }
    await s.realm.flushAsync();
    const durable = createHash("sha256")
      .update(JSON.stringify([...s.records.records]))
      .digest("hex");
    return {
      trace,
      state: state.digest("hex"),
      wire: wire.digest("hex"),
      durable,
      roadReads,
      heightReads,
      propQueries,
      bodyQueries,
      peakChoices,
    };
  } finally {
    try {
      await s?.close();
    } finally {
      Math.random = random;
    }
  }
};
const report = {
  referenceSHA256: createHash("sha256").update(original).digest("hex"),
  currentTrafficSHA256: createHash("sha256")
    .update(await readFile(new URL("../../src/traffic/TrafficSystem.ts", import.meta.url)))
    .digest("hex"),
  fixture:
    "Native authored flat loop and bridge/garage recipes; fixed diagnostic identity RNG; no browser timing claim",
  cases: [],
};
for (const fixture of fixtures) {
  const before = await run(fixture, true),
    after = await run(fixture, false);
  const mismatch = before.trace.findIndex((v, i) => v !== after.trace[i]);
  if (mismatch !== -1) {
    await writeFile(
      path.join(output, "first-mismatch.json"),
      JSON.stringify(
        {
          fixture: fixture.name,
          tick: mismatch,
          before: JSON.parse(before.trace[mismatch]),
          after: JSON.parse(after.trace[mismatch]),
        },
        null,
        2,
      ),
    );
    console.log("First mismatch", fixture.name, mismatch);
  }
  delete before.trace;
  delete after.trace;
  for (const key of ["state", "wire", "durable", "propQueries", "bodyQueries", "peakChoices"])
    assert.equal(after[key], before[key], `${fixture.name}: ${key}`);
  if (fixture.name.includes("turns")) assert(after.peakChoices > 0, "Must actually turn");
  report.cases.push({ name: fixture.name, ticks: fixture.ticks, dt: fixture.dt, before, after });
  console.log(
    `${fixture.name}: exact state/wire/durable parity; road reads ${before.roadReads} → ${after.roadReads}`,
  );
}
await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
