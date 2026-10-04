# 049: Reusable renderer performance matrix

Status: complete (2026-10-04). Owner: [performance](../topics/performance.md).

## Plan

1. Extend the existing real-game streaming runner with a zoom-motion workload:
   fresh isolated world per zoom, same seed/arrival, entry catch-up, stationary,
   timed noclip sprint, recovery and stationary reuse. Keep legacy traversal.
   Record display cadence before game load, actual motion and presentation debt.
   Bound settling and report failure honestly without hiding overloaded cases.
2. Add a sequential matrix CLI: desktop/phone × Canvas/GPU × faster-fill/small-
   batches, two repeats in reversed order. Share flags with the single runner;
   resumable progress, source fingerprint, per-run logs, sanitized JSON and Markdown
   summaries. Compare within device/zoom; never merge percentiles as raw samples.
3. Run synthetic tooling checks and repository validation, then the full matrix
   on bundled headed Chromium and attached Pixel. Run no tests/builds concurrently
   with timing. Commit implementation and evidence separately.

## Workload / evidence boundaries

Default matrix zooms: 1, 0.5, 0.25, 0.1, 2. Default movement duration: 8 seconds
at each zoom. This is broad repeated coverage, not a replacement for one-minute
stutter traces. Entry means after game readiness/settings selection, not navigation
cold start. Input stays keyboard on Mac and actual touch on phone. Each zoom starts
at the same seed/arrival instead of inheriting a slower preceding stage's endpoint.
Record actual start/end and travel because simulation scheduling/input latency can
still vary the route. Gaps during motion are evidence, not automatically failures;
row-cap violations, absent motion, page errors and failure to recover are failures.
A bounded recovery timeout is retained in failed rows and does not abort later
combinations. Source changes invalidate resume/comparison. Private raw reports
remain outside Git; the matrix exports only explicitly whitelisted fields.

No runtime engine behavior or asset/review pixels are changed by this work.


## Implementation validation

The single-run zoom-motion workload and matrix CLI are implemented. Pure tooling
checks cover complete/reversed combinations, privacy allowlisting, failed rows
and fixed display cadence reporting. The four-combination desktop smoke passes;
resume skips all completed configurations. Legacy `--assert-ready` traversal
passes. Typechecks, all 1,452 engine unit tests and lint pass (existing 124 warnings
and 32 informational diagnostics). No production renderer or input code changed;
real-game smoke and full measurement matrix exercise the runner integration.

The current engine includes committed embedded-host refactor `50c30c5`. Unrelated
world-geometry documentation remains outside this workstream. Implementation is
committed as `20e3629`.

## Completed matrix

[Full comparison](../benchmarks/049-renderer-matrix.md) and
sanitized [Mac](../benchmarks/049-renderer-matrix-desktop.json) /
[Pixel](../benchmarks/049-renderer-matrix-phone.json) measurements retain every
repeat separately. The matrix completed 16 configurations / 80 zoom cases:
Mac and Pixel 7a × Canvas and WebGL2 sprites × faster fill and small batches ×
two repeats × five zooms (1, 0.5, 0.25, 0.1, 2). Each case measures entry,
stationary, 8-second noclip motion, recovery and warm reuse. Actual motion was
validated throughout; travel was approximately 1,166–1,180 pixels per stage.

76 cases passed. All four failures were **Canvas / small batches / 0.1×**, both
repeats on both devices: entry and recovery exceeded the 30-second catch-up gate,
and terrain preparation continued during the nominal warm sample. These are
measured performance failures, not omitted results. The matrix correctly exited
nonzero. There were zero page errors and no small-batch row-cap violations.

The Mac used an Apple M4 Pro with bundled headed full Chromium at approximately
120 Hz, viewport 1280×900. The Pixel used physical Chrome at approximately 60 Hz,
viewport 411×789. Work ran sequentially without concurrent builds/tests, with a
stable executable-source fingerprint. Configuration order was reversed for the
second repeat. Device results have different viewport and cadence targets; compare
renderers within each device.

**Phone temperature limits the comparison:** battery temperature rose from
26.6°C to 35.9°C and reported thermal status changed from 0 to 1. It was charging,
with no cooling interval. Later phone repeats are warmed-device evidence, not
independent cold repeats; temperature/order effects cannot be separated from
renderer effects. The runner's dedicated tabs, bundled browsers and servers were
closed, and the temporary phone forwarding/reverse ports were removed.

## Findings

The table shows motion frame-interval p95, with the range spanning the two
individual repeats, using the default faster-fill policy. It does not pool or
average percentiles. Lower is better; these are rAF timings, not direct GPU or
hardware presentation measurements.

| Device | Zoom | Canvas p95 | GPU sprites p95 |
| --- | --- | ---: | ---: |
| Mac | 1×, ½×, ¼×, 2× | 9.7–10.1 ms | 9.8–10.1 ms |
| Mac | 0.1× | 50.4–51.1 ms | 17.1 ms |
| Pixel | 1×, ½×, 2× | 16.7–16.8 ms | 16.7–16.8 ms |
| Pixel | ¼× | 16.8–33.3 ms | 16.8 ms |
| Pixel | 0.1× | 66.7–99.9 ms | 33.4–33.5 ms |

At ordinary zooms, both renderers are competitive. All non-overview Mac cases
had zero calibrated missed intervals. On Pixel at 1×, faster fill recorded
3/476 and 3/476 missed intervals for Canvas versus 7/473 and 8/471 for GPU.
Small batches reduced those to 0/479 and 0/480 for Canvas, and 1/479 and 2/478
for GPU. This does not establish a universal policy win: at ¼×, Canvas small
batches had 33.3 ms p95 in both repeats, worse than its first faster-fill repeat.

At 0.1×, GPU is substantially faster, but still misses both devices' target
cadence. Every sampled Canvas motion interval exceeded 1.5× the calibrated idle
cadence. Small batches barely change this expensive overview's frame p95; a
preparation cap cannot fix a slow recurring draw path. In the first Mac faster-
fill repeat, render CPU p95 was 49.8 ms for Canvas versus 12.6 ms for GPU, while
update CPU p95 was approximately 0.3 ms for both.

Faster fill had no incomplete visible terrain during motion in any case. GPU
small batches did incur transient incomplete terrain at 0.1×, but recovered:
Mac entry took 27.2–27.5 s and recovery 3.4–3.5 s; Pixel entry took 19.5–19.7 s
and recovery 8.4–9.2 s. For comparison, GPU faster-fill entry/recovery took
3.3 s / 0.6–0.7 s on Mac and 7.6–7.8 s / 1.8–2.0 s on Pixel. Catch-up includes
60 quiet render frames, so compare these times within each device.

All successful cases reached zero terrain rebuilding in the final warm stage.
However, **Pixel GPU small batches at 0.1× requested 2,064,384 texture-upload
bytes during each two-second warm sample**, despite zero terrain rows prepared.
This needs attribution; the terrain-reuse gate does not promise all textures
remain unchanged. Do not generalize the older 047 zero-upload observation to
all current workloads.

## Limits and next work

Eight-second motion stages provide broad coverage, not rare-stutter or GC
attribution. These are development-server, post-ready entry measurements with
instrumentation. They cover outdoor sprite rendering, not mesh-heavy scenes,
indoor play, WebGPU, Rust, iOS or lower-end devices. Actual trajectories and actor
times can differ slightly even with the same arrival and seed.

Keep current defaults. Next, profile the recurring warm 0.1× collection/draw
cost and attribute the Pixel warm GPU uploads before choosing batching, caching
or upload-admission changes. Add temperature-gated/cooldown phone repeats and
longer motion traces before drawing default-policy conclusions. The reusable
runner now supplies coverage and resumable evidence for those changes.
