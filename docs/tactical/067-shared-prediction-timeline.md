# Shared prediction time, moving contacts and supports

Topic: player-prediction
Status: authorized for implementation, 2026-10-05.

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
