// Production Realm crowd control. Run with node --import tsx; no rendering/IndexedDB.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPlayer } from "../../src/entities/Player.ts";
import { encodeActor } from "../../src/persistence/ActorRecords.ts";
import { FLAT_SCENARIO } from "../../src/scenarios/ScenarioRecipe.ts";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.ts";
import { serializeEntity } from "../../src/shared/serialization.ts";
import { createFauna } from "../../src/wildlife/Fauna.ts";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const output = option("output", path.join(os.tmpdir(), "tilefun-collision-broad-phase"));
const counting = process.argv.includes("--count");
const cellSize = Number(option("cell-size", "0"));
const repeats = Number(option("repeats", "3"));
if (![0, 32, 64].includes(cellSize) || !Number.isInteger(repeats) || repeats < 1 || repeats > 6)
  throw Error("Use --cell-size=32|64 and --repeats=1..6");
await mkdir(output, { recursive: true });
const results = [];
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    max: sorted.at(-1),
  };
};
const sink = {
  send() {},
  broadcast() {},
  onMessage() {},
  onConnect() {},
  onDisconnect() {},
};
for (let repeat = 0; repeat < repeats; repeat++) {
  const populations = repeat % 2 ? [384, 96, 24, 0] : [0, 24, 96, 384];
  for (const n of populations)
    for (const motion of ["stationary", "moving"]) {
      const actors = Array.from({ length: n }, (_, i) => {
        const e = createFauna("dog", 96 + (i % 16) * 24, 96 + Math.floor(i / 16) * 18);
        e.persistentId = `fixture-${i}`;
        e.fauna.timer = 1000;
        if (motion === "moving") {
          e.fauna.state = "travel";
          e.fauna.target = { wx: e.position.wx + 500, wy: e.position.wy };
          e.fauna.motion = { elapsed: 0, duration: 100, escaping: false };
          e.wanderAI.state = "walking";
        }
        return e;
      });
      const player = createPlayer(32, 32);
      player.persistentId = "fixture-player";
      const session = await ScenarioSession.create({
        version: 1,
        id: `collision-${n}-${motion}`,
        generation: FLAT_SCENARIO,
        player,
        actors,
        props: [],
      });
      try {
        await session.ready({ minCx: -5, maxCx: 5, minCy: -5, maxCy: 5 });
        session.player.visibleRange = { minCx: -3, maxCx: 3, minCy: -3, maxCy: 3 };
        const realm = session.realm,
          manager = realm.entityManager;
        if (cellSize) {
          if (!manager.collisionIndex) throw Error("Cell variants require CollisionIndex");
          manager.collisionIndex = new manager.collisionIndex.constructor(cellSize);
        }
        const initial = new Map(manager.entities.map((e) => [e.id, { ...e.position }]));
        let collecting = false;
        const counts = {},
          phases = {};
        for (const [owner, key, name] of [
          [manager, "update", "physics"],
          [realm, "computeEntityTickDtsMulti", "selection"],
          [realm, "decisionDts", "decisions"],
          [realm.streaming, "update", "streaming"],
        ]) {
          const original = owner[key];
          owner[key] = function (...args) {
            const t = performance.now();
            try {
              return original.apply(this, args);
            } finally {
              if (collecting) {
                phases[name] ??= [];
                phases[name].push(performance.now() - t);
              }
            }
          };
        }
        if (counting) {
          for (const [owner, key, name] of [
            [manager.spatialHash, "queryRange", "chunk"],
            ...(manager.collisionIndex ? [[manager.collisionIndex, "query", "fine"]] : []),
          ]) {
            const original = owner[key];
            owner[key] = function (...args) {
              const result = original.apply(this, args);
              if (collecting) {
                counts[`${name}Queries`] = (counts[`${name}Queries`] ?? 0) + 1;
                counts[`${name}Candidates`] = (counts[`${name}Candidates`] ?? 0) + result.length;
              }
              return result;
            };
          }
        }
        const tick = [],
          replicate = [],
          trace = counting ? createHash("sha256") : null;
        for (let i = 0; i < 240; i++) {
          collecting = i >= 60;
          realm.handleMessage(session.player.clientId, session.player, {
            type: "player-input",
            seq: i + 1,
            dx: 0,
            dy: 0,
            sprinting: false,
            jump: false,
            dtMs: 1000 / 60,
          });
          const t = performance.now();
          realm.tick(1 / 60, sink, false, new Set());
          if (collecting) {
            tick.push(performance.now() - t);
            const start = performance.now();
            realm.replicate(session.player.clientId);
            replicate.push(performance.now() - start);
            // Outside the timers, counting lanes compare full wire + durable state.
            trace?.update(
              JSON.stringify(
                manager.entities.map((e) => {
                  const record = encodeActor(e);
                  delete record.persistentId;
                  return [serializeEntity(e), record];
                }),
              ),
            );
          }
          if (i % 20 === 0) await new Promise(setImmediate);
        }
        const displacements = manager.entities
          .filter((e) => e !== session.player.player)
          .map((e) => {
            const p = initial.get(e.id);
            return Math.hypot(e.position.wx - p.wx, e.position.wy - p.wy);
          });
        const expected = motion === "moving" ? 88 : 0;
        if (displacements.some((d) => Math.abs(d - expected) > 0.0001))
          throw Error("Crowd motion hit an obstruction or sleep boundary");
        const row = {
          repeat,
          population: n,
          motion,
          counting,
          cellSize: manager.collisionIndex?.cellSize ?? null,
          ticks: summary(tick),
          replication: summary(replicate),
          phases: Object.fromEntries(Object.entries(phases).map(([k, v]) => [k, summary(v)])),
          counts,
          traceSHA256: trace?.digest("hex") ?? null,
          expectedActorTravelPx: expected,
          resident: manager.entities.length,
        };
        results.push(row);
        console.log(
          JSON.stringify({
            population: n,
            motion,
            repeat,
            meanMs: row.ticks.mean,
            p95Ms: row.ticks.p95,
          }),
        );
      } finally {
        await session.close();
      }
    }
}
await writeFile(
  path.join(output, "report.json"),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      cpu: os.cpus()[0]?.model,
      node: process.version,
      limits:
        "Accelerated Node Realm/memory persistence; no render/IndexedDB. Nearby held rest/travel, no planning. Counting/trace lane adds overhead. Replication separate. 60 warmup/180 retained steps; index costs included in tick.",
      cases: results,
    },
    null,
    2,
  ),
);
