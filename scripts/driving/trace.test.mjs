import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeDrivingTrace, completeEvents, unionUs } from "./trace.mjs";

const cell = () => ({
  diagnostic: { navigationStartS: 0, trace: { dataLossOccurred: false } },
  pageClock: { startMs: 1000 },
  elapsedMs: 100,
  idleFrameMs: 16,
  frames: [16, 50, 16, 18],
});
const marks = () => [
  { name: "tilefun.driving.start", ph: "I", pid: 1, tid: 1, ts: 1e6 },
  { name: "tilefun.driving.end", ph: "I", pid: 1, tid: 1, ts: 1.1e6 },
];
test("aligns exact cadence clocks, unions nested work and excludes foreign GC/async spans", () => {
  const trace = [
    ...marks(),
    { name: "RunTask", ph: "B", pid: 1, tid: 1, ts: 1016000, tts: 1000 },
    { name: "RunTask", ph: "X", pid: 1, tid: 1, ts: 1020000, dur: 30000 },
    { name: "MajorGC", ph: "X", pid: 1, tid: 1, ts: 1020000, dur: 40000 },
    { name: "MinorGC", ph: "X", pid: 1, tid: 1, ts: 1030000, dur: 10000 },
    { name: "MajorGC", ph: "X", pid: 2, tid: 1, ts: 1010000, dur: 80000 },
    { name: "RunTask", ph: "E", pid: 1, tid: 1, ts: 1066000, tts: 31000 },
    { name: "AsyncFlow", ph: "b", pid: 1, tid: 1, ts: 1000000 },
    { name: "AsyncFlow", ph: "e", pid: 1, tid: 1, ts: 1100000 },
  ];
  const result = analyzeDrivingTrace(cell(), trace);
  assert.equal(result.clockErrorUs, 0);
  assert.equal(result.frames.length, 1);
  assert.equal(result.frames[0].interval.mainTaskWallMs, 50);
  assert.equal(result.frames[0].interval.mainGcWallMs, 40);
  assert.equal(result.mainGc.length, 2);
  assert.equal(completeEvents(trace).find((e) => e.dur === 50000).tdur, 30000);
  assert.equal(
    unionUs([
      [0, 10],
      [3, 7],
      [9, 15],
      [20, 22],
    ]),
    17,
  );
});
test("sorts out-of-order profile timestamps before clipping disjoint sample weights", () => {
  const cpu = {
    startTime: 1e6,
    samples: [2, 3, 2, 3],
    timeDeltas: [20000, 20000, -10000, 30000],
    nodes: [
      { id: 1, callFrame: { functionName: "root" }, children: [2, 3] },
      { id: 2, callFrame: { functionName: "A" } },
      { id: 3, callFrame: { functionName: "B" } },
    ],
  };
  const result = analyzeDrivingTrace(cell(), marks(), cpu).frames[0].interval.profile;
  assert.deepEqual(result.self, [
    { function: "B", sampledWallMs: 30 },
    { function: "A", sampledWallMs: 14 },
  ]);
  assert.equal(result.inclusive[0].sampledWallMs, 44);
});
test("refuses clock mismatch, missing markers and trace loss instead of guessing alignment", () => {
  const shifted = cell();
  shifted.diagnostic.navigationStartS = 1;
  assert.throws(() => analyzeDrivingTrace(shifted, marks()), /clocks disagree/);
  assert.throws(() => analyzeDrivingTrace(cell(), marks().slice(0, 1)), /end mark/);
  const lost = cell();
  lost.diagnostic.trace.dataLossOccurred = true;
  assert.throws(() => analyzeDrivingTrace(lost, marks()), /lost data/);
});
