# 118: Phone physics headroom profile

Status: profile complete; crowded entity-support proposal ready for the next slice.
Date: 2026-10-11.
Owner: [performance](../topics/performance.md).

## Scope and method

Follow [115](115-collision-broad-phase.md) with physical Pixel 7a measurements of
remaining physics phases, support candidates and ordinary-play timing. This is an
investigation and proposal; no simulation, prediction or renderer policy changes.
The frozen source is `c5ed0f8` (115 runtime plus its phone evidence), excluding
concurrent ambulance work in the checkout. Git archives, task-owned Vite/CDP
routes and new benchmark tabs preserve the user's existing browser tabs.

Crowds run the same production `Realm`/`ScenarioSession` fixture as 115 in a
physical dedicated browser Worker: 60 warmup and 180 retained 1/60s ticks, separate
replication, flat terrain, native held dog rest/travel and verified 0/88px motion.
They exclude rendering, real IndexedDB, network delivery and fresh AI planning.
Eight phase-timing lanes have only EntityManager phase boundary timers, with
reversed population/motion order on the second pass. Separate census lanes add
query/support counters. Four separate 1ms CPU profiles include session setup,
warmup, retained ticks, replication and close; their inclusive rows overlap and
cannot be converted into retained-tick savings. Counting and CPU lanes are not
clean before/after performance controls.

Native game controls use Canvas, Worker authority, real IndexedDB, native AI,
unchanged visibility/scheduling and ordinary keyboard input. Walking captures
last eight seconds, avoiding the known obstacle encountered by longer held-right
runs. Deep, CPU and Chrome timeline captures are separate. A 45-second idle
timeline checks rarer pauses. Timelines mark authority ticks/publication, main
update/render, rAF intervals and submission-to-observed-ack latency. Only the
owned main and authority threads are analyzed; GC totals exclude nested GC events.
Tracing adds overhead, rAF cadence does not measure displayed GPU presentation,
and temporal overlap alone does not establish causation.

## Crowded physics

Phase means in milliseconds, two repeats:

| Population / state | Tick | Physics | Movement | Ground tracking | Separation |
| --- | --- | --- | --- | --- | --- |
| 96 resting | 2.568–2.668 | 1.670–1.673 | 0.667–0.667 | 0.533–0.536 | 0.224–0.232 |
| 96 moving | 3.081–3.127 | 2.179–2.197 | 0.958–1.008 | 0.681–0.705 | 0.242–0.243 |
| 384 resting | 10.528–11.318 | 7.469–8.019 | 2.456–2.619 | 3.237–3.518 | 0.811–0.856 |
| 384 moving | 12.996–13.637 | 9.996–10.468 | 3.776–3.857 | 4.238–4.469 | 0.883–0.909 |

For 384 moving dogs, ground is about 42–43% of physics and 33% of tick mean.
This is measured cost available for investigation, not a predicted saving.
Index setup costs 0.319–0.346ms, first refresh 0.262–0.343ms, attachment/index
phase 0.290–0.296ms and animation 0.205–0.224ms; these are smaller than ground.
Movement tick p95 ranges 16.3–20.8ms in these diagnostic lanes. Different lanes
and tails from 115 are not evidence of a regression or a gain.

The separate census records 69,300 support resolutions over 180 ticks at 384
actors (385 including the player). Moving resolutions inspect 9,197,912 entity
candidates: **51,100 per tick**, about 133 per resolution. Resting resolutions
inspect 8,481,780: 47,121 per tick. Nearly all have eligible solid colliders and
physical heights, so eligibility filtering alone would not remove most work.
No props exist in this fixture: it identifies an entity support problem and
cannot establish the cost or benefit of a prop index. Existing per-pass chunk
query reuse remains effective; the large lists are scanned again for each actor.

Four CPU captures identify `getWalkableEntitySurfaceZ` as a leading self row:
8.2–8.8% of sampled active fixture time. `computeGroundZ` inclusive accounts for
16.7–17.5%; these rows overlap. The collector is 2.9–5.2% of active fixture time.
Because sampling includes warmup/setup and separate replication, these
percentages are corroboration of the hot path rather than phase-timer equivalents.

A separate read-only census compares the existing dense index after movement
with the original chunk candidate list, calculating both ground heights while
applying neither alternative result. Over 69,120 matched dog resolutions per
case, moving candidate averages fall from 132.09 to 9.03 (93.2% fewer); resting
averages fall from 121.71 to 9.84 (91.9% fewer). Both states repeat with zero
ground-height mismatches. This is candidate-count and flat-fixture correctness
evidence, not a production implementation or measured tick improvement. Counters
for the double-resolution lanes include both calls; the evidence separates the
matched original/fine candidate totals from those aggregate counters.

## Proposal

Next bounded optimization: narrow **entity** support candidates only on crowded
EntityManager ground passes. First investigate reusing the already refreshed
movement index as a read-only XY broad phase until ground tracking finishes,
rather than building another index. Read live geometry/Z for every resolution;
only candidate membership may be reused. Keep sparse chunk-query reuse and prop
handling unchanged until their own evidence warrants a change.

The movement index currently finishes before ground; its lifecycle deliberately
has a narrower contract. Extending it requires explicit ground-pass ownership and
checks for sleepers, skipped/parented actors, collider edits, oversized bodies,
chunk seams and negative coordinates. Check roof bounds for vehicles/trains,
step-up thresholds, sequential ground snaps, jumps/landings, terrain excavation
and support moving under a stationary actor. A tracking change must not silently
replace player jump/landing queries in Realm or client prediction.

Acceptance: full state/durable-record parity in matched flat crowd controls,
adversarial support tests and native game/lab roof/jump checks; measurable phone
phase/tick improvement including lifecycle/index costs; sparse native walking
within observed control variation. Publication remains separate in the crowd
fixture and whole-game frame/input behavior needs its own validation. Do not
claim stable 60Hz from accelerated tick means alone.

Only after that, revisit remaining movement/prop scans and ordinary streaming /
activation bookkeeping. More Workers are not the first proposal: the current
shared physics and support order use live mutable state, while the measured
redundant candidate work can be reduced without introducing synchronization.

## Native timeline and validation

Ordinary deep walking holds approximately 60Hz, with 512.1px continuous travel,
7.210ms mean tick, 11.7ms p95 and ground 0.552ms mean / 0.9ms p95. The deeper
wrappers add overhead; this is attribution, not a new comparison against 115.
Ground is much smaller here than in the crowd. Ordinary CPU self rows instead
highlight streaming/activation maps, selection and snapshot/bookkeeping work;
AI planning is not the principal hot path in these native controls.

| Native trace | Tick mean / p95 | rAF p95 / max | Intervals >25ms | Ack p95 / max |
| --- | --- | --- | --- | --- |
| 8s walking, first | 6.319 / 9.2ms | 16.7 / 17.1ms | 0 | 47.8 / 134.3ms |
| 8s walking, second | 6.528 / 10.7ms | 16.7 / 16.8ms | 0 | 39.4 / 153.6ms |
| 45s idle | 6.517 / 8.801ms | 16.7 / 33.4ms | 1 | 53.0 / 57.8ms |

Walking authority averages approximately 60Hz, with 512–513px uninterrupted
travel. Each walking trace contains two ticks above 16.67ms, with maxima 41.5
and 29.6ms; frame cadence remains steady in both. The largest walking prediction
resimulation error is below 0.00003px. Ack tails do not establish a server/input
cause without finer sequence/publication tracing. There are no page errors and
no diagnostic evidence reproducing warping. These timing captures do not establish
the original stopped-animation symptom.

The 45-second idle trace has one 33.4ms rAF interval at about 39.03s. Its
intersecting authority tick maximum is 6ms; neither owned-thread MinorGC nor
MajorGC intersects it. The longest overlapping main task is about 5.14ms.
This capture does not identify its cause. Separate GC spans do exist (including
main-thread major cycles up to 20.82ms), but those timings do not prove pauses
causing the observed missed interval. The sole idle tick over budget is only
16.699ms. One interval is too little evidence to generalize stable presentation
or choose a renderer fix, and these Canvas controls do not establish GPU-backend
behavior. A user-symptom reproduction should next use the actual renderer/input
mode and add GPU/presentation and sequence/publication timing.

All measured entry/end temperatures are 25.1–28.5°C with thermal status zero and
charging unchanged. Cleanup restores prior ADB routes and foreground application,
closes task tabs/Workers and stops Vite/CDP proxy. User browser tabs are retained.

[Sanitized evidence](../benchmarks/118-phone-physics-headroom.json) owns the
source/probe hashes, eight phase lanes, three original census lanes, four crowd
CPU lanes, four read-only census comparisons and seven native captures. Raw
profiles, traces and private device/browser/host identifiers remain temporary.

Validation: all three typecheck configurations and 2,502 unit tests across 256
files pass in the current checkout. Lint passes with 119 warnings and 34 infos,
no errors. Evidence consistency/privacy assertions and `git diff --check` pass. No runtime or rendering changes, so the
integration/streaming gates from 115 are not rerun for this evidence-only slice.
