import { createDescriptor } from "../../src/generation/GenerationDescriptor.js";
import { createGenerator } from "../../src/generation/Generator.js";
import { Chunk } from "../../src/world/Chunk.js";
import { registerDefaultTiles } from "../../src/world/TileRegistry.js";
import { contentHash, gridArrays, route, type Sample, summarize } from "./report.js";
import { streamingFixture } from "./streaming.js";

export const FIXTURES = {
  district: [18, 32],
  farm: [42, 82],
  woodland: [-60, -60],
  "negative-coast": [-4, -9],
} as const;
export interface Options {
  seed: number;
  side: number;
  trials: number;
  fixtures: (keyof typeof FIXTURES)[];
  lanes: ("generate" | "streaming")[];
  verify: boolean;
}
function cell(lane: string, fixture: string, trial: number, pass: string, samples: Sample[]) {
  const names = [...new Set(samples.flatMap((s) => Object.keys(s.phasesMs)))];
  const publications = samples.flatMap((s) => s.publications ?? []);
  return {
    lane,
    fixture,
    trial,
    pass,
    first: samples[0],
    total: summarize(samples.map((s) => s.totalMs)),
    // Keep startup visible, while separating the rest of the exploration tail.
    afterFirst: samples.length > 1 ? summarize(samples.slice(1).map((s) => s.totalMs)) : null,
    phases: Object.fromEntries(
      names.map((name) => [name, summarize(samples.map((s) => s.phasesMs[name] ?? 0))]),
    ),
    publication: publications.length ? summarize(publications.map((p) => p.ms)) : null,
    slowest: [...samples].sort((a, b) => b.totalMs - a.totalMs).slice(0, 5),
    samples,
  };
}

export async function runBenchmark(options: Options) {
  const { seed, side, fixtures, trials, lanes, verify } = options;
  if (
    !Number.isSafeInteger(seed) ||
    !Number.isInteger(side) ||
    side < 1 ||
    side > 15 ||
    !Number.isInteger(trials) ||
    trials < 1 ||
    trials > 10 ||
    !fixtures.length ||
    !lanes.length ||
    new Set(fixtures).size !== fixtures.length ||
    new Set(lanes).size !== lanes.length ||
    fixtures.some((f) => !Object.hasOwn(FIXTURES, f)) ||
    lanes.some((l) => l !== "generate" && l !== "streaming")
  )
    throw Error(
      "Invalid workload: seed integer, side 1–15, trials 1–10, unique fixtures/lanes required",
    );
  registerDefaultTiles();
  const descriptor = createDescriptor("regional", seed);
  const cells = [];
  for (let trial = 0; trial < trials; trial++) {
    // Rotate fixture order to avoid always giving the district process-cold code.
    const ordered = fixtures.map((_, i) => fixtures[(i + trial) % fixtures.length]);
    for (const fixture of ordered) {
      if (!fixture) throw Error("Missing fixture");
      const [cx, cy] = FIXTURES[fixture],
        coordinates = route(cx, cy, side);
      for (const lane of lanes) {
        if (lane === "streaming") {
          const setupStart = performance.now();
          const f = await streamingFixture(descriptor, verify);
          const setupMs = performance.now() - setupStart;
          try {
            // Groups of eight exercise the production in-flight load limit and publication bursts.
            const samples = [];
            for (let i = 0; i < coordinates.length; i += 8) {
              // Let the event loop run between batches; this delay is outside every timer.
              await new Promise((resolve) => setTimeout(resolve, 0));
              samples.push(await f.visit(coordinates.slice(i, i + 8)));
            }
            cells.push({ ...cell(lane, fixture, trial, "unseen-batches", samples), setupMs });
          } finally {
            await f.close();
          }
          continue;
        }
        // A new generator per fixture/trial isolates planner caches, NOT process JIT state.
        const setupStart = performance.now();
        const generator = createGenerator(descriptor);
        const setupMs = performance.now() - setupStart;
        for (const pass of ["unseen", "regenerate"] as const) {
          const samples: Sample[] = [];
          for (const coordinate of coordinates) {
            const { cx, cy } = coordinate;
            const a = performance.now(),
              chunk = new Chunk();
            generator.terrain.generate(chunk, cx, cy);
            const b = performance.now();
            chunk.railPaths = generator.terrain.railPathsForChunk?.(cx, cy) ?? [];
            const c = performance.now();
            const props = generator.placements(cx, cy, new Set()).placements;
            const d = performance.now();
            const actors = generator.actors?.(cx, cy) ?? [];
            const e = performance.now();
            samples.push({
              ...coordinate,
              totalMs: e - a,
              phasesMs: {
                terrain: b - a,
                railMetadata: c - b,
                propPlans: d - c,
                actorPlans: e - d,
              },
              props: props.length,
              actors: actors.length,
              gridBytes: gridArrays(chunk).reduce((sum, array) => sum + array.byteLength, 0),
              ...(verify ? { contentHash: contentHash(chunk, props, actors) } : {}),
            });
          }
          cells.push({
            ...cell(lane, fixture, trial, pass, samples),
            setupMs: pass === "unseen" ? setupMs : 0,
          });
        }
      }
    }
  }
  return {
    schemaVersion: 2,
    descriptor,
    workload: { ...options, route: "serpentine-square-v1", batchSize: 8 },
    cells,
    scope: {
      generate:
        "Fresh planner caches per fixture/trial; all unseen chunks then same-coordinate regeneration. JIT stays warm across fixtures. Phases are exclusive; terrain includes its internal regional planning. No persistence, live admission, autotiling, physics, traffic services, replication or rendering.",
      streaming:
        "Production RealmStreaming + procedural registries + RealmRecords, empty MemoryRecordStore, batches of up to eight unique chunks; all earlier batches stay resident. totalMs is awaited batch wall time, NOT a single Worker task or disk latency. publications records synchronous per-chunk publication. phasesMs partitions the batch into exclusive timings. Excludes physics, autotiling, traffic services, replication and rendering. Verification hashes terrain/rail metadata only; live props/actors are counted.",
      observation:
        "Counts/records are collected after timers, but can affect later GC. No forced GC or discarded warmup. Verify/profile runs are diagnostic, not timing baselines. FNV-1a content hashes are regression checks, not cryptographic identities.",
    },
  };
}
