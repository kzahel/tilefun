import { expect, it } from "vitest";
import {
  PRESENTATION_CASES,
  runPresentationCase,
} from "../../scripts/instrumentation/presentation-timeline-case.js";

const rates = PRESENTATION_CASES.filter((c) => !c.lateSnapshot);

it.each(rates)(
  "is deterministic and continuous with on-time snapshots ($serverHz/$renderHz Hz)",
  (config) => {
    const a = runPresentationCase(config);
    expect(runPresentationCase(config)).toEqual(a);
    expect(a.summary.roofOffsetRangePx).toBeLessThan(0.001);
    expect(a.summary.maxWorldStepErrorPx).toBeLessThan(0.05);
    expect(a.summary.maxScreenStepPx).toBeLessThan(1);
  },
);

it.each(rates)(
  "preserves roof alignment and repeatability with one ordered late snapshot ($serverHz/$renderHz Hz)",
  (config) => {
    const late = { ...config, lateSnapshot: true };
    const a = runPresentationCase(late);
    expect(runPresentationCase(late)).toEqual(a);
    expect(a.summary.roofOffsetRangePx).toBeLessThan(0.001);
    expect(a.samples.some((s) => s.framesApplied > 1)).toBe(true);
  },
);

// Regression promoted from the original expected failures, with the same oracle
// and tolerances after adopting the shared timestamped presentation owner.
it.each(rates)(
  "keeps constant-speed presentation continuous across a 10ms late snapshot ($serverHz/$renderHz Hz)",
  (config) => {
    const a = runPresentationCase({ ...config, lateSnapshot: true });
    expect(a.summary.maxWorldStepErrorPx).toBeLessThan(0.05);
    expect(a.summary.maxScreenStepPx).toBeLessThan(1);
  },
);
