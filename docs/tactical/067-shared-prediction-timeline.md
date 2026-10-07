# Shared prediction time, moving contacts and supports

Topic: player-prediction
Status: authority timing follow-up implemented; presentation/momentum follow-up open, 2026-10-05.

The user requested a recorded plan/references, then autonomous implementation
and incremental commits. This supersedes the investigation-only hold after the
reproduction baselines were established. Train tickets/map markers in 066 remain
deferred. No asset/geometry approvals are manufactured by this work.

## Evidence and objective

Preserve responsive ordinary walking while eliminating repeatable carry-clock,
collision-policy and rate-transition errors. Keep authority, prediction and
presentation explicit about time. Start from the committed
[contact baseline](../research/moving-contact-reproductions.md),
[rate baseline](../research/prediction-rate-reproductions.md) and
[real Worker train captures](../research/train-roof-prediction-jitter.md).

Current failures are distinct: negative GameLoop alpha when changing rates inside
an update; authoritative car roof drift under uneven input; train passenger
carry per predicted command versus per committed authority pose; stale moving
collider poses during replay; native cows omitted from predicted blocking.

## References and what to borrow

- [Valve Source SDK prediction.cpp](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/client/prediction.cpp):
  `CheckError`, `StorePredictionResults`, restore/replay and `RunSimulation`.
  Measure against acknowledged prediction state, keep command/physics time
  distinct from rendering, and treat visual error smoothing separately from physics.
- [Valve shared gamemovement.cpp](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/shared/gamemovement.cpp):
  `SetGroundEntity` and base velocity handling. Explicit support attachment and
  velocity inheritance on landing/leaving rather than accidental repeated carry.
- [id Quake III cg_predict.c](https://github.com/id-Software/Quake-III-Arena/blob/master/code/cgame/cg_predict.c):
  snapshot `physicsTime`, command time, mover-adjusted prediction error and decay.
  Physics and displayed states have explicit timelines; unpredictable interactions
  can still require bounded visual correction.
- [id Quake III cg_ents.c](https://github.com/id-Software/Quake-III-Arena/blob/master/code/cgame/cg_ents.c):
  `CG_AdjustPositionForMover` evaluates a mover between two times and applies its
  displacement independently of command count. Its rotation FIXME is a limitation;
  Tilefun must preserve its own committed cardinal train transforms and roof geometry.

Local read-only references are available under `~/code/reference/source-engine`
(a community Source tree), `Quake`, `Quake-2` and `Quake-III-Arena`. Public Valve/id
repositories above are the reviewable references. Earlier
[prediction lessons](../hard-won-knowledge.md) preserve prior queue fixes; their
“N commands → N movements” rule applies to player-controlled relative motion,
not autonomous support travel. Command generation, packet sending and render
frequency must not be conflated.

## Delivery order

1. Correct shared GameLoop accumulator ownership. Consume the current timestep
   before invoking an update that may change rates, and share native/external
   stepping. Verify 60→30→60 transitions and intermediate 120Hz frames.
2. Give moving roofs a shared support relationship and pose transform. Relative
   walking/jumping stays command-driven; autonomous carrier carry occurs exactly
   once per committed authority motion, including no-input ticks. Cars and trains
   use the same relationship. Preserve clearance, saved support and native turns.
3. Predict/reconcile relative support motion. Store support identity/local offset
   with synchronized player/carrier snapshots. Replay walking relative to the roof,
   not vehicle travel per command. Derive displayed rider/camera from one displayed
   support pose plus the interpolated predicted relative offset. Detach and inherit
   momentum once on jump, missing support, alighting or teleport.
4. Introduce bounded timestamped moving-entity collision history/proxies. Retain
   authoritative elapsed simulation time, not tick-number × current tick duration.
   Query poses at explicit prediction/replay times; bound extrapolation, resets and
   memory. Predict nearby motion, not entire NPC AI. Keep spatial queries correct.
5. Unify authoritative/predicted collision policy. Decide blocking through a shared
   predicate; test native stationary and moving cows/people without diagnostic flag
   overrides. Preserve non-solid/height filtering and mounted exclusions.
6. Evaluate residual visual corrections only after measuring the remaining
   simulation errors. Add bounded presentation-only smoothing if unpredictable
   contact still warrants it; teleports/support changes reset history. Do not smooth
   away repeatable authority drift or attach idle passengers to separate timelines.

Commit independently validated checkpoints; revise the plan if evidence requires
a different mechanism. Keep the game and embedded labs on shared engine owners.
No broad whole-world deterministic AI rollback or server hit-scan rewind is planned.

## Acceptance

Ground/wall/still-person controls stay stable. Cows use consistent collision rules.
Steady idle car/train passengers retain constant authoritative and displayed roof
offsets under uneven commands, delay, batched frames and 30/60Hz transitions, on
60/120Hz presentation. Check actual post-replay shifts separately from backlog
lead, authority drift, presentation error and startup.

Meaningful tests also cover relative roof walking, jump momentum/alight, braking,
curves/native pose changes, support switching/loss, save/reload and two passengers
with different command schedules. Moving-NPC cases retain reproducible before/after
traces; document corrections from genuinely unpredictable motion rather than
promising impossible perfect future knowledge. Bound history and extrapolation.

Run typechecks, unit tests, lint, asset inventories, build/browser integration
checks and streaming readiness where shared execution changes. Exercise real
Worker game plus affected labs on Canvas/GPU using isolated data and bundled
Chromium. Native 120Hz cadence is measured, not assumed from the display label.

## Execution

Plan recorded before runtime changes. Checkpoints and final evidence follow here.

### Loop timing checkpoint

Consume the active timestep before calling update; native rAF and external lab
stepping now share GameLoop.externalTick. Focused loop tests pass (including
60→30→60 with intermediate 120Hz renders). The deterministic free-walk transition
probe reports zero negative-alpha frames, versus seven in the recorded baseline,
and unchanged float-noise walking error. Report: `/tmp/rate-switch-fixed.json`.

### Committed support checkpoint

Cars and trains share normalized cardinal roof transforms and passenger clearance.
Authority carries once per committed support pose, including zero/multiple-input
frames; the old missing-input car fallback is removed. Prediction replays relative
walking without autonomous carry per command. Presentation binds passenger and
carrier interpolation endpoints together in the game and labs, with physics kept
separate. Jump velocity inheritance remains in shared movement. The predictor now
uses the authority's default solid-collider policy, including native cows.

Focused traffic/train/predictor/presentation tests pass (27). Car uneven-input
probe authority offset range is zero (baseline 21.02136px). All seven train rate
profiles have zero displayed roof-offset range/steps and zero invalid alphas;
raw world-position shifts of 3.2/6.4px remain expected carrier snapshot travel.
A new support-relative resimulation diagnostic measures actual rider correction.
Reports: `/tmp/car-authority-fixed.json`, `/tmp/train-relative-rates.json`.
Existing traffic harnesses now defer roof carry and load their passenger clearance
cells; prediction tests reconcile synchronized player/carrier snapshots.

### Collision timeline checkpoint

Authority frames carry Float64 elapsed simulation seconds (27-byte binary header,
up from 19); both endpoints must run the same build. Tick-count × current rate is
never used to reconstruct time. Game and scenario clients pass that time into
reconciliation. Collision proxies retain eight poses per visible solid entity,
100ms maximum extrapolation, invalidate exits/time resets/teleports/geometry
changes, and do not mutate replicas or autonomously advance moving roofs.
Replay uses accumulated command durations; live queries advance from that horizon
by measured time since the frame arrived, so co-generated catch-up commands share
an NPC pose. Deterministic probes inject their clock instead of wall time.

The first proxy probe removed delayed moving-away/crossing errors but introduced
1.067px corrections in the zero-latency uneven lane: advancing NPCs per live
command repeated the carry-clock mistake. Freeze co-generated command horizons,
then advance by arrival-relative elapsed time; retain the failing traces and rerun
all profiles. Native 120Hz Canvas Worker capture at 30Hz authority now reports
exactly zero displayed/server roof-offset range, including zero/two-command ticks.
One GPU run failed ordinary keyboard boarding before capture; no claim from it.
Full unit suite passes (1576 tests) before the final clock refinement; focused
codec/predictor/history tests and all three typechecks pass after it. Streaming
readiness passes. Inventory rebuilds update source references, not approved pixels.

### Residual presentation and phase checkpoint

Account for authority order: input uses the last committed NPC pose before that
NPC advances. Arrival-relative live lead subtracts the advertised authority step.
This preserves lockstep/uneven controls and removes batched-frame corrections;
naively adding a whole frame interval had introduced 1.067px errors in lockstep.
Those prototype reports remain local evidence, not the accepted result.

The accepted contact/rate traces and real Worker captures are summarized in
[shared prediction evidence](../research/shared-prediction-fix.md). Remaining
uncertain arrivals/AI contacts accept physics immediately, with an independent
60ms, ≤8px display decay; support/mount/height changes and teleports reset it.
All 50 contact traces retain identical repeats; instantaneous non-roof displayed
correction is ≤0.00001454px, maximum visual offset 2.13376px. All 42 rate cases
repeat, no invalid alpha frames, zero settled car/train displayed offset range.
The probe CLIs now have explicit `--assert-fixed` acceptance checks.

Tests cover 30/60/120Hz decay, normal roof walking/replay, once-only explicit jump
and walk-off momentum, support loss, native curve/braking/headroom/reload and two
roof passengers with independent [2,0,1,1,1] / [0,0,3,1,1] command schedules.
Full units pass 1580 tests before the final two-passenger addition; that new scenario
and existing roof scenarios pass independently (7). Typechecks pass; lint errors
introduced in new tests/probes have been corrected. Rebuilt inventories contain
current source references/interactive fingerprints, without modifying frozen art.

Broad browser validation was interrupted after a build replaced served bundles
mid-run; its failures are not accepted evidence. Repeat against a settled build,
then record final checks and any reproducible unrelated frozen-review limitations.

### Camera follow checkpoint

Final review found that fixed-tick follow still targeted the raw physics pose,
while render-time follow targeted the displayed pose. Shared followPlayer now
binds the predictor's presentation pose for both game and scenario camera targets.
The focused test verifies that a 1px correction changes physics without moving the
follow target/body; existing camera and decay tests pass (8), plus all typechecks.
Full units at the preceding checkpoint pass 1581 tests. Contact/rate CLIs pass
`--assert-fixed` with all independent repeats; streaming readiness passes again.
The broad settled-build browser suite is still running on the preceding built
checkpoint; rebuild and rerun affected game/lab consumers after it completes.

### Final validation

- All three typechecks pass; strict standalone probe typecheck passes.
- Full unit suite passes: 195 files / 1582 tests after camera follow alignment.
- Lint passes with the existing 118 warnings / 34 infos; no introduced errors.
- Art catalog and Workshop manifest regenerated, build passes. Source references
  and input digest are current; immutable asset banks/review evidence are untouched.
- Contact `--assert-fixed`: all 50 cases pass, independent complete traces identical.
- Rate `--assert-fixed`: all 42 cases pass, independent complete traces identical.
- Real Worker native Canvas/GPU approximately 120Hz with 30Hz authority and GPU
  external 120Hz with 60→30→60 authority pass roof presentation checks.
- Settled broad browser run: 372/375 passed. Two wildlife checks reproduce the
  prior fox `preview.gif` hash mismatch. Standalone timed out because source
  changed after inventory generation; its freshness guard correctly disabled
  voting. Its orphaned test process was reaped, inventories regenerated and the
  isolated standalone rerun passed.
- Final rebuilt game/lab consumer suite: all 35 pass, including standalone,
  city-to-city boarding/ride/reload/alight, native curves, train/car bridge/garage
  grades, traffic render/pause/context recovery, Worker settings/lifecycle and
  character/furniture/scenario presentation. No bundle/source mutation during it.
- Streaming `--assert-ready` passes again on the final camera build.

Next checkpoint: human native-120Hz playtest of moving-NPC contact and train/car
roof walking, jumping and alighting. Uncertain future AI/arrival grouping still
corrects physics; bounded visual decay handles the measured residuals. Train
lifetime/map tickets remain deferred to 066. No claim of full NPC AI prediction.

### Playtest follow-up: camera and flight

The user's idle train playtest preserved roof-relative alignment but exposed
periodic screen skips and ineffective inherited jump momentum. The focused
[reproduction record](../research/train-camera-and-jump-reproductions.md) adds
render-time camera capture and whole-flight traces before runtime changes.
Native 120Hz Canvas/GPU reproduce ~9.4px screen steps every ~0.4s; authority
actually advances near 62.5Hz although advertising 60Hz. Deterministic 16ms versus
16.6667ms authority wakes isolate that drift with exactly repeating controls.
At 30Hz, native screen steps are ~18.9px but occur ~3.3s apart. Default platformer
air friction erases inherited 192px/s on the second jump command; car control agrees.

The earlier acceptance checks omitted camera continuity and sustained flight.
Reopen those boundaries: shared monotonic-time authority scheduling first, measured
camera rerun, timestamped remote presentation as needed, then separate carrier
momentum from voluntary air controls with native carriage-gap/collision cases.
This checkpoint changes probes/docs only; no camera or movement tweak.

### Authorized authority timing follow-up

ServerLoop now uses monotonic fixed-step deadlines, rounded-up one-shot timer
delays, 250ms bounded overdue catch-up and fresh epochs on resume/rate changes.
It consumes deadlines before callback lifecycle mutations and preserves error
reporting. All timed Worker/P2P/dedicated hosts share the change; labs already
advance explicit scenario authority steps and need no timer migration.
Fourteen clock regressions and native Node cadence checks cover the contract,
including the 250ms catch-up boundary at 30/60/120Hz.

Native 120Hz game captures remove the repeating 400ms clock-drift skip. Consumed
authority cadence is ~60/~30Hz, with exactly stable roof alignment. Canvas 60Hz
had one delayed-frame forward/reverse pair, GPU 60Hz and Canvas 30Hz had none;
mixed-rate changes retain presentation discontinuities. The
[follow-up evidence](../research/train-camera-and-jump-reproductions.md#shared-authority-timing-fix)
records those limits and the corrected steady-section measurement. No camera or
momentum tweaks are bundled into the timer fix. Final repository/browser validation
is recorded after the settled build.

Timing fix commit: `ddc7fef`. Final typechecks (including standalone clock probe),
all 1,596 units and lint pass; existing 118 warnings/34 infos. Inventories regenerated
with no tracked output changes; build passes. All 16 affected game/lab/Worker/
standalone browser tests pass on the settled build in 3.0m. Final native GPU timing
assertion measures 60.003Hz authority and 120.003Hz rendering, zero roof-offset range
and zero >3px forward/reverse screen jumps. Streaming `--assert-ready` passes on
the final build. Remaining work is timestamped remote presentation through delayed
snapshots/rate switches, followed by full-flight carrier momentum; neither is
claimed fixed by the shared authority clock correction.

### Deterministic presentation boundary

The user requested simpler simulation-based verification. The new
[headless reproduction](../research/train-camera-and-jump-reproductions.md#small-headless-presentation-reproduction)
uses analytic constant-speed snapshot data and actual client codec/replica/predictor/
GameLoop/interpolation/camera code, with no renderer/browser/OS clock/Realm. One
10ms late snapshot causes a backwards frame and a ~9.9px screen step at 120Hz;
on-time controls are smooth. Eight small parameter traces repeat identically.
Four expected-failure unit contracts and a red `--assert-continuous` CLI make the
remaining problem explicit. Sampling and camera math can be refactored behind
this boundary, then the contracts promoted to ordinary regressions. No runtime
behavior changes in this checkpoint.

Headless checkpoint checks: typechecks/lint pass, 1,604 unit tests pass and four
continuity tests are expected failures. The direct CLI is intentionally red.
No browser/renderer run or runtime/pixel/asset change in this checkpoint.

### Basic camera cases before passengers

The user explicitly prioritized basic continuous motion over jump momentum and
the combined rider/train case. [Camera basics evidence](../research/camera-basics-reproductions.md)
records four rider-free fixtures: locked and smoothed remote train framing, plus
768px/s real local prediction with/without noclip. On-time controls at 30/60Hz
simulation × 60/120Hz display pass target motion and one-sided update-boundary
checks. Fault traces separately inject late delivery and absent render callbacks.

One late snapshot makes the locked train/camera move backwards. A short render
gap preserves train target interpolation but shared smoothed follow runs 4.728px
ahead of uninterrupted camera execution: catch-up follows the newest remote target
repeatedly. Local player catch-up produces intermediate targets and passes the
same short-gap control. A long gap separately drops local simulation debt and
misphases remote presentation. No runtime change or jump work in this checkpoint.

Next implementation order: establish shared explicit-time remote sampling and
camera recovery using these basic contracts; preserve passing local prediction
controls; define long-pause behavior and test authority debt/reconciliation before
returning to supported passengers. Keep jump momentum as a later independent fix.

Checks: three repository typechecks plus standalone CLI typecheck pass; 198 unit
files / 1,647 ordinary passes / 11 expected failures; lint passes with existing
118 warnings / 34 infos. Twenty-eight complete numeric traces repeat exactly;
direct continuity CLI remains intentionally red. Tests/docs only: no runtime,
integration, asset or browser change.

### Shared presentation implementation

Authorized follow-up implements pure `PresentationTimeline` sampling/monotonic
clock and `CameraFollow` linear-target exponential integration. RemoteStateView
owns bounded remote history and render-only pose borrowing; PlayScene and the
embedded host share those outputs. Local walking remains predicted, with sampled
support motion added only for display. Ground camera uses admitted input time;
remote supported motion uses presentation time. Physics/replay owners are unchanged.

All eleven expected failures are ordinary regressions, unchanged oracle tolerances;
both continuity CLIs pass with exact repeated traces. The previous 4.728px short-gap
camera error falls below 0.000002px; remote late delivery/long-pause controls have
no backwards frames. Long local simulation debt remains intentionally bounded.
[Evidence and limits](../research/camera-basics-reproductions.md#shared-presentation-fix)
record the 50ms buffer, 100ms extrapolation/hold, reset and clock-domain behavior.
Inventories/build are refreshed; final browser/streaming verification follows.


Verification completed for the scoped basic-motion fix: all three typechecks,
200 unit files / 1,670 tests, lint, refreshed inventories/build, both deterministic
continuity CLIs and streaming readiness pass. The settled accessor build passes
34/34 affected browser cases; the final epoch build passes 12/12 affected lifecycle
cases, including real editor/play switching and Canvas/GPU embedded hosts.
Opaque epoch identities fix a separately reproduced predictor-replacement camera
freeze without adding a global clock or changing physics.

Native GPU straight-motion captures at approximately 120Hz pass roof/cadence/
presentation assertions at 60Hz and 60→30→60Hz. Maximum steady camera-step errors
are 0.000288px / 0.000242px, with no backwards frames or large screen skips. An
earlier mixed-rate attempt misses the separate 30Hz consumed-cadence tolerance
while presentation passes; the evidence preserves it alongside the passing repeat.
[Final integration/native evidence and reruns](../research/camera-basics-reproductions.md#integration-and-native-refresh-verification)
record measurement timestamps, startup exclusions and limitations. Next work is
explicit authority-debt, varying motion and reconciliation cases, then separate
airborne momentum; no new claim about arbitrary server/GC stalls.

### Airborne support momentum (2026-10-06)

User playtest confirms the camera jitter is fixed, including riding trains. The
next authorized change preserves departure momentum while retaining the preferred
platformer air-control option. World XY velocity remains the total velocity used
by collision/integration. Two optional replicated airborne momentum components
identify the departure platform contribution; platformer friction/acceleration
operate on the remaining controlled component. Quake air control continues to
operate on total velocity. No air drag/swimming model is introduced.

Departure samples platform velocity once on jump or walk-off. Subsequent platform
braking/turning does not influence the airborne player. Landing converts total
world velocity to velocity relative to the new moving roof, then clears the
inherited components; ordinary ground retains total velocity for existing friction.
Wall blocking clips both the blocked total velocity and passive component, so
momentum cannot reappear after obstruction. Noclip, teleports/respawn, mounting
and realm/lab resets clear the airborne state. Save/reload and prediction replay
must retain it during a real airborne flight. Existing ordinary ground/air controls,
roof colliders, jump height and immutable art remain unchanged.

First checkpoint adds native-carriage pure full-flight contracts at 30/60Hz:
idle momentum in either travel direction, direction reversal/release, departed
platform direction changes, forward/backward gap landings, landing/rejump without
stacking, and blocked/tangential motion. Positive invariants initially use explicit
expected-failure tests. Stationary-platform and Quake-air controls stay ordinary
passing tests. Next implement shared state/replication and promote these contracts,
then verify authority/prediction and actual game/lab consumers, including existing
60/120Hz presentation controls.

Shared movement now records optional `airMomentumX/Y` on departure, keeps total
velocity for integration, and excludes the passive contribution only while applying
platformer air controls. Quake control continues to use total velocity. Both
command movement and missing-command authority friction preserve passive motion;
both collision paths clip blocked components. Landing conversion also covers a
jump buffered through touchdown. State roundtrips through entity baseline/delta
binary masks (two spare optional bits), cloning, replay and airborne saves, with
explicit removal on landing/reset/travel/mount/noclip. Endpoints must use the same
build, as with the existing binary frame protocol.

A display-only regression additionally reproduced a 9.6px departure jump from the
50ms buffered train pose to current physics position. Prediction now retains the
sampled support/display translation through flight; ordinary ground landing releases
it over the existing 60ms presentation response, and a new sampled roof takes over
on roof landing. This never translates physics/collision data. Predictor resets,
large relocations and noclip/mounting clear that display state. Unknown changing
platform motion still has the previously documented presentation limits.

Focused checks pass 64 tests, including native Realm/car/train replay at 30/60Hz
from one-tick-delayed batched binary frames. Replay has an outstanding command;
roof landings compare support-relative offsets rather than mismatched world clocks.
The separate real save/reopen/explicit-travel test passes. New regressions include
walk-off, buffered landing jump, ceiling contact, noclip and display/physics ownership.
All three typechecks pass. Full validation and ordinary-keyboard Worker jump
captures follow on a settled source/build checkpoint.

The first native GPU approximately-120Hz / 60Hz authority run passes two keyboard
flights: forward gap landing on the next roof and an idle→forward→backward midair
steering sequence. The 30Hz Canvas lane preserves physical momentum and reaches
the next roof, but exposes an existing jump replay latch fault: an unacknowledged
predicted takeoff is suppressed when an older grounded acknowledgement is replayed
using the already-consumed latest jump-button state. It returns on authoritative
confirmation, introducing ~12.5px of display motion beyond expected travel.

A focused regression fails before the correction. Player snapshots now carry
`jumpInputState` (consumed/held bits), and reconciliation restores that acknowledged
latch before replay. Direct/reference callers without the replicated field restore
the first pending command's stored pre-input latch. Repeated reconciliation can
neither suppress the pending takeoff nor add carrier velocity twice. Binary baseline,
delta and null-removal checks include the final spare delta-mask bit; max buffer
sizes account for all added fields. Focused predictor/codec/native-replay tests and
all three typechecks pass; native 30Hz is rerun without changing tolerances.

The final review adds a small scripted-midair-relocation display-state check and
removes new non-null assertions from codec writes. On settled inventories, all
three typechecks, 202 unit files / 1,696 tests, lint (the existing 118 warnings /
34 infos), build and both basic/idle-rider continuity CLIs pass. The full-flight
`--assert-momentum` CLI passes; native authority idle train velocity survives at
192px/s, forward flight settles to 256px/s, and car flight retains 36px/s. Inventories
refresh source/interactive fingerprints; immutable art banks are untouched.
Affected browser consumers and streaming readiness follow on the final build.


Final airborne checkpoint is verified: 202 unit files / 1,696 tests, all three
typechecks, existing-only lint diagnostics, refreshed inventories/build, basic and
idle-rider continuity CLIs, full-flight momentum CLI, 36 affected game/lab/Worker/
phone Canvas/GPU browser checks and streaming readiness all pass. Native GPU 60Hz
and Canvas 30Hz keyboard flights at approximately 120Hz both cross onto the next
carriage and preserve forward/backward midair steering. The failed pre-latch 30Hz
record remains in the evidence; takeoff excess falls from ~12.5px to ~1.1px in that
lane without loosening acceptance. No source/build mutation during browser runs.
[Movement contract, reruns and final evidence](../research/airborne-support-momentum.md)
record defaults, replay/reset boundaries and remaining limits. Next is human
jump-distance/steering feedback, then explicit varying-motion/authority-debt cases;
water/air drag and service tickets remain separate future work.

## Reload pacing reproduction (2026-10-06)

The new [reload pacing evidence](../research/train-refresh-pacing.md) reproduces
native GPU approximately-120Hz train/rider stepping after normal saved-world
refresh. All 600 settled reload steps exceed 0.1px error (max 1.806px), versus
~0.002px before reload and after an isolated production clock reset. Nine pure
controls include four expected failures before runtime edits. Clock creation
before the first snapshot and permanently retained forward source debt are
isolated; the browser reset control does not claim native visibility recovery.
Next: snapshot-anchored startup and bounded monotonic exhaustion/burst recovery
in the shared game/lab sampler, then repeat the existing controls and native lane.

The shared sampler now waits for its first snapshot before starting the source
clock. Exhaustion rebases unreachable forward debt without rewinding; a separate
large-delivery-burst recovery avoids falling permanently behind pruned history.
All nine startup regressions and two additional pure clock contracts pass, as do
91 focused game/lab tests, all three typechecks and both continuous-presentation
CLIs. Camera response, movement/momentum and authority clocks remain unchanged.

Final reload checkpoint: all three typechecks, 203 unit files / 1,707 passing
checks, existing-only lint diagnostics, refreshed inventories/build, both
headless continuity CLIs, 36 affected Canvas/GPU game/lab/Worker browser checks
and streaming readiness pass. Native approximately-120Hz saved refresh reduces
train/rider maximum cruise step error from 1.806px to 0.001856px at 60Hz and
0.000731px at 30Hz; zero bad steps and zero roof-offset range in both. The 30Hz
lane requests the rate again after reopen and verifies advertised metadata.
One initial keyboard-boarding setup failed before capture; unchanged rerun passed.
No runtime/build changes occur during these browser runs. Evidence and remaining
native-visibility/longer-stall limits are in the linked reload record. Next is the
user's exact refresh/background playtest, then varying-motion/stall acceptance.

## Idle roof-jump follow-up (2026-10-07)

[Idle jump evidence](../research/idle-support-jump.md) preserves six expected
failures and a native 60Hz / approximately-120Hz keyboard capture. Input batches
and no-input fallback double-count passive flight; input landing then roof carry
also advances twice; buffered train versus local-flight display introduces an
additional small offset. Prior velocity/gap checks did not detect relative drift.
Next isolate uneven delivery and correct authority passive-time admission,
landing carry eligibility and source-time passive presentation in shared owners.

The shared correction admits inherited XY once per authority interval and excludes
input-landed riders from the next service carry phase. Timestamped prediction
endpoints let passive display motion use the carrier source clock while voluntary
steering stays local. Future landing offsets convert to the committed roof frame.
Ten new regressions and 104 focused controls pass; all three typechecks pass.
Native idle/steering flights and full game/lab validation follow before acceptance.

Native follow-up finds zero physical landing drift but a ~3.2px display dip while
older grounded acknowledgements replay takeoff. Two further delayed-snapshot
cases reproduce ~3.2px / 6.4px before correction. Contact-error decay now removes
expected passive source-time travel, retaining genuine residual correction.
Twelve idle positional regressions and all 1,719 unit checks, typechecks, lint and
settled inventory/build pass. Final native flight and browser/readiness evidence
still follows in the linked record.

Final idle-jump checkpoint: native 120Hz GPU/60Hz and Canvas/30Hz idle flights
land with zero relative drift and display error below 0.003px. Next-carriage and
midair-reversal controls pass at both rates. All 1,719 units, three typechecks,
existing-only lint diagnostics, refreshed inventories/build, 36 affected
Canvas/GPU game/lab/Worker browser checks and streaming readiness pass. Native
and integration runs use fixed runtime/build; owned bundled browsers and servers
are reaped. A 0.164px acceleration-boundary display case is retained as a varying
trajectory limit. Next: repeat the user's idle-jump playtest, then address varying
trajectories/long stalls under a separate positional acceptance scope.
