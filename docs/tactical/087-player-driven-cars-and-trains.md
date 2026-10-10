# Player-driven cars and trains

Status: complete (2026-10-10).
Owner request: 2026-10-10. [Vehicles](../topics/vehicles.md) and
[trains](../topics/trains.md) own continuing runtime status.

## Accepted behavior

The owner chose hidden inside drivers with visible passive roof passengers,
explicit nearby boarding, direct diagonal car movement and forward/back trains.
The owner rejected disappearing abandoned cars: an off-road car remains parked
and saved. NPC drivers exiting to wander, and nearby NPCs adopting empty cars,
remain future work; there are no visible NPC driver exchanges in this slice.

- **Drive car / Drive train · E** appears beside an available stopped vehicle.
  Touch and E request the same authoritative boarding action; walking nearby or
  landing on the roof never grants control. One player owns the car or complete
  train service. The character disappears only after successful boarding.
- **Get out · E** brakes immediately and searches supported clear ground beside
  the body. A blocked exit retains the seat and explains why. Jump, throw and
  sprint are disabled inside; ordinary roof riders keep walking/jumping.
- Cars use normalized directional input, gentle acceleration, quick braking,
  and native four-view facing with diagonal hysteresis. They can cross clear dry
  ground, including grass, while retaining full-body collision, slope limits,
  ready-terrain checks and roof-passenger headroom. No collision damage.
- Tap-mode cars drive directly toward a world target, slowing near arrival and
  stopping at obstacles. No pathfinding or automatic boarding. Touch/desktop
  taps use the captured presented view rather than a moving camera projection.
- Trains move along their existing straight/curved alignment. Up/right selects
  increasing path distance; down/left selects decreasing distance. Release brakes;
  reversing brakes to zero first. Tap the right/left canvas half to latch travel
  in that direction; repeat the same side to stop. This side meaning stays fixed
  through bends. Open route ends stop; authored loops keep circulating.
- Exit on a usable generated road resumes car traffic through a short checked
  connector at the actual position. No snap back to a lane. Otherwise the car
  stays parked and persists across unloading/reopening. There is no deletion or
  automatic off-road recovery. Train exit resumes its service after eight seconds.

## Implementation boundaries

`Realm.vehicles` grants/releases the seat, validates range and availability,
clears pending movement, disables the hidden occupant's walking collider, and
keeps the player/camera attached to the controlled body. Ordinary replicated
parent/mount identity carries occupancy; saved seats reference procedural vehicle
identity separately from animal mounts and passive roof support.

`Driving.drivenCarPose` is shared by authority and car prediction. Traffic owns
manual pose commits and passenger carry; controlled/parked cars skip its AI loop.
Lane progress, parking/facing and temporary rejoin paths persist in traffic records.
Railway owners interpret manual input at whole-service level while retaining
native carriage clearance, ready-track checks and roof carry. Train presentation
and the inside camera sample the authoritative displayed carriage together.

The game and embedded Traffic/World geometry labs share the prompt, Realm service,
scenario commands and client predictor. Scene reload resets prediction with the
actual occupied parent. The shared collector hides inside occupants on Canvas
and GPU, while leaving roof riders visible. No approved vehicle bounds, pixels or
immutable asset banks changed. Interactive recipe identities are regenerated
through the existing catalog/manifest workflow; no human approval is fabricated.

Menu/focus and occupied-mode changes clear walking/tap/latch input. A short stale
input watchdog brakes. Disconnect, edit mode, deletion, teleport and realm travel
release ownership; explicit travel does not restore the old vehicle seat at the
new destination. Reload restores the seat when its saved vehicle is available;
otherwise it checks an on-foot fallback beside the saved exit, including when
another player has claimed the service. Forced lifecycle release can
fall back to the last safe walking position when all adjacent exits are obstructed.

## Evidence

`VehicleControl.test.ts` covers exclusive boarding, shared prediction, visible
roof passengers and hidden drivers, normalized diagonal off-road driving,
blocked motion/exits, parent deletion, saved inside seats, persistent parked
cars, saved seats that are missing/already claimed, whole-service motion through
a bend, reload, hard route-end stopping/reversal and train tap toggling.

`vehicle-driving.spec.ts` exercises real Worker game boarding, tap destinations,
inside-seat reopening and exits, and train side-tap start/stop/reversal with
menu input isolation on bundled Chromium mobile Canvas/GPU.

Validation on 2026-10-10:

- Typecheck and production build pass. A separate export of the staged tree also
  passes the production build and generated inventory checks, excluding unrelated
  worktree edits from the commit's asset identities.
- All **2,141 unit tests in 226 files** pass. The long train journey uses a
  15-second test budget to allow its 2,180 deterministic simulation steps under
  complete-suite contention; its route, reload and terminal assertions stay intact.
- All four focused phone driving checks pass on Canvas/GPU. Captures:
  [car](/tmp/tilefun-driving-car-gpu.png),
  [train](/tmp/tilefun-driving-train-gpu.png).
- Changed-source lint passes with four existing Realm non-null warnings. Full
  `npm run check` reports an existing formatting error in the unrelated
  `docs/benchmarks/088-predicted-animation.json`; no diagnostic was introduced.
- Catalog/manifest regeneration verifies all 761 identities in bundled full
  Chromium at retina scale. Frozen banks remain unchanged.
- `npm run streaming:bench -- --assert-ready` passes its readiness scenarios.
- Complete worktree browser run: **518/520**. The two failures were walking
  fullscreen-tap destination equality checks: train-only `screenSide` metadata
  had been added to ordinary walking targets. Restricting it to occupied trains
  fixes that contract; unchanged assertions pass on Canvas/GPU in the staged
  export. All four driving tests also pass within the full run and staged export.
- The complete affected walking/driving run from the staged tree passes **15/16**;
  the profile-switch/storage-failure walking check misses its short-lived target.
  Its unchanged isolated retry passes (**1/1**), as did the complete worktree run.
  Retain this timing evidence; no profile behavior or assertion was changed.
  [Full browser log](/tmp/tilefun-driving-browser-full.log),
  [staged affected checks](/tmp/tilefun-driving-staged-browser.log),
  [profile retry](/tmp/tilefun-driving-staged-retry.log).

## Next work

Playtest entering, finding the exit action and train side taps with the child.
Tune acceleration/arrival/facing only from that feedback, then consider visible
NPC driver exchange and parked-car adoption. Generated loops, dispatch, switches,
ordinary passenger seats and off-road route recovery remain separate work.
