# Entity activation, AI and unloading

Topic: entity-activation
Status: incremental persistence and shared lazy residency are implemented.
World containers, traffic records, bounded admission and recovery validation
are complete.
Updated: 2026-10-03.

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
