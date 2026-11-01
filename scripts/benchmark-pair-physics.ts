import { writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { PairAuthority } from "../src/physics/rapier/PairAuthority.js";
import { PairHarness } from "../src/physics/rapier/PairHarness.js";
import { PAIR_SCENARIOS } from "../src/physics/rapier/PhysicsScenarios.js";

const results = [];
const percentile = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.95)] ?? 0;
for (const scene of PAIR_SCENARIOS) {
  const authority = await PairAuthority.create(scene.id);
  const harness = new PairHarness(
    { scene: scene.id, rtt: 200, jitter: 20, seed: 713 },
    authority,
    authority.frame(),
  );
  const replay: [number[], number[]] = [[], []],
    errors: [number[], number[]] = [[], []],
    authorityMs: number[] = [];
  try {
    for (let tick = 0; tick < 300; tick++) {
      await harness.step();
      authorityMs.push(harness.latest.tickMs);
      for (const seat of [0, 1] as const) {
        const d = harness.clients[seat].diagnostics;
        replay[seat].push(d.replayMs);
        errors[seat].push(d.correction);
      }
    }
    results.push({
      scene: scene.id,
      ticks: harness.tick,
      snapshotBytes: harness.latest.snapshot.state.bytes.byteLength,
      authorityTickP95Ms: percentile(authorityMs),
      lateInputs: harness.latest.lateInputs,
      clients: ([0, 1] as const).map((seat) => ({
        seat,
        replayP95Ms: percentile(replay[seat]),
        replayMaxMs: Math.max(...replay[seat]),
        errorP95Metres: percentile(errors[seat]),
        errorMaxMetres: Math.max(...errors[seat]),
        finalErrorMetres: harness.clients[seat].diagnostics.correction,
        recoveries: harness.clients[seat].diagnostics.recoveries,
      })),
      finalPoses: [...harness.latest.poses],
    });
  } finally {
    await harness.close();
  }
}
const report = `${JSON.stringify(
  {
    cpu: cpus()[0]?.model,
    seed: 713,
    rttMs: 200,
    jitterPerDirectionMs: 20,
    limits:
      "Accelerated Node/WASM. Real Realm, codecs and replicas; complete small-scene snapshots. No Worker transfer, browser rendering, independent-clock scheduling, WebRTC or Chromebook qualification. Error compares positions of all bodies at matching past ticks; remote input transitions are unknown until received.",
    results,
  },
  null,
  2,
)}\n`;
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
if (output) await writeFile(output, report);
else process.stdout.write(report);
