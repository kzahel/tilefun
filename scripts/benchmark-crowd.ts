// Compiled by benchmark-crowd.mjs without tsx keepNames instrumentation.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Session } from "node:inspector/promises";
import { findSourceMap } from "node:module";
import { performanceMetrics } from "../src/diagnostics/PerformanceMetrics.js";
import { crowdBenchRecipe } from "../src/scenarios/CrowdBenchRecipe.js";
import { ScenarioSession } from "../src/scenarios/ScenarioSession.js";
import {
  assertEquivalent,
  cars,
  compare,
  lane,
  output,
  profile,
  rabbits,
  reportBase,
  ticks,
  warmup,
} from "./crowd/options.js";
import {
  assertComparable,
  compareOutcome,
  delta,
  round,
  sha256,
  summarize,
} from "./crowd/report.js";
import { writeTape } from "./crowd/tape.js";

if (lane === "client" || lane === "render") {
  const { runReplay } = await import("./crowd/replay.js");
  await runReplay();
} else {
  await authority();
}

async function authority() {
  const recipe = crowdBenchRecipe(rabbits, cars);
  const base = reportBase({
    recipeSha256: sha256(JSON.stringify(recipe)),
    rabbits,
    cars,
    warmup,
    ticks,
    authorityHz: 60,
    input: "none",
    clock: "fixed-wall-v1",
  });
  const previous = compare ? JSON.parse(await readFile(compare, "utf8")) : undefined;
  const comparison = previous
    ? assertComparable(base, previous, process.argv.includes("--allow-incompatible"))
    : [];
  const originalNow = Date.now;
  let clock = Date.UTC(2026, 0, 1);
  Date.now = () => clock;
  const s = await ScenarioSession.create(recipe);
  try {
    const realm = s.realm;
    const counters = () => {
      const d = realm.collisionDiagnostics;
      if (!d) throw Error("Physics scene is not ready");
      return { ...d };
    };
    const placed = {
      rabbits: realm.entityManager.entities.filter((e) => e.type === "wildlife-rabbit-v1").length,
      cars: realm.entityManager.entities.filter((e) => e.type.startsWith("vehicle-v1:")).length,
      entities: realm.entityManager.entities.length,
    };
    if (placed.rabbits !== rabbits || placed.cars !== cars)
      throw Error(`Placed ${JSON.stringify(placed)}, expected ${rabbits} rabbits and ${cars} cars`);
    const step = () => {
      clock += 1000 / 60;
      return s.tick(true);
    };
    if (lane === "record") {
      performanceMetrics.enabled = false;
      const initial = s.frames();
      const steps = Array.from({ length: warmup + ticks }, step);
      const digest = await writeTape(output, {
        version: 1,
        recipe,
        recipeSha256: sha256(JSON.stringify(recipe)),
        warmup,
        ticks,
        initial,
        steps,
        source: base.source,
      });
      console.log(
        `Recorded ${steps.length} ticks (${warmup} warm-up), sha256 ${digest}\nTape: ${output}`,
      );
      return;
    }
    for (let i = 0; i < warmup; i++) step();
    performanceMetrics.reset(ticks);
    const before = counters();
    const inspector = profile ? new Session() : undefined;
    if (inspector) {
      inspector.connect();
      await inspector.post("Profiler.enable");
      await inspector.post("Profiler.setSamplingInterval", { interval: 100 });
      await inspector.post("Profiler.start");
    }
    const times: number[] = [];
    const wire = createHash("sha256");
    let bytes = 0,
      simulated = 0,
      awakeCars = 0,
      moving = 0,
      napping = 0,
      samples = 0;
    for (let i = 0; i < ticks; i++) {
      const t = performance.now();
      const frames = step();
      times.push(performance.now() - t);
      // Observation stays outside the tick timer; it can still affect GC/cache state.
      wire.update(`${i}:${frames.length}:`);
      for (const frame of frames) {
        bytes += frame.byteLength;
        wire.update(`${frame.byteLength}:`).update(new Uint8Array(frame));
      }
      simulated += realm.persistenceDiagnostics.activeActors;
      napping += realm.physicsScene?.diagnostics.heldBodies ?? 0;
      if (i % 30 === 0) {
        samples++;
        for (const body of realm.physicsState?.bodies ?? [])
          if (body.kind === "vehicle" && !body.sleeping) awakeCars++;
        for (const e of realm.entityManager.entities)
          if (e.velocity?.vx || e.velocity?.vy || e.jumpVZ) moving++;
      }
    }
    const cpu = inspector
      ? sourceProfile((await inspector.post("Profiler.stop")).profile as CpuProfile)
      : undefined;
    inspector?.disconnect();
    const after = counters();
    const perTick = (key: keyof typeof after) =>
      round((Number(after[key]) - Number(before[key])) / ticks);
    const stages = Object.fromEntries(
      Object.entries(performanceMetrics.snapshot())
        .filter(([name]) => name.startsWith("realm.") || name.startsWith("server."))
        .map(([name, v]) => {
          if (v.count !== v.retained) throw Error(`Stage ${name} lost timing samples`);
          return [
            name,
            {
              count: v.count,
              retained: v.retained,
              totalMs: round(v.totalMs),
              p50: round(v.p50Ms),
              p95: round(v.p95Ms),
              p99: round(v.p99Ms),
            },
          ];
        }),
    );
    const outcome = { wireSha256: wire.digest("hex") };
    const outcomeMatches = compareOutcome(outcome, previous?.outcome, assertEquivalent);
    const report = {
      ...base,
      comparisonIssues: comparison,
      placed,
      tickMs: summarize(times),
      stages,
      work: {
        simulatedActors: round(simulated / ticks),
        nappingActors: round(napping / ticks),
        movingActors: round(moving / samples),
        movingSampleEveryTicks: 30,
        physicsBodies: after.bodies,
        bodyReads: perTick("bodyReads"),
        motorUpdates: perTick("motorUpdates"),
        awakeCars: round(awakeCars / samples),
        wheelRays: perTick("wheelQueries"),
        wheelBodyTests: perTick("wheelNarrowQueries"),
        supportQueries: perTick("supportQueries"),
        replicationBytes: Math.round(bytes / ticks),
      },
      outcome,
      outcomeMatches,
      profile: cpu ? summarizeProfile(cpu) : undefined,
    };
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    if (cpu) await writeFile(`${output.replace(/\.json$/, "")}.cpuprofile`, JSON.stringify(cpu));
    if (comparison.length) console.log(`INCOMPATIBLE COMPARISON: ${comparison.join(", ")}`);
    console.log(`crowd:bench authority ${rabbits} rabbits, ${cars} cars · ${base.environment.cpu}`);
    console.log(
      `tick p50 ${report.tickMs.p50} ms${delta(report.tickMs.p50, previous?.tickMs.p50)}, p95 ${report.tickMs.p95} ms${delta(report.tickMs.p95, previous?.tickMs.p95)}`,
    );
    for (const [name, v] of Object.entries(stages))
      console.log(
        `  ${name.padEnd(26)} p50 ${v.p50} ms${delta(v.p50, previous?.stages?.[name]?.p50)} (${v.count} samples)`,
      );
    console.log("work per tick:", report.work);
    console.log("wire sha256:", report.outcome.wireSha256);
    if (previous) console.log("outcome matches:", outcomeMatches);
    if (report.profile)
      for (const [name, share] of report.profile.self)
        console.log(`  ${share.padStart(6)} ${name}`);
    console.log(`Report: ${output}`);
  } finally {
    await s.close();
    Date.now = originalNow;
  }
}

interface CpuProfile {
  nodes: {
    id: number;
    callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number };
    children?: number[];
  }[];
  samples: number[];
  timeDeltas: number[];
}
/** This script runs as one esbuild bundle: map call frames back to source files. */
function sourceProfile(p: CpuProfile): CpuProfile {
  const map = findSourceMap(import.meta.url) ?? findSourceMap(new URL(import.meta.url).pathname);
  if (!map) return p;
  for (const { callFrame: f } of p.nodes) {
    if (!import.meta.url.endsWith(f.url.replace(/^file:\/\//, ""))) continue;
    const origin = map.findOrigin(f.lineNumber + 1, f.columnNumber + 1);
    if (!("fileName" in origin)) continue;
    f.url = origin.fileName;
    f.lineNumber = origin.lineNumber - 1;
    f.columnNumber = origin.columnNumber - 1;
  }
  return p;
}
/** Top self-time functions within ScenarioSession ticks. */
function summarizeProfile(p: CpuProfile) {
  const nodes = new Map(p.nodes.map((n) => [n.id, n]));
  const parent = new Map<number, number>();
  for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const name = (id: number) => {
    const f = nodes.get(id)?.callFrame;
    return `${f?.functionName || "(anonymous)"} ${f?.url.split("/").slice(-2).join("/") ?? ""}`;
  };
  const inTick = (id: number) => {
    for (let x: number | undefined = id; x !== undefined; x = parent.get(x))
      if (
        nodes.get(x)?.callFrame.url.endsWith("server/Realm.ts") &&
        nodes.get(x)?.callFrame.functionName === "tick"
      )
        return true;
    return false;
  };
  const self = new Map<string, number>();
  let total = 0;
  p.samples.forEach((id, i) => {
    if (!inTick(id)) return;
    const dt = p.timeDeltas[i] ?? 0;
    total += dt;
    self.set(name(id), (self.get(name(id)) ?? 0) + dt);
  });
  return {
    self: [...self]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([n, t]) => [n, `${((t / total) * 100).toFixed(1)}%`] as const),
  };
}
