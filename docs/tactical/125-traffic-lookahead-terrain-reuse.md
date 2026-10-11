# 125: Traffic lookahead terrain reuse

Status: implemented, measured and validated.
Date: 2026-10-11.
Owner: [performance](../topics/performance.md).

## Boundary

Following [124](124-city-workload-profile.md), reuse successful flat-road tile
checks during one autonomous car's synchronous lookahead and junction reservation.
The shared TrafficSystem owns this for game Worker authority and ScenarioSession
labs. Player driving and prediction retain their existing paths.

A fixed 256-slot scratch grid stores exact tile coordinates and successful road
legality, including the original zero-height and rail exclusions. Coordinates
are checked after hashing; collisions overwrite an entry and only lose reuse.
Storage is 4,352 bytes per TrafficSystem, allocated once. Entries reset before
each admitted autonomous car. Only lookahead/reservation explicitly opt in;
movement, rerouting, spawning, callbacks, later cars and later ticks do not reuse
an earlier sweep. Failed checks return immediately without caching.

Every footprint still visits its tiles and every probe still checks live props,
bodies and junction ownership. Surface-following bridge/garage routes keep the
original road, height, grade and rider-clearance queries. This is a bounded flat
road optimization, not an AI-rate or collision-frequency change.

## Method

Frozen `323823a` baseline and a matching archive with only TrafficSystem changed
use the native city audit at seed 2026, core arrival `(300,479)`, four seconds
warmup and eight seconds capture. Shallow phone standing comparisons reverse
source order (before/after/after/before), two fresh worlds per source run. Actual
populations, temperatures and frame/tick distributions remain recorded. Native
spawn timing can vary; this is a scoped ordinary city comparison, not fixed-state
capacity proof. Deep counters and deterministic parity run separately.

Phone admission stays <=32°C and thermal status zero. No gate relaxation.
Desktop uses bundled full Chromium; phone uses its existing native Chrome through
task-owned CDP/USB routes. Private device/controller/browser state stays temporary.

The [parity runner](../../scripts/instrumentation/traffic-road-parity.mjs) uses
original TrafficSystem prototype methods against the current companion modules,
then native current methods in a fresh equivalent ScenarioSession. The flat loop
is authored to avoid asynchronous retirement of distant regional startup actors;
generated roads retain native unit/browser integration coverage. A seeded diagnostic
Math.random holds persistent identities fixed; production randomness is unchanged.
It hashes full
serialized actor/traffic/reservation state each tick, binary replicated frames and
flushed durable records. Crossing/roof riding, bus turns/reload, road edits,
bridge/garage directions and removed bridge supports are included. It counts
queries separately from timings; no speed claim comes from deep instrumentation.

[Sanitized evidence](../benchmarks/125-traffic-lookahead-terrain-reuse.json) retains
all 21 captures, failures, distributions and source/probe hashes. Raw browser,
controller and detailed trace state stays temporary.

## Results and validation

Eight shallow phone standing captures use 11 active cars/13 active route people,
34 resident actors and 46 props at entry. Temperatures stay 30.9–31.5°C and status
zero. Weighted traffic mean is 2.398→1.761ms (about 26.6% less); whole-server mean
is 6.220→5.963ms (about 4.1% less). Whole-server means vary and one reverse-order
pair regresses, so the smaller total-tick gain is noisy. Tick p95 ranges
8.4–9.4→8.1–8.4ms. Both policies maintain approximately 60Hz authority and
16.7–16.8ms rAF p95. These eight-second standing cases do not establish continuous
crowded-city capacity, stable displayed frames or an original-desync cure.

A baseline native-touch drive covers about 878px at 32°C/status zero. The
optimized driving setup loses the fixed thermal gate before capture: zero cases,
no accepted after comparison. A premature standing-repeat launch also fails port
admission during the prior run's shutdown and captures zero cases; it is rerun
only after confirmed process completion. No benchmark capture overlaps that failed
port attempt. Both failures remain in the evidence.

The first generated whole-Realm parity attempt diverges at tick 518 only in removal
of one distant initial robin; all common actors, traffic and reservations match
at that first mismatch. Asynchronous regional residency is unsuitable for exact
whole-trace comparison on wall-time-dependent work budgets. The final diagnostic
uses a native authored flat loop plus native bridge/garage recipes instead of
claiming deterministic generated-world parity. Compiler/runner setup failures are
retained locally, with no production changes needed.

All nine native deterministic traces (8,860 ticks per policy) match serialized and
durable actor state, traffic state/waiting/reservations, binary frame bytes and
flushed records exactly. Body/prop query counts also match. The flat crossing trace
reduces road reads 175,908→39,681 (77.4%); the bus completes three route choices
with a reload. Bridge/garage query counts and outcomes remain unchanged.

Four final shallow desktop standing captures use 12 active cars/13 active people
at entry. Server mean ranges 0.903–0.954→0.645–0.680ms; traffic mean ranges
0.309–0.336→0.177ms. This ordered desktop lane varies from earlier pilots and
is descriptive evidence, not a portable speedup percentage. Both native drives
cover about 874px with 51 entry props and 16.7ms rAF p95; server means are
0.731→0.695ms and traffic means 0.179→0.130ms. Earlier noisy desktop pilots
remain recorded/excluded from the final lane. No wide-view improvement is measured
for this slice.

Separate native deep captures each record 487 ticks. Flat blocked-probe road and
height reads each fall 617,908→110,110 (1,269→226 per tick, about 82% fewer).
No repeated cells remain in the optimized flat-road census. Body/prop probes
remain live: 37,815 versus 38,031 calls, with wall-time trajectories/candidate
counts varying. These instrumented timings are not speedup evidence.

Typechecks and all 2,528 unit tests in 257 files pass. Lint has the existing
119 warnings/34 infos and no errors. The initial isolated build rejects a stale
Workshop input digest after the engine-source change. Art catalog regeneration is
unchanged; the verified 770-candidate manifest refresh changes five explicitly
excluded interactive car/bridge experiment identities and the broad digest only.
All other candidate records, including every immutable review identity, remain
identical. The root production build then passes; its output is used for isolated
native browser checks. All six streaming readiness stages pass with zero missing-data or incomplete-cache frames. All 15 affected full bundled-Chromium game/lab checks pass serially on an isolated alternate port (3.5 minutes): generated crossings, traffic/renderer lifecycle, roof riding and bridge/garage routes on Canvas/GPU. This is scoped browser validation, not a full browser suite.

## Next

Measure conservative swept local candidates for inside-player driving on both
authority and prediction, preserving large bodies, compound prop walls and roof
passenger support/headroom. Wide-camera snapshot/interest and cool-phone displayed
frame tracing remain separate proposals from 124.
