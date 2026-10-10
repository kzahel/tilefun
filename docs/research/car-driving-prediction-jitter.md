# Inside-car prediction jitter

Investigation: 2026-10-10, runtime revision
`ef90258f3c058096d29a2121f0ba4e19cc8c9d06`. The owner reports slight snapping or
unsmooth movement while driving. The initial checkpoint changed no gameplay;
the authorized shared-authority fix is recorded below.

## Original fault

An authority tick with no newly arrived input calls
`vehicles.input(session, { dx: 0, dy: 0 }, dt)` in `Realm.tick`. For a driven car,
this brakes **and integrates additional position** through `TrafficSystem.drive`.
It does not advance the acknowledged input sequence. A delayed command then
arrives with its successor and both integrate their full commanded duration.
`PlayerPredictor` replays commands, so it cannot reproduce the extra unacknowledged
braking interval. The next frame produces a positional and velocity correction,
even while driving straight on clear, flat ground.

`PlayerPredictor.reconcileSteps` also clears presentation correction whenever
there is a server mount. `RemoteStateView.beginPresentation` renders the predicted
car directly with its local interpolation endpoints. The bounded residual
correction used for ordinary walking therefore does not soften this car correction.
The hidden driver/camera target and rendered car remain aligned in the controlled
traces; a disagreement between their interpolation clocks is not required for the
observed fault.

The missing-input call also refreshes `VehicleControl.lastInput`. Consequently
the seat's 250ms stale-input deadline is not reached by ordinary missing-input
ticks; progressive synthetic braking supplied the stop instead.

## Controlled reproduction

`car-driving-prediction.ts` creates the native flat car fixture, grants an inside
seat through `VehicleControl`, and runs production Realm, binary replication,
RemoteStateView, PlayerPredictor, GameLoop and camera math. Commands and authority
both run at 30 or 60Hz; controlled presentation runs at 120Hz for four seconds.
Each entire trace repeats identically in a fresh session. Metrics omit the first
second of acceleration.

| Authority | Delivery | Max post-replay correction | Rendered world step range |
| --- | --- | --- | --- |
| 60Hz | Regular | 0.000026px | 0.933515–0.933546px |
| 60Hz | One input one tick late every 0.5s after warmup | 1.664465px | 0.925745–2.596041px |
| 60Hz | One snapshot late every 0.5s | 0.000026px | 0.933515–0.933546px |
| 60Hz | Constant 50ms delay each way | 0.000026px | 0.933515–0.933546px |
| 30Hz | Regular | 0.000020px | 0.933221–0.933251px |
| 30Hz | One input one tick late every 0.5s after warmup | 3.048917px | 0.917675–3.978266px |
| 30Hz | One snapshot late every 0.5s | 0.000020px | 0.933221–0.933251px |
| 30Hz | Constant 50ms delay each way | 0.000020px | 0.933221–0.933251px |

Five missing-input cruise ticks add 8.711px of synthetic authority movement at
60Hz and 16.8px at 30Hz. After subsequent input recovery, the authority finishes
8.244px / 14.933px farther forward than its matched regular-delivery control.
Maximum screen steps are 4.860px / 8.900px at the fixture's ordinary 3× zoom.
Hidden-driver/car separation remains exactly zero. Stable delay alone does not
produce cruise correction; crossing an input-admission deadline does.

The lower-precision binary snapshot positions explain the tiny regular-control
residuals. These explicit-clock traces do not measure GPU rendering, rAF cadence,
physical display smoothness or OS input routing.

## Real Worker confirmation

`car-driving-browser.mjs` opens a fresh seed-2026 regional world in task-owned
bundled full Chromium, stops a traffic car by approaching its bumper, enters via
the ordinary Drive car button, and holds the native heading key for eight seconds.
It observes reconciliation and rendered poses without injecting delay or changing
movement/prediction code. Each run owns isolated Workshop data and browser storage
and closes its browser/server. Browser runs were sequential, without concurrent
tests or profilers.

At 60Hz authority:

| Renderer | Reconciliations | Cruise samples | Single-tick input gaps during cruise | Max cruise correction |
| --- | --- | --- | --- | --- |
| Canvas | 480 | 364 | 1 | 1.680104px |
| GPU | 480 | 451 | 3 | 1.680104px |

Both captures have zero page errors. One Canvas sequence is:

| Server tick | Input acknowledgement | Car speed | Authority displacement | Post-replay correction |
| --- | --- | --- | --- | --- |
| 1823 | 1816 | 112px/s | 1.867188px | 0.000148px |
| 1824 | 1816 | 104.533px/s | 1.773438px | 1.680104px |
| 1825 | 1818 | 112px/s | 3.640625px | 0.000122px |

The unchanged acknowledgement, braking movement, and subsequent two-command
admission match the controlled reproduction. This occurs on both renderers, so
GPU rendering is not needed to trigger it. These headless browser runs rendered
at approximately 60Hz; the 120Hz lane above is controlled math, not native display
acceptance. Cruise filtering excludes hard stops but cannot exclude every nearby
contact in the generated world. The user's specific device/session has not been
captured; turning, changing grades, obstacle/roof-rider clearance and long stalls
remain additional possible correction sources.

A separate Canvas 30Hz run has 238 reconciliations, 115 cruise samples and 28
single-tick input gaps during cruise. Maximum motion without an acknowledgement
is 3.360352px and maximum cruise correction is 2.986993px, with zero page errors.
This provides a real-clock lower-authority-rate control, not a repeat-identical
browser trace.

## Initial reruns and proposed fix

```sh
npx tsx scripts/instrumentation/car-driving-prediction.ts --output=/tmp/tilefun-car-driving-prediction.json
node scripts/instrumentation/car-driving-browser.mjs --output=/tmp/tilefun-car-driving-browser-canvas60.json
node scripts/instrumentation/car-driving-browser.mjs --renderer=gpu --output=/tmp/tilefun-car-driving-browser-gpu60.json
node scripts/instrumentation/car-driving-browser.mjs --server-hz=30 --output=/tmp/tilefun-car-driving-browser-canvas30.json
```

The controlled CLI's `--assert-continuous` initially fails the late-input cases.
[Original summary](../benchmarks/car-driving-prediction.json)
retains complete-trace hashes and sanitized browser metrics; raw traces remain
local.

The next fix should give driven cars one motion-time owner: short missing-input
ticks must not integrate an extra interval that delayed commands subsequently
integrate again. Keep a real last-received-command timestamp and the explicit
250ms stale/disconnected-driver stop. Test empty/two-command batches, deliberate
release-to-brake, stale stopping and recovery at 30/60Hz through the common Realm
and predictor used by the game and labs. Residual mount presentation smoothing
can be considered afterward; smoothing alone would hide the incorrect extra
authority travel. Preserve train service-time control and ordinary walking policy.

## Initial validation

All three typechecks, 2,274 unit tests across 236 files, and lint pass. Lint retains
the existing 118 warnings and 34 informational diagnostics; the added diagnostic
files pass their focused lint check. All eight controlled traces repeat
identically, and the optional continuity gate fails as expected at `60/late-input`.
The three native browser captures complete with zero page errors and close their
owned browser/server processes. No runtime, renderer, recipe, input contract or
asset inventory changes are included in this investigation.

## Shared-authority fix (2026-10-10)

The owner authorized implementation and a validated commit. `Realm.tick` now
calls `VehicleControl.missingInput` for an empty driver input queue. Cars retain
their last committed pose and velocity during short delivery gaps; only consumed
commands integrate car motion. Real zero-axis commands still brake through the
same shared `drivenCarPose`. Empty ticks do not refresh the driver input timestamp,
so `VehicleControl.sync` stops stale input after the existing 250ms deadline,
without adding displacement. A new command then accelerates from rest. Disconnect
continues to stop, release the seat and park immediately.

Train empty-input ticks still select zero drive intent and brake through the
native service clock. They also retain a genuine last-command timestamp for the
existing stale-driver stop. Autonomous cars/trains, collision/grade policy,
prediction, presentation smoothing and binary protocol are unchanged. Game and
embedded labs consume this single shared Realm owner.

The former diagnostic case is now an importable simulation fixture used by
`CarDrivingPrediction.test.ts`. Eight cases cover 30/60Hz authority with 120Hz
presentation under regular inputs, one-tick late input, late snapshots and
constant delay. Two more compare delayed diagonal turns/release braking against
the uninterrupted trajectory in both axes. `CarInputTiming.test.ts` adds eight
native authority cases: short gaps and roof-passenger carry, delayed release,
the exact stale-input boundary and recovery at both rates, disconnect and a
train service-clock control. No DOM, timer or browser is needed for these tests.

Before the fix, the initial 16 new cases report **8 failures / 8 passes**:
late-input continuity and all six car gap/release/stale cases fail; regular,
late-snapshot, constant-delay, disconnect and train controls pass. After the fix,
the initial cases pass, followed by the two steering/release comparisons. The
CLI continuity gate now passes all eight traces, each repeated identically.
Previously failing late-input cruise correction drops from 1.664/3.049px to
below 0.000026px at 60/30Hz, matching regular controls. Motion without a consumed
command is exactly zero, and late-input authority travel matches the regular
control. [Fixed summary](../benchmarks/car-driving-prediction-fixed.json) retains
the new complete-trace hashes and browser results.

Post-fix real Worker captures pass `--assert-fixed` (0.01px replay/empty-tick gate):

| Renderer / authority | Display cadence | Cruise input gaps | Max cruise correction | Extra motion without acknowledgement |
| --- | --- | --- | --- | --- |
| Canvas / 60Hz | Headless 60.002Hz | 68 | 0.000829px | 0px |
| GPU / 60Hz | Headed 120.009Hz | 35 | 0.000341px | 0px |
| Canvas / 30Hz | Headless 60.003Hz | 3 | 0.000438px | 0px |

All three captures have zero page errors. Steady known-speed rendered world-step
errors are at most 0.000672/0.000526/0.000287px respectively, omitting the first
second and last half-second. The headed GPU run measures native rAF, without a
render-rate override. This establishes scoped straight driving continuity, not
whole-machine pacing or all terrain/contact trajectories.

Two probe setup attempts timed out before boarding or driving measurement. The
runner now waits for the requested realm arrival and ready terrain before choosing
the nearest car, uses the tested bumper coordinate convention, and retains failure
diagnostics. It obtains heading from the actually occupied seat. The final 30Hz
capture uses these startup guards; no authority/input timing is injected.

### Fix validation

All three typechecks, **2,363 unit tests across 243 files**, lint and the production
build pass. Lint retains the existing 118 warnings and 34 informational diagnostics.
`art:catalog` followed by `workshop:manifest` verifies all 761 candidate identities
in headless-shell and full Chromium. Six live character scenario fingerprints
refresh because their controller identity includes shared Realm source; their
source fingerprints and the promoted art/settings banks remain unchanged.

The full bundled-Chromium suite reports **540/542 passing** in its first run.
All vehicle driving/geometry/rendering, prediction recovery, traffic, train and
embedded scenario checks pass. Two failures are outside the occupied-driver
branch: the fish ball volley does not trigger its expected escape within 15s,
and GPU terrain pacing observes another texture upload during its warm window.
Both pass **all three isolated single-worker repetitions (6/6 total)** without
code changes. The initial full-suite failures remain recorded; this is not a
clean first-pass result or proof that those two broader tests are never flaky.

`streaming:bench -- --assert-ready` passes all six default stages (cold,
standing, walk, sprint, reverse and zoom-out), with zero missing-data,
incomplete-cache or stale-cache frames. A normal device driving playtest is the
next subjective check; it should distinguish any remaining terrain/contact or
frame-pacing issue from the now-covered command-admission regression.
