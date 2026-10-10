# Identical NPC collision probes

Status: complete, 2026-10-10.
Owner: [performance](../topics/performance.md).

The user authorized the duplicate collision-probe reuse selected in
[092](092-authority-physics-profile.md), with physical-phone measurement and a commit.

## Contract and implementation

`resolveCollision` accepts an opt-in `reuseIdenticalProbe` argument. It retains
its X verdict and reuses it only if the subsequent Y test has exactly the same
position. Y still performs its normal accepted position write or momentum clip,
and the blocked return remains unchanged. Zero-displacement bodies are the main
case; successful horizontal movement with no Y displacement also qualifies.
A failed nonzero X move with no Y displacement tests the original position
separately. Diagonal/vertical movement retains separate queries.

Default callers retain both queries and their side effects. Only EntityManager's
NPC movement path opts in. Its tile flags, props, entity geometry, elevation and
water/deep-water reads are stable across that entity's axis processing; the
predicates do not consume RNG or read the changed XY velocity/position. Production
World's loaded collision/height/base-terrain lookups are synchronous reads. Entity
position/momentum writes do not change the other bodies or props, and the self ID
is excluded. Air momentum clips do not change any of those predicates. Persistence
observers update indices/dirty records without changing collision geometry. Custom
EntityManager collision/height/terrain callbacks must honor the documented stable
geometry contract during each resolution.

Reuse is local to one call, so prop/body/terrain edits, motion and later ticks
observe fresh geometry. AI decisions, blocked reactions, grounding, separation,
attachments, animation, candidate order and persistence policy are unchanged.
Game and embedded labs share the EntityManager/resolver; no lab-only physics.

## Parity

A frozen pre-change resolver is the independent oracle. Tests cover exact query
counts for resting/open/blocked and one-axis/diagonal poses, default stateful
callback behavior, and 4,096 deterministic masks/footprints/terrain/obstacle/air
cases including absent colliders and negative/fractional positions.
A 180-step EntityManager/AI trace covers overlapping chickens, wildlife, fish,
water/deep-water edges, elevation, static wall edits, changed body dimensions,
inactive actors and a horse attachment. Full live actors, each frame's saved
records, AI random state and external RNG draws match the oracle.

## Phone method and results

Native Worker/Canvas/IndexedDB thicket seed 2026/dog clearing, 15-second
idle/walking windows after warmup. Same frozen 64829c0 runtime with only the new
EntityManager/resolver/probe copied in. `--collision-reference` substitutes the
pre-change resolver for before controls; its ignored opt-in argument has no effect.
Two shallow before and after samples per motion in B/A/A/B order; one deep query
capture per policy for attribution. No CPU sampling. Source hashes, thermal state,
travel, membership, resimulation and errors are retained in
[sanitized evidence](../benchmarks/093-identical-collision-probes.json). The phone
foreground app, owned tabs/origin and USB routes are restored/released afterward.

| Measure | Original idle | Reuse idle | Original walking | Reuse walking |
| --- | --- | --- | --- | --- |
| EntityManager mean | 1.93–1.96ms | 1.64–1.65ms | 2.31–2.47ms | 2.12–2.16ms |
| EntityManager p95 | 2.7–3.2ms | 2.4–2.5ms | 3.4–3.5ms | 3.1–3.5ms |
| Whole tick mean | 7.54–7.77ms | 7.56–7.57ms | 7.63–7.99ms | 7.47–7.66ms |
| Whole tick p95 | 10.0–10.8ms | 9.7–10.3ms | 10.5–11.0ms | 10.2–11.2ms |

Across the two shallow captures per policy, EntityManager mean falls about 15%
idle and 10% walking. Whole tick p95 ranges overlap; this is a bounded physics
saving, not evidence that hitching or desync is fixed. Subphase p95s cannot be
added. In the deep walking pair, NPC prop queries fall 72,648 → 44,926
(about 38%; 2.00 → 1.24 per resolution), and returned prop candidates fall
917,619 → 570,067. Entity queries fall 72,130 → 44,667, with candidates
320,890 → 197,566. Resolution counts differ by only 32 (36,324 → 36,292);
about 76% have zero displacement. Deep wrappers add work, so their lower NPC
p95 (2.5 → 2.1ms) is attribution only, not the shallow performance comparison.

All ten phone captures have zero page errors, resimulation error below 0.001px,
60Hz authority, and final membership 22 idle/43 walking. Shallow walking advances
624.1px. Temperatures span 27.6–29.1°C while charging with thermal status zero;
B/A/A/B reduces order bias but does not isolate all heat/GC/run variability.
Main-frame p95 stays 16.7–16.8ms, with 0–2 intervals over 25ms per capture.
Whole-update maxima reach 45.8ms in shallow walking and 49.2ms in deep walking,
so intermittent hitches and the 4–6ms authority target remain open. Two samples
per shallow policy/motion and one deep pair do not establish sustained mobile
performance; keyboard walking is not original-save/native-touch acceptance.

## Validation and next work

All three typechecks, 2,253 units in 235 files and lint pass (118 existing
warnings/34 infos). The nine new parity tests also pass in a focused final run.
These standard checks use the combined checkout. Phone timing uses the frozen
64829c0 runtime plus this slice's implementation.

Integration uses a separate archive of committed `25ce073` plus this slice's
EntityManager/resolver/test, excluding concurrent touch/recovery edits. Inventory
generation and production build pass there. Its 761 review identities are verified
in headless-shell and full bundled Chromium at retina scale. Seventeen
geometry/character controller/runtime fingerprints refresh because they include
shared physics source; source art, batches, tools and approval events are unchanged.
The catalog is byte-identical to the archive base. The commit takes its coherent
inventory from this archive; the working inventory retains concurrent sources.
Full browser integration passes 526 tests with one skipped and no failures.
All six streaming readiness phases pass with zero final missing/incomplete/stale
terrain. The runner's read-only revision/status probes use parent-repo metadata
for the archive; no branch or registered worktree is created.

Original-save and sustained thermal acceptance remain separate. Next: profile and
incrementally reuse InterestManager demand assembly under live ticket/readiness changes, a remaining sampled hot spot
from 092; do not introduce a persistent physics cache without separate
invalidation/parity evidence.
