import { expect, it } from "vitest";
import { advanceCameraFollow, type CameraFollowState } from "./CameraFollow.js";
import {
  advancePresentationClock,
  MAX_MOTION_SAMPLES,
  recordMotionSample,
  sampleMotion,
} from "./PresentationTimeline.js";

const pose = (time: number) => ({ time, x: time * 192, y: time * 48, z: time * 12, jumpZ: 0 });
it("samples a known line in history and bounded extrapolation without mutating inputs", () => {
  const history = Object.freeze([Object.freeze(pose(0)), Object.freeze(pose(1))]);
  expect(sampleMotion(history, 0.5)).toEqual(pose(0.5));
  expect(sampleMotion(history, 1.05)?.x).toBeCloseTo(201.6);
  expect(sampleMotion(history, 10)?.x).toBeCloseTo(211.2);
  expect(sampleMotion([], 1)).toBeUndefined();
});
it("bounds history, replaces equal-time snapshots and starts a new segment for relocation", () => {
  let history = [pose(0)];
  for (let tick = 1; tick <= 100; tick++) history = recordMotionSample(history, pose(tick / 60));
  expect(history).toHaveLength(MAX_MOTION_SAMPLES);
  const replacement = { ...pose(100 / 60), x: 319 };
  expect(recordMotionSample(history, replacement).at(-1)).toBe(replacement);
  expect(recordMotionSample(history, { ...pose(2), x: 1000 })).toHaveLength(1);
  expect(recordMotionSample(history, pose(0))).toEqual([pose(0)]);
});
it("keeps display time monotonic through late frames, caps exhausted history, and resumes", () => {
  const initial = Object.freeze({ localOrigin: 0, sourceOrigin: 0, time: 0 });
  const a = advancePresentationClock(initial, 1, 0.95);
  expect(a.time).toBeCloseTo(0.95);
  const held = advancePresentationClock(a, 2, 0.95);
  expect(held.time).toBeCloseTo(1.05);
  expect(advancePresentationClock(held, 1, 0.95).time).toBe(held.time);
  expect(advancePresentationClock(held, 2.1, 2.1).time).toBeCloseTo(2.05);
  expect(initial.time).toBe(0);
  expect(advancePresentationClock(initial, 1, 2, 2).time).toBeCloseTo(1.95);
});
it.each([30, 60, 120])("composes camera motion across a missing render interval at %iHz", (hz) => {
  const start = Object.freeze({ time: 0, x: -10, y: 20, targetX: 0, targetY: 0 });
  let regular: CameraFollowState = start;
  for (let tick = 1; tick <= hz; tick++)
    regular = advanceCameraFollow(regular, tick / hz, (tick * 192) / hz, (tick * 48) / hz);
  const missing = advanceCameraFollow(start, 1, 192, 48);
  expect(missing.x).toBeCloseTo(regular.x, 10);
  expect(missing.y).toBeCloseTo(regular.y, 10);
  expect(advanceCameraFollow(missing, 1, 200, 90)).toBe(missing);
  expect(advanceCameraFollow(missing, 0, 200, 90)).toBe(missing);
});
