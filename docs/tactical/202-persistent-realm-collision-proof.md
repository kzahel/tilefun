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
