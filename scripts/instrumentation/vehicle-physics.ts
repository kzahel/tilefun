/** Native authority-physics cost, excluding AI/render/network. Optional exact old
 * PhysicsScene module supports a bounded comparison without retaining that solver. */
import { cpus, platform } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Direction } from "../../src/entities/Entity.js";
import { PhysicsScene } from "../../src/physics/PhysicsScene.js";
import type { MotionIntent } from "../../src/physics/PhysicsState.js";
import { createVehicle } from "../../src/traffic/Vehicle.js";
import { createFauna } from "../../src/wildlife/Fauna.js";

type Scene = Pick<PhysicsScene, "synchronize" | "step" | "snapshot" | "dispose" | "diagnostics">;
const current: { create: () => Promise<Scene> } = PhysicsScene;
const baseline: { create: () => Promise<Scene> } | undefined = process.argv[2]
  ? (await import(pathToFileURL(resolve(process.argv[2])).href)).PhysicsScene
  : undefined;
const geometry = {
  getCollision: () => 0,
  getHeight: () => 0,
  queryProps: () => [],
  geometryVersion: () => ({ identity: 1, revision: 0 }),
};
const stats = (times: number[]) => {
  const sorted = [...times].sort((a, b) => a - b),
    percentile = (p: number) => sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
  return {
    samples: times.length,
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: percentile(1),
  };
};
const reports = [];
for (const mode of ["characters", "parked", "driving"] as const) {
  const samples: Record<string, number[]> = {},
    runs = [];
  for (let repeat = 0; repeat < 3; repeat++) {
    const versions =
      repeat % 2
        ? [["current", current], ...(baseline ? [["baseline", baseline]] : [])]
        : [...(baseline ? [["baseline", baseline]] : []), ["current", current]];
    for (const [label, factory] of versions as [string, { create: () => Promise<Scene> }][]) {
      const scene = await factory.create();
      try {
        const actors = Array.from({ length: 96 }, (_, i) => {
          const e = createFauna("dog", (i % 16) * 32, -96 - Math.floor(i / 16) * 24);
          e.id = i + 1;
          return e;
        });
        const cars =
          mode === "characters"
            ? []
            : Array.from({ length: 32 }, (_, i) => {
                const e = createVehicle(
                  "compact-1",
                  (i % 8) * 144,
                  128 + Math.floor(i / 8) * 96,
                  Direction.Right,
                );
                e.id = i + 97;
                return e;
              });
        const bodies = [...actors, ...cars],
          intents = new Map<number, MotionIntent>(
            mode === "driving"
              ? cars.map((e) => [e.id, { vx: 0, vy: 0, driveSpeed: 112, heading: 0 }])
              : [],
          );
        const times: number[] = [];
        for (let tick = 0; tick < 780; tick++) {
          const started = performance.now();
          scene.synchronize(bodies);
          scene.step(intents, geometry);
          if (tick >= 180) times.push(performance.now() - started);
        }
        if (scene.diagnostics.worldSteps !== 780 || scene.diagnostics.bodyCreates !== bodies.length)
          throw Error("Physics identity/step contract failed");
        samples[label] ??= [];
        samples[label]?.push(...times);
        runs.push({
          label,
          repeat,
          ms: stats(times),
          sleepingVehicles: scene
            .snapshot()
            .bodies.filter((b) => b.kind === "vehicle" && b.sleeping).length,
        });
      } finally {
        scene.dispose();
      }
    }
  }
  reports.push({
    mode,
    bodies: mode === "characters" ? 96 : 128,
    runs,
    summary: Object.fromEntries(
      Object.entries(samples).map(([label, times]) => [label, stats(times)]),
    ),
  });
}
console.log(
  JSON.stringify(
    {
      schema: 1,
      measuredAt: new Date().toISOString(),
      environment: { node: process.version, platform: platform(), cpu: cpus()[0]?.model },
      scope:
        "synchronize + one shared physics step; 180 warm-up and 600 measured ticks, three alternating repeats; no AI, rendering, wire or real-device timing",
      reports,
    },
    null,
    2,
  ),
);
