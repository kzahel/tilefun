# Straight, constant-speed train roof jitter

Investigated 2026-10-05 against gameplay source at `17ec681` (documentation-only
successor of `5847bd3`). No gameplay fix is implemented in this investigation.
[Player prediction](../topics/player-prediction.md) now owns the broader
reproduction-first investigation, including the
[NPC/car baseline](moving-contact-reproductions.md). The support-relative proposal
below is an initial train diagnosis, not an implemented or complete NPC solution.
[Trains](../topics/trains.md) owns service behavior; the deferred service lifetime
and map-marker work is [066](../tactical/066-train-lifetime-and-map-markers.md).

## Finding

The reported symptom is reproducible without acceleration or a curve. Idle roof
passengers are transported on two different clocks: authoritative train ticks
versus predicted/replayed player commands. Ordinary Worker timing causes actual
post-replay position corrections of roughly one train tick, 3.2 world pixels at
192px/s. Ground controls do not show this displacement. This establishes a
train-specific failure; it does not certify all ordinary movement or car riding.

## Deterministic reproduction

Run from the repository root:

```sh
npx tsx scripts/instrumentation/train-roof-prediction.ts --output=/tmp/train-clock.json
```

The probe uses production `ScenarioSession`/Realm, RailwaySystem, replication,
binary codecs, RemoteStateView and PlayerPredictor. A straight alignment and
ordinary long straight body are both warmed to exactly 192px/s. For 180 server
ticks, send either one input each tick or the repeating `[2,0,1,1,1]` schedule.
Average input and server rates match. The idle passenger keeps authoritative
roof support and an exactly constant relative position throughout. No custom
simulation, authority patch, browser presentation or transport delay is used.

| Case | One input per tick, largest correction | Uneven input timing, largest correction |
| --- | --- | --- |
| Three carriage entities, precise 1/60s commands | 0.000074px | 3.200074px |
| Three carriage entities, production 16.67ms commands | 0.000689px | 3.201329px |
| One long straight train entity, production commands | 0.000689px | 3.201329px |
| Ground idle, production commands | 0px | 0px |
| Ground walking, production commands | 0.000108px | 0.000108px |

Ground-walking input is the same 64px/s ordinary movement under both schedules.
Tiny residuals include float snapshot precision. Command wire precision is
0.01ms, not whole milliseconds; its discrepancy is much smaller than the jitter.

## Real Worker reproduction

```sh
node scripts/instrumentation/train-roof-browser.mjs --renderer=canvas --output=/tmp/train-canvas.json
node scripts/instrumentation/train-roof-browser.mjs --renderer=gpu --output=/tmp/train-gpu.json
node scripts/instrumentation/train-roof-browser.mjs --delay=50 --output=/tmp/train-delay.json
```

Each invocation owns an isolated Vite origin, fresh browser context/world, bundled
full Chromium and shutdown. Optional `--headed` uses that same test browser.
Seed 2026 is an existing ordinary keyboard boarding fixture. The player boards
with Down+Space and then supplies idle input. Observation hooks retain frame
poses, actual post-replay shifts, acknowledgements, input durations and render
alpha for 20 seconds; they do not replace prediction, authority or rendering.
Steady samples require 192px/s, heading zero and authoritative roof height 44px.

Initial captures on macOS, headless full Chromium, 1280×900, development serving:

| Capture | Steady render samples | Rendered rider X minus train X | Largest post-replay shift | Server relative X |
| --- | --- | --- | --- | --- |
| Canvas, no artificial latency | 684 | 6.401–9.602px | 3.203125px | exactly 0px |
| GPU, no artificial latency | 683 | 6.401–9.602px | 3.203125px | exactly 0px |
| Canvas, 50ms each way | 681 | 25.605–44.809px | 3.203125px | exactly 0px |

Stopped-roof rendered relative X is exactly zero in all three captures. All
steady speeds are exactly 192px/s; no page errors or server roof loss occurs.
Both zero-latency captures have 1–2 commands awaiting replay. The latency
control has 7–13, magnifying the incorrect relative lead as replicas age.
These are instrumented desktop observations, not phone, WAN or FPS claims.

The Canvas capture contains 683 consecutive steady reconciliation pairs:

| Server ticks elapsed / commands newly acknowledged | Count | Mean post-replay X shift |
| --- | --- | --- |
| 1 / 0 | 36 | +3.201389px |
| 1 / 1 | 611 | −0.000705px |
| 1 / 2 | 8 | −3.202061px |
| 2 / 2 | 28 | −0.001447px |

For every pair, the measured shift matches this equation:

```text
postReplayShift = authoritativeTrainTravel
                − newlyAcknowledgedCommands × 192 × 0.01667
```

The largest residual is <6e-12px for both ordinary backend captures and <2e-11px
for the latency control. This uses the actual post-replay displacement, not the
raw predicted-versus-server error, which can legitimately contain backlog lead.
There are 44 Canvas and 52 GPU corrections over 1px during straight cruise.
Both simulation correction and inconsistent passenger/carriage presentation
are present; this is not only a camera or backend raster issue.

## Code path and why current tests missed it

- `Realm` input processing sets `deferTrainCarry: true`. Player commands predict
  relative walking/jumping, but an idle train passenger is carried later by
  `RailwaySystem.tick`, once per authoritative simulation step.
- `CurvedRailMotion`/`TrainPassengers` carry the passenger by each committed
  carriage pose. This runs even when no player command arrived that tick.
- `PlayerPredictor.applyInput` builds its movement context without deferring
  train carry. `stepPlayerFromInput` therefore adds the latest replica support
  velocity for each live or replayed command, independently of train motion.
- `PlayerPredictor.reconcile` resets to the authoritative player pose and replays
  unacknowledged commands against current replica entities. Those commands add
  carrier motion again. A variable acknowledgement backlog changes the lead.
- Presentation interpolates the train's replicated history and the player's
  predicted history separately. A passenger can lead the displayed carriage by
  several ticks even while authority says their relative position is constant.

The current `TrainRoofRiding.test.ts` predictor check runs one command before
each server step, reconciles immediately and uses the command duration as the
scenario server duration. It covers pose/roof behavior but not independently
scheduled clocks or unacknowledged commands. The browser journey test checks
boarding, saved support and arrival, without measuring rider-relative smoothness.

## Proposed fix

Make moving support a shared, explicit passenger relationship, independent of
steerable mount parenting. While grounded on a carriage, retain its identity and
the player's local roof coordinates. Server pose commits still carry the player
and validate clearance. Client command prediction/replay advances relative
walking and jumping, not autonomous carrier travel per command.

Derive passenger world pose and camera follow from one carriage presentation
pose plus the predicted local offset. Train and passenger must use the same
interpolation/extrapolation timeline. Reconcile local offsets from an authoritative
player/carriage pair at the same server tick, rather than mixing a replayed world
position with an older displayed carriage. Predicting/extrapolating carrier motion
can be bounded separately; it must advance once on its own timeline, not once per
passenger input. This does not depend on implementing the global map summary.

Keep ordinary walking and jumping responsive, detach cleanly on alighting/jump,
inherit carrier momentum once, and preserve native cardinal pose transforms,
collision/headroom checks and saved roof identity. Exercise the same support
contract on cars and embedded labs. Merely setting `deferTrainCarry` on the client
without deriving a supported world pose would leave the passenger behind;
reconciliation smoothing alone would conceal the clock error. Moving the train
according to rider command counts would make its speed depend on passengers and
is not an appropriate authority fix.

Acceptance before integration: an idle rider has constant rendered local offset
with `[2,0,1,1,1]`, missing/batched frames, changing replay backlog and transport
latency; relative walking remains correct. Then cover braking, departure, curves,
native pose snaps, support switching, jump momentum, reload and two passengers
with different input schedules. Use actual post-replay shifts and relative
presentation error, plus ground controls. Validate game and labs on both backends
and 60/120Hz presentation lanes. General train lifetime work remains deferred.

## Investigation validation

Standard typechecks, all 192 unit files / 1,571 tests and lint pass (lint retains
its existing 118 warnings and 34 informational diagnostics). The TypeScript
probe also passes a separate strict typecheck because instrumentation scripts
are outside the normal project include. All 16 deterministic cases, the three
browser lanes above and a final Canvas repeat complete successfully. The repeat
retains the same 6.401–9.602px rendered offset range and verifies the clock
equation in the probe's own summary. Only documentation and diagnostic runners
changed; no renderer, recipe, generation, protocol or simulation implementation
was modified, and the deferred ticket plan has not been implemented.
