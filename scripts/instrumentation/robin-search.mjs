// Deterministic decision parity against an explicitly supplied pre-change source.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  getEntityAABB,
} from "../../src/entities/collision.ts";
import { decodeActor, encodeActor, observeActor } from "../../src/persistence/ActorRecords.ts";
import { getSurfaceZ } from "../../src/physics/surfaceHeight.ts";
import { naturalLandscapeRecipe } from "../../src/scenarios/NaturalLandscapeRecipe.ts";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.ts";
import { updateRobinAI } from "../../src/wildlife/robinAI.ts";
import { robinTreePerches } from "../../src/wildlife/robinPerches.ts";
import { CollisionFlag } from "../../src/world/TileRegistry.ts";

const option = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const referencePath = option("reference", "");
if (!referencePath) throw Error("Supply --reference=PATH to the pre-change robinAI.ts");
const output = option("output", path.join(os.tmpdir(), "tilefun-robin-search-parity"));
await mkdir(output, { recursive: true });
const source = (await readFile(referencePath, "utf8")).replace(
  'from "./robinInteractions.js"',
  `from ${JSON.stringify(new URL("../../src/wildlife/robinInteractions.ts", import.meta.url).href)}`,
);
const reference = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);
const session = await ScenarioSession.create(naturalLandscapeRecipe("dog", "thicket"));
try {
  await session.ready();
  const { realm } = session;
  const birds = realm.entityManager.entities.filter((e) => e.robin).slice(0, 32);
  const getHeight = (tx, ty) => realm.world.getHeightAt(tx, ty);
  const records = [];
  const fixtures = [];
  const run = (update, record, setup, capture = true) => {
    const bird = decodeActor(record);
    if ("isProp" in bird) throw Error("Expected bird");
    observeActor(bird, () => {});
    const ai = bird.robin;
    ai.state = setup.state;
    ai.activity = setup.activity;
    ai.timer = setup.timer;
    ai.randomState = setup.seed;
    delete ai.motion;
    delete ai.alarmFrom;
    if (ai.state === "startle") ai.alarmFrom = { wx: bird.position.wx - 10, wy: bird.position.wy };
    bird.wz = setup.height;
    const players =
      setup.playerOffset === null
        ? []
        : [{ wx: bird.position.wx + setup.playerOffset, wy: bird.position.wy }];
    const trace = [];
    let perches = 0;
    const env = {
      perches: (home, radius) => {
        perches++;
        return robinTreePerches(
          realm.propManager.getPropsInChunkRange(
            Math.floor((home.wx - radius) / 256),
            Math.floor((home.wy - radius) / 256),
            Math.floor((home.wx + radius) / 256),
            Math.floor((home.wy + radius) / 256),
          ),
        );
      },
      surfaceZ: (p) => getSurfaceZ(p.wx, p.wy, getHeight),
      isWater: (p) =>
        (realm.world.getCollisionIfLoaded(Math.floor(p.wx / 16), Math.floor(p.wy / 16)) &
          CollisionFlag.Water) !==
        0,
      canOccupy: (body, p) => {
        if (capture) trace.push([p.wx, p.wy, body.wz ?? 0]);
        if (!body.collider) return false;
        const box = getEntityAABB(p, body.collider);
        if (
          aabbOverlapsSolid(
            box,
            (tx, ty) => realm.world.getCollisionIfLoaded(tx, ty),
            CollisionFlag.Solid,
          )
        )
          return false;
        return !realm.propManager
          .getPropsNearPosition(p, body.collider)
          .some((prop) =>
            aabbOverlapsPropWalls(
              box,
              prop.position,
              prop,
              body.wz ?? 0,
              body.collider.physicalHeight ?? 9,
            ),
          );
      },
    };
    const start = performance.now();
    update(bird, 0.1, env, realm.entityManager.entities, players);
    const ms = performance.now() - start;
    return {
      semantic: capture ? JSON.stringify({ actor: encodeActor(bird), trace }) : undefined,
      ms,
      perches,
      occupancy: trace.length,
    };
  };
  for (const [index, bird] of birds.entries())
    for (const state of ["rest", "perch", "startle", "recover", "action"])
      for (const timer of [0, 0.1, 1.5]) {
        const setup = {
          state,
          timer,
          activity: index % 3,
          seed: (7801 + index * 73856093) >>> 0,
          height: state === "perch" ? 32 : 0,
          playerOffset: [null, 10, 20, 26][index % 4],
        };
        const record = encodeActor(bird);
        fixtures.push({ record, setup });
        const before = run(reference.updateRobinAI, record, setup);
        const after = run(updateRobinAI, record, setup);
        assert.equal(
          after.semantic,
          before.semantic,
          `Decision mismatch: bird ${index}, ${state}, timer ${timer}`,
        );
        records.push({
          setup,
          before: { ms: before.ms, perches: before.perches, occupancy: before.occupancy },
          after: { ms: after.ms, perches: after.perches, occupancy: after.occupancy },
          hash: createHash("sha256").update(after.semantic).digest("hex"),
        });
      }
  const totals = (side) =>
    records.reduce(
      (sum, r) => ({
        ms: sum.ms + r[side].ms,
        perches: sum.perches + r[side].perches,
        occupancy: sum.occupancy + r[side].occupancy,
      }),
      { ms: 0, perches: 0, occupancy: 0 },
    );
  // Warm both implementations, then reverse order each round. Timed passes omit
  // trace allocation; actor hydration/observation remains outside the AI timer.
  const rounds = [];
  for (let round = 0; round < 7; round++) {
    const timings = { before: [], after: [] };
    for (const { record, setup } of fixtures)
      for (const side of round % 2 ? ["after", "before"] : ["before", "after"])
        timings[side].push(
          run(side === "before" ? reference.updateRobinAI : updateRobinAI, record, setup, false).ms,
        );
    if (round > 0)
      rounds.push(
        Object.fromEntries(
          Object.entries(timings).map(([side, values]) => {
            values.sort((a, b) => a - b);
            return [
              side,
              {
                totalMs: values.reduce((a, b) => a + b, 0),
                p50: values[Math.floor(values.length * 0.5)],
                p95: values[Math.floor(values.length * 0.95)],
                max: values.at(-1),
              },
            ];
          }),
        ),
      );
    await new Promise(setImmediate);
  }
  const report = {
    date: new Date().toISOString(),
    cases: records.length,
    parity: true,
    limits:
      "Headless decisions with observed actors and native terrain/prop queries. Parity capture includes trace allocation; six timing rounds omit traces after one warmup round and reverse lane order. No full server, motion or rendering benchmark.",
    before: totals("before"),
    after: totals("after"),
    rounds,
    records,
  };
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, records: undefined }));
} finally {
  await session.close();
}
