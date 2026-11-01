import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { PairAuthority } from "../src/physics/rapier/PairAuthority.js";
import { PairHarness } from "../src/physics/rapier/PairHarness.js";

const results = [];
for (const scene of ["start-stop", "opposed", "reversal"] as const) {
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
    try {
      for (let tick = 0; tick < 300; tick++) {
        await harness.step();
        for (const seat of [0, 1] as const) {
          harness.presentedPoses(seat);
          sources[seat].add(harness.presentation[seat].diagnostics.remoteSource);
        }
      }
      results.push({
        scene,
        mode,
        lateInputs: harness.latest.lateInputs,
        finalPhysicsHash: createHash("sha256")
          .update(harness.latest.snapshot.state.bytes)
          .digest("hex"),
        clients: ([0, 1] as const).map((seat) => ({
          seat,
          maxPastErrorMetres: harness.clients[seat].diagnostics.maxCorrection,
          maxCurrentCorrectionMetres: harness.clients[seat].diagnostics.maxCurrentCorrection,
          maxPresentedRemoteStepMetres: harness.presentation[seat].diagnostics.maxRemoteStep,
          finalOffsetMetres: harness.presentation[seat].diagnostics.maxOffset,
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
      "Accelerated native coordinator, not browser frames or GPU timing. Same-tick past error, same-present raw rebase and sampled displayed position are separate metrics. Prediction of unknown remote inputs still corrects; this experiment changes presentation only. Compare final physics hashes across modes within each scene.",
    results,
  },
  null,
  2,
)}\n`;
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
if (output) await writeFile(output, report);
else process.stdout.write(report);
