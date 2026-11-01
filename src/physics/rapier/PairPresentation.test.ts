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
it("buffers coherent scene components and predicts a nearby contact group on local input", () => {
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
  presentation.noteInput(8, { x: 1, z: 0, jump: false });
  const connected = presentation.sample(near, 8);
  expect(presentation.diagnostics.remoteSource).toBe("predicted");
  expect(presentation.diagnostics.cubeSource).toBe("predicted");
  expect((connected[POSE_STRIDE + 1] ?? 0) - (connected[2 * POSE_STRIDE + 1] ?? 0)).toBeCloseTo(
    1.4,
  );
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
    // One rigid transform preserves the corrected contact geometry, even if
    // the incoming physical arrangement differs from the previous prediction.
    const remoteOffset = (raw[POSE_STRIDE + 1] ?? 0) - (displayed[POSE_STRIDE + 1] ?? 0);
    const cubeOffset = (raw[2 * POSE_STRIDE + 1] ?? 0) - (displayed[2 * POSE_STRIDE + 1] ?? 0);
    expect(cubeOffset).toBeCloseTo(remoteOffset, 4);
    previous = displayed;
  }
  expect(previous[POSE_STRIDE + 1]).toBeCloseTo(4, 4);
  const moved = raw.slice();
  moved[1] = 0.075;
  expect(presentation.sample(moved, 120)[1]).toBeCloseTo(0.075);
  expect(after).toEqual(raw);
});

it("uses one buffered frame for a remote player and its cube, including an idle local participant", () => {
  const presentation = new PairPresentation(0, 2);
  const a = poses(2, 1.3),
    b = poses(2.4, 1.7);
  presentation.acceptAuthority(0, a);
  presentation.acceptAuthority(4, b);
  const ahead = poses(3.8, 3.1);
  const display = presentation.sample(ahead, 4, 14);
  expect(display[POSE_STRIDE + 1]).toBeCloseTo(2.2);
  expect(display[2 * POSE_STRIDE + 1]).toBeCloseTo(1.5);
  expect(presentation.diagnostics.ownSource).toBe("buffered");
  expect(presentation.diagnostics.cubeDisplayTick).toBe(presentation.diagnostics.remoteDisplayTick);
  expect(presentation.diagnostics.predictedGroups).toBe(0);
  // Corrections to the speculative world cannot move any buffered member.
  presentation.correct({ before: ahead, after: poses(4, 3.3), reset: false });
  expect(presentation.sample(poses(4, 3.3), 4, 14)).toEqual(display);
});
it("preserves local motion on entry, and applies one rigid transform to predicted contacts", () => {
  const presentation = new PairPresentation(0, 2);
  const before = poses(1.4, 0.7);
  presentation.acceptAuthority(0, before);
  presentation.sample(before, 0);
  const moving = before.slice();
  moving[1] = 0.075;
  presentation.noteInput(1, { x: 1, z: 0, jump: false });
  const display = presentation.sample(moving, 1);
  expect(display[1]).toBeCloseTo(0.075);
  expect(presentation.diagnostics.ownSource).toBe("predicted");
  const after = poses(2, 1.3);
  after[1] = 0.2;
  presentation.correct({ before: moving, after, reset: false });
  const corrected = presentation.sample(after, 1);
  expect(corrected[1]).toBeCloseTo(0.075);
  expect((corrected[POSE_STRIDE + 1] ?? 0) - (corrected[2 * POSE_STRIDE + 1] ?? 0)).toBeCloseTo(
    0.7,
  );
  expect((corrected[2 * POSE_STRIDE + 1] ?? 0) - (corrected[1] ?? 0)).toBeCloseTo(1.1);
});

it("keeps local prediction through release and airborne motion before returning to a settled buffer", () => {
  const presentation = new PairPresentation(0, 2);
  const raw = poses();
  presentation.acceptAuthority(0, raw);
  presentation.sample(raw, 0);
  presentation.noteInput(1, { x: 1, z: 0, jump: false });
  presentation.sample(raw, 1);
  expect(presentation.diagnostics.ownSource).toBe("predicted");
  presentation.noteInput(2, { x: 0, z: 0, jump: false });
  presentation.sample(raw, 3);
  expect(presentation.diagnostics.ownSource).toBe("predicted");
  presentation.sample(raw, 30, 30, true);
  expect(presentation.diagnostics.ownSource).toBe("predicted");
  presentation.sample(raw, 31);
  expect(presentation.diagnostics.ownSource).toBe("predicted");
  presentation.sample(raw, 45);
  expect(presentation.diagnostics.ownSource).toBe("buffered");
});

it("applies a shared rotation and translation without changing contact geometry", () => {
  const presentation = new PairPresentation(0, 2);
  presentation.remoteMode = "predicted";
  const before = poses(1.4, 0.7),
    after = before.slice();
  for (let i = 0; i < after.length; i += POSE_STRIDE) {
    const x = after[i + 1] ?? 0;
    after[i + 1] = 0;
    after[i + 3] = -x;
    after[i + 5] = Math.SQRT1_2;
    after[i + 7] = Math.SQRT1_2;
  }
  presentation.sample(before, 0);
  presentation.correct({ before, after, reset: false });
  const displayed = presentation.sample(after, 0);
  for (let i = 0; i < before.length; i++) expect(displayed[i]).toBeCloseTo(before[i] ?? 0, 5);
  presentation.advance(0.05);
  const advanced = presentation.sample(after, 1);
  const distance = (a: number, b: number) =>
    Math.hypot(
      (advanced[a + 1] ?? 0) - (advanced[b + 1] ?? 0),
      (advanced[a + 3] ?? 0) - (advanced[b + 3] ?? 0),
    );
  expect(distance(0, POSE_STRIDE)).toBeCloseTo(1.4);
  expect(distance(POSE_STRIDE, POSE_STRIDE * 2)).toBeCloseTo(0.7);
});
