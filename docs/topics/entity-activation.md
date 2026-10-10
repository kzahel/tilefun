# Entity activation, AI and unloading

Topic: entity-activation
Status: incremental persistence and shared lazy residency are implemented.
World containers, traffic records, bounded admission and recovery validation
are complete.
Updated: 2026-10-10.

Owns simulation activity, actor persistence/residency and the cost of distant entities.
[Performance](performance.md) owns broader timing evidence and renderer work;
[client/server architecture](../client-server-architecture.md) owns execution
boundaries. Single-player authority runs in a browser Worker using the shared
server implementation, so moving work to that Worker does not eliminate it.

## Selected direction

The 2026-10-03 request authorizes a new save format without existing-world
compatibility. The [target architecture](../entity-streaming-architecture.md)
defines individual durable entity/prop records with spatial indices, shared
asynchronous persistence policy, IndexedDB for browser authority and SQLite
for Node. It separates ticket demand, data readiness, replication and simulation;
sleeping actors freeze without wall-clock catch-up. Actual eviction waits for
required save acknowledgements and releases decoded caches as well as actors.

[Reference research](../research/entity-streaming-reference.md) records the
inspected Minecraft Java 1.17.1 and mclone sources. Java uses chunk-sized entity
lists; individual records and reduced-rate AI are deliberate Tilefun choices.
[Tactical 019](../tactical/019-entity-streaming-and-persistence.md) records the completed
parent sequence. Runtime delivery includes [020](../tactical/020-shared-record-persistence.md) and
[021](../tactical/021-incremental-world-records.md); [024](../tactical/024-interest-and-residency.md) and
[026](../tactical/026-persistence-completion.md) complete residency and scheduling.

All hosts must execute the same authoritative server and persistence coordinator;
only injected host adapters differ. The
[shared implementation boundary](../entity-streaming-architecture.md#one-server-implementation-injected-host-adapters)
is a required architecture and validation constraint, including removal of
browser adapter defaults from the shared server during the refactor.

## Current behavior

The shared [RealmStreaming](../../src/server/RealmStreaming.ts) controller loads
terrain, actor/prop records and origin overrides before publishing a chunk.
Player tickets request full AI decisions within 2 chunks, reduced decisions
within 4 and collision support within 5. Camera tickets add residency without
activating distant AI. Distant players contribute a union of neighborhoods.

[094](../tactical/094-interest-demand-cache.md) caches the sorted demand assembled
from ordered ticket values. `set` owns a snapshot; resubmit changed ticket/range
values explicitly. Equivalent and empty submissions avoid reassembly. Owner,
range, activity, reason, expiry and order changes invalidate it, as do exact lease
expiry and backwards clock changes across an expiry boundary. Demand maps/values
remain independent per call. Readiness and residency reconciliation stay live
on every streaming update, including pressure recovery and failed-read retries.

[088](../tactical/088-wildlife-work-budgets.md) further narrows wildlife simulation
within that membership. An animal wakes within 192px of any player or in that
player's visible chunk range plus one chunk, clamped to the player's two-chunk
neighborhood. Exit hysteresis lasts at most 0.5 simulation seconds with a wider
margin. Followers, attached groups and moving ordinary-body contacts retain
activity. A fresh actor receives one grounding step before sleep; sleeping actors
retain residency, collision bodies, RNG and motion phase without accumulating dt.
Ordinary avatars, vehicles and projectiles retain their existing membership.

[090](../tactical/090-incremental-simulation-membership.md) caches demanded ready
attachment groups by spatial/topology revision and ordered ready activity chunks.
Ordinary state writes do not rebuild membership. Live view/proximity/follower/
contact eligibility still runs each step; sleeping wildlife skips trajectory
readiness queries. Supported ordinary bodies supply wake contacts before wildlife
selection. Eviction drops cached references immediately; world replacement and
successful teardown clear membership and hysteresis. Active-body readiness,
fixed-step dt, bucket ordering and fresh grounding remain unchanged.

[091](../tactical/091-static-prop-admission.md) caches ordered static prop activity/
readiness admission. Live demand/ready-key and identity/position/collider-size
comparisons refresh changed results through existing support checks, including
halo readiness and in-place procedural edits. Unchanged props make no support
queries and reuse the selected array. Removal, world replacement and teardown
release references/listeners; collision geometry and moving entity readiness
remain live. Game and embedded scenarios share the Realm selector.

Movement remains fixed-step in both active tiers; nominal reduced decision rate
is 15 Hz at a 60 Hz server rate. Sleeping/retiring actors preserve semantic
state without wall-clock catch-up. Balls, entity physics, separation, attachments
and gameplay query/overlap passes receive active memberships. Lifecycle listeners
release tag references on eviction without reporting a death.

Dirty actors, authored props, per-feature overrides and edited terrain save as
individual transactional records through one coordinator on IndexedDB/SQLite.
Startup uses local indexed loads. General eviction freezes actors, waits for a
finite snapshot barrier, rechecks interest and dirty scope, then releases runtime
objects, collision membership and terrain. Failed writes retain state. Runtime
IDs change on return; durable IDs and root-scoped attachment records do not.

[024](../tactical/024-interest-and-residency.md) records deterministic fault tests,
1,000-chunk bounded-retention evidence, real browser/Node integration and the
concurrent spatial-query fix discovered during that integration.

The transient entity spatial hash keeps origin-cell buckets plus an overlap index
for any collider footprint crossing a chunk edge. Refresh that index on every
move or pose change, including changes inside the same origin cell. Exact cell
queries must still find a sub-chunk train roof straddling the edge; otherwise
missing-input gravity ticks can drop a rider. Radius queries remain origin based.
This index is independent of durable actor residency and persistence scope.

## Completion validation

[026](../tactical/026-persistence-completion.md) records completion:
outdoor/interior namespaces share one writer, transfers have an atomic world
snapshot and durable recovery pointer, traffic uses spatial records, and pressure
pauses producers with visible feedback. Actual IndexedDB and SQLite each pass
the same 3,000-distinct-chunk fixture: 1,000 single-player steps and 1,000 steps
with two distant moving player tickets, followed by semantic restart checks.
The full browser run and focused recovery/editor follow-ups pass; 026 records
exact test counts, benchmark observations and limits.

Dense active crowds still produce collision-pair and rendering costs. Bounded
unloading is not proof of acceptable performance for arbitrarily dense nearby
populations.

The [2026-10-10 desync investigation](../research/mobile-desync-investigation.md)
confirms that 384 camera-resident distant dogs leave only the player active;
nearby dogs instead incur expensive collision/support work. Normal generated
countryside fixtures have 94–173 active actors. On the attached Pixel 7a, a fresh
dog-clearing world has 242 resident actors (221 robins), approximately 160 active
and three in visible chunks. Baseline tick p95 is 23–26 ms. Decision-only culling
reduces spikes but leaves fixed-step offscreen physics; full wildlife sleep beyond
a one-chunk view margin/proximity reduces active membership to 22 and tick p95 to
12.5–13.5 ms. These physical measurements describe the earlier diagnostic control,
not the shipped policy's mobile performance. [088](../tactical/088-wildlife-work-budgets.md)
implements shared sleep interest and deterministic robin work quotas, including
bounds inside an individual path search. It deliberately chooses among a smaller
set of fully checked candidates; 085's original-choice parity applies to the
unbudgeted allocation optimization only. 090 supplies fresh phone walking controls; original-save/contact acceptance and
cheaper resting-body support/broadphase queries remain follow-up. Prediction's history
weakness has its own owner; the user's original save has not been profiled.

Campfires have no AI: their definition in
[EntityDefs](../../src/entities/EntityDefs.ts) gives them animation and a solid
collider. Dense nearby fire piles need a separate collision/rendering and gem
pickup investigation; improving distant AI cannot by itself resolve local
crowding. Original reports and pictures remain in the private
[Play ideas inbox](play-ideas.md), not in Git. A reported symptom is not evidence
that these activation gaps caused it.

## Delivery and next work

- [x] Make NPC separation honor existing tick selection and per-entity elapsed
  time; cover sleeping/waking crowds, reduced-rate substeps and multiplayer
  interest. [Tactical 018](../tactical/018-tick-aware-npc-separation.md).
- [x] Research reference implementations and document the target architecture
  and prioritized parent plan without changing runtime behavior.
- [x] Deliver minimum durable identity, semantic codecs, transaction/race tests
  and incremental writes on real IndexedDB and SQLite. One-actor write counts
  remain constant as unchanged population grows; see tactical 021.
- [x] Deliver shared tickets/readiness, lazy indexed loads, acknowledged eviction
  and separate reduced decisions from fixed-step motion.
- [x] Complete the container/traffic/pressure and lifecycle gates in 026.
  [Tactical 019](../tactical/019-entity-streaming-and-persistence.md) owns phase
  dependencies, acceptance scenarios and failure/pressure gates.
- [ ] Investigate dense active campfire collision and pickup behavior separately;
  general distant-entity unloading does not establish the cause of that symptom.

Create bounded child tacticals as implementation slices are selected. Existing
[AI tests](../../src/server/tickAllAI.test.ts) cover skipping the AI pass, not
complete simulation sleep. Execution changes require the standard checks
and `npm run streaming:bench -- --assert-ready` in addition to focused regression
tests; see [performance validation](performance.md#evidence-and-validation).

## Generated railway services

[Trains](trains.md) use a bounded service controller with at most four trains and
footprint/braking-halo dependency tickets. One `railServices` record owns each
train, separate from ordinary entity records. Retirement waits for a finite save
barrier; returning to either station restores the same frozen service. Unknown
terrain pauses movement. [Tactical 036](../tactical/036-first-generated-railway.md)
records the initial implementation and validation.
