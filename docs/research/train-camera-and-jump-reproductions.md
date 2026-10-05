# Idle train camera skips and airborne momentum loss

2026-10-05, runtime baseline `6c762ab`. Follow-up to the user's roof-riding
playtest after [shared prediction work](shared-prediction-fix.md).
Reproduction and diagnosis only; no movement, camera or server-loop changes in
this checkpoint. [Player prediction](../topics/player-prediction.md) owns next work.

## What was missing from the previous acceptance checks

The earlier real Worker probes and deterministic matrices checked the passenger's
offset from the carriage, not continuity of the carriage/player in world space or
on screen relative to the camera. A whole carriage and its passenger can skip
together while passing every roof-offset assertion. The earlier jump tests checked
inherited velocity immediately after takeoff, not its survival through flight.

The browser probe now captures the camera **during rendering**, just before
`restoreActual()`, alongside interpolated player/train world positions, their
relative offset, screen-relative position, authority tick and client alpha. Reading
camera.x after rendering would instead measure the restored fixed-tick camera.

## Real Worker reproduction

Fresh regional seed 2026, ordinary Down + Space boarding, then release all input.
Native headed rAF on this machine's 120Hz display; bundled full Playwright Chromium,
1280×900 viewport, isolated dev origins/auth/data, no network emulation. Twenty-second
captures include station dwell, acceleration and straight 192px/s cruise. Analysis
below selects consecutive straight cruise frames with authoritative roof height 44.

| Backend / advertised authority | Measured render Hz | Measured authority Hz | Cruise screen skips >3px | Maximum screen step |
| --- | ---: | ---: | ---: | ---: |
| Canvas / 60Hz | 120.009 | 62.431 | 28 | 9.442px |
| GPU / 60Hz | 120.002 | 62.527 | 29 | 9.376px |
| Canvas / 30Hz | 120.002 | 30.213 | 3 | 18.905px |

Displayed and authoritative roof-offset ranges are **exactly zero** in all three
captures. No browser errors or invalid alpha frames. At 60Hz the large screen steps
occur about every 0.4 seconds; the Canvas inter-event spacing is 310–484ms. At 30Hz
the measured spacings are 3.067 and 3.500 seconds. This matches the reported idle
roof-riding symptom without turns, acceleration or walking.

One representative Canvas transition, across a 7.9ms display frame:

- Consumed authority tick advances from 621 to 623.
- Passenger and train advance together by 4.716 world pixels.
- Rendered camera advances by 1.616 world pixels.
- Their screen position advances by 9.300px at the default scale of 3.

The camera is not teleporting backward. The train/player pair periodically steps
ahead of the independently smoothed camera, then the camera catches up. To the
rider this appears as unstable tracking. Merely switching the camera to follow
the same discontinuous movement would transfer the skip to the landscape.

The first 30Hz attempt failed during ordinary keyboard boarding, before measurement;
it is excluded. A sequential rerun boarded normally and produced the accepted
30Hz capture. Every browser and dev server is closed by the probe's finally block.

## Timing cause and deterministic control

`ServerLoop.start()` schedules `setInterval(fixedDt * 1000)` and advances exactly
one fixed simulation step for every callback, without measuring elapsed time.
The 60Hz interval is 16.6667ms, but the observed browser authority cadence is near
16ms. This explains the measured ~62.5 ticks/second. The main-thread `GameLoop`
accumulates real elapsed time at the advertised 60Hz. Thus authority advances an
extra tick approximately every `1 / (62.5 - 60) = 0.4` seconds.

`RemoteStateView` consumes the accumulated frames during client updates. Carrier
rendering interpolates its most recent authoritative previous/current poses with
**client** alpha; passengers correctly share those endpoints. When two authority
ticks arrive within one client update, the endpoints advance by an extra 3.2px at
192px/s. The fixed-tick camera filters that advance. At 30Hz, a nominal 33.3333ms
timer running near 33ms produces a smaller clock drift, but each excess tick moves
the carrier 6.4px.

The focused deterministic probe varies only actual authority wake cadence, keeping
the advertised rate and physics dt unchanged. It uses the production Realm,
codec, replica, predictor, GameLoop and shared camera functions, with independently
scheduled authority and render events. Six seconds per case; screen steps are
measured after a one-second camera warmup. Each complete trace is run twice and
must hash identically.

| Advertised rate / actual timer | Render rates | Screen skips | Maximum screen step at 120Hz |
| --- | --- | ---: | ---: |
| 60Hz / 16.6667ms control | 60, 120Hz | 0 | 0.066px |
| 60Hz / 16ms reproduction | 60, 120Hz | 13 | 9.376px |
| 30Hz / 33.3333ms control | 60, 120Hz | 0 | 0.361px |
| 30Hz / 33ms reproduction | 60, 120Hz | 1 | 18.989px |

All eight cases preserve exactly zero roof-offset range and correct advertised
rate. The 60Hz reproduction's skip spacing is exactly 400ms. The ideal-cadence
control eliminates the periodic large skip. This isolates clock drift from an
arbitrary camera smoothing setting. The browser results independently establish
that the drift exists in the real Worker; the deterministic fixture does not
pretend to measure OS timers or display cadence.

## Jump reproduction and cause

The same native authority fixture starts an ordinary held jump from a carriage
cruising at 192px/s, then records every command until landing. A car at 36px/s is
the shared moving-support control. Both use default physics. Diagnostic repeats
disable only platformer air control to isolate its effect; this is not a proposed
change to the game's default controls. Each trace repeats identically.

| Case | First airborne vx | Second airborne vx | Relative travel at landing |
| --- | ---: | ---: | ---: |
| Train, idle jump, defaults | 192px/s | 0 | −105.621px |
| Train, forward jump, defaults | 265.6px/s | 64px/s | −68.120px |
| Train, idle jump, air-control-off diagnostic | 192px/s | 192px/s | +3.201px |
| Train, forward jump, air-control-off diagnostic | 265.6px/s | 265.6px/s | +46.143px |
| Car, idle jump, defaults | 36px/s | 0 | −19.804px |

Flights last 583.45ms in these fixtures. The forward takeoff contains the roof's
current walking velocity plus carrier velocity; airborne wish speed is 64px/s.
Relative travel at landing includes that landing tick's committed roof carry;
the +3.201px diagnostic landing displacement is not a claim of zero landing error.
This fixture demonstrates momentum loss, not successful traversal of a particular
carriage gap or complete predicted airborne presentation.

`stepPlayerFromInput()` adds the last carrier velocity exactly once on takeoff.
On the next command, `applyMovementPhysics()` applies ordinary friction in air
when `platformerAir` is enabled, which is the default. Default friction is 100;
at 60Hz, the computed drop exceeds the full speed, erasing it in one tick. With
forward input, normal acceleration then sets ordinary airborne walking velocity.
Thus the inheritance exists, but does not survive long enough to be useful. This
is shared player movement behavior, not a train-specific omission or air drag model.

## Proposed implementation sequence

1. Make the shared ServerLoop advance fixed steps according to monotonic elapsed
   time/deadlines, rather than callback count. Fractional timer rounding and late
   callbacks must not speed up/slacken simulation. Bound catch-up, preserve hidden
   pause/resume, stop/restart and tick-rate changes, and test Worker/P2P/dedicated
   owners. Verify measured wall-time authority cadence at 30/60Hz first.
2. Rerun these camera traces before touching smoothing. Separately address ordinary
   delayed/batched snapshots with an authority-timestamped presentation clock:
   remote bodies and support passengers share sampled carrier poses; local command
   alpha remains the local prediction clock. The camera consumes that displayed
   pose through the shared game/lab policy. Do not conceal a faster simulation by
   changing camera lerp or repeating carrier velocity per predicted command.
3. Preserve inherited airborne carrier velocity independently of voluntary movement
   velocity, so platformer friction/control operates on the voluntary component.
   Carry this state through authority, replication, prediction/replay, collision,
   landing, teleports and support changes. Retain responsive default air steering
   rather than globally switching to Quake air controls. Before implementation,
   stage a native two-carriage gap case in both directions, idle/forward/backward
   jumps, landing on same/next roof, walk-off and wall/ceiling collision.

Acceptance must include world/screen continuity and whole airborne trajectories,
in addition to roof-relative alignment. Exercise 60/120Hz render, 30/60Hz authority,
rate transitions and ordered delayed/batched delivery. Keep game and embedded labs
on shared engine owners. Train lifetime/minimap tickets remain deferred.

## Rerun and validation

```sh
npx tsx scripts/instrumentation/roof-camera-jump.ts --assert-baseline --output=/tmp/roof-camera-jump-baseline.json
node scripts/instrumentation/train-roof-browser.mjs --renderer=canvas --headed --output=/tmp/train-camera-baseline.json
node scripts/instrumentation/train-roof-browser.mjs --renderer=gpu --headed --output=/tmp/train-camera-gpu-baseline.json
node scripts/instrumentation/train-roof-browser.mjs --renderer=canvas --headed --server-hz=30 --output=/tmp/train-camera-30-baseline.json
```

Run native headed captures sequentially to avoid focus/cadence contention.
`--assert-fixed` in the older browser probe still asserts roof alignment and alpha,
**not camera continuity**. The new `--assert-baseline` intentionally requires the
documented failures and ideal-cadence/air-control controls; replace its expectations
when implementing fixes. Local reports contain raw frame/step/velocity data and
deterministic trace hashes; the document preserves the reviewable numerical evidence.

Typechecks, strict standalone probe typecheck, all 1,582 unit tests and lint pass
at the reproduction checkpoint. Lint retains 118 existing warnings/34 infos.
Native browser evidence is above. No renderer/input/recipe/runtime changes are
made, so this checkpoint does not change inventories or rebuild frozen review art.

## Shared authority timing fix

The user authorized the timing fix separately after the reproduction checkpoint.
`ServerLoop` now schedules monotonic deadlines with one-shot timers. Timer delays
round up, and callbacks consume only deadlines actually reached. Small late wakes
catch up fixed steps without shifting future deadlines or adding tick work to each
interval. More than 250ms of overdue debt is bounded/discarded. Stop/resume and
rate changes establish a fresh epoch; callbacks that stop, restart or change rate
cannot continue the old epoch or install an extra timer. Existing tick error
reporting/recovery remains intact. No camera lerp or airborne movement change.

Worker, browser P2P and dedicated-server GameServer hosts share this owner.
Embedded labs use explicit ScenarioWorkerHost/ScenarioSession steps, rather than
ServerLoop; their stepping and shared player/camera policy stay unchanged.

Fourteen focused clock tests cover 30/60/120Hz with integer timers over ten seconds,
late/early wakes, long-stall bounds, hidden pause/resume, callback work, callback
rate switches, stop/restart and fatal/recoverable errors. Native Node's direct
clock runner requires each five-second window to be within one endpoint tick of
elapsed wall time, with unchanged dt and no early simulation steps.
Its completed-tick cadence is 30.004 / 59.997 / 120.014Hz, respectively; final
pending ticks account for one tick of endpoint quantization in each window.

Native 120Hz game captures after the fix:

| Capture | Consumed authority Hz | Cruise forward / reverse screen skips >3px |
| --- | ---: | ---: |
| Canvas, 60Hz | 60.025 | 1 / 1 |
| GPU, 60Hz | 60.023 | 0 / 0 |
| GPU, 60Hz final with timing assertion | 60.003 in steady section | 0 / 0 |
| Canvas, 30Hz | 29.913 | 0 / 0 |
| Canvas, 30Hz repeat | 29.964 in steady section | 0 / 0 |
| GPU, 60→30→60Hz | 60.038 / 29.931 in steady sections | 1 / 7 across whole capture |

All roof-offset ranges remain exactly zero; all captures render at approximately
120Hz, with no invalid alpha or browser errors. The repeatable 400ms clock-drift
skip is eliminated. The first Canvas 60Hz capture has one forward/reverse pair
associated with delayed snapshot consumption, rather than a repeating beat. GPU
60Hz and both Canvas 30Hz runs show no >3px screen jumps. Rate-switching still has
presentation discontinuities. This fixes authority timing, not all snapshot
presentation; timestamped presentation and sustained airborne momentum remain next.

An initial whole-phase rate-switch assertion measured 29.753Hz because transition
edges mix advertised metadata and independently consumed frames. The probe now
excludes 500ms at each phase edge, measures steady sections separately, and reports
forward/reverse jumps. The final mixed-rate capture passes `--assert-timing` and
roof `--assert-fixed`. This measurement refinement does not alter game behavior;
direct clock tests exercise the actual transition lifecycle.

```sh
npx vitest run src/server/ServerLoop.test.ts
npx tsx scripts/instrumentation/server-clock.ts --output=/tmp/server-clock-fixed.json
node scripts/instrumentation/train-roof-browser.mjs --renderer=gpu --headed --server-hz=alternate --assert-fixed --assert-timing --output=/tmp/train-camera-timing-alternate-final.json
node scripts/instrumentation/train-roof-browser.mjs --renderer=canvas --headed --server-hz=30 --assert-fixed --assert-timing --output=/tmp/train-camera-timing-canvas30-repeat.json
```

The deterministic `roof-camera-jump --assert-baseline` deliberately supplies an
independent 16ms wake schedule directly to Realm; it does not call ServerLoop.
It therefore still reproduces the old cadence's presentation failure and current
jump friction. Its controls are retained for the next presentation/momentum work.

Final validation of the runtime committed as `ddc7fef`: all three typechecks and
strict standalone clock-probe typecheck pass; 196 unit files / 1,596 tests pass;
lint passes with the existing 118 warnings / 34 infos. Art catalog and Workshop
manifest regenerated without tracked output changes; build passes. All 16 affected
browser tests pass against the settled build (3.0m): Canvas/GPU city ride,
mid-bend save/reopen and alighting, phone roof restoration, curved route motion,
Worker busy/save/visibility lifecycle, standalone server, lab disposal and shared
traffic rendering/pause/context recovery. No source or bundle changes during that
run. `npm run streaming:bench -- --assert-ready` passes on the final build;
the tested traversal retains ready visible terrain. These readiness checks are
separate from the native 120Hz camera/cadence captures above.

## Small headless presentation reproduction

The user requested a simpler, deterministic verification boundary rather than
relying on browser runs or visual judgment. `presentation-timeline-case.ts` now
isolates one analytically moving train (`x = 192 * time`), one idle roof rider
and a following camera. It supplies ordered binary frames to the actual
RemoteStateView, PlayerPredictor, GameLoop, entity interpolation, PlayerPresentation
and Camera projection. There is no Realm/generation/service behavior, renderer,
DOM, browser, OS timer or rAF. Logical timestamps and delivery times are explicit.

The only disturbance is **one snapshot at t=1500ms arriving 10ms late**. On-time
delivery is the control; the same case runs at 30/60Hz snapshots × 60/120Hz
presentation. Each three-second numeric trace repeats exactly. This is eight
light parameter combinations of one scenario, not eight gameplay scenes.

At 60Hz snapshots / 120Hz presentation, consecutive displayed train positions:

| Presentation time | Consumed server tick | Frames consumed | Train x |
| ---: | ---: | ---: | ---: |
| 1493.750ms | 89 | 0 | 283.600px |
| 1502.083ms | 89 | 0 | 282.000px |
| 1510.417ms | 89 | 0 | 283.600px |
| 1518.750ms | 91 | 2 | 288.400px |

A constant 192px/s train should advance 1.6px every 120Hz frame. Instead it
briefly moves back 1.6px, then later advances 4.8px. The client alpha resets while
the replica still has the old interpolation endpoints, then the next update
consumes two snapshots. The camera follows its own fixed-tick state; the pair
produces a 9.878px maximum screen step. Rider/carriage offset stays within
0.000062 world pixels; Float32 wire rounding explains that tiny residual.

| Snapshots / presentation | On-time maximum world-step error | Late maximum world-step error | Late maximum screen step |
| --- | ---: | ---: | ---: |
| 30 / 60Hz | <0.00005px | 6.400px | 19.907px |
| 30 / 120Hz | <0.00005px | 6.400px | 19.487px |
| 60 / 60Hz | <0.00005px | 3.200px | 10.423px |
| 60 / 120Hz | <0.00005px | 3.200px | 9.878px |

This reproduces the remaining delivery/interpolation fault without authority clock
drift. Analytic authority is deliberately diagnostic data, not an alternate game
physics loop. Native Realm/Worker captures remain the integration evidence; this
fixture does not establish AI, collisions, rendering pixels or display cadence.

```sh
# Numeric traces and repeatability; no browser launched.
npx tsx scripts/instrumentation/presentation-timeline.ts --output=/tmp/presentation-timeline-baseline.json
# Desired continuity contract: intentionally exits nonzero on current code.
npx tsx scripts/instrumentation/presentation-timeline.ts --assert-continuous
npx vitest run src/rendering/MovingPresentationTimeline.test.ts
```

The test file has eight ordinary tests for repeatability, the smooth control,
ordered batching and roof alignment. Four `it.fails` tests explicitly record the
unmet continuity contract. A passing aggregate suite is **not** evidence that late
snapshot presentation is fixed: those four failures are expected and the direct
continuity CLI is red. After the timeline fix, promote them to ordinary regressions
without loosening the 0.05px world-step / 1px screen-step limits. World-step error
is measured against the independent constant-speed oracle, not copied interpolation
math; the camera warmup is excluded.

### Pure boundary for the next fix

The current harness is deterministic while exercising stateful production owners.
The next runtime change should isolate presentation sampling into shared math:

- Timestamped snapshot history plus chosen display time → displayed remote poses.
- Displayed carrier pose plus locally predicted roof offset → displayed rider pose.
- Previous camera state, displayed target and explicit elapsed time → camera state.

Clock/buffer policy supplies a monotonic display time; the sampler reads no ambient
timer. Explicit reset/teleport and insufficient-history policies remain necessary.
Game and ScenarioPresentationHost consume the same outputs; Canvas/GPU consume
those poses. This keeps responsiveness and roof walking prediction separate from
delayed remote presentation without duplicating a special train algorithm.
No production refactor or motion tweak is included in this reproduction checkpoint.
An offscreen renderer is useful later for projection/pixel/ordering checks, but
these numeric traces already detect the motion discontinuity before drawing.

Reproduction checkpoint validation: all three typechecks and lint pass (the same
118 warnings/34 infos); 197 unit files report **1,604 passed / 4 expected failures**.
The direct continuity CLI fails as intended, and all eight traces repeat exactly.
Only diagnostic fixtures/tests/docs changed. No browser, offscreen renderer or
asset inventory regeneration was needed to establish this numerical reproduction.


## Shared presentation follow-up

The subsequent [rider-free camera implementation/evidence](camera-basics-reproductions.md#shared-presentation-fix)
introduces shared pure timestamp sampling and exact linear-target camera follow,
used by both game and embedded hosts. All four continuity failures above are now
ordinary passing regressions; the eight complete numeric traces still repeat
exactly and `presentation-timeline.ts --assert-continuous` passes. The follow-up
records broader basic controls, lifecycle boundaries and native approximately-120Hz
measurements. Jump momentum remains an independent deferred change.
