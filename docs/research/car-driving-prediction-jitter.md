# Inside-car prediction jitter

Investigation: 2026-10-10, runtime revision
`ef90258f3c058096d29a2121f0ba4e19cc8c9d06`. The owner reports slight snapping or
unsmooth movement while driving. Gameplay remains unchanged in this checkpoint.

## Finding

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
ticks; progressive synthetic braking currently supplies the stop instead.

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

## Rerun and next work

```sh
npx tsx scripts/instrumentation/car-driving-prediction.ts --output=/tmp/tilefun-car-driving-prediction.json
node scripts/instrumentation/car-driving-browser.mjs --output=/tmp/tilefun-car-driving-browser-canvas60.json
node scripts/instrumentation/car-driving-browser.mjs --renderer=gpu --output=/tmp/tilefun-car-driving-browser-gpu60.json
node scripts/instrumentation/car-driving-browser.mjs --server-hz=30 --output=/tmp/tilefun-car-driving-browser-canvas30.json
```

The controlled CLI's `--assert-continuous` is a future acceptance gate and
currently fails the late-input cases. [Committed summary](../benchmarks/car-driving-prediction.json)
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

## Validation

All three typechecks, 2,274 unit tests across 236 files, and lint pass. Lint retains
the existing 118 warnings and 34 informational diagnostics; the added diagnostic
files pass their focused lint check. All eight controlled traces repeat
identically, and the optional continuity gate fails as expected at `60/late-input`.
The three native browser captures complete with zero page errors and close their
owned browser/server processes. No runtime, renderer, recipe, input contract or
asset inventory changes are included in this investigation.
