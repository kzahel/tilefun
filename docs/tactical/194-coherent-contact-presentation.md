# Coherent contact-group presentation

Status: delivered and validated for the reported observer case, 2026-11-01. Owner controls the left host view and observes
its avatar in the right guest view. Movement is smoother after 192–193, but the
cube moves before that visible avatar reaches it. [Physics engine](../topics/physics-engine.md)
owns direction; preceding tacticals record the full-world replay reference.

## Root cause

The display buffered only the remote avatar, while its loose cube remained on the
predicted timeline. A native reproduction of **Push while watched** shows the
cube's first visible movement with about **90 cm** of visible face gap, growing
to about a metre. The raw predicted avatar is already contacting it, but the
buffered avatar has not arrived. Later, different per-body correction offsets
can also separate bodies that are actually touching. Using one decay fraction
in 193 did not make those offsets a rigid contact-group transform.

This was a presentation-policy error. Increasing correction smoothing concealed
the avatar jump without preserving the interaction shown to the observer.

## Current policy

PairPresentation now constructs conservative contact components from the union of
predicted and buffered poses, retaining the fixture's bounded proximity/hysteresis
policy. Every member of a component uses one scene time and **one rigid transform**:
translation plus rotation around a shared anchor. No independent cube/avatar
correction can break that component's relative geometry.

- An idle client displays a coherent buffered scene, including its idle actor,
  remote players, cubes and moving supports. All are sampled from the same two
  authority frames at the same requested tick.
- Recent local movement/jump input predicts its connected component immediately.
  Other components remain buffered. Local airborne motion also keeps prediction
  active. A confirmation/display tail after release and landing prevents switching
  into a historical moving/airborne pose.
- A group containing the local actor anchors correction there; otherwise it
  prefers the remote actor, then a stable body ID. Normal fresh local motion is
  preserved when entering prediction or changing component membership.
- A stable predicted group applies replay correction to its anchor and transforms
  all member positions/orientations together. Buffered groups ignore speculative
  physics corrections. The 4.5 m/s translation-release bound remains in place.
- Group/source changes preserve the chosen anchor. They cannot preserve every
  old member position when the corrected physical arrangement is different.
  Other members may visibly correct; one common transform retains contact geometry.

Full Rapier prediction, input admission, authority state, replication and network
simulation are unchanged. Presentation never feeds display coordinates into physics.
**Remote: predicted** still forces the speculative scene for comparison; default
**Remote: buffered when clear** now applies to whole components and idle scenes.
The UI labels own/remote/cube source and scene ticks, component counts, correction
metrics and actual mesh motion. First visible cube push records the actual drawn
cube/player X-AABB gap, not a physics-world-only measurement.

## Evidence and limits

- 56 focused native tests pass across full physics/replay, display components,
  shared host/clock and bounded transport. New coverage checks one buffered frame
  for avatar and cube, one rigid position/rotation correction, immediate local
  input deltas, release/landing tails and the reported first-push reproduction.
- In the idle right view, first visible push face gap falls from about 90 cm to
  9.2 cm in native samples. The residual is below one 30 Hz snapshot interval of
  character travel and includes character-controller skin/interpolation error;
  this is not a promise of exact contact reconstruction between snapshots.
- `npx tsx scripts/benchmark-physics-presentation.ts --output=docs/benchmarks/194-coherent-contact-groups.json`
  includes the watched push plus start/stop, opposing pushes and reversals under
  seeded 200 ms RTT / ±20 ms per-direction jitter. Idle guest push/reversal maximum
  displayed samples are about 7.5 cm. Authority physics hashes match across display
  modes within every scene. These are accelerated native samples, not GPU timings.
- **Both-active interaction remains a migration blocker.** Group coherence exposes
  larger member corrections that the preceding independent offsets concealed:
  the opposing-push default lane records a 1.10 m remote step, and forced predicted
  comparison can exceed that. 193's small-step observation is not a universal bound
  on membership/relative-state corrections. The chosen local anchor stays stable;
  the next work must address input/timeline uncertainty rather than add independent
  smoothing back onto touching bodies.
- The graph is a conservative small-fixture presentation policy, not production
  contact-island discovery. Static terrain is not transformed with components;
  transformed static contacts, general geometry residency, independent clocks and
  Chromebook/WebRTC behavior remain unqualified. Large reset fences can still snap.

Validation:

- All three production Chromium physics cases pass. The two-client case checks
  actual rendered player/cube bounds, matching display ticks and sources at push
  onset, keyboard/touch/controller input, release/pause/reset, source comparisons,
  reversals and Worker teardown. Both original bridge/support/stall cases pass.
  An additional onset capture/assertion run passes on identical runtime code.
- Browser first-push X-AABB gap is **8.96 cm**; player and cube are both buffered
  at matching display ticks. The inspected scene shows their contact aligned in
  both views. In the idle guest capture, maximum remote rendered step is 7.50 cm
  despite 109.64 cm raw current-pose rebase, with zero late inputs/recoveries.
  Coordinator-step p95 is 2.60 ms in that desktop capture; this is not sustained,
  GPU or Chromebook headroom evidence.
- Three-project typechecks, focused lint, diff whitespace checks and production
  build pass. Regenerated inventories verify 2,119 review identities in normal
  Chromium at retina scale (137 exclusions). Only the excluded physics candidate
  and overall source digest change identity. All authority Worker runtime hashes
  and sizes remain unchanged. Experimental page size is 4,392.30 kB / 1,688.94 kB gzip.
- All six normal-game streaming readiness stages pass with zero missing-data
  frames, final missing data and incomplete caches. Browser checks use isolated
  preview auth/data and bundled Chromium. No primary browser or user world is
  opened. Whole-repository suites were not rerun.

The current delivery fixes the watched-push display inconsistency and keeps the
both-active limitations above explicit. It does not qualify normal-game migration.

## Next

Inspect **Push while watched** with host control, then take the guest seat near
contact to inspect the transition. Next qualify both-active input/timeline handling
and independently scheduled clocks before migrating normal gameplay. Keep coherent
contacts and local response as explicit acceptance conditions alongside smoothness.
