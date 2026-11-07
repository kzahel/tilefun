# Shared-physics dump bed

Status: delivered and qualified locally; ready for owner play review.
Owner request, 2026-11-07: bring the dump bed back after the physics reset.
Owners: [vehicles](../topics/vehicles.md), [physics engine](../topics/physics-engine.md).

Reset 205 retired the tipping bed, cargo and bed-rider services from 164, 165 and 167:
they posed bodies with their own collision, carry and slide solvers. 219 recorded that
restoring them needs articulated collision and authority in the shared world. This
slice restores the dump bed only. Towing, transporters and parking services stay
deferred.

## Delivered

- **Hollow body.** The dump truck's chassis collider is one Rapier compound of the
  existing 13 authored convex parts (`traffic/DumpBed.ts`, unchanged source
  geometry): floor, side walls, front wall, tailgate, cab, chassis and tyre clips.
  People and loose cargo rest on the recessed floor (21.7px), not the 49px roof
  box. Explicit mass properties keep the ordinary chassis box's mass distribution,
  so raising the tub does not move the centre of mass or change driving.
- **Scene-owned clock.** `PhysicsBodyState` carries `bedTilt`/`bedTarget`. Each
  fixed step, a stopped truck moves toward its target at 48° in 3.2s, recompiling
  the compound with the pitched tub and the automatically opening tailgate. If
  static terrain or props would intersect the moving parts, that step is skipped;
  the bed resumes once clear. Riders and cargo are pushed by ordinary contacts.
  Driving is locked (zero drive/steer intent) while the bed is raised or moving.
  Authority and replay run the same code (`physics/DumpBedBody.ts`).
- **Wire and saves.** The numerical vehicle segment gains both angles (frame tag
  `0x15`; host and guests must reload together). Entity fields `vehicleBedTilt`
  and `vehicleBedTarget` replicate (bits 18/19, golden wire digests regenerated)
  and saved vehicles store `bed: [tilt, target]`. A mid-tip reload resumes.
- **Rider carry through turns.** Riders now inherit the chassis velocity at their
  own position, including its rotation, instead of only the centre's linear
  velocity. Before, a bed rider kept its world offset while the truck turned and
  slid towards a wall. This applies to every chassis roof rider.
- **Cargo kept in the bed.** Unowned balls no longer start the 3s resting despawn
  while supported by a dump truck; ordinary cleanup resumes after discharge.
- **Request and controls.** `vehicle-bed` (`tip`/`lower`) goes through GameServer
  and ScenarioSession to `server/DumpBedControl.ts`. Allowed for the cab driver,
  or a grounded, unmounted person beside or inside the bed (32px, 64px vertical),
  when the truck is stopped and upright and nobody else is driving. A tipped
  generated traffic truck parks. The contextual equipment button (Right car / Tip
  bed / Lower bed) shares F, D-pad down and touch in the game and embedded labs.
- **Presentation.** The existing v2 mesh rig and Canvas fallback receive tilt and
  gate angles. Players and carryables inside the tub are grouped with the truck
  again, so GPU contents depth-test against the tub triangles and fallbacks clip
  against the physical parts. No art changed.
- **Lab.** World geometry → `car-dynamics`, start **bed**: three balls in a parked
  dump truck, with the player beside it. The `geometry:truck-bed-v2` Workshop
  candidate now opens this scene instead of the deferred page.

The old scripted *Ride in bed / Climb out / Load / Unload* teleports are not
restored. With a real hollow body, people use the existing near-roof jump assist
to climb in, and cargo is thrown or carried in. Tipping people stay upright and
can jump out; they are not seated passengers.

## Validation

- Native: `physics/DumpBed.test.ts` covers floor support for a person and a ball,
  carry through drive/turn/brake, tipping with the drive lock and discharge
  through the open tailgate, lowering, a low ceiling stopping and resuming the
  bed, and binary round-trip replay mid-tip matching authority.
  `server/VehicleControl.test.ts` covers the requests, distance guard,
  reload mid-tip, driver lock, lowering and the moving guard.
  `scenarios/VehicleDynamicsRecipe.test.ts` covers cargo lasting past ordinary
  cleanup, then discharging.
- Full native suite: 377 files, 4,649 tests pass. All typechecks, Biome on the
  changed files (existing warnings only), knip, art catalog and Workshop manifest
  (2,121 identities verified in Chromium) and the production build pass.
- Browser (production build, GPU meshes): all five `tests/vehicle-geometry.spec.ts`
  cases pass, including the new dump-bed case. It checks that the cargo is
  grouped with the bed, F tips the bed through the Worker, all three balls leave
  the tub, and the touch Lower bed button returns it to level.
- Code-health ratchet: PhysicsScene, VehicleRegistry, the UI and the scenario
  files shrank (bed, rail and support-motion code moved into modules). Accepted
  small line growth in GameServer (+3, the request handler), physicsStateCodec
  (+11), BallGameplay (+14) and WorldGeometryPage (+2).

Not measured: phone or Chromebook frame cost of a loaded, tipping truck, and
streaming readiness (no streaming/execution change). A parked truck creeps about
4px while a rider stands in a tipping bed, because the rider's normal force
pushes the truck. Repeated forward/back rotation in tight turns drifts riders a
few pixels outward, but they stay inside the walls.

## Next

Owner play review of climbing in, riding and tipping. Then consider a second
qualified open bed (pickups) or crates/pallets, reusing `DumpBedBody`'s
pattern: posed convex parts, a scene-owned clock and static-only obstruction.
