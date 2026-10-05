import { expect, it } from "vitest";
import {
  CAMERA_CONTROLS,
  CAMERA_FAULT_CASES,
  compareCameraBasics,
  runCameraBasicsTrace,
} from "../../scripts/instrumentation/camera-basics-case.js";

it.each(CAMERA_CONTROLS)(
  "advances the rider-free $subject at its known speed ($serverHz/$renderHz Hz)",
  (config) => {
    const a = compareCameraBasics(config);
    expect(compareCameraBasics(config)).toEqual(a);
    expect(a.summary.maxWorldStepErrorPx).toBeLessThan(0.05);
    expect(a.summary.backwardTargetFrames).toBe(0);
    expect(a.summary.backwardCameraFrames).toBe(0);
    // A locked camera has no filter: its world motion must be exact too.
    if (config.subject === "train-locked")
      expect(a.summary.maxCameraStepErrorPx).toBeLessThan(0.05);
  },
);

it.each(CAMERA_FAULT_CASES)("repeats the complete $subject / $fault trace exactly", (config) => {
  expect(compareCameraBasics(config)).toEqual(compareCameraBasics(config));
});

// Probe both sides of update boundaries. Equal-rate render samples alone can
// miss a discontinuity that consistently falls between the sampled frames.
it.each(CAMERA_CONTROLS.filter((c) => c.renderHz === 120))(
  "has matching one-sided camera/target limits at ordinary tick boundaries for $subject ($serverHz Hz)",
  (config) => {
    const left = runCameraBasicsTrace(config, -0.001);
    const right = runCameraBasicsTrace(config, 0.001);
    for (const [i, b] of right.samples.entries()) {
      if (b.timeMs < 1000) continue;
      const a = left.samples[i];
      expect(a).toBeDefined();
      expect(Math.abs(b.targetX - (a?.targetX ?? NaN))).toBeLessThan(0.01);
      expect(Math.abs(b.cameraX - (a?.cameraX ?? NaN))).toBeLessThan(0.01);
    }
  },
);

const shortPausePasses = CAMERA_FAULT_CASES.filter(
  (c) => c.fault === "render-gap-100ms" && c.subject !== "train-smoothed",
);
it.each(shortPausePasses)(
  "resumes $subject after absent frames at the same pose as uninterrupted execution",
  (config) => {
    const a = compareCameraBasics(config);
    expect(a.summary.maxElapsedMs).toBeGreaterThan(100);
    // Compare equal timestamps, not equal frame indices in the shortened array.
    expect(a.summary.maxWorldDeviationPx).toBeLessThan(0.05);
    expect(a.summary.maxCameraDeviationPx).toBeLessThan(0.05);
    expect(a.summary.maxWorldStepErrorPx).toBeLessThan(0.05);
  },
);

it("isolates noclip from timing: both real prediction paths agree on resident empty terrain", () => {
  const config = { serverHz: 60, renderHz: 120, fault: "render-gap-100ms" } as const;
  const normal = runCameraBasicsTrace({ ...config, subject: "player" });
  const noclip = runCameraBasicsTrace({ ...config, subject: "player-noclip" });
  expect(normal.samples).toEqual(noclip.samples);
});

it("a centered train can hide backwards camera motion; a stationary landmark reveals it", () => {
  const a = compareCameraBasics({
    subject: "train-locked",
    fault: "snapshot-late-10ms",
    serverHz: 60,
    renderHz: 120,
  });
  expect(a.samples.every((s) => s.screenX === 640)).toBe(true);
  expect(
    a.steps.some((s) => s.targetStep < 0 && s.cameraStep < 0 && s.landmarkScreenStep > 0),
  ).toBe(true);
});

it.each(["player", "player-noclip"] as const)(
  "records intentional elapsed-time loss beyond the catch-up cap for $subject",
  (subject) => {
    const a = compareCameraBasics({
      subject,
      fault: "render-gap-600ms",
      serverHz: 60,
      renderHz: 120,
    });
    expect(a.summary.maxElapsedMs).toBeGreaterThan(600);
    expect(a.summary.maxWorldDeviationPx).toBeGreaterThan(250);
    expect(a.summary.backwardTargetFrames).toBe(0);
    // Continuing to walk must not restore the discarded simulation time later.
    expect(a.comparisons.at(-1)?.worldDeviation).toBeLessThan(-250);
  },
);

// Unmet contracts, not success claims. Promote to normal regressions after the
// shared timeline/camera fix; do not relax the independent oracle tolerances.
const shortPauseFailures = CAMERA_FAULT_CASES.filter(
  (c) =>
    c.fault === "snapshot-late-10ms" ||
    c.fault === "delivery-gap-100ms" ||
    (c.fault === "render-gap-100ms" && c.subject === "train-smoothed"),
);
it.fails.each(shortPauseFailures)(
  "keeps basic $subject presentation independent of $fault scheduling",
  (config) => {
    const a = compareCameraBasics(config);
    expect(a.summary.maxWorldDeviationPx).toBeLessThan(0.05);
    expect(a.summary.maxCameraDeviationPx).toBeLessThan(0.05);
  },
);

it.fails.each(["train-locked", "train-smoothed"] as const)(
  "does not replay train movement backwards after a long render pause ($subject)",
  (subject) => {
    const a = compareCameraBasics({
      subject,
      fault: "render-gap-600ms",
      serverHz: 60,
      renderHz: 120,
    });
    expect(a.summary.backwardTargetFrames).toBe(0);
  },
);
