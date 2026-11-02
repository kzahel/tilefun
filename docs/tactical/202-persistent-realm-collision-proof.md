# Persistent realm collision proof

Status: implementation in progress, 2026-11-02.
Parent: [201](201-rapier-cutover-sequence.md); owner: [physics engine](../topics/physics-engine.md).

## Inventory and first baseline

| Current owner | Replacement boundary |
| --- | --- |
| Realm per-command player motor and missing-input gravity | Retain input admission/CVars/landing events; share a persistent query world with other actors |
| GameCharacterPhysics | Extract common geometry compilation; retain controlled support/push semantics; stop rebuilding whole scenes on the replacement path |
| EntityManager NPC movement, ground tracking and separation | Retain AI intent, travel preparation, animation, indexing and parenting; replacement contact phase owns pose/grounding |
| Driving/TrafficSystem | Retain steering, acceleration, routes and driver identity; replacement controlled-car collision must bypass old checkedCarPose/push geometry |
| BallPhysics / vehicle cargo | Qualify one ordinary ball first; other projectile/cargo behavior remains an explicit cutover gap |
| MovingSupport, roofs, mounts, railways, vehicle beds/towing | Inventory compatibility blockers; no silent collision fallback in replacement qualification scenes |
| AI canOccupy/navigation, editor placement, safe arrival | Read-only gameplay queries still need routing/qualification before default cutover; no hidden claim of all-query replacement |
| PlayerPredictor / collision timeline | Private per-predictor world and immutable replica inputs; rebuild actor poses on rebase without freeing reusable static geometry |
| Realm load/close, edits and streaming | Dispose/recreate physics with realm lifecycle; section cache invalidates from actual chunk identity/revision and prop geometry |

Frozen legacy baseline: `e59df9ca`; [native measurements](../benchmarks/201-native-legacy.json)
use the existing production Realm active-crowds runner (0/24/96/384 near actors,
384 far). Rendering and browser/Chromebook timing are absent from this lane.
The later paired runner must preserve these activation and content distinctions.

Implementation checkpoints, focused validation and early decision evidence will
be recorded here. No proceed/default-cutover claim has been made.

## Replacement proof checkpoint

Implemented opt-in modes 3/4 (fixed box / controlled capsule) behind ordinary
Worker startup `?physics=rapier-world&hull=box|capsule`. They select at startup;
console hot switching into/out of the realm backend rejects. Modes 0/1/2 retain
their previous behavior. `stepCharacterPhysics` refuses a missing realm owner,
and legacy movement contexts reject collision when a replacement world owns them.

Each Realm/private predictor owns and disposes its persistent world. Bounded
static sections reuse a common geometry compiler; chunk identity, edit/physical
revisions and prop geometry invalidate them. Section terrain is clipped to its
actual bounds. Actor shapes/poses update without recreating the world; idle
unchanged actor transforms are reused. Query broad-phase refreshes do not advance
a second rigid-body simulation: these are controlled colliders and retain explicit
motors. The ball is also a controlled bounce/rolling motor in this qualification
slice, not a general free rigid-body implementation.

NPC motion, support and side contacts use the shared motor, bypassing old ground
tracking/separation. AI intent, activation/travel preparation, animation, parenting
and spatial interest remain ordinary game code. Dense replacement movement reuses
the existing fine collision index, refreshed after each motor/push; ordinary balls
are included despite their legacy non-solid flag.

One upright controlled car retains steering/acceleration intent but uses the same
world for collision, gentle NPC pushes and gravity. Conservative padded angular
samples reject turning into walls and retain straight-roll recovery. Vertical
state commits with the authority pose; missing-input intervals hold horizontal
travel while advancing an already falling car. Ordinary balls retain gameplay hit
reactions/lifetime and bounce using Rapier contact normals, including airborne or
unpushed recipients. No legacy ball contact pass also runs.

World Geometry's **Realm physics replacement proof** uses ordinary Realm actors,
Worker, prediction and renderer. `?geometry=realm` stages a ramp/deck, NPCs, ball
and one car; `crowd=0|24|96|384` stages the seeded active-crowds workload instead.
The selector compares legacy and persistent modes without changing global CVars.
Explicit diagnostic sampling reports bounded Worker tick/AI/contact timings and
world residency. The paired browser runner is
`node scripts/benchmark-realm-physics-browser.mjs`; `--cdp` connects to an existing
dedicated device browser and owns/closes only its new tabs.

This is not full game parity. Autonomous traffic, parking maneuvers, mounted animal
controllers, train motion and moving roof passengers are unqualified and blocked
or recorded explicitly; no legacy solver silently handles them. Vehicle apparatus,
specialized wildlife movement, other loose cargo, editor/navigation/safe-arrival
query parity, and arbitrary initial-overlap recovery remain cutover gaps.

## Qualification in progress

The first physical Chromebook run completed two order-reversed pairs for each
0/24/96/384-NPC workload in Chrome 150. The initial 384-NPC Rapier p95 was
163–172ms versus legacy 22–22.5ms; normal rendering could remain near 60Hz while
authority processed far fewer ticks. This is a failed cutover budget, not an FPS
success. A bounded fine-index change reduced desktop 384-NPC p95 from about
99ms to 43ms, still above the frozen legacy 11ms. Final device measurements after
review fixes and the index change remain to be recorded.

The requested read-only Sol 6.1 high review identified five issues: section spill,
unchecked car rotation, missing committed car vertical state, missing ball bounce
normal and missing hit reactions for unpushed recipients. Focused regressions and
fixes were added; re-review, final browser checks and the decision record are pending.
