# Airborne support momentum

2026-10-07 follow-up: [idle roof-jump travel](idle-support-jump.md) adds positional
acceptance through flight and landing. The initial velocity/gap checks missed
uneven-input passive travel, landing double carry and flight display source phase;
the newer record owns their correction and verification.

Implemented 2026-10-06 after the user's playtest confirmed camera jitter was fixed.
[Player prediction](../topics/player-prediction.md) owns current contracts;
[Tactical 067](../tactical/067-shared-prediction-timeline.md) records execution.

## Movement contract

Keep the preferred platformer air steering. Total world XY velocity is the sum
of passive platform departure velocity and controlled movement. At departure
from a 192px/s train, no input retains 192px/s, forward input settles to 256px/s,
and backward input to 128px/s. These are world velocities; the backward player
travels toward the rear relative to the train. The steering contribution retains
existing friction, acceleration and wish-speed settings, not a cap on total speed.
The first forward takeoff can retain 73.6px/s of roof walking under existing ground
surface settings; subsequent ordinary airborne steering settles to 64px/s.

`airMomentumX/Y` are optional replicated velocity components in px/s. A jump or
walk-off adds the departure roof velocity once and records it. Platformer controls
exclude it during friction/acceleration and restore it for integration/collision.
Missing-command authority ticks use the same voluntary-friction policy. Quake air
control still accelerates total velocity and skips ordinary air friction; its
existing option remains intact. No physical air resistance is introduced.

The departed platform can brake, turn or unload without changing the stored
contribution. Ground friction still controls voluntary walking. Roof surface-material
selection remains the existing policy; this work does not add ice/water roof materials.
Landing on a roof subtracts the new roof velocity before resuming relative walking;
ordinary ground retains total velocity for existing friction. Departure state is
cleared, including before a buffered landing jump inherits the new roof velocity.
This prevents repeated jumps from stacking carrier speed. Blocked axes clear both
total and passive components in command and no-command collision paths, while
unblocked axes can slide. Ceiling contact stops ascent without deleting XY motion.

Noclip, mounting, scripted/explicit travel and lab/reset paths clear passive state.
Airborne save/reopen retains total and passive XY motion; old saves without it keep
existing defaults. Binary baseline/delta serialization carries both components and
explicit null removal. Prediction restores them from authority before replay. The
shared binary endpoints must run the same build; no historical wire emulation is
added. Ground/player jump heights and frozen art/collider geometry are unchanged.

## Presentation and jump replay boundaries

Buffered roofs are displayed behind committed authority poses. A focused regression
found a 9.6px takeoff shift when switching directly from that sampled roof to the
current physics player. The initial fix retained the sampled departure translation.
The idle-travel follow-up timestamps simulated endpoints and samples inherited
flight motion on the remote source clock; untimed reference callers keep the
departure-translation fallback. A new sampled roof owns roof-landing presentation;
ordinary ground landing releases translation over 60ms. Physics poses never
receive this display offset. Reset, noclip/mount and large relocations clear it.

The first 30Hz native run then exposed a separate pre-existing replay bug: an older
grounded acknowledgement replayed a pending jump with the latest already-consumed
jump-button latch. The player temporarily returned to the roof and jumped again
when the authoritative takeoff arrived, adding approximately 12.5px of display travel.
`jumpInputState` now replicates the authority's consumed/held bits. Reconciliation
restores that acknowledged state before pending commands; direct/reference consumers
without it use the first pending command's stored pre-input latch. Repeated replay
neither suppresses a pending takeoff nor inherits platform velocity twice. The last
spare delta mask bit and buffer sizing have explicit codec coverage.

## Reproduction and evidence

Before runtime changes, native-carriage positive contracts report two ordinary
controls and eleven explicit expected failures. After implementation they are
ordinary passes. Cases at 30/60Hz cover full idle flight in both train directions,
steering reversal/release, departure-platform velocity changes, same/next-roof
landing and re-jump, forward/backward native carriage gaps, walls/tangential motion,
walk-offs, buffered landing jump, ceiling and noclip. Quake and stationary-surface
controls preserve existing behavior.

Native Realm car/train cases at 30/60Hz delay/batch binary snapshots with a pending
command at reconciliation, including takeoff, midair reversal and landing. Compare
world pose in flight and support-relative offsets on landing: the replica's newest
roof and authority's newer roof occupy different world times. Airborne save/reopen
and explicit travel test state persistence/removal. Display borrowing tests distinguish
physics and sampled takeoff poses and reproduce the jump-latch regression directly.
Existing basic camera/idle-rider 60/120Hz controls remain required.

The command-driven browser probe boards through ordinary keyboard input in a fresh
seed-2026 Worker world, walks toward the roof edge, jumps forward to the next roof,
then makes an idle→forward→backward second jump. Bundled full Chromium runs headed
on this machine's native approximately-120Hz display. No position/physics overrides
are used. Sources remain fixed during each run; browser/server/data are isolated
and browser/server are reaped afterward.

| Final lane (`818d83d`) | Measured display Hz | First landing | Second flight velocity range | Max inherited velocity error | Takeoff step error, first / second |
| --- | ---: | --- | --- | ---: | --- |
| GPU / 60Hz authority | 120.0021 | Next roof | 128–256px/s | 0px/s | 0.0011 / 0.4550px |
| Canvas / 30Hz authority | 120.0113 | Next roof | 128–256px/s | 0px/s | 1.0907 / 1.1102px |

Both flights in both lanes land at roof height 44 and produce no page errors.
The earlier failing Canvas record is preserved as the pre-latch boundary, not
replaced by a claim that all native presentation errors are zero. The probe requires
at least 20 airborne samples per flight, preserved departure velocity, both steering
directions on the second flight, a different roof on the first landing and takeoff
step error ≤3.5px. Motion deltas use actual GameLoop/rAF timestamps; server-airborne
frames locate the observed boundary and are not guaranteed to be the first predicted
airborne frame. Pure tests separately assert the actual prediction boundary.

```sh
npx vitest run src/physics/AirborneMomentum.test.ts src/client/AirborneMomentumReplication.test.ts src/client/MovingSupportPrediction.test.ts
npx tsx scripts/instrumentation/roof-camera-jump.ts --assert-momentum --output=/tmp/airborne-momentum.json
node scripts/instrumentation/train-roof-browser.mjs --renderer=gpu --headed --server-hz=60 --jump-momentum --output=/tmp/airborne-native-60.json
node scripts/instrumentation/train-roof-browser.mjs --renderer=canvas --headed --server-hz=30 --jump-momentum --output=/tmp/airborne-native-30.json
```

The older `--assert-baseline` deliberately checks the historical momentum-loss
contract and is no longer the current acceptance command. Its camera lanes retain
historical untimed presentation for comparison; the current camera/presentation
CLIs exercise the shared timestamped owner.

## Final verification

The settled `666d65c` engine/build checkpoint passes all three typechecks, 202 unit
files / **1,696 tests**, lint (existing 118 warnings / 34 infos), refreshed catalogs/
manifest and build. Both basic camera and idle-rider `--assert-continuous` CLIs pass;
the full-flight `--assert-momentum` CLI passes. Unit execution uses settled
inventories rather than overlapping their regeneration.

All **36 affected Playwright checks pass** on the final build, using isolated auth/
data and bundled Chromium (full Chromium for GPU): generated city train boarding,
ride/reopen/alight and phone lab, curved trains, Worker persistence/pause, standalone
Workshop, lifecycle and real edit/play switching, Traffic, Character, Furniture,
Outdoor, Train/Vehicle and World Geometry on Canvas/GPU. Sources/build stay fixed
throughout the browser run. `streaming:bench -- --assert-ready` also passes afterward;
its readiness gate is not a universal FPS claim. Native jump captures above are
from `818d83d`; the final extra engine change clears stale presentation after a
scripted relocation and removes newly introduced codec lint assertions, with
unit coverage. Normal keyboard flight logic is unchanged from those captures.

Runtime commits: `27acbb5` shared airborne movement/presentation, `818d83d` jump
latch replay, `666d65c` scripted relocation cleanup. `d3053ec` preserves the initial
full-flight reproduction checkpoint. Frozen/promoted art and approval snapshots
are untouched; source references and interactive engine fingerprints refresh in
normal generated inventories. No new medium forces, AI rollback or ticket service.

## Limits and next work

This implements platform departure momentum with the existing arcade steering,
not general physical inertia for every impulse or preservation of ordinary running
momentum. Unknown varying-speed/rotating-platform presentation and extended
server debt retain existing limits; this is not a universal GC/frame-pacing proof.
Air/water drag, swimming, currents, buoyancy and lifting-platform vertical/tangential
velocity are future decisions. Neither medium forces nor train lifetime/map tickets
are introduced here. Next human playtest should check forward/backward carriage
jumps and steering feel; further deterministic cases can cover changing platform
motion and long authority debt without weakening the basic controls.
