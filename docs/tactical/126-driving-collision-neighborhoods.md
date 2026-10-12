# 126: Player-driven car collision neighborhoods

Status: implemented, measured and validated.
Date: 2026-10-12.
Owner: [performance](../topics/performance.md).

## Boundary

Following 124/125, reduce repeated full-city prop scans in shared drivenCarPose.
Authority uses the existing live PropManager and entity SpatialHash. Native replica
prop snapshots register a lazy index with the same PropManager footprint rules;
both game and embedded labs inherit the shared RemoteStateView/PlayerPredictor
path. Direct mutable callers keep the full-list fallback. Prediction collision
history and roof-support selection still receive complete entity lists; no new
historical-body index or contact cadence is introduced.

Queries cover both cardinal chassis poses, their sweep, and the next feet anchor.
Each roof rider gets its own swept query, including headroom beyond the chassis.
Prop indexing includes every compound wall and oversized footprint. Authority
body queries include spanning bodies outside their origin cells. Every terrain,
grade, support, obstacle and passenger rule retains the original resolver.

All excavation props remain candidates even when distant: the existing ground
resolver has a global excavation-presence branch and an inclusive feet-edge policy.
Removing distant cuts could change that branch. No height/blocked result is cached.
Live authority props use manager revision to refresh this list. Replica indexes
belong to published immutable prop snapshots; queued replay copies retain their
exact snapshot's index. New sync replaces the array/index, and weak ownership
allows old snapshots and replay indexes to be collected. Non-driving snapshots do
not build an index; index creation is included in native capture costs.

[Sanitized evidence](../benchmarks/126-driving-collision-neighborhoods.json) retains
all 15 captures, source/probe hashes, full duration distributions, adverse lanes,
pose/native trace hashes and validation. Raw/private browser and controller state
stays temporary.

## Measurement

Frozen `dd2b9ce` source and a matching archive with only the runtime changes are
served by the native city audit: real Worker, IndexedDB, GPU/default authored
vehicle models, four-second warmup, eight-second capture, native driving input.
Desktop overview is 0.05; phone overview is 0.1, with fixed <=32°C/status-zero
admission. Actual populations, chosen road/model, motion and temperatures remain
recorded. Wall-time route/population differences limit causal whole-tick claims.
Deep candidate counts run separately from shallow timings. Private controller,
browser and raw trace state stays temporary; task-owned phone routes are removed.

The initial desktop pair has matching 51 normal/708 overview entry props and
approximately 874px travel. Overview driving mean is 0.388→0.062ms and whole tick
1.596→1.431ms. The initial audit did not yet fingerprint the new query module or
replica/predictor files; later captures do. Treat this as a pilot rather than a
complete source-fingerprinted lane.

Four phone overview captures reverse source order (before/after/after/before),
with matching 367 entry props, 124 resident actors and eight active cars/six active
route people. All start/end readings are 28.9–31.1°C/status zero. Weighted driving
mean falls 0.541→0.154ms (71.5% lower); whole-server mean 4.099→3.879ms (5.4%
lower). Whole main-update mean is 1.328→1.067ms, including processing beyond
prediction. Every drive covers approximately 882px. Native authored meshes draw
about 234–235 calls/frame in both policies. Render means remain 8.1–8.3ms and
rAF p95 stays 50ms, with over-budget intervals and acknowledgement tails. This is
server/prediction headroom, not stable displayed 60Hz or an original-desync fix.
No GPU-duration/display-present trace was captured.

A separate ordinary-width phone pair has matching 232 entry props and continuous
approximately 877px travel. Driving mean falls 0.703→0.257ms and whole tick
4.743→4.110ms. Both have 16.7ms rAF p95. A single pair is scoped coverage rather
than broad normal-play acceptance. Phone routes/foreground are restored afterward.

## Validation and next work

Six focused regressions cover distant compound walls, spanning live bodies,
roof headroom outside the chassis, global excavation presence and old/new snapshot
index ownership plus mounted-car recovery across a newer prop snapshot. Original/current full poses match for 38,880 cases across all 45
models, four cardinal poses, eight inputs and three step durations in nine native
and authored environments. Both indexed authority and registered replica props
match the original implementation, including generated-city geometry. This is
query/pose parity, not full-server capacity or a timing benchmark.

Sixteen composed native fixed-clock authority/binary-replica/predictor traces
match the frozen baseline exactly at 30/60Hz authority and 120Hz presentation,
including late inputs, late snapshots, 50ms delivery delay, diagonal turns and
release braking. This four-second trace lane excludes browser/GPU timing and
long replay recovery. The six new unit regressions and 42 affected existing
vehicle/recovery/grade units pass. The native wide-road census supplies approximately 703 props/206 entities per
pose; indexed authority returns zero prop candidates on that clear road and
2.55 body candidates on average. This is candidate selection, not counts of
surviving narrow collision tests or a guarantee for obstacle-dense roads.

The final desktop reverse-order pair has matching 708 overview entry props:
driving mean falls 0.355→0.071ms, while whole tick rises 1.580→1.661ms. Ordinary
entry props are 232; driving falls 0.274→0.200ms but whole tick rises
1.403→2.308ms. Other phases/rendering are also noisier. Retain this adverse
whole-tick lane; do not claim a stable desktop whole-server gain or extrapolate
the phone result to every scene.

All 2,567 units in 259 files pass in the final run, including the new mounted
replay regression. Typecheck initially catches
an unused fixture local and lint catches probe formatting; both are corrected.
Art catalog updates source line references only. All 807 manifest candidates
verify across browser modes; five explicitly excluded interactive car/bridge
identities and the broad digest change, while every immutable review stays equal.
The production build, all three typecheck configurations and lint pass (119
existing warnings/34 infos, zero errors). All six streaming readiness stages have
zero missing data/incomplete caches. All 22 affected full bundled-Chromium checks
pass serially in 3.8 minutes on an isolated alternate port: game/lab driving,
boarding/saving/recovery, mesh modes, traffic lifecycle and bridge/garage grades.
This is scoped browser coverage, not a full browser suite.

Next: separately profile camera-resident snapshot/interest cost and phone main/GPU
presentation after collision searches are narrowed. Historical body scans in
prediction remain a candidate only if their measured cost warrants another index.
