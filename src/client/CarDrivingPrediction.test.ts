import { expect, it } from "vitest";
import {
  CAR_DRIVING_PROFILES,
  runCarDrivingCase,
} from "../../scripts/instrumentation/car-driving-prediction-case.js";

for (const hz of [30, 60] as const)
  it(`replays reverse through binary input and authority without divergence (${hz}Hz)`, async () => {
    const regular = await runCarDrivingCase(hz, "regular", "reverse");
    const delayed = await runCarDrivingCase(hz, "late-input", "reverse");
    expect(delayed.summary.maxReconcileShiftPx).toBeLessThan(0.001);
    expect(delayed.summary.maxReconcileVelocityShift).toBeLessThan(0.001);
    expect(delayed.summary.endAuthorityX).toBeCloseTo(regular.summary.endAuthorityX, 5);
    expect(delayed.authority.some((sample) => sample.vx < -1)).toBe(true);
    expect(delayed.summary.motionWithoutInputPx).toBe(0);
  });

for (const hz of [30, 60] as const)
  for (const profile of CAR_DRIVING_PROFILES)
    it(`keeps car prediction and 120Hz presentation continuous (${hz}Hz, ${profile})`, async () => {
      const result = await runCarDrivingCase(hz, profile);
      const summary = result.summary;
      expect(summary.maxReconcileShiftPx).toBeLessThan(0.001);
      expect(summary.maxReconcileVelocityShift).toBeLessThan(0.001);
      expect(summary.motionWithoutInputPx).toBe(0);
      expect(summary.maxWorldStepPx - summary.minWorldStepPx).toBeLessThan(0.001);
      expect(summary.maxDriverCarSeparationPx).toBe(0);
      if (profile === "late-input") {
        expect(summary.missingInputTicks).toBe(5);
        expect(result.authority.some((tick) => tick.commands === 2)).toBe(true);
        const regular = await runCarDrivingCase(hz, "regular");
        expect(summary.endAuthorityX).toBeCloseTo(regular.summary.endAuthorityX, 5);
      }
    });

for (const hz of [30, 60] as const)
  it(`replays delayed diagonal turns and release braking without extra authority travel (${hz}Hz)`, async () => {
    const regular = await runCarDrivingCase(hz, "regular", "turn-release");
    const delayed = await runCarDrivingCase(hz, "late-input", "turn-release");
    expect(delayed.summary.missingInputTicks).toBe(5);
    expect(delayed.summary.maxReconcileShiftPx).toBeLessThan(0.001);
    expect(delayed.summary.maxReconcileVelocityShift).toBeLessThan(0.001);
    expect(delayed.summary.motionWithoutInputPx).toBe(0);
    expect(delayed.summary.endAuthorityX).toBeCloseTo(regular.summary.endAuthorityX, 5);
    expect(delayed.summary.endAuthorityY).toBeCloseTo(regular.summary.endAuthorityY, 5);
    expect(delayed.summary.endAuthoritySpeed).toBe(0);
    expect(delayed.summary.maxDriverCarSeparationPx).toBe(0);
  });

for (const hz of [30, 60] as const)
  it(`replays curved reverse, a rolling gear change and a diagonal stop (${hz}Hz)`, async () => {
    const regular = await runCarDrivingCase(hz, "regular", "reverse-turn");
    const delayed = await runCarDrivingCase(hz, "late-input", "reverse-turn");
    expect(delayed.summary.maxReconcileShiftPx).toBeLessThan(0.001);
    expect(delayed.summary.maxReconcileVelocityShift).toBeLessThan(0.001);
    expect(delayed.summary.maxReconcileHeadingShift).toBeLessThan(0.00001);
    expect(delayed.summary.endAuthorityHeading).toBeCloseTo(
      regular.summary.endAuthorityHeading ?? 0,
      5,
    );
    expect(delayed.summary.endAuthorityX).toBeCloseTo(regular.summary.endAuthorityX, 5);
    expect(delayed.summary.endAuthorityY).toBeCloseTo(regular.summary.endAuthorityY, 5);
    expect(delayed.summary.endAuthoritySpeed).toBe(0);
    expect(delayed.summary.motionWithoutInputPx).toBe(0);
  });

for (const hz of [30, 60] as const)
  for (const motion of ["automatic-reverse", "relative"] as const)
    it(`replays ${motion} controls through binary authority (${hz}Hz)`, async () => {
      const regular = await runCarDrivingCase(hz, "regular", motion);
      const delayed = await runCarDrivingCase(hz, "late-input", motion);
      expect(delayed.summary.maxReconcileShiftPx).toBeLessThan(0.001);
      expect(delayed.summary.maxReconcileVelocityShift).toBeLessThan(0.001);
      expect(delayed.summary.maxReconcileHeadingShift).toBeLessThan(0.00001);
      expect(delayed.summary.endAuthorityX).toBeCloseTo(regular.summary.endAuthorityX, 5);
      expect(delayed.summary.endAuthorityY).toBeCloseTo(regular.summary.endAuthorityY, 5);
      expect(delayed.summary.endAuthoritySpeed).toBe(0);
      expect(delayed.authority.some((sample) => sample.vx < -1)).toBe(true);
    });
