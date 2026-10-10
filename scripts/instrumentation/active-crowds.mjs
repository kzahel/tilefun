// Synthetic populations through production Realm streaming and physics; excludes rendering/IndexedDB.
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performanceMetrics } from "../../src/diagnostics/PerformanceMetrics.ts";
import { createPlayer } from "../../src/entities/Player.ts";
import { naturalLandscapeRecipe } from "../../src/scenarios/NaturalLandscapeRecipe.ts";
import { FLAT_SCENARIO } from "../../src/scenarios/ScenarioRecipe.ts";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.ts";
import { createFauna } from "../../src/wildlife/Fauna.ts";

const output =
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
  path.join(os.tmpdir(), "tilefun-active-crowds");
await mkdir(output, { recursive: true });
const results = [];
const syntheticCases = [
  [0, "near"],
  [24, "near"],
  [96, "near"],
  [384, "near"],
  [384, "far"],
];
const cases = process.argv.includes("--natural")
  ? ["city-pets", "farmstead", "pond", "dog", "deer", "forest"].map((id) => [0, id])
  : syntheticCases;
for (const [population, placement] of cases) {
  const natural = process.argv.includes("--natural");
  const actors = Array.from({ length: population }, (_, i) =>
    createFauna(
      "dog",
      96 + (i % 16) * 24 + (placement === "far" ? 9 * 256 : 0),
      96 + Math.floor(i / 16) * 18,
    ),
  );
  const session = await ScenarioSession.create(
    natural
      ? naturalLandscapeRecipe(placement, "thicket")
      : {
          version: 1,
          id: `crowd-${population}-${placement}`,
          generation: FLAT_SCENARIO,
          player: createPlayer(32, 32),
          actors: placement === "far" ? [] : actors,
          props: [],
        },
  );
  try {
    if (natural) await session.ready();
    else
      await session.ready({ minCx: -5, maxCx: placement === "far" ? 11 : 5, minCy: -5, maxCy: 5 });
    const realm = session.realm;
    if (placement === "far") for (const actor of actors) realm.entityManager.spawn(actor);
    if (!natural)
      session.player.visibleRange = {
        minCx: -3,
        maxCx: placement === "far" ? 11 : 3,
        minCy: -3,
        maxCy: 3,
      };
    const totals = {};
    const restorers = [];
    let aiStarted = 0;
    for (const [owner, key, name] of [
      [realm, "computeEntityTickDtsMulti", "selection"],
      [realm, "decisionDts", "decisions"],
      [realm.entityManager, "update", "physics"],
      [realm.streaming, "update", "streaming"],
      [realm.records, "changed", "dirty-marking"],
      [realm.worldAPI.tick, "firePre", "pre-hooks"],
    ]) {
      const fn = owner[key];
      owner[key] = function (...args) {
        const t = performance.now();
        if (name === "pre-hooks" && aiStarted) {
          totals["ai-and-props"] ??= [];
          totals["ai-and-props"].push(t - aiStarted);
          aiStarted = 0;
        }
        try {
          return fn.apply(this, args);
        } finally {
          totals[name] ??= [];
          totals[name].push(performance.now() - t);
          if (name === "decisions") aiStarted = performance.now();
        }
      };
      restorers.push(() => (owner[key] = fn));
    }
    performanceMetrics.enabled = true;
    performanceMetrics.reset();
    const samples = [];
    for (let i = 0; i < 240; i++) {
      realm.handleMessage(session.player.clientId, session.player, {
        type: "player-input",
        seq: i + 1,
        dx: 0,
        dy: 0,
        sprinting: false,
        jump: false,
        dtMs: 16.67,
      });
      const t = performance.now();
      realm.tick(
        1 / 60,
        {
          send() {
            /* discard fixture output */
          },
          broadcast() {
            /* discard fixture output */
          },
          onMessage() {
            /* manual fixture */
          },
          onConnect() {
            /* manual fixture */
          },
          onDisconnect() {
            /* manual fixture */
          },
        },
        false,
        new Set(),
      );
      const tickMs = performance.now() - t;
      if (i >= 60) {
        const t = performance.now();
        realm.replicate(session.player.clientId);
        samples.push({ tickMs, replicateMs: performance.now() - t });
      }
      if (i % 20 === 0) await new Promise(setImmediate);
    }
    for (const restore of restorers) restore();
    const summary = (values) => {
      values.sort((a, b) => a - b);
      return {
        p50: values[Math.floor(values.length * 0.5)] ?? 0,
        p95: values[Math.floor(values.length * 0.95)] ?? 0,
        max: values.at(-1) ?? 0,
      };
    };
    const row = {
      population,
      placement,
      resident: realm.entityManager.entities.length,
      props: realm.propManager.props.length,
      active: realm.persistenceDiagnostics.activeActors,
      tickMs: summary(samples.map((x) => x.tickMs)),
      replicateMs: summary(samples.map((x) => x.replicateMs)),
      phases: Object.fromEntries(
        Object.entries(totals).map(([k, v]) => [
          k,
          { totalMs: v.reduce((a, b) => a + b, 0), calls: v.length, ...summary(v) },
        ]),
      ),
    };
    results.push(row);
    console.log(JSON.stringify(row));
  } finally {
    await session.close();
  }
}
await writeFile(
  path.join(output, "report.json"),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      cpu: os.cpus()[0]?.model,
      platform: os.platform(),
      cases: results,
    },
    null,
    2,
  ),
);
