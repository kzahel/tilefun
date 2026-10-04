# 049: Reusable renderer performance matrix

Status: implementing. Owner: [performance](../topics/performance.md).

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
world-geometry documentation remains outside this workstream. Measurements are
pending; no comparison or default-selection claim is made yet.
