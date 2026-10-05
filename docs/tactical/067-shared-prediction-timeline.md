# Shared prediction time, moving contacts and supports

Topic: player-prediction
Status: implementation and validation complete; human playtest next, 2026-10-05.

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
