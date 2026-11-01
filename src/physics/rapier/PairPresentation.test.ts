import { expect, it } from "vitest";
import { MAX_CORRECTION_SPEED, PairPresentation } from "./PairPresentation.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";

function poses(remoteX = 8, cubeX?: number) {
  const rows = [
    0,
    0,
    0.63,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    -1,
    remoteX,
    0.63,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
  ];
  if (cubeX !== undefined) rows.push(2, cubeX, 0.4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0);
  return new Float32Array(rows);
}
it("preserves a whole-group correction immediately, decays only the offset, and leaves physics untouched", () => {
  const presentation = new PairPresentation(0, 2);
  presentation.remoteMode = "predicted";
  const before = poses(8, 4),
    after = poses(9.2, 4.8);
  after[1] = 0.1;
  // Include a dynamic cube rotation in the same correction.
  after[2 * POSE_STRIDE + 5] = Math.sin(0.3);
  after[2 * POSE_STRIDE + 7] = Math.cos(0.3);
  const copy = after.slice();
  presentation.sample(before, 0);
  presentation.correct({ before, after, reset: false });
  const corrected = presentation.sample(after, 0);
  expect([...corrected]).toEqual([...before]);
  expect(after).toEqual(copy);
  presentation.advance(0.12);
  const halfway = presentation.sample(after, 1);
  expect(halfway[POSE_STRIDE + 1]).toBeGreaterThan(8);
  expect(halfway[POSE_STRIDE + 1]).toBeLessThan(9.2);
  // Ordinary subsequent movement keeps its full delta: no blanket low-pass lag.
  const moved = after.slice();
  moved[1] = (moved[1] ?? 0) + 0.075;
  expect((presentation.sample(moved, 1)[1] ?? 0) - (halfway[1] ?? 0)).toBeCloseTo(0.075);
  expect(presentation.sample(moved, 1)).toEqual(presentation.sample(moved, 1));
  presentation.advance(2);
  expect(presentation.sample(after, 2)[POSE_STRIDE + 1]).toBeCloseTo(9.2, 4);
});
it("buffers only the remote actor and switches to prediction through a nearby cube with a continuous handoff", () => {
  const presentation = new PairPresentation(0, 2);
  const initial = poses(4);
  presentation.acceptAuthority(0, initial);
  presentation.acceptAuthority(4, poses(4.4));
  const raw = poses(4.6);
  expect(presentation.sample(raw, 4)[POSE_STRIDE + 1]).toBeCloseTo(4.2);
  expect(presentation.diagnostics.remoteSource).toBe("buffered");
  // A shared interaction chain connects player -> cube -> remote player.
  const near = poses(2.8, 1.4);
  presentation.acceptAuthority(6, near);
  presentation.sample(near, 8);
  expect(presentation.diagnostics.remoteSource).toBe("predicted");
  expect(presentation.diagnostics.remoteOffset).toBeGreaterThan(0);
  // A large source switch is an explicit fence rather than an unbounded offset.
  presentation.correct({ before: near, after: raw, reset: true });
  expect(presentation.diagnostics.historyFrames).toBe(0);
  expect(presentation.sample(raw, 8)).toEqual(raw);
});
it("caps history, clears offsets for raw comparison, and does not advance a paused display", () => {
  const presentation = new PairPresentation(0, 2);
  presentation.remoteMode = "predicted";
  const before = poses(),
    after = poses(9);
  presentation.sample(before, 0);
  presentation.correct({ before, after, reset: false });
  expect(presentation.sample(after, 0)[POSE_STRIDE + 1]).toBe(8);
  expect(presentation.sample(after, 0)[POSE_STRIDE + 1]).toBe(8);
  for (let tick = 0; tick < 100; tick++) presentation.acceptAuthority(tick, after);
  expect(presentation.diagnostics.historyFrames).toBe(48);
  presentation.smooth = false;
  expect(presentation.sample(after, 100)).toEqual(after);
  expect(presentation.diagnostics.remoteOffset).toBe(0);
});

it("bounds large reversal catch-up speed for the entire group without slowing new motion", () => {
  const presentation = new PairPresentation(0, 2);
  presentation.remoteMode = "predicted";
  const before = poses(1, 1),
    after = poses(4, 3);
  presentation.sample(before, 0);
  presentation.correct({ before, after, reset: false });
  let previous = presentation.sample(after, 0);
  const raw = after.slice();
  for (let tick = 1; tick <= 120; tick++) {
    presentation.advance(1 / 60);
    const displayed = presentation.sample(raw, tick);
    const movement = (displayed[POSE_STRIDE + 1] ?? 0) - (previous[POSE_STRIDE + 1] ?? 0);
    expect(movement).toBeGreaterThanOrEqual(0);
    expect(movement).toBeLessThanOrEqual(MAX_CORRECTION_SPEED / 60 + 0.00001);
    // The shorter cube offset follows the same group fraction, preserving the
    // relative correction path instead of catching up on a different schedule.
    const remoteOffset = (raw[POSE_STRIDE + 1] ?? 0) - (displayed[POSE_STRIDE + 1] ?? 0);
    const cubeOffset = (raw[2 * POSE_STRIDE + 1] ?? 0) - (displayed[2 * POSE_STRIDE + 1] ?? 0);
    expect(cubeOffset).toBeCloseTo((remoteOffset * 2) / 3, 4);
    previous = displayed;
  }
  expect(previous[POSE_STRIDE + 1]).toBeCloseTo(4, 4);
  const moved = raw.slice();
  moved[1] = 0.075;
  expect(presentation.sample(moved, 120)[1]).toBeCloseTo(0.075);
  expect(after).toEqual(raw);
});
