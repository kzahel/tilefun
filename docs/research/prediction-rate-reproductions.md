# Prediction and presentation at different rates

Recorded 2026-10-05 against gameplay source at `c848623`. This extends the
[moving-contact baseline](moving-contact-reproductions.md). Only diagnostics and
documentation changed. [Player prediction](../topics/player-prediction.md) owns
the reproduction-first gate; no runtime fixes are implemented.

## Clocks and repeatable commands

Production `GameLoop` renders on animation frames and runs fixed updates
independently. `GameClient` applies buffered state at the beginning of an update,
follows the advertised server tick rate, then generates player commands. Normally
120Hz rendering therefore produces 60 commands/s with 60Hz authority or 30
commands/s with 30Hz authority. It must not turn rendering into 120Hz simulation.

```sh
npx tsx scripts/instrumentation/prediction-rates.ts --output=/tmp/prediction-rates.json
npx tsx scripts/instrumentation/prediction-rates.ts --case=free-walk --profile=switch60-30-60-render120 --output=/tmp/rate-switch.json
npx tsx scripts/instrumentation/prediction-rates.ts --case=train-roof --profile=server30-render120 --output=/tmp/train30.json
```

Six existing native scenes cover free walking, a static wall, a moving person,
a still cow and straight cruise on car/train roofs. Seven profiles vary clocks:

| Profile | Authority | Render callbacks | Command clock |
| --- | --- | --- | --- |
| `server60-render60` | 60Hz | 60Hz | follows replicated rate |
| `server60-render120` | 60Hz | 120Hz | follows replicated rate |
| `server30-render60` | 30Hz | 60Hz | follows replicated rate |
| `server30-render120` | 30Hz | 120Hz | follows replicated rate |
| `switch60-30-60-render120` | 60→30→60Hz, one second per phase | 120Hz | follows replicated rate |
| `switch60-30-60-delay50-render120` | same transitions | 120Hz | follows replicated rate; 50ms each way |
| `server30-command60-render120` | 30Hz | 120Hz | deliberately independent 60Hz |

The independent command-rate lane is a stress case, not normal client behavior.
Each three-second run repeats in a fresh session. The probe rejects differing
traces, missed contact, lost cruise/support, wrong authority tick counts, missing
advertised rates or missing render callbacks. Absolute process-wide physics
revision counters are normalized as fixture metadata; native physics parameters,
colliders and gameplay rules are unchanged.

This runner drives production `GameLoop.externalTick` with timestamped 60/120Hz
frames. Its update ordering mirrors `GameClient`, including rate synchronization
inside the callback. Authority uses 1/rate timesteps and the normal binary CVar
replication path. Ordered delays are measured in elapsed time rather than numbers
of 60Hz ticks. A 2.08333ms frame phase avoids accidental floating-point boundary
coincidences. The 120Hz scheduling grid is diagnostic data, not a runtime change.

Shared `bindPredictedPlayerPose` and `interpolatePosition` supply sampled body
poses. This lane does not draw pixels or measure physical refresh, camera motion,
native rAF cadence or GPU frame pacing. Metrics distinguish startup from samples
after 250ms. JSON retains commands, authority steps, rate transitions, actual
post-replay shifts, interpolation fractions and relative poses.

## Deterministic findings

All 42 combinations have identical traces across fresh repeats. Fixed 30/60Hz
walking and wall controls retain post-replay corrections below 0.00002px after
startup. Changing render frequency does not double input or authority steps.
Fixed-rate train roof interpolation after startup remains within 0.0006px of a
constant offset in these phase-locked cases. This is a stable control, not proof
that independently scheduled real Worker roof motion is correct.

The delayed rate-switch person case reaches 2.13312px contact corrections during
30Hz input. The still-cow policy mismatch also persists, scaling from a 1.06688px
60Hz command to a 2.13312px 30Hz command.

All six normal-follow scenes produce **seven negative interpolation fractions**
during 60→30→60 transitions, including free walking and wall contact. This happens
without transport delay. Transitions arrive through replicated rate updates;
the harness does not directly impose them on the client loop.

Train authority retains exactly constant roof offset while no-delay transitions
produce corrections up to 9.59929px and a 9.59862px settled rendered-offset span.
Car authority itself drifts: its relative offset spans 4.80636px, with corrections
up to 1.19999px. Neither carrier loses support or changes cruise speed. The
independent command-rate stress lane also exposes changing displayed roof offsets
despite small settled corrections; simulation and presentation need separate metrics.

## Shared loop transition defect

`GameClient.update` calls `GameLoop.setTickRate` after a replicated CVar change.
The setter resets the accumulator to zero. When the callback returns, both
`externalTick` and ordinary rAF `tick` subtract the **new** fixed duration from
that zero accumulator. Render receives a negative interpolation fraction instead
of a value between zero and one. The in-flight command still uses the old update
duration; subsequent commands use the new one. The probe preserves this ordering.

This is a shared-loop defect, separate from train carry, moving NPC geometry and
collision policy. No accumulator, interpolation or command-duration fix is made here.

## Actual Worker, native rAF and renderer captures

```sh
# Native animation frames; measure the observed rate rather than assuming it.
node scripts/instrumentation/train-roof-browser.mjs --headed --output=/tmp/native-rate.json
node scripts/instrumentation/train-roof-browser.mjs --headed --server-hz=30 --output=/tmp/native30.json

# Controlled target cadence through actual GameClient update/render callbacks.
node scripts/instrumentation/train-roof-browser.mjs --render-hz=120 --server-hz=30 --output=/tmp/canvas120-30.json
node scripts/instrumentation/train-roof-browser.mjs --renderer=gpu --render-hz=120 --server-hz=alternate --output=/tmp/gpu120-switch.json
```

These retain ordinary keyboard boarding, native seed 2026, the real Worker,
isolated Vite origin/data and bundled full Chromium, closing browser and server
on exit. `--server-hz` uses the existing `sv_tickrate` console/CVar path.
`alternate` changes rates after four and twelve seconds of capture. The fixture
waits for terrain readiness before boarding; no simulation movement is replaced.

External 120Hz mode stops internal rAF scheduling and invokes the production
external clock with actual wall timestamps at an 8.333ms target interval. It draws
through actual scene renderers. Reports reject a run below 110 callbacks/s or a
median frame interval above 10ms. This verifies approximately 120Hz callbacks,
not physical scanout or sustainable frame pacing. Native mode instead observes
real rAF; its cadence depends on the machine/display and must be measured.

Measured macOS captures, 1280×900, development serving, no artificial network delay:

| Lane | Render callbacks/s | Median interval | Command duration | Observed authority rates | Largest steady correction |
| --- | ---: | ---: | --- | --- | ---: |
| Headed Canvas, native rAF | 120.004 | 8.3ms | 16.67ms | 60Hz | 3.222px |
| Headed Canvas, native rAF | 120.002 | 8.3ms | 33.33ms | 30Hz | 6.402px |
| Canvas, external 120Hz | 119.994 | 8.3ms | 33.33ms | 30Hz | 6.402px |
| GPU, external 120Hz, rate transitions | 119.985 | 8.3ms | 16.67/33.33ms | 60/30Hz | 6.400px |

Native 30Hz displays rider-relative X from 6.381 to 19.201px while authority
keeps its offset at zero. Its 6.4px correction is one 30Hz train step, twice the
60Hz displacement. The GPU transition capture contains eight negative fractions;
both fixed-30Hz captures contain four residual startup frames from changing rate
before capture. Native fixed-60Hz has none. All captures have no browser errors.

The train clock-equation check now sums actual acknowledged command durations,
including mixed rates, rather than assuming every command lasts 16.67ms:

```text
postReplayShift = authoritativeTrainTravel
               − 192 × sum(newly acknowledged command durations)
```

Maximum residual is below 7e-12px for both 30Hz captures and the GPU transition
capture. Native 60Hz has occasional larger residuals whose cause has not been
isolated; reports retain them rather than claiming this equation explains every
correction under all schedules. These are instrumented observations, not FPS claims.

## Validation and next work

All 42 deterministic combinations completed twice with validity checks and
identical traces. Four real Worker captures above completed on Canvas/GPU,
including measured native 120Hz rAF at both authority rates. Project typechecks,
all 192 unit files / 1,571 tests, lint and the probe's separate strict TypeScript
check pass. Lint retains its existing warnings/informational diagnostics.

Keep fixed-rate controls and live transitions in the eventual acceptance set.
Correct accumulator ownership, moving collision policy/geometry timing and carrier
motion as separate responsibilities. Retest Worker game and embedded labs on both
backends before declaring a fix. Runtime implementation remains unchanged.
