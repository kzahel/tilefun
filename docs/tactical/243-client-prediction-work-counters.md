# 243 — Count client prediction work in driving runs

Status: delivered and physically measured · 2026-11-11.
Owner: [performance](../topics/performance.md).
Follows [242](242-startup-prediction-and-restore-churn.md).

## Contract

`PlayerPredictor.sampleWork(true)` opens/resets an explicit diagnostic window;
`sampleWork()` stops it and returns an independent record. Ordinary play leaves
accounting disabled. The recorder has fixed scalar counters, no clocks, arrays or
per-step allocations. It counts accepted inputs/reconciliations, successful
restores and bodies restored, forward/replayed physics steps, actual world steps,
body reads, motor updates, wheel queries, geometry builds, resets and clears.

Executed partial/cancelled replay counts immediately, not only at job completion.
Replay steps mean all steps inside a replay job, including horizon extension by
newly admitted inputs; they are not a count of duplicated past ticks alone.
Counters survive private scene reset/replacement within the window. Physics
metrics are differenced around each actual shared step; authority Worker metrics
are separate. A helper extraction keeps existing snapshot-copy arithmetic and
ownership unchanged and tightens the predictor size baseline.

The v3 driving harness opens/stops accounting synchronously at cadence boundaries,
after warmup/calibration and before the final pause fence. Authority counters still
include that fence; client counters do not. Sampler scope also includes setup and
pause bookkeeping, so the counters do not turn total heap samples into a pure
physics-allocation measurement.

Qualification refuses missing/non-finite/negative/non-integral counters, missing
client work, inconsistent forward+replay totals and invalid restore accounting.
Comparison additionally rejects differing client work beyond 5% or two operations
per counter (whichever is larger), and requires identical reset/clear counts.
The forward/replay partition uses 5% of total world steps, so moving a few startup
steps between paths is not mistaken for a large change in total work.
Heap comparisons also require update/render execution counts within 5%, so fewer
rendered frames cannot masquerade as allocation savings. This is a live scheduling
tolerance, not an exact replay or a performance gate.
Old v2 reports cannot supply these numbers retrospectively and must be rerun.
Do not normalize whole-thread heap bytes by one physics counter.

## Validation

A native integration test checks actual scene step/restore calls and physics
metric deltas across forward prediction, partial replay, cancellation, reset,
scene replacement and stop/restart. Duplicate inputs do not count, and returned
records cannot modify accounting. Node report tests cover malformed work and
comparability, including workloads with identical authority progress but changed
client work. 47 native checks across four prediction/multi-seat/lab files and
seven Node benchmark/capture/trace checks pass. All four TypeScript projects, focused Biome,
health and the normal production build pass. Two rebuilt-production desktop
benchmark fixtures qualify in bundled Chromium. Streaming readiness passes.
All 2,130 Workshop identities remain unchanged; only the manifest input digest
changes. The predictor size baseline tightens from 986 to 968 lines.

With accounting enabled, independent baseline/current native bundles preserve the
exact prior 242 authority/prediction checkpoint record across both 900-tick
fixtures, delayed deliveries and replay backlogs. Their printed work counts also
match for this fixed schedule. The canonical SHA-256 remains
`6069297294d23da40d4019aa737bed63d1e6ab24c7b5ddf5382d33b45c3383b2`.

## Physical comparison

[Sanitized evidence](../benchmarks/243-client-prediction-work.json) retains all
12 phone cells and every prescribed comparison, including rejections. The
allocation campaign uses before-a / after-a / after-b / before-b, then a separate
ordinary before-a / after-a. Each run uses both clear and jam fixtures for 10 s
with fresh page/world/Worker, the same 180 idle authority warmup ticks, native
viewport, throughput policy and ordinary calibration. No startup samples are
removed. All 12 workloads qualify (599–601 authority ticks).

Both production bundles use the same v3 harness and counter implementation. The
before build substitutes the three `168f3fa9` runtime files, adding only the same
accounting hooks to its predictor; after retains the 242 optimization. Current
source is never toggled. Original/instrumented source hashes and actual served
module hashes identify the bundles; `--base` checkout hashes do not identify the
served baseline. The final comparison policy is applied to all saved records.
CLI descriptive/postprocessing edits during capture do not change either served
page or the counter implementation.

Every whole-report pair passes the old authority/distance gate and fails the new
client-work gate. Per-fixture outcomes, with no rematching:

| Heap pair | Client steps before → after | Body reads before → after | Sampled MiB before → after | Work gate |
| --- | ---: | ---: | ---: | --- |
| Clear a | 1,192 → 1,755 | 1,192 → 1,755 | 84.9 → 90.6 | Reject |
| Clear b | 1,753 → 1,193 | 1,753 → 1,193 | 98.6 → 85.0 | Reject |
| Jam a | 1,226 → 1,193 | 14,636 → 14,475 | 388.5 → 379.5 | Pass |
| Jam b | 1,194 → 1,613 | 14,493 → 16,476 | 383.4 → 424.8 | Reject |

Clear pair a has **47% more client physics work for 600 authority ticks on both
sides**. Jam pair b has **35% more client steps** despite nearly equal authority
progress. Most live steps execute within replay jobs; the label includes horizon
extension by new input, not just duplicate simulation of old ticks. The counters
expose a variation that the old gate could not see; old records cannot be assigned
these counts retrospectively.

Only jam heap pair a passes the prescribed per-fixture gate. Its sampled allocation
falls ~2.3%, while client steps fall ~2.7%, within the work tolerance. One small
difference does not establish a reliable optimization percentage. Do not select
different pairs after looking at heap outcomes or divide whole-thread heap bytes
by physics steps: rendering, decoding and prediction have different work owners.

Ordinary clear and jam comparisons also fail the client-work gate: 1,189 → 1,762
and 1,193 → 1,409 steps respectively. No cadence or GC improvement is claimed.
Prepared roads exclude city art, regional generation and persistence. Browser/JIT
and frequency state are not frozen; no Steam Deck measurement. Thermal status
stays 0 at 25.6–26.1°C, on external power; all temporary tabs/Workers, servers
and USB routes are
cleaned up, and the final common device doctor passes.

Raw records/bundles remain in ignored `data/scratch/work-243/`.

## Next work

Attribute or control the variable client replay horizon/delivery work before
claiming small whole-game allocation gains. A fixed input/snapshot delivery
replay can measure allocation at exact work; live phone cadence remains a separate
check. Presentation/decal churn remains a valuable target after that control is
available. These measurements change no prediction policy and do not establish
that replay itself is defective.
