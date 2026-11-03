# Vehicle contact, train continuity and speedway stutter

Status: contact/train repairs qualified for owner review; phone stutter remains open and equipment migration remains a follow-on. Owner feedback 2026-11-03.
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

## Racetrack attribution and limits

The current streaming CLI now accepts `--scene=racetrack`. It derives the venue
from the generated seed, requests ordinary local-authority `tp` setup on the
clear northern infield lane, then measures normal input with the real game
Worker, IndexedDB, prediction and GPU meshes. Default city traversal is unchanged.
The older city-audit helpers still address deleted traffic owners; the README
now marks that limitation instead of using them as current-game evidence.

[Portable receipts](../benchmarks/219-racetrack-attribution.json) retain two lanes:
ordinary southern-grandstand arrival/traversal/overview, and an explicit infield
walk with separate CPU profiling. Normal-view frames remain 16.8ms p99 in both
4× CDP desktop runs. Authority progress stays around 60Hz, with sampled warm tick
p99 roughly 1–4.4ms; this does not reproduce sustained server backlog. The southern
overview has 33.4ms frame p99 and 50ms maximum, render CPU p99 22ms and authority
tick p99 about 1.7ms. That sampled stage is rendering-limited, not proof of the
owner's phone cause. Both loaded venue areas have zero final missing/incomplete/
stale terrain in the retained stages. A native initial tick still takes about
45ms admitting 56 bodies and 38 geometry sections; warm percentiles do not solve
that cold cost. No unmeasured physics/AI/rendering quality reduction was made.

Both configured Android phones report not connected; the unavailable-status
adapter also raises an unrelated NameError. No phone timing, temperature, FPS
improvement or cause is claimed. Fresh race lanes remain excluded from automatic
population after reset 205: there is currently no restored racing service, so it
cannot be attributed as a running race-AI bottleneck in this fresh venue. Normal
road traffic, depot bodies and spectators still use ordinary shared owners.

## Qualification

- 106 native checks across nine kernel, chassis, jump, railway, prediction and
  wire/traffic files pass with one worker. The two new hop/consist regressions
  fail against the pre-fix implementation; the parked-car presentation test now
  settles its initial suspension before comparing distinct prediction ticks.
- All three TypeScript projects pass. Focused lint has no errors; the binary
  codec files retain their 26 existing non-null-assertion warnings.
- Nine production full-Chromium cases pass: Canvas/GPU driving and contact,
  actual delayed P2P, two-session lab replacement/teardown and rotated vehicle,
  ordinary Worker NPC contacts, station touch/keyboard/reload, and a cruise-speed
  train jump/landing with less than 3px relative drift.
- Art catalog, 2,121 Workshop identities (normal Chromium/retina; 139 compiler
  exclusions), generated manifest and production build pass. Approved art assets
  were not changed. Final GPU/meshes streaming `--assert-ready` at 4× CDP CPU passes all six city traversal stages, with zero final missing/incomplete/stale terrain.

Next: owner review of car contact and train jumping; capture the affected phone
on the same venue if stutter remains, separating cold setup, replay and rendering.
Restore one dump truck's articulated bed/tailgate/cargo through the same world
before expanding to towing and transporter mechanisms. The truck action buttons
remain unavailable until that physical/authority slice is delivered.
