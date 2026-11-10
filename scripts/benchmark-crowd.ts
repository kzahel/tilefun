// Body of `npm run crowd:bench` (scripts/benchmark-crowd.mjs compiles it without
// keepNames, as Vite does, and runs it in plain Node).
//
// Repeatable authority crowd bench: the fixed CrowdBenchRecipe (1,000 rabbits and
// 50 parked cars inside one 5×5-chunk view on flat ground) runs in a headless
// ScenarioSession with its seeded random source and a simulated wall clock that
// advances 1/60 s per tick. Reports tick time, per-stage timings and
// machine-independent work counts (simulated actors, physics bodies, awake cars,
// wheel ray tests, replication bytes). Counts repeat exactly between runs; times
// depend on the machine and its load.

import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { Session } from "node:inspector/promises";
import { findSourceMap } from "node:module";
import os from "node:os";
import path from "node:path";
import { performanceMetrics } from "../src/diagnostics/PerformanceMetrics.js";
import { crowdBenchRecipe } from "../src/scenarios/CrowdBenchRecipe.js";
import { ScenarioSession } from "../src/scenarios/ScenarioSession.js";

const option = (key: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const rabbits = Number(option("rabbits", "1000"));
const cars = Number(option("cars", "50"));
const warmup = Number(option("warmup", "180"));
const ticks = Number(option("ticks", "600"));
const output = option("output", path.join(os.tmpdir(), "tilefun-crowd.json"));
const compare = option("compare", "");
const profile = process.argv.includes("--profile");
if (![warmup, ticks].every((n) => Number.isInteger(n) && n > 0 && n <= 10_000))
  throw Error("--warmup and --ticks must be integers 1–10000");

// Interest leases and door timers read Date.now(); a simulated clock keeps the
// workload independent of how fast this machine runs the ticks.
let clock = Date.UTC(2026, 0, 1);
Date.now = () => clock;
const step = () => {
  clock += 1000 / 60;
  return s.tick(true);
};

type Counters = NonNullable<ScenarioSession["realm"]["collisionDiagnostics"]>;
const s = await ScenarioSession.create(crowdBenchRecipe(rabbits, cars));
try {
  const realm = s.realm;
  const counters = (): Counters => {
    const d = realm.collisionDiagnostics;
    if (!d) throw Error("Physics scene is not ready");
    return { ...d };
  };
  const count = (match: (type: string) => boolean) =>
    realm.entityManager.entities.filter((e) => match(e.type)).length;
  const placed = {
    rabbits: count((t) => t === "wildlife-rabbit-v1"),
    cars: count((t) => t.startsWith("vehicle-v1:")),
    entities: realm.entityManager.entities.length,
  };
  if (placed.rabbits !== rabbits || placed.cars !== cars)
    throw Error(`Placed ${JSON.stringify(placed)}, expected ${rabbits} rabbits and ${cars} cars`);

  for (let i = 0; i < warmup; i++) step();
  performanceMetrics.reset();
  const before = counters();
  const inspector = profile ? new Session() : undefined;
  if (inspector) {
    inspector.connect();
    await inspector.post("Profiler.enable");
    await inspector.post("Profiler.setSamplingInterval", { interval: 100 });
    await inspector.post("Profiler.start");
  }
  const times: number[] = [];
  let bytes = 0,
    simulated = 0,
    awakeCars = 0,
    moving = 0,
    samples = 0;
  for (let i = 0; i < ticks; i++) {
    const t = performance.now();
    const frames = step();
    times.push(performance.now() - t);
    for (const frame of frames) bytes += frame.byteLength;
    simulated += realm.persistenceDiagnostics.activeActors;
    // Sleeping state is read outside the timed tick, every 30 ticks.
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

  const sorted = [...times].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const perTick = (key: keyof Counters) =>
    round((Number(after[key]) - Number(before[key])) / ticks);
  const stages = Object.fromEntries(
    Object.entries(performanceMetrics.snapshot())
      .filter(([name]) => name.startsWith("realm.") || name.startsWith("server."))
      .map(([name, v]) => [name, { p50: round(v.p50Ms), p95: round(v.p95Ms) }]),
  );
  const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const report = {
    date: new Date().toISOString(),
    revision: git(["rev-parse", "--short", "HEAD"]),
    dirty: !!git(["status", "--porcelain", "--", "src"]),
    machine: `${os.cpus()[0]?.model} · ${os.platform()} ${os.arch()} · load ${os.loadavg()[0]?.toFixed(1)}`,
    recipe: { rabbits, cars, warmup, ticks },
    placed,
    tickMs: { p50: round(at(0.5)), p95: round(at(0.95)), p99: round(at(0.99)), max: round(at(1)) },
    stages,
    work: {
      simulatedActors: round(simulated / ticks),
      // Actors with horizontal or vertical motion: the work that is not idle.
      movingActors: round(moving / samples),
      physicsBodies: after.bodies,
      awakeCars: round(awakeCars / samples),
      wheelRays: perTick("wheelQueries"),
      wheelBodyTests: perTick("wheelNarrowQueries"),
      supportQueries: perTick("supportQueries"),
      replicationBytes: Math.round(bytes / ticks),
    },
    profile: cpu ? summarizeProfile(cpu) : undefined,
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  if (cpu) await writeFile(output.replace(/\.json$/, "") + ".cpuprofile", JSON.stringify(cpu));

  const previous = compare ? JSON.parse(await readFile(compare, "utf8")) : undefined;
  const delta = (now: number, then: number | undefined) =>
    then === undefined
      ? ""
      : ` (was ${then}${then ? `, ${Math.round(((now - then) / then) * 100)}%` : ""})`;
  console.log(
    `crowd:bench ${rabbits} rabbits, ${cars} cars · ${report.machine} · ${report.revision}${report.dirty ? "+dirty" : ""}`,
  );
  console.log(
    `tick p50 ${report.tickMs.p50} ms${delta(report.tickMs.p50, previous?.tickMs.p50)}, p95 ${report.tickMs.p95} ms${delta(report.tickMs.p95, previous?.tickMs.p95)}`,
  );
  for (const [name, v] of Object.entries(stages))
    console.log(
      `  ${name.padEnd(26)} p50 ${v.p50} ms${delta(v.p50, previous?.stages?.[name]?.p50)}`,
    );
  console.log("work per tick:");
  for (const [name, v] of Object.entries(report.work))
    console.log(`  ${name.padEnd(26)} ${v}${delta(v, previous?.work?.[name])}`);
  if (report.profile) {
    console.log("profile, self time share of measured ticks:");
    for (const [name, share] of report.profile.self) console.log(`  ${share.padStart(6)} ${name}`);
  }
  console.log(`Report: ${output}`);
} finally {
  await s.close();
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
