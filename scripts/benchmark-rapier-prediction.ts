import { writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import type { PhysicsStart } from "../src/physics/rapier/BridgeFixture.js";
import {
  type RapierAuthorityState,
  RapierPredictor,
} from "../src/physics/rapier/RapierPredictor.js";
import { initRapier, type PhysicsInput, RapierWorld } from "../src/physics/rapier/RapierWorld.js";

await initRapier();
const lanes = [];
for (const name of ["ramp", "lift", "loose-contact"] as const) {
  const authority = new RapierWorld(8, name === "loose-contact" ? 16 : 0);
  const predictor = new RapierPredictor(8);
  const start: PhysicsStart = name === "lift" ? "platform" : "ramp";
  authority.teleport(start);
  for (let i = 0; i < 30; i++) authority.step({ x: 0, z: 0, jump: false });
  predictor.receive({ ack: 0, motor: authority.motor(), poses: authority.poses() }, 0);
  const up: { at: number; seq: number; input: PhysicsInput }[] = [];
  const down: { at: number; state: RapierAuthorityState }[] = [];
  const replay: number[] = [],
    correction: number[] = [],
    relative: number[] = [],
    step: number[] = [];
  let ack = 0,
    maxPending = 0,
    reconciles = 0,
    bodyCount = 0;
  try {
    for (let frame = 1; frame <= 600; frame++) {
      const input = {
        x: name === "lift" ? 0 : frame < 360 ? 1 : 0,
        z: name === "lift" && frame > 300 && frame < 360 ? 1 : 0,
        jump: frame >= 160 && frame < 166,
      };
      predictor.submit(frame, input, (frame * 1000) / 60);
      up.push({ at: frame + 6, seq: frame, input });
      const command = up[0] && up[0].at <= frame ? up.shift() : undefined;
      authority.step(command?.input ?? { x: 0, z: 0, jump: authority.motor().jumpHeld });
      ack = command?.seq ?? ack;
      if (frame % 2 === 0)
        down.push({
          at: Math.max(frame + 6 + (frame % 3), down.at(-1)?.at ?? 0),
          state: { ack, motor: authority.motor(), poses: authority.poses() },
        });
      while (down[0] && down[0].at <= frame) {
        const packet = down.shift();
        if (packet) predictor.receive(packet.state, (frame * 1000) / 60);
      }
      predictor.drain();
      const d = predictor.diagnostics;
      if (d.reconciles !== reconciles) {
        reconciles = d.reconciles;
        replay.push(d.completedReplayMs);
        correction.push(d.correctionMetres);
        relative.push(d.relativeCorrectionMetres);
      }
      step.push(authority.diagnostics().stepMs);
      maxPending = Math.max(maxPending, d.pending);
      bodyCount = authority.diagnostics().bodies;
    }
    const stats = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        count: values.length,
        p95: sorted[Math.floor((values.length - 1) * 0.95)] ?? 0,
        max: sorted.at(-1) ?? 0,
      };
    };
    lanes.push({
      name,
      frames: 600,
      maxPending,
      finalBodies: bodyCount,
      authorityStepMs: stats(step),
      completeReplayMs: stats(replay),
      correctionMetres: stats(correction),
      supportRelativeCorrectionMetres: stats(relative),
    });
  } finally {
    predictor.dispose();
    authority.dispose();
  }
}
const report = `${JSON.stringify(
  {
    date: new Date().toISOString(),
    cpu: cpus()[0]?.model,
    platform: process.platform,
    inputDelaySteps: 6,
    snapshotDelaySteps: "6–8, ordered",
    limits:
      "Accelerated single-process Node/WASM roles, not Worker/Chromebook headroom. No Realm codec, render or persistence cost. Dynamic proxies extrapolate for 100 ms. Replay totals include restoration and all scratch slices. No production performance comparison.",
    lanes,
  },
  null,
  2,
)}\n`;
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
if (output) await writeFile(output, report);
else process.stdout.write(report);
