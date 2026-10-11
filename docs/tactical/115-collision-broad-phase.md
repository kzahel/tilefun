# 115: Narrow collision broad phase

Status: desktop and physical Pixel comparisons complete; dense scaling gain,
ordinary timing ranges overlap.
Owner: [performance](../topics/performance.md).

## Boundary

Implement the collision candidate reduction identified in
[114](114-authority-work-profile.md), preserving fixed-step physics, narrow-phase
body/prop/terrain rules and immediate blocked reactions. Baseline is frozen
`e969d8a`; the phone was initially unavailable, with the follow-up below measured
when attached. Use production shared EntityManager for the
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

## Physical Pixel follow-up

The attached Pixel 7a (API 37, Chrome 154.0.8037.126) runs eight ordinary
Canvas/Worker/IndexedDB captures and sixteen accelerated crowd captures against
the same frozen baseline and delivered `9929a42` runtime. Source hashes match;
four separate 96-dog counting captures match desktop counts exactly. Two shallow
repeats use before/after/after/before source order, reversing population order
on the second repeat. Every traveling dog advances 88px. Entry gate is <=29°C
and thermal status zero; all captured starts/ends are 25.1–28.0°C/status zero,
with AC charging unchanged. Samples run sequentially without competing checks.
[Phone evidence](../benchmarks/115-collision-broad-phase-phone.json) owns timings,
thermal readings, poses, source/probe hashes and limits.

| Dogs | Motion | Original tick mean | Delivered tick mean | Original p95 | Delivered p95 |
| --- | --- | --- | --- | --- | --- |
| 96 | Rest | 3.96–4.38ms | 2.76–3.01ms | 5.3–5.9ms | 3.5–4.2ms |
| 96 | Travel | 4.69–5.39ms | 3.05–3.40ms | 6.6–6.8ms | 4.1–4.8ms |
| 384 | Rest | 27.57–31.25ms | 11.90–12.22ms | 32.0–37.7ms | 14.7–17.7ms |
| 384 | Travel | 34.57–38.72ms | 13.52–14.84ms | 40.1–44.1ms | 16.4–18.0ms |

All index maintenance is included; publication is timed separately. The dense
fixture runs production Realm in a dedicated phone Worker with memory persistence,
held native rest/travel and no rendering, real IndexedDB or planning. It ports the
committed runner with `setTimeout(0)` yields every twenty steps outside timers.
This establishes dense workload savings on the phone, not a real-time whole-game
deadline or FPS result. At 384 moving dogs, p95 still reaches 18ms before separate
publication cost; there is no claim of complete 60Hz headroom at that load.

Ordinary eight-second walking means overlap at 6.84–7.15ms original versus
6.80–6.95ms delivered, with p95 9.9–10.3 versus 10.2–10.4ms. Physics means are
2.057–2.075 versus 1.945–2.134ms. All four walking controls stay continuously
moving 512–513px near 60Hz, frame p95 16.8ms, with no page errors. Twelve-second
idle means also overlap (6.03–6.77 versus 6.37–6.50ms); delivered idle p95 is
slightly higher in these two repeats (8.1–9.1 versus 9.2–9.3ms). Native timing
variability and temperature/order differences remain. There is no demonstrated
sparse-play performance gain, desync reproduction or stutter cure.

Initial CDP attachments timed out while initializing pre-existing Chrome pages,
before sampling. A temporary proxy resumes/detaches existing targets and exposes
only new benchmark targets to Playwright; both sources use the identical route.
Game inputs and authority messages stay on the phone. Failed starts are excluded.
Owned pages, Workers, Vite/proxy servers and USB routes are closed; original home
foreground is restored and existing Chrome tabs retained. No production source,
browser settings or art changes were needed.

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
The phone evidence follow-up repeats all three typechecks, 2,491 units and lint;
runtime source is unchanged, so build/browser/streaming validation above is retained.
Next: profile the remaining crowded ground/support and prop work on the phone,
then choose a bounded footprint-aware candidate change while preserving live
support outcomes and existing per-pass reuse. Ordinary tick p95 remains around
10ms; do not infer further easy wins or introduce compute workers from the dense
fixture alone.
