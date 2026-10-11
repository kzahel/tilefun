# 107: Reuse ground-query candidate lists within a pass

Status: complete. Owner: [performance](../topics/performance.md).

## Scope and contract

Profile the physical-phone ground/support phase, then remove repeated broad-phase
candidate assembly where measurements justify it. Ground tracking must still
sample terrain and walkable surfaces for every actor. No cached support verdict,
height, position or cross-tick result is introduced.

The shared EntityManager ground pass now lazily assembles props and entities once
for each exact inclusive chunk range. Lists retain live references, so an earlier
actor's ground snap remains visible to later support checks. Production `World.getHeightAt` only reads loaded chunks, and settlement changes
height/AI/sprite state without XY or collider membership changes. The phase contains
no membership/index changes or XY movement; its lists die before the following index
update/separation. Each subsequent update starts fresh after terrain/prop edits,
carrier movement, readiness and actor membership changes. Different footprints
that cover different ranges receive distinct lists, including negative coordinates
and boundary-spanning bodies. Players keep both existing tracking calls and cliff
behavior; sleep, contacts, motion settlement and RNG policy stay unchanged.

Game authority and embedded ScenarioSession labs consume the same EntityManager;
there is no lab or predictor cache. Prediction uses the unchanged shared ground
resolver. Validation must exercise real Worker game/lab contacts on Canvas/GPU.

## Measurement plan

Frozen source archive at the recorded base revision, with only EntityManager and
the diagnostic probe overlaid. `--entity-reference` substitutes the original
manager against identical companion modules. Separate deep walking controls count
and time ground-phase prop/entity queries and repeated ranges; shallow 15-second
walking and idle samples run original/reuse/reuse/original, twice each. Four
additional B/A/A/B walking controls use `--ground-profile=true` only, adding one
timer pair per update without query wrappers. No heavy validation overlaps
physical-phone sampling. Raw reports/device selectors remain
local; a sanitized benchmark owns exact source hashes and results.

Deep timing wrappers add overhead. Shallow phase costs and whole-tick timing are
reported separately; these short samples cannot establish rare-hitch causality,
sustained thermal performance or recovery of the user's original session.

## Phone results

[Sanitized benchmark](../benchmarks/107-ground-query-reuse.json) records base
`31cc2e5`, executable source hashes and fourteen accepted captures. Three earlier
exploratory captures are excluded: the probe was being refined and the frozen
manager was replaced during one setup. Each completed capture cleaned its own
page/origin; no interrupted/orphan page was found. Final checks verify the prior
foreground app restored and owned USB reverse/forward routes released.

In the deep walking pair, original prop/entity ground queries each number 25,655
versus 9,637 with reuse, about 62% fewer. Original repeated ranges account for
16,074 calls (63%); reuse has zero repeated ranges. Returned prop candidates fall
320,763 → 119,103 and entity candidates 115,116 → 36,979. There are 905/908 updates;
these short captures are comparable workloads, not identical frame traces.
Deep ground mean falls 0.79 → 0.60ms, but removing query-wrapper calls also removes
measurement overhead. The lighter ground-only lane is the ordinary phase evidence:

| Measure | Original | Reuse |
| --- | --- | --- |
| Walking ground mean, timer pair only | 0.516–0.536ms | 0.476–0.478ms |
| Walking ground p95, timer pair only | 0.8–0.9ms | 0.8ms |
| Walking EntityManager mean, shallow | 2.319–2.334ms | 2.246–2.364ms |
| Idle EntityManager mean, shallow | 1.598–1.675ms | 1.619–1.667ms |
| Walking whole-tick mean, shallow | 7.55–7.55ms | 7.26–7.50ms |
| Idle whole-tick mean, shallow | 6.29–6.96ms | 6.41–6.97ms |
| Walking whole-tick p95, shallow | 10.4–10.7ms | 10.4–11.1ms |
| Idle whole-tick p95, shallow | 8.5–9.2ms | 8.9–9.4ms |

The ground-only lane averages about 9% less time (about 0.05ms per update).
EntityManager and whole-tick ranges overlap; idle whole-tick mean rises slightly.
There is no reliable whole-tick or stutter improvement claim. The fourteen captures
have zero page errors, negligible resimulation and stable final actor membership
(22 idle/43 walking). Walking advances about 624px. Temperatures span
28.9–31.7°C with thermal status zero; frame p95 remains 16.7–16.8ms, and the largest
whole tick is 48.2ms. Short charging captures do not establish sustained headroom
or acceptance of the original save/native touch session.

## Validation and next work

All three typechecks, 2,367 tests in 244 unit files and lint pass (118 existing
warnings/34 infos). Deterministic tests cover exact range query counts, live support snaps, edits/readiness-style membership changes,
sleeping supports, movement and a 240-step AI/RNG/live/saved-state comparison against
fresh per-entity queries. The reference performs the pre-cache query policy on
every sample, independently of the cached arguments.

Integration uses an unregistered archive of `31cc2e5` plus only this slice's
EntityManager/test/probe. Test-only browser ports are remapped for isolation;
one longer URL required formatting in that snapshot only. Art catalog generation
is byte-identical, and the workshop rebuild changes only the broad input digest:
all 761 candidate records, batches, tools and approval identities stay unchanged.
Normal full Chromium/retina verification and production build pass. Full browser
integration passes 541 checks with one skipped and no failures (22.4 minutes),
including native Worker game/lab contacts and supports on Canvas/GPU. All six
streaming phases finish with zero missing/incomplete/stale terrain and no readiness
failures. The archive runner uses read-only parent-repository Git metadata for its
revision/status probes; no branch or registered worktree is created.

Next: measure and fuse NPC collision-blocker filtering, which currently allocates
an exclusion Set and a Z-filtered array per probe before walking candidates again.
Preserve self/rider exclusions, Z overlap, solidity and callback ordering through
an independent predicate oracle, then compare native timing/allocation. NPC movement
remains the largest physics phase in the deep walking sample (1.40ms mean/2.2ms p95);
selection and replication are additional costs. Phase percentiles cannot be added.
Finer spatial buckets and prop-query reuse remain later candidates. Ground/support
verdict caching across ticks remains unjustified without stronger geometry/carrier
invalidation evidence.
