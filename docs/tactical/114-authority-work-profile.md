# 114: Profile remaining authority work

Status: investigation complete; no gameplay behavior change.
Owner: [performance](../topics/performance.md).

## Question and measurement boundary

After [113](113-shared-ai-planning.md) bounds native planning bursts, identify the
remaining collision, ground/support and mutation costs before choosing another
optimization. Keep physics, alarms, inputs and publication at their existing rates.

Use a frozen unregistered archive of `264cb6e`, excluding unrelated working-tree
renderer/XR changes. Apple M4 Pro/macOS, Node 26.7.0; native game captures use
bundled full headless Chromium 153, 411x789 CSS pixels, Canvas, real authority
Worker and IndexedDB, thicket seed 2026 and no CPU throttle. The phone remains
unmeasured. Sampling runs sequentially without builds/tests alongside them.

Native deep probes extend `mobile-authority.mjs` with unchanged-order collision
visit/test/hit counts, ground cache hits/misses, spanning-footprint scans and record
index/attachment counters. Dirty notifications are timed separately and counted
once per unique actor per server tick. Per-phase unique counts partition that
single deduplication; a later notification in another phase is not another unique
actor. Native CPU captures restore production sources and remove the added dirty
and query counters; the original diagnostic phase/AI method wrappers remain.
CPU sampling uses the existing owned-Worker helper at 1,000 microseconds. Deep
counter/timer overhead is included; its timings are attribution, not clean baseline
performance. CPU samples cannot be interpreted as projected savings.

Controlled crowds extend the existing `active-crowds.mjs` approach through shared
ScenarioSession/Realm/EntityManager and memory persistence. Each fresh flat scene
contains 0/24/96/384 dogs spaced 24px horizontally and 18px vertically, plus a
stationary player outside alarm range. Animals are held resting with long timers,
or in long precommitted eastward native travel. Planning is deliberately absent;
AI updates, terrain/body collision, ground tracking, attachments and dirty handling
remain production behavior. All dogs remain admitted; no overlaps occur. Three
repeats use 60 warmup and 180 retained steps; all moving dogs advance 88px in the
complete four simulated seconds. A second shallow lane restores production source
and removes per-query, per-dirty and subphase instrumentation. Replication is timed
separately after retained ticks. Accelerated Node steps exclude rendering, actual
IndexedDB and network delivery; they are not Worker deadline or FPS measurements.

## Collision scaling

The shallow production-source crowd lane measures:

| Nearby dogs | Stationary tick mean | Moving tick mean |
| --- | --- | --- |
| 24 | 0.281–0.344ms | 0.317–0.371ms |
| 96 | 2.168–2.442ms | 2.549–2.633ms |
| 384 | 19.695–20.839ms | 22.191–23.727ms |

These tick timings exclude the separately measured replication. The stress fixture
has many more nearby bodies than the native captures and intentionally suppresses
new goals; it isolates recurring physics work, not a representative phone scene.

At 96 stationary dogs, each tick makes 96 NPC extra-blocker queries, filters 5,232
entity candidates and evaluates 5,136 non-self entity AABBs, with zero hits. At
384 it makes 384 queries, filters 46,736 candidates and evaluates 46,352 AABBs,
again zero hits. Moving cases test approximately 5,570/50,382 entity AABBs per tick
at 96/384 dogs. All three repeats agree on deterministic work counts.

Separate production-source Node CPU captures run 60 warmup plus 840 retained
stationary/660 retained moving steps, twice for each 96/384-dog condition. Longer
moving captures reached the sleep boundary for outermost actors and are excluded;
the accepted twelve-second moving lane keeps every dog admitted and advancing
264px. Stationary captures retain their fifteen-second simulation window. In the 384-dog scene,
collision resolution accounts for about 51.1–52.9% of sampled active time across
the four captures. Bounding-box construction, EntityManager callback/filter work
and mutation-observed component access dominate self rows; the hash lookup itself
is only part of the expense. Collision inclusive time already contains those
children. Do not add it to their rows or interpret this fraction as a potential
50% saving. These profiles have no deep query counters and remain accelerated
Node attribution, distinct from native Worker captures.

The entity hash uses 256px chunks: a small actor footprint receives every entity
in its chunk range. Collision then allocates an exclusion Set, allocates a filtered
array for height/attachment checks, and visits the retained candidates again.
Ground candidate reuse already avoids most repeated hash queries, but still
resolves fresh support against broad candidate lists.

Spanning footprints also have a global supplemental pass on every range query.
The stationary 384-dog fixture examines 14,976 spanning entries per NPC movement
pass; moving averages 19,637. These figures count supplemental entry visits,
including entries already present in the local bucket. They are distinct from
AABB-test counts and must not be added as equivalent operations.

## Native game and bookkeeping

An eight-second dog-scene walk advances 513px continuously, confirmed by one-second
position samples. It maintains about 60Hz, frame p95 16.7ms and no page errors.
Deep per-authority-tick means: NPC movement 0.290ms, ground 0.101ms, actor selection
0.178ms, streaming 0.107ms and replication 0.142ms. These scopes overlap with nested
dirty handling; do not sum their percentiles or use them as expected savings.

That moving capture makes about 49 NPC extra-blocker queries per tick, returns 218
entity candidates and tests 109 entity AABBs, with only 0.03 blocker hits per tick.
It also returns about 595 prop candidates in 49 movement queries. Ground performs
26 support resolutions but only 10 candidate-list lookups per tick: current
same-pass reuse is effective. Counts alone do not identify expensive individual
prop shapes or prove a prop-query cache would be a net win.

Approximately 145 dirty notifications touch about 40 unique actors per tick.
Their combined measured time is 0.070ms per tick, overlapping the enclosing
physics/AI scopes. About 144 record index checks correspond to only 0.12 membership
changes per tick. Unattached root traversal and empty child-array copies remain
common. In the controlled 96-dog scene, rest produces 193 notifications for 97
unique actors; moving produces 289. At 384 dogs these become 769/1,153 notifications
for 385 unique actors. Timer/semantic changes still require persistence; dirty
notifications are not equivalent to immediate serialization or disk writes.

Two additional eight-second native Worker CPU walking captures stay continuously
moving, and two twenty-second idle captures characterize ordinary resting work.
Snapshot construction/validation, mutation-observed component reads and streaming
remain recurring sampled costs. GC appears in samples, but no temporal correlation
with a stutter has been established. The native workload is distributed; the dense
fixture does not establish collision as the largest cost in every ordinary scene.

## Recommendation

1. Prototype a footprint-aware narrow spatial query for collision/support. Compare
   32px/64px cells or an equivalent exact-footprint visitor against current chunk
   queries. Index large/spanning bodies into intersected cells rather than scanning
   every spanning body globally. Preserve the existing chunk-query contract for
   residency/replication and stable candidate order where collision behavior uses
   it. Include update/deduplication overhead in the comparison, not just lookup time.
2. Fuse exclusion, attachment/height filtering and overlap testing in the NPC
   blocker path, eliminating its temporary Set and filtered array. This is a
   smaller independently measurable slice; it does not by itself fix broad bucket
   scaling. Preserve both axis results, momentum clipping and blocked-AI reactions.
3. Measure an unattached/no-children record fast path and, separately, safe repeated
   dirty-registration coalescing. Spatial scope and attachment invalidation must
   remain immediate; saves/eviction cannot miss later mutations. Ordinary native
   bookkeeping is small enough that this is secondary to dense-query work.

Retain current ground reuse. Do not introduce cross-tick support caches without
explicit terrain/body/readiness invalidation. Snapshot live-field validation still
costs time, but replacing it with revisions requires a complete network-field
mutation contract; persistence observation alone remains insufficient. Extra
workers and lower publication rates are later experiments, not selected by this
profile. Compare any prototype on both sparse native scenes and dense idle/moving
fixtures, then repeat on the phone when available.

## Evidence and validation

Sanitized numerical captures and source/probe hashes belong in
[114 evidence](../benchmarks/114-authority-work-profile.json). Raw profiles, temporary
source overlays, host identifiers and worlds remain local. All nine native captures
have no page errors. All three native walking captures stay moving; every crowd
actor has the expected complete-window displacement, and all three deep repeats
have identical work counts. Frozen source hashes match the committed runtime.

Typechecks (all three configurations), all 2,428 unit tests in 250 files and lint
pass; lint retains 118 existing warnings/34 infos. This delivery changes only
documentation and sanitized evidence. No runtime, renderer, execution policy or
committed diagnostic script changes, so build/browser/streaming suites are not
repeated. Owned browsers, pages and Vite servers close through the probe finalizers.
