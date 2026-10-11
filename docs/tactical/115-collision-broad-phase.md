# 115: Narrow collision broad phase

Status: complete on desktop; phone acceptance remains unmeasured.
Owner: [performance](../topics/performance.md).

## Boundary

Implement the collision candidate reduction identified in
[114](114-authority-work-profile.md), preserving fixed-step physics, narrow-phase
body/prop/terrain rules and immediate blocked reactions. Baseline is frozen
`e969d8a`; the phone is unavailable. Use production shared EntityManager for the
ordinary Worker game and embedded ScenarioSession labs.

## Implementation

CollisionIndex supplies a separate 32px footprint grid for EntityManager's
extra-blocker checks. It is admitted when at least 32 actors are active and an
active solid body occupies an origin chunk with at least 32 resident entities.
SpatialHash caches whether any such chunk exists, avoiding a position scan in
sparse worlds. This is a cost heuristic, not an activity/collision eligibility
rule; sparse passes retain chunk queries. On admitted passes, every collidable
resident body, including sleepers, enters its intersected cells before movement.
Each pushed/player/NPC
body refreshes its membership after movement, before later movers query it.
Spawn/restore update membership only while the movement pass is open; removal
drops indexed references. Rebuilding each admitted movement pass reads
current teleports, collider edits and solidity; it has no cross-tick stale geometry
contract. Bucket arrays and per-body cell keys/membership metadata are reused.
Weak metadata does not keep removed bodies alive. Extremely wide edited bodies
use a bounded supplemental fallback, rather than filling unbounded cell ranges;
ordinary seam-crossing bodies are indexed locally. Large queries safely enumerate
live resident colliders. Negative/large coordinates use non-aliasing string keys.

The blocker now combines self/pushed-body/child exclusion, solidity, height overlap
and exact AABB overlap in one loop. It removes the temporary exclusion Set and
filtered array. Terrain/prop checks retain their ordering; both axis outcomes,
air-momentum clipping and blocked AI behavior retain existing ownership. Player
input integration/prediction, chunk residency/replication, ground query reuse and
separation retain their existing paths. This is a collision slice, not a ground
support index or physics cadence change.

## Measurement and acceptance

The committed `collision-broad-phase.mjs` fixture runs production Realm and
ScenarioSession on flat ground: 0/24/96/384 native dogs resting with long timers or
in long precommitted native travel. It uses 60 warmup/180 measured fixed steps,
three repeats with population order reversed in the middle repeat, and separately
times replication. Index reconstruction and updates are inside whole-tick/physics
timing. All moving dogs must advance 88px; a sleep boundary/obstruction fails the
run. Optional counting captures hash every measured step's wire and durable state,
excluding random persistent record IDs, outside timing windows. Count/trace
instrumentation still affects allocation/GC, so its timings are not used as the
shallow before/after result. Raw profiles/worlds remain temporary.

Use frozen before/after archives with identical dependencies and run sequentially,
without concurrent validation. 32/64px variants are diagnostic constructor choices,
not a gameplay CVar. Finish with native Worker/Canvas/IndexedDB stationary and
continuously moving controls, then required typechecks/units/lint, build/browser
and streaming readiness. No historical art pixels or approval records are rewritten.

## Results

[Sanitized evidence](../benchmarks/115-collision-broad-phase.json) retains source
and probe hashes, 48 shallow crowd rows, eight matching full wire/durable traces,
candidate counts and eight native captures on Apple M4 Pro/Node 26.7.0.
Whole-tick mean ranges across three repeats (milliseconds, replication separate):

| Dogs | Motion | Original | Delivered |
| --- | --- | --- | --- |
| 24 | Rest | 0.310–0.356 | 0.287–0.371 |
| 24 | Travel | 0.347–0.398 | 0.323–0.391 |
| 96 | Rest | 2.368–2.561 | 1.431–1.585 |
| 96 | Travel | 2.646–2.799 | 1.585–1.713 |
| 384 | Rest | 21.816–22.492 | 8.333–9.573 |
| 384 | Travel | 25.057–25.524 | 9.160–9.894 |

384-dog travel tick p95 falls from 28.05–29.06ms to 10.75–11.53ms in this
accelerated fixture. Collision candidates per step fall from 46,736 to 3,780 at
384 resting dogs and about 50,766 to 3,475 during travel (92–93% fewer).
Original movement counts are original coarse candidates minus the delivered
remaining coarse candidates: unchanged support/replication queries remain coarse.
The 24-dog control uses zero fine queries. All eight full wire/durable hashes
match and every moving dog advances the expected 88px.

The initial always-on grid added sparse native overhead, so it was rejected in
favor of the density gate. Prototype 32px cells outperformed 64px in the dense
controls; those captures precede lifecycle/gate refinements and are excluded from
the delivered table. Final native eight-second walking means overlap: original
1.158–1.311ms versus delivered 1.222–1.294ms; p95 1.5–1.7 versus 1.6ms. Physics
means are 0.337–0.355 versus 0.345–0.355ms. Walking stays continuously moving
512–513px, near 60Hz, with frame p95 16.7ms and no page errors. Twelve-second
idle means overlap at 0.945–1.058 versus 1.024–1.079ms; physics means are
0.216–0.254 versus 0.227–0.229ms. These small samples establish a dense scaling
gain with sparse controls in the same timing range, not an ordinary FPS or phone
improvement. No desync/stutter reproduction or mobile acceptance is claimed.

## Validation and next work

47 focused checks cover brute-force candidate completeness at 32/64px, negative
seams/large coordinates, oversized roofs, solidity/shape edits, sleeping blockers,
remove/reinsert, sequential mover refresh, height/attachment exclusions, blocked
reactions, sparse fallback and crowd metadata transitions. Existing ground-query
reuse remains covered and unchanged.

All three typechecks, 2,491 unit tests in 252 files, lint and the production build
pass. Lint retains the existing 118 warnings/34 infos. Build regenerated only the
workshop manifest input digest; candidate identities and pixels are unchanged.
All 547 browser checks pass in the full two-worker bundled-Chromium run (22.7m),
including shared game/lab movement, prediction recovery, fauna contacts, terrain
grades, support, persistence and GPU lifecycle/upload checks. All six streaming
readiness cases pass: cold, standing, walk, sprint, reverse and zoom-out finish
with no missing, incomplete or stale terrain. Task-owned browser/Vite instances
close through the probe/test finalizers. Measured runtime/helper hashes still
match the delivered source.
Next: repeat ordinary
and crowded controls on a cooled phone when attached; then measure a separate
footprint-aware ground/prop candidate path while preserving live support outcomes
and the existing per-pass reuse. Extra compute workers are not justified by this
slice.
