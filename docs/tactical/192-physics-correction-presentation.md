# Physics correction presentation and remote interpolation

Status: delivered and validated for inspection, 2026-11-01. Owner reported a large remote-player teleport
on movement start, accepted the diagnosis, and authorized correction smoothing,
current-pose diagnostics and buffered remote comparison. [Physics engine](../topics/physics-engine.md)
owns direction; [191](191-cooperative-physics-laboratory.md) records the shared
coordinated-clock, full-world physics reference and its qualification limits.

## Problem and design

The last-known remote input guesses stationary before movement starts and keeps
walking after release. Replaying a delayed snapshot to the predicted present can
move the displayed remote actor over a metre at once. Agreement at a past tick
can coexist with that large current-pose rebase. Presentation previously exposed
raw replay with only one-frame interpolation. The native manual reproduction
measured 1.12 m start / 1.35 m stop steps in the guest view.

The solver still restores and replays the complete small world. It now returns
before/after poses for each completed correction and records current-pose
correction, own/remote components and lifetime maximum separately from past-tick
position error. Epoch/initialization/history recovery resets are explicit fences,
not same-time correction measurements. Existing replay/ack semantics are retained.

PairPresentation is a renderer-independent presentation consumer shared by the
visual lab and native scenarios. Corrections accumulate translation and quaternion
offsets for all affected predicted bodies. Offsets decay exponentially with a
120 ms time constant; normal subsequent input movement retains its full delta.
Displayed positions never enter collision queries or replay. Offsets over 4 m and
explicit clock/history fences reset rather than smoothing unbounded teleports.
The display can temporarily differ from actual physical contacts; this is visible
in diagnostics and can be disabled with **Corrections: raw**.

**Remote: buffered when clear** is the default. It samples only the other
player's display from up to 48 ordered authoritative frames, interpolating without
extrapolation at coordinator time minus maximum configured downlink delay plus
two ticks of safety. For the jitter preset this is ten ticks behind coordinator
time; the physics world still runs at its ordinary prediction lead. This adds
remote visual latency and avoids stationary-to-forward-extrapolation catch-up.
The local player, lift and cube remain on the predicted timeline.

A conservative proximity graph through both capsules, the loose cube and moving
lift returns the remote display to prediction before a possible shared contact.
Both predicted and buffered candidate positions participate. Entry/exit margins
have hysteresis (0.85/1.25 m beyond conservative body bounds). This is a bounded
fixture policy, not production contact-island discovery or a navigation change.
Source handoffs preserve the current displayed position/rotation and decay that
offset too. **Remote: predicted** compares the original extrapolation policy,
with smoothing independently switchable. Modes never restart authority or change
inputs, networking, physics snapshots or collision residency.

The coordinator clock advances display decay, network interpolation and physics
for repeatable play/pause/step. Browser rendering still runs independently, with
one-step interpolation in PhysicsViewport. Pausing may settle the last displayed
step but does not continue decaying offsets against wall time. Actual displayed
remote-mesh displacement is also measured after drawing; it differs from both
raw correction distance and the native 60 Hz presentation sample metric.

## Reproduction and evidence

**Remote start / stop** is a new shared script: host walks away from the guest
between ticks 60 and 95, then stops; no loose body obscures that observation.
Other push/lift scenes remain available to inspect contact handoffs.

Run `npx tsx scripts/benchmark-physics-presentation.ts --output=docs/benchmarks/192-physics-presentation.json`.
It compares raw prediction, smoothed prediction and buffered-when-clear for the
same seeded 200 ms RTT / ±20 ms per-direction jitter scenarios. It captures both
error metrics, maximum presented remote step, chosen sources and final authority
physics hash. It is accelerated native sampling, not a browser/GPU performance test.

Initial results: remote start/stop in the guest has about 7.6 cm maximum past error
but **1.275 m current-pose correction**. Maximum 60 Hz presented step is **1.275 m
raw**, **0.240 m smoothed prediction**, **0.075 m buffered**. Opposing pushes switch
between buffered and predicted sources and reduce the guest maximum step from
1.274 m raw to 0.184 m with either smoothing policy. Final physics snapshot hashes
match across all three modes within each scene. Corrections still exist in physics;
they are measured rather than hidden by the display statistic.

Native checks cover whole-group position/rotation continuity, undelayed normal
input increments, explicit reset, pause, bounded history, raw comparison,
interaction-graph handoff, live-pose diagnostics and the seeded full-world replay.
Validation passes:

- 47 focused native tests across Rapier, display offsets/history, shared scenario
  hosting, authority clock and bounded transport; three-project typechecks and
  focused lint pass. No whole-repository suite rerun is claimed.
- All three production full-Chromium physics browser cases pass. The extended
  two-client case checks the actual rendered remote mesh, new start/stop script,
  current-pose metric, buffered/predicted and raw/smooth controls, and unchanged
  Worker identity when switching presentation modes. Existing keyboard, touch,
  controller, pause/step, kilometre bridge, support and stall/recovery checks pass.
- The inspected start/stop capture reports 127.48 cm maximum current-pose rebase,
  7.56 cm maximum past error, but only 7.51 cm maximum rendered guest remote-frame
  step. Both displays are buffered in that scene, with zero late inputs or
  recoveries. This is one desktop run, not sustained/Chromebook/GPU headroom.
- Production build and freshly generated catalog/manifest pass, with 2,119 review
  identities verified in normal Chromium at retina scale (137 exclusions).
  Only the excluded physics candidate and overall source digest change identity.
  Ordinary scenario/local-server and the original physics Worker retain their
  previous runtime hashes/sizes. The experimental pair Worker is 5,497.71 kB;
  the experimental page chunk is 4,389.27 kB / 1,687.97 kB gzip.
- All six normal-game streaming readiness stages have zero missing-data frames,
  final missing data or incomplete caches. Browser checks use isolated preview
  auth/data and bundled Chromium. No user world or primary browser profile is
  opened. Focused diff/whitespace checks pass.

The new display policy is lab-only. Full snapshots, coordinated clocks and
unknown remote inputs retain the limitations recorded in 191. Startup/history
fences intentionally reset presentation; extreme corrections over the offset
bound can still snap and remain visible in raw diagnostics.

## Next

Inspect start/stop and opposing pushes manually, including near-contact source
handoffs. Qualify independent client/server clocks and actual Chromebook/WebRTC
behavior before generalizing the proximity policy, tuning buffering/smoothing
or migrating this reference into ordinary game presentation.
