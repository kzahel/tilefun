import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { PairAuthority } from "../src/physics/rapier/PairAuthority.js";
import { PairHarness } from "../src/physics/rapier/PairHarness.js";
import { PHYSICS_DT } from "../src/physics/rapier/RapierWorld.js";

const results = [];
for (const scene of [
  "push",
  "start-stop",
  "opposed",
  "reversal",
  "player-push",
  "player-head-on",
  "player-glance",
] as const) {
  for (const mode of ["raw", "smooth-prediction", "buffered-when-clear"] as const) {
    const authority = await PairAuthority.create(scene);
    const harness = new PairHarness(
      { scene, rtt: 200, jitter: 20, seed: 713 },
      authority,
      authority.frame(),
    );
    for (const presentation of harness.presentation) {
      presentation.remoteMode = mode === "buffered-when-clear" ? "buffered" : "predicted";
      presentation.smooth = mode !== "raw";
    }
    const sources: [Set<string>, Set<string>] = [new Set(), new Set()];
    const firstPushGap: (number | undefined)[] = [],
      previousCubeX: (number | undefined)[] = [];
    const initialMotors = harness.latest.snapshot.state.motors;
    let previousMotors = initialMotors;
    let releasedMotors: typeof previousMotors | undefined;
    let maxAuthoritySpeed = 0,
      maxReleaseDrift = 0;
    try {
      for (let tick = 0; tick < 300; tick++) {
        await harness.step();
        const motors = harness.latest.snapshot.state.motors;
        for (const seat of [0, 1] as const) {
          const current = motors[seat],
            previous = previousMotors[seat],
            released = releasedMotors?.[seat];
          if (current && previous)
            maxAuthoritySpeed = Math.max(
              maxAuthoritySpeed,
              Math.hypot(current.x - previous.x, current.z - previous.z) / PHYSICS_DT,
            );
          if (current && released)
            maxReleaseDrift = Math.max(
              maxReleaseDrift,
              Math.hypot(current.x - released.x, current.z - released.z),
            );
        }
        previousMotors = motors;
        if (tick === 140) releasedMotors = motors;
        for (const seat of [0, 1] as const) {
          const displayed = harness.presentedPoses(seat);
          const cube = displayed.findIndex((v, i) => i % 14 === 0 && v === 2);
          const player = displayed.findIndex((v, i) => i % 14 === 0 && v === 0);
          const x = displayed[cube + 1],
            previous = previousCubeX[seat];
          if (
            cube >= 0 &&
            player >= 0 &&
            x !== undefined &&
            previous !== undefined &&
            x - previous > 0.005 &&
            firstPushGap[seat] === undefined
          )
            firstPushGap[seat] = x - 0.4 - ((displayed[player + 1] ?? 0) + 0.28);
          previousCubeX[seat] = cube >= 0 ? x : undefined;
          sources[seat].add(harness.presentation[seat].diagnostics.remoteSource);
        }
      }
      results.push({
        scene,
        mode,
        lateInputs: harness.latest.lateInputs,
        authorityDisplacementFromStartMetres: harness.latest.snapshot.state.motors.map(
          (motor, seat) => ({
            seat,
            x: motor.x - (initialMotors[seat]?.x ?? motor.x),
            z: motor.z - (initialMotors[seat]?.z ?? motor.z),
          }),
        ),
        maxAuthorityHorizontalSpeedMetresPerSecond: maxAuthoritySpeed,
        maxAuthorityDriftAfterTick141Metres: maxReleaseDrift,
        finalPhysicsHash: createHash("sha256")
          .update(harness.latest.snapshot.state.bytes)
          .digest("hex"),
        clients: ([0, 1] as const).map((seat) => ({
          seat,
          maxPastErrorMetres: harness.clients[seat].diagnostics.maxCorrection,
          maxCurrentCorrectionMetres: harness.clients[seat].diagnostics.maxCurrentCorrection,
          maxPresentedRemoteStepMetres: harness.presentation[seat].diagnostics.maxRemoteStep,
          finalOffsetMetres: harness.presentation[seat].diagnostics.maxOffset,
          firstPushGapMetres: firstPushGap[seat] ?? null,
          cubeSource: harness.presentation[seat].diagnostics.cubeSource,
          cubeDisplayTick: harness.presentation[seat].diagnostics.cubeDisplayTick,
          remoteDisplayTick: harness.presentation[seat].diagnostics.remoteDisplayTick,
          remoteSources: [...sources[seat]],
          recoveries: harness.clients[seat].diagnostics.recoveries,
        })),
      });
    } finally {
      await harness.close();
    }
  }
}
const report = `${JSON.stringify(
  {
    seed: 713,
    rttMs: 200,
    jitterPerDirectionMs: 20,
    limits:
      "Accelerated native coordinator, not browser frames or GPU timing. Same-tick past error, same-present raw rebase and sampled displayed position are separate metrics. Contact components share one timeline and one rigid transform; idle clients buffer the scene. First-push gap uses the authored unrotated cube half-width and allows sub-step snapshot/controller error. 196 shares bounded push displacement between player motors using current proposals; 195's relative sweeps and 194's display policy remain. Authority speed is measured every fixed tick, independently of presentation. Drift after tick 141 is meaningful for scripts whose input has already stopped. Unknown remote inputs still cause corrections. Compare final physics hashes across modes within each scene.",
    results,
  },
  null,
  2,
)}\n`;
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
if (output) await writeFile(output, report);
else process.stdout.write(report);
