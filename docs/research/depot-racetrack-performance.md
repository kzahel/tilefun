# Depot and racetrack performance

Date: 2026-10-22. Owner: [performance](../topics/performance.md).

The owner reports poor performance around a car depot and racetrack. Initial
desktop probes identify costs but do **not** reproduce the slowdown. The owner's
follow-up supplies the attached Pixel 7a: native-phone captures below reproduce
wide-track and dense parked-car slowdowns. The exact saved depot remains unknown.
No production gameplay or renderer policy changes are part of this investigation.

## Method

Source `e1884392`, Apple M4 Pro, bundled full Chromium 153.0.8010.12, headless,
1440×900 CSS/device pixels, seed 2026, real dedicated authority Worker and
IndexedDB. Runs are sequential without concurrent validation. The
[city audit](../../scripts/instrumentation/city-audit.mjs) now accepts racetrack
arrivals, desktop viewports and a separately labelled synthetic parked fleet.
Its stale Realm AI timing marker was also repaired; AI timing stops before the
new resident-behavior pass.

Short controls warm for four seconds and measure eight seconds. Longer track
controls warm for twelve seconds and measure twenty seconds, covering the
spectators' twenty-second waits and giving racers time to reach cruising speed.
Each stage creates a fresh world; native traffic arrival can vary. Source/probe
hashes, populations and aggregate timings are retained in the
[sanitized evidence](../benchmarks/depot-racetrack-performance.json).

Normal zoom is 1 (camera scale 3); overview zooms 0.25 and 0.1 have scales 0.75
and 0.3. An overview changes resident geometry and renderer load, while distant
residency alone does not activate all actors. CPU render timers measure
submission, not hardware GPU execution or displayed presentation. Callback pacing
is not a physical-device FPS guarantee.

## Racetrack authority

Short ordinary track controls average 1.95–2.06ms per server tick, with
2.9–3.2ms p95 and authority near 60Hz. AI decisions average 0.07–0.08ms,
NPC physics 0.38–0.42ms and traffic 0.82–0.93ms. All 48 spectators are resident;
36 are active at the southern arrival. City core standing averages 0.88ms per
tick, including 0.30ms traffic and thirteen active route pedestrians. These are
different populations and native workloads, not matched optimization controls.

The separate deep 0.1-overview capture has eight active racers, 389 resident
actors and 961 props. Across 505 ticks, traffic performs **152,761 obstruction
probes** (302.5/tick), returning **1,723,829 body candidates** (3,413.5/tick).
These counts include repeated candidates, not that many distinct actors.
Per-query timers/counters and 1ms sampled CPU add overhead: its 4.07ms tick mean
and 2.03ms traffic mean must not be compared as regressions against shallow runs.
A 102.9ms outlier falls in the profiler-setup window before the first sampled
client frame; it is excluded from ordinary timing conclusions.

The work has a concrete cause in [TrafficSystem](../../src/traffic/TrafficSystem.ts):
every car probes its stopping distance in four-pixel increments, repeatedly
querying body/prop candidates and checking passenger/roof clearance. At the
ordinary 36px/s speed, minimum lookahead produces seven samples. At racers'
126/150px/s speeds, the same formula produces about 35/47 samples before any
junction-exit probes. Existing terrain reuse already avoids repeated road cells;
it does not reuse candidate queries. Sampled Worker CPU confirms `blocked`,
spatial queries, collision bounds and roof support are material. Broad wildlife
planning is not the first target in this scene.

Longer shallow track controls confirm about 60Hz authority and 16.7–16.8ms
callback p95 while up to 24 spectators are moving in sampled populations. Normal
view averages 2.04ms/tick (4.0ms p95); the 0.1 overview averages 3.45ms/tick
(4.0ms p95), with 1.73ms traffic and 0.067ms AI. Wide render CPU averages 3.53ms
(3.90ms p95); no measured frame interval exceeds 25ms. The 389-actor/961-prop
wide view has eight active cars throughout. This demonstrates desktop headroom,
not phone/Deck capacity, moving-camera performance or the owner's saved world.

## Parked vehicle rendering

The diagnostic fleet uses the first 45 registered road models through native
parked placement, centered on the track. It is **not the owner's depot**. Some
grid positions obstruct racers; its server cost is not a measure of adding parked
cars to an otherwise unchanged race. Both fleet captures have 56→57 native car
records including the 45 parked cars, with matching resident counts. The two mesh
captures have identical aggregate mesh draw counts.

| Fleet rendering control | Render CPU mean / p95 | Server mean / p95 | Callback p95 |
| --- | --- | --- | --- |
| GPU meshes, attribution wrappers | 2.15 / 2.30ms | 2.64 / 3.10ms | 16.7ms |
| GPU sprites | 0.82 / 1.10ms | 2.91 / 4.00ms | 16.8ms |
| GPU meshes, exact-size target reuse | 1.94 / 2.10ms | 2.59 / 3.20ms | 16.8ms |
| GPU meshes, shallow repeat | 2.09 / 2.30ms | 2.76 / 3.40ms | 16.7ms |

Mesh rendering costs about 2.5 times the sprite control's render CPU here, but
neither saturates this desktop. Every visible parked body still passes through
the full mesh/outline pipeline each frame. The census measures about **53 mesh
bodies and 463 mesh draw calls per frame**, including racers. There are 3,466
body and 3,466 outline target size changes in 480 profiled frames: **14.4 target
reallocations per frame**, despite a stationary camera and unchanged parked poses.
Three.js target `setSize` disposes the prior GPU allocation when dimensions differ.

The existing diagnostic exact-size reuse intervention retains five sizes
(128/160/224/288/384), about 3.69MiB. Against the later shallow mesh control it
saves about 0.15ms, with unchanged callback pacing. This is one comparison,
not a demonstrated frame-rate improvement or pixel-parity qualification. Do not
present target reuse alone as the cure.

## Wider views

The native track's short 0.25 overview uses about 0.90ms render CPU; the separately
instrumented 0.1 overview uses 4.52ms. Core city 0.1 overview uses 2.20ms. Different
scenes and profiling overhead prevent interpreting those ratios as gains.

The deep track view submits about 260 terrain items and 1,055 scene items per
frame. It has zero texture-page uploads in the measured window but about 93MiB
of vertex uploads in eight seconds. Sampled main-page CPU places Three.js vertex-binding
`needsUpdate`, scene collection and `depthAboveProps` ahead of individual vehicle
drawing. The latter scans depth surfaces for overlapping actor footprints.
Existing sprite submission and depth/locality work therefore remains relevant
when zoomed out; this capture does not identify recurring terrain rebuilding.

## Attached Pixel 7a follow-up

The [phone evidence](../benchmarks/depot-racetrack-pixel7a.json) retains six clean
captures and one separately labelled thermal-affected attribution trace. The
actual Pixel 7a runs Android 17/API 37 and Chrome 155.0.8059.79 at native
411×789 CSS pixels/DPR 2.625. No CPU or viewport emulation is applied. Each shallow
case warms for twelve seconds and samples twelve seconds; movement uses the
native touch joystick. All clean captures start/end at thermal status zero,
24.8–27.2°C battery temperature. They run sequentially without host validation.

| Phone workload | Mean callback FPS | Frame interval p95 | Server CPU mean | Render CPU mean |
| --- | ---: | ---: | ---: | ---: |
| Track, normal zoom | 60.0 | 16.8ms | 8.07ms | 2.03ms |
| Track, normal zoom, touch walking | 59.6 | 16.8ms | 7.21ms | 2.05ms |
| Track, 0.1 overview, meshes | 44.8 | 33.4ms | 8.71ms | 4.81ms |
| Track, 0.1 overview, sprites | 44.2 | 33.4ms | 9.13ms | 3.79ms |
| Synthetic parked fleet, 0.1, meshes | 29.0 | 50.0ms | 5.80ms | 13.02ms |
| Synthetic parked fleet, 0.1, sprites | 38.4 | 33.4ms | 6.45ms | 4.53ms |

Authority stays at 59.99–60.00Hz throughout. The normal standing view contains
no visible vehicle meshes on this portrait screen: it tests spectators and
authority, not car drawing. Touch walking covers 803px, with two frame intervals
over 25ms (maximum 66.6ms) and maximum replay correction about 0.00047px. These
are brief hitches, not a reproduced sustained prediction/desync failure.

The two wide-track controls have matching start/end resident, prop, active and
car counts: 138 actors, 212 props, 59 active actors, twelve cars/eleven active.
Mesh disabling reduces render CPU about 21% but does not improve callback pacing.
They still submit about **166 raster draws per frame**. The mesh control has
about 7.24 visible mesh bodies/50.7 mesh calls per frame; it uploads no new texture
pages during sampling. AI is about 0.21ms/tick, versus 5.03ms traffic. General AI
planning is therefore a poor first optimization target for this reproduction.

The fleet controls likewise match 187 resident actors, 228 props, 111 active
actors and 57 car records. The mesh view draws **51 mesh bodies/449 mesh calls**
plus **212 raster calls per frame**. Sprites reduce render CPU about 65% and
raise average callback rate about 32%, but leave a 33.4ms interval p95. Both have
zero texture-page uploads in the measured window, and all stationary clean
captures finish with no pending terrain jobs or prepared rows. Thus repeated
terrain rebuilding is not observed as the cause here. This remains a synthetic
fleet: some grid placements obstruct racers, so its cheaper server traffic cannot
be interpreted as an ordinary depot's marginal simulation cost.

The extra sprite-only wide-track trace ends at **thermal status one**, despite
28°C battery temperature. It is retained for attribution, excluded from clean
pacing comparisons, and stops subsequent captures. Its main-thread tasks have
8.77ms p95/13.85ms maximum; GC has 4.48ms maximum. GPU-service requests occupy
about 8.03s elapsed in an 8.02s marked window, with 3.28s request-thread CPU and
29.88ms request p95. Of 144 intervals over 25ms, 128 have no overlapping main GC
and 84 overlap a GPU request longer than 25ms. Nested durations/overlaps are not
additive or proof of causation. These are GPU-service waits/work, **not hardware
GPU duration or physical display presents**, and thermal change prevents clean
baseline attribution. Together with the clean renderer controls, they keep
submission/GPU-service/presentation work ahead of an AI rewrite in the next queue.
Shared CPU contention is not ruled out merely by the healthy authority rate.

Chrome initially exposed an existing empty-URL debug target that never completed
load, stalling Playwright attachment. A task-local CDP relay excluded only that
target; measurement timers still run inside the phone and game clocks remain
native. No saved game or existing page is navigated. The task closes its own
tabs/Workers/Vite servers and relay, clears only its isolated test origin, removes
only its USB routes, verifies prior routes remain, and restores the original
launcher foreground. Final Machine Control doctor reports ready/unlocked; a
post-cleanup thermal read is back to status zero (29.8°C battery).

## Advice and next work

1. The physical-phone slowdown is now reproduced in fresh scenes. Exact saved
   depot and moving/driving overview acceptance remain open. GPU sprites are a
   useful partial depot workaround; they do not fix wide-track pacing here.
2. For a depot, prototype bounded reuse of unchanged vehicle body/outline rasters.
   A parked vehicle's mesh is currently redrawn even without pose changes. The
   cache must invalidate paint, lights, equipment, wheels, carried contents and
   tow/roof relationships, and release resources on eviction/context loss.
   Measure native pixel parity, moving cameras and real-device timing before
   adopting it. Exact-size target retention can be evaluated alongside this,
   but its isolated timing benefit is small here.
3. For wide views, prioritize measured raster submission/batching and depth-query
   locality, with a cool-phone GPU/presentation trace to refine attribution. The
   sprite controls retain 166–212 raster calls/frame and slow tails. Avoid treating
   either mesh target retention or an AI rewrite as a complete remedy.
4. For the race, prototype conservative candidate reuse within one synchronous
   car lookahead/reservation sweep. Keep every contact check and use fresh
   candidates for later cars/ticks. Curves, junction exits, edits, passengers and
   readiness are dependencies. Avoid reducing collision cadence or removing
   spectators on the strength of these measurements.
   This remains useful server headroom work; these phone captures do not show
   authority saturation causing the lower frame rates. No evidence here justifies
   another simulation Worker or a broad AI rewrite.

Two diagnostic pilots were rejected: a stale source marker prevented startup,
and an initial grid had overlapping placements. They contribute no accepted
timings. Final fleet runs require all 45 native placements to succeed.
Raw [reports](/tmp/tilefun-depot-track-long/report.json),
[CPU profiles](/tmp/tilefun-depot-track-deep/0-overview-main.cpuprofile) and
[fleet screenshots](/tmp/tilefun-depot-fleet-mesh/1-overview.png) remain temporary;
Accepted aggregates are retained in the evidence file above. All owned browsers,
Workers and Vite servers are closed after captures.

Desktop validation: all thirteen accepted captures have zero page errors and no sampled
frame interval over 25ms (7,680 frames). Typechecks pass; all 6,638 unit tests in
365 files and the Node visual-comparison integration pass. Lint passes with the
existing 121 warnings / 42 infos; the modified probe and evidence JSON check
cleanly. No production rendering changes or full browser regression suite are
part of this profiling-only slice.

Phone validation: all six clean captures and the retained attribution case have
zero page errors. No production code changed for the phone follow-up; the previous
typecheck/unit/integration checks still cover the unchanged diagnostic source.
Raw [phone report](/tmp/tilefun-pixel7a-racetrack-mesh-final/report.json),
[fleet report](/tmp/tilefun-pixel7a-fleet-mesh/report.json) and
[thermal-affected trace summary](/tmp/tilefun-pixel7a-racetrack-trace/summary.json)
remain local; the sanitized evidence above excludes device selectors and routes.
