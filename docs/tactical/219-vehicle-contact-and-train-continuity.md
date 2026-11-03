# Vehicle contact, train continuity and speedway stutter

Status: in progress. Owner feedback 2026-11-03.
Owners: [vehicles](../topics/vehicles.md), [trains](../topics/trains.md),
[player prediction](../topics/player-prediction.md), [performance](../topics/performance.md).

## Scope

Investigate missing dump-truck controls, repeated contact-induced car hopping,
separating carriages while riding and lost support velocity during jumps, plus
phone movement stutter near the generated speedway. Use the ordinary shared
Realm/physics/prediction/presentation owners and existing approved art.

1. Native reproduction and bounded regression for chassis contact settling;
   retain dynamic pushing, suspension, ramps and tumbling.
2. Preserve takeoff support velocity through airborne ticks and binary replay;
   never continue accelerating a detached rider with its former support.
3. Keep every member of a prescribed consist on the same presentation timeline
   and correction, including carriages outside immediate player proximity.
4. Exercise the real generated racetrack with authority/main-thread timings,
   identify any reproduced bottleneck, and record device evidence limits.
5. Qualify the affected native, wire and real Worker/rendering boundaries, commit
   checkpoints and mark playable changes ready for owner review.

Dump/tailgate, cargo, towing and transporter controls were explicitly retired by
205; only render rigs remain. Do not expose decorative action buttons without
matching shared-world articulated collision and safe loading/unloading. Restoring
those mechanisms is a separate implementation slice, not a hidden legacy solver.

## Reproductions and repairs

- An ordinary player walks from 100px away into a parked compact car, then releases.
  Before: chassis root ranges roughly -5.29 to +1.85px. Removing the custom manual
  sleep shortcut reduces the same run to about 0.14px total vertical excursion;
  side pushing still works and the car sleeps naturally afterward. The removed
  shortcut discarded spring impulses and zeroed velocity at a premature rest pose.
  Native ramp, collision, tumbling, wire replay and recovery checks pass unchanged.
- A ridden middle carriage selected predicted time, while its far carriage could
  stay buffered. Group membership now closes both presentation and correction
  sets through replicated physicsGroupId. A normal generated-service test supplies
  deliberately delayed buffered carriage poses and requires all three displayed
  carriages to use one current predicted pose at fractional render times.
- Jump tick added support velocity, but the next air tick replaced it with input.
  Retained inherited horizontal velocity now survives until landing, blocked side
  contact or explicit relocation. A moving-train jump, voluntary steering, later
  train acceleration, wire restore/replay and landing test verifies takeoff speed
  is preserved exactly once. Elevated-wall coverage verifies collision consumes it.
  Frame advances to 0x13 (+8 bytes per numerical body); reload all co-op endpoints.

Dump equipment was not restored in this repair. The next restoration slice should
be one truck: a chassis-local bed and gate with shared Rapier articulated shapes,
normal authority/controller/touch actions, cargo/rider discharge and replay/save.
Existing render-only rigs alone are not safe to advertise as working machinery.
