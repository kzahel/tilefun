# Camera basics before moving passengers

Reproduction checkpoint, 2026-10-05. [Player prediction](../topics/player-prediction.md)
owns current status; [Tactical 067](../tactical/067-shared-prediction-timeline.md)
owns execution. The user requested elementary camera/motion cases before more
passenger or jump changes. No runtime behavior changes in this checkpoint.

## Four fixtures, explicit clocks

`scripts/instrumentation/camera-basics-case.ts` runs four rider-free fixtures:

1. Remote train at 192px/s, camera locked exactly to its displayed pose.
2. Same train, ordinary shared follow smoothing.
3. Locally predicted player at 768px/s, ordinary collision and follow.
4. Same player with the predictor's actual noclip path enabled.

The train lock matches the existing ScenarioPresentationHost diagnostic camera
callback contract. It does not instantiate that host or add a gameplay UI mode.
Train snapshots are analytic data passed through production binary codec and
RemoteStateView; player motion uses real PlayerPredictor/shared movement over
resident flat grass. GameLoop, PlayerPresentation, Camera and projection are
production code. Player velocity starts at the requested speed; held right input
sustains it. Input dt uses real wire quantization, producing effective speeds
767.9232px/s at 30Hz and 768.1536px/s at 60Hz, measured separately from jitter.
Terrain covers the entire trip and collider footprint so unloaded boundaries
cannot masquerade as a timing fault.

There is no rider, jump, NPC, Realm, generation service, renderer, browser,
ambient clock driving motion, streaming work or player reconciliation in these fixtures.
Local predicted movement deliberately isolates its own camera/loop before
introducing reconciliation. Remote replica internals retain ordinary bookkeeping;
the numeric outputs use only explicitly supplied times.

Controls run at 30/60Hz simulation × 60/120Hz rendering. Faults run at 60/120Hz:
one ordered snapshot 10ms late, a 100ms ordered delivery gap, and absent render
callbacks for 100ms or 600ms. Delivery faults apply only to remote trains.
These are four fixtures / 28 lightweight rate-delivery traces, not a roster of
gameplay scenes. Full traces repeat exactly. Eight additional unit parameter
checks sample immediately before/after ordinary update boundaries (±0.001ms),
which regular-frame samples could otherwise miss.

## What continuity means here

Each target step is checked against known speed × **actual elapsed time**.
Withheld renders are also compared against uninterrupted execution at the same
timestamp. Missing frames naturally produce larger steps; that is not alone a
failure. We record world pose, camera pose, subject screen pose and the screen
pose of a stationary landmark. A perfectly centered train can conceal backwards
camera motion unless the surrounding world is measured too.

We measure both value continuity near fixed update boundaries and recovery after
schedule disturbances. These do not assert perfectly constant camera velocity:
the existing follow filter has startup lag and small sub-tick speed variation.
For example the fast-player 60/120Hz control has up to 0.0884px camera-step error
against constant speed, even though target motion is exact. A future pure camera
contract should decide and test its filter response independently.

## Results before fixes

All on-time target controls follow the speed oracle within 0.00005 world pixels;
ordinary camera and target one-sided boundary checks pass within 0.01px.
No on-time target/camera moves backwards. Grounded and noclip player traces agree
exactly on this obstacle-free terrain.

Selected 60Hz simulation / 120Hz presentation results:

| Fixture / disturbance | Maximum target deviation from uninterrupted run | Maximum camera deviation | Observation |
| --- | ---: | ---: | --- |
| Locked train / one snapshot 10ms late | 3.200px | 3.200px | One backwards target/camera frame; train remains centered |
| Locked train / 100ms delivery gap | 19.200px | 19.200px | Six backwards target/camera frames |
| Locked train / 100ms render gap | <0.00005px | <0.00005px | Correct recovery at equal time |
| Smoothed train / 100ms render gap | <0.00005px | 4.728px | Camera error creates 14.183px subject screen deviation |
| Player, grounded or noclip / 100ms render gap | <0.00005px | <0.00005px | Same result as uninterrupted execution |
| Locked train / 600ms render gap | 1.600px | 1.600px | One backwards frame after resume |
| Player, grounded or noclip / 600ms render gap | 275.255px | 275.332px | Catch-up cap discards elapsed simulation time |

The nominal 100ms missing-render window produces a 108.333ms gap between actual
samples. At 192px/s, the locked train advances 20.8px across that gap, as it should.
The smoothed camera advances 25.545px instead of the uninterrupted camera's
20.818px. Target interpolation itself is correct in this case.

### Two short-gap faults, before a rider exists

**Late snapshot:** local GameLoop alpha resets independently of snapshot arrival.
Old replica endpoints are sampled again, causing backwards travel; later ordered
frames advance the endpoints together. Locking the camera to that pose faithfully
reproduces its backwards motion. This is the earlier rider reproduction's fault
with the passenger removed.

**Smoothed train after a render gap:** the first catch-up update consumes seven
queued authority frames through the newest train pose. All seven local catch-up
updates then follow that same newest target, rather than the train positions at
each historical update. The camera gets too far forward. Locally predicted player
updates instead produce successive intermediate positions, and their camera
matches uninterrupted execution. This identifies a separate fixed-update camera
target timing problem; changing only render interpolation does not prove it fixed.

### Long pauses require an explicit contract

The 600ms window produces a 608.333ms callback gap. GameLoop admits at most 250ms,
discarding 358.333ms of simulation time. The fast local player stays 275.255px
behind the uninterrupted run; that loss does not heal by continuing to walk.
This is existing catch-up policy, not a new interpolation defect or an inevitable
property of camera rendering. Authority reconciliation is deliberately absent here.

The remote train's snapshots continue advancing throughout that pause. Its local
alpha phase no longer matches that remote history after capped catch-up, yielding
a backwards frame on resume. Its presentation needs a remote time contract even
if local simulation retains its bounded catch-up policy.

A delivery gap models missing *information*, not a server dropping simulation
time. A render gap models absent callbacks, not measured GC allocation or an OS
stall. Actual authority stalls that drop debt, visibility resume, rate switches,
teleports and player reconciliation remain subsequent distinct cases. No claim
that arbitrary stalls can be visually hidden, or that these numerical passes
establish GPU, pixel rounding, window scheduling or real streaming performance.

## Commands and next step

```sh
npx tsx scripts/instrumentation/camera-basics.ts --output=/tmp/camera-basics-baseline.json
# Intentionally red until shared presentation/camera recovery is fixed.
npx tsx scripts/instrumentation/camera-basics.ts --assert-continuous
npx vitest run src/rendering/CameraBasicsTimeline.test.ts
```

The unit file reports **43 ordinary passes / seven expected failures**, covering
the unmet remote short-gap contracts and backwards motion after a long render
pause. The CLI continuity gate is red; aggregate unit success does not establish
a fix. Promote the expected failures after implementation, preserving oracle
tolerances. Long-pause local simulation debt is characterized separately; the
current CLI does not require it to equal uninterrupted wall-time simulation.

Next: make remote pose sampling and camera advancement explicit in time, using
these rider-free contracts first. The remote sampler must not replay old segments;
the camera must not repeatedly integrate a future target during catch-up. Keep the
passing local prediction/short-pause controls intact. Decide long-pause/resume
policy explicitly, then add authority-debt and reconciliation cases before
returning to a passenger. Jump momentum remains separate and deferred.

Checkpoint validation: all three repository typechecks and strict standalone CLI
typecheck pass. Full units report **198 files / 1,647 ordinary passes / 11 expected
failures** (seven here, four from the earlier passenger presentation fixture).
Lint passes with existing 118 warnings / 34 infos. All 28 complete default-phase
traces repeat exactly, and the direct continuity CLI fails as intended. No runtime,
rendered-pixel or integration changes; no browser/build/inventory run in this
test/doc checkpoint. A simulated render gap is not a measurement of real GC.

## Shared presentation fix

The authorized implementation extracts pure timestamped sampling/clock functions
into `PresentationTimeline` and exact exponential linear-target follow into
`CameraFollow`. Replica-owned `RemotePresentation` retains at most 32 samples per
entity, removes exits and resets segments for large relocations/backwards source
time. The display clock has a 50ms buffer and at most 100ms of linear extrapolation,
then holds. Snapshot arrival does not restart an already displayed segment.
Pause/resume, visibility and replica clear have explicit reset behavior; timeScale
updates rebase the source clock without depending on a 60Hz server interval.

GameLoop passes the actual render timestamp separately from its capped simulation
updates. Both PlayScene and ScenarioPresentationHost borrow display-only remote
and player clones for the full render, including diagnostic fixed cameras, and
release them in `finally`. Physics, serverEntities and collision replay stay on
committed data. Predicted roof walking is interpolated locally and composed with
the sampled carrier. Grounded prediction supplies its admitted input clock to the
camera, so discarded simulation debt does not produce a second camera discontinuity.
Clock-domain transitions preserve camera position; explicit camera snaps reset
follow state. Static untimed reference camera consumers retain their old path.

The camera integrates a moving target in closed form rather than following the
newest remote target repeatedly during fixed catch-up. Its decay rate preserves
the ordinary 60Hz response independently of server/render Hz. For straight motion,
the integration composes across omitted renders, rather than needing to invent
frames that never occurred. The unshaken displayed camera becomes the camera's
post-render position for input/view queries.

All eleven previously expected failures are promoted to ordinary regressions
with the original independent tolerances. Both continuity CLIs now pass and all
complete traces repeat exactly. At 60/120Hz, late-10ms locked-train recovery has
zero world/camera deviation and no backwards frames. The 100ms delivery gap has
only 0.000080px world deviation (Float32 extrapolation noise), no backwards frames.
Smoothed-train 100ms render-gap camera deviation is 0.0000011px instead of 4.728px;
600ms remote render-gap camera deviation is 0.0000027px with no backwards frames.
Fast grounded/noclip short-pause recovery remains identical to uninterrupted
execution. Their long-pause simulation deficit remains 275.255px by existing policy,
but maximum additional subject screen deviation is only 0.00591px.

Pure-function tests cover history bounds, relocation, equal-time replacement,
bounded extrapolation, monotonic clock and camera composition at 30/60/120Hz.
Replica tests check immutable physics ownership, paused resume, exit/re-entry,
clear/relocation and responsive local roof walking. Shared host lifecycle tests
check presentation borrow/release and visibility reset.

Limits: last-segment extrapolation cannot know future braking/turns/collisions.
Stalls beyond the bounded history/lead require hold and may correct on delivery.
Latest replicated heading/native cardinal art and collider policy remain intact.
Authority-debt/variable-speed/reconciliation cases remain further work; the fixed
local simulation catch-up cap is unchanged. This is not a promise to hide arbitrary
GC pauses or a pixel/frame-pacing result. Final browser/streaming checks follow.

The first settled-build browser run passed 32/34 checks; both outdoor geometry
backends exposed a diagnostics ownership mismatch. `playerEntity` must retain its
physics pose even during a render borrow. The follow-up introduces the explicit
`presentedPlayerEntity` accessor for cameras and `host.presentedPlayer` for render
overlays, while leaving physics/diagnostic callers on `playerEntity`. The replica
ownership test asserts that contract during a live borrow. The numeric continuity
fix is unchanged. Inventories/build and final affected consumers are rerun after
this boundary correction; no source changes during the first browser run.

Final lifecycle review reproduced a second reset boundary: separate predictors
both named their local clock `input:1`. Returning from editor mode could restart
input time at zero while the camera still waited on the previous play clock.
A regression first failed on that reused name. Each predictor/reset now allocates
an opaque epoch identity; the camera preserves its position while rebasing time.
The predictor identity and camera restart regressions pass, as do both headless
continuity CLIs, all three typechecks, 200 unit files / 1,670 tests and lint
(existing 118 warnings / 34 infos). Inventories/build are refreshed after this
change. The lifecycle browser rerun is recorded below after execution.
