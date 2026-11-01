# Controlled-player contact feedback

Status: delivered and validated locally for owner inspection, 2026-11-01.
[Physics engine](../topics/physics-engine.md) owns the continuing direction.
The owner rejected the no-push gameplay policy after delivery; [196](196-restore-controlled-player-pushing.md)
restores bounded player pushing. This record describes the earlier implementation.

## Reproduction and cause

After 194, the owner reported indefinite gliding during glancing player contact,
and short bursts faster than walking when walking into another player. This is
an authority-physics defect, independently reproducible without networking,
prediction or presentation.

Two upright capsules start at X −16/−14, Y 0.67. Move the first toward the second
for ticks 30–89, then release both through tick 300. With a 0.1 m Z offset, the
old backend travels another 4.65 m after release, still drifting during ticks
180–300. A 0.3 m offset produces a 20.63 m/s peak against 4.5 m/s walking.
Simultaneous head-on movement also overlaps capsules and can autostep one upward.

Rapier's KCC handles moving kinematics by matching their contact-normal velocity
and inheriting tangential motion. That is appropriate for prescribed supports.
Our two position-based character motors instead expose their previous computed
velocities to each other's next query. Contact motion can feed back as if each
character were a moving platform. See the upstream
[contact/friction implementation](https://github.com/dimforge/rapier/blob/master/src/control/character_controller.rs).
This is our motor policy/ordering error, not evidence of nondeterministic WASM.

## Shared motor policy

Keep characters as position-controlled upright capsules. Both environment KCC
queries exclude the controlled actors, retaining ordinary terrain, lift and loose
body behavior. Then use Rapier's actual collider/collider relative-motion sweep
for the proposed movements before committing either body and stepping the world.

Remove only the closing normal displacement after time of impact, divided among
motors proportional to their inward movement. This reduces each proposal's
magnitude, preserves sliding and permits moving away/together. It does not give
an idle player another player's walking velocity. Jump/landing normals update
motor state. KCC checks the adjusted paths against the environment again, without
a second application of dynamic-body impulses; a final conservative relative
sweep shortens any remaining crossing. There is no added separation force,
inertia accumulator, invented capsule geometry or display-speed clamp.

An early prefix-only guard stopped the runaway but could pin follow/jump at
resting contact. Release/follow/jump tests rejected that intermediate approach.
The final implementation clips normal motion and ignores non-closing skin hits.
Authority, both full-world predictors and snapshot replay use the same backend.
The display policy from 194 is unchanged; the ordinary game still uses its
existing simulation owner.

New shared scripts **Players head-on** and **Players glancing / release** appear
in the existing lab. They contain no cube, stop input at tick 90 and leave an idle
tail for spotting drift. Existing keyboard, controller and touch selection works.

## Evidence

- Native raw-physics regressions cover both control seats, simultaneous head-on,
  glancing release and the speed-burst offset. Every tick stays within 4.55 m/s
  horizontal speed, release drift below 2 mm, clear capsule separation and no
  accidental climbing. Walking away must remain possible.
- Focused checks also cover jumping/following from resting contact and a glancing
  slide beside a solid wall. Full snapshots replay both new contact scripts
  exactly, including all pose/velocity values. Both scripts converge through the
  two real Realm sessions, normal input/replication and seeded RTT/jitter.
- `npx tsx scripts/benchmark-physics-presentation.ts --output=docs/benchmarks/195-player-contact.json`
  records 18 native lanes: six scripts and three presentation policies, 200 ms RTT
  and ±20 ms per-direction jitter. New contact scenes peak around 4.52 m/s in
  authority and drift less than 0.02 mm after tick 141. Display modes produce
  matching authority hashes within each script, with no late inputs/recoveries.
- These are accelerated desktop correctness samples, not GPU/Chromebook timings.
  Both-active input uncertainty still causes corrections: the opposing-cube guest
  view records a 1.10 m maximum displayed step. This work does not qualify that
  separate migration blocker.

## Validation

- 66 focused native checks pass across Rapier physics, full-world replay,
  presentation, shared authority scheduling, Worker hosting and bounded transport.
  All three TypeScript projects and focused Biome checks pass.
- Production build and all three full-Chromium physics cases pass. The co-op case
  selects the new glancing script through the real Worker, checks both authority
  players stay still across its idle tail, and retains input/pause/reset/teardown
  coverage. The original bridge/support/delay/stall cases pass. Rendered first-push
  gap stays 8.96 cm with matching buffered player/cube ticks. Inspected playback
  captures show both views and the new selectable scripts.
- Art catalog and Workshop manifest regenerate/verify 2,119 identities with 137
  exclusions. Only the excluded physics candidate and source digest change.
  Normal `scenario.worker-uU-42f3Q.js` / `local-server.worker-CTXrun75.js` hashes
  and sizes remain unchanged. Physics workers become 5,499.05/5,499.40 kB;
  the experimental page is 4,394.22 kB / 1,689.48 kB gzip.
- `npm run streaming:bench -- --assert-ready` passes all six normal-game stages
  with zero missing-data frames, final missing data or incomplete caches. This
  protects the existing game boundary; it is not Rapier performance qualification.
- Browser checks use isolated data/auth and bundled Chromium; no player world or
  primary browser is opened. Diff whitespace checks pass. Whole-repository suites
  were not rerun.

## Limits and next work

This is the two-controlled-motor reference. Player contact blocks/slides instead
of shoving another player's motor. Intentional shoving/knockback needs an explicit
bounded gameplay policy; it must not recycle solved velocities as future intent.
Arbitrary initial overlaps, crowds/multiple simultaneous motor contacts, moving
player supports and general contact islands remain unqualified. Cast normals are
local; the controlled capsules currently stay unrotated. The additional fixed
queries/callbacks need actual Chromebook measurement before migration.

Inspect both new scripts and manual release/follow movement. Next address
both-active dynamic-object input uncertainty and independent clocks, then measure
crowd/corner contacts and Chromebook headroom before normal-game adoption.
