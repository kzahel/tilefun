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
