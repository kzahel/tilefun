# 024 — Shared interest, readiness and actor residency

Status: core delivered, 2026-10-03. Parent [019](019-entity-streaming-and-persistence.md).
Depends on the incremental record cutover in [021](021-incremental-world-records.md).

Introduce one shared interest manager with owner tickets for players, camera
observers and temporary dependencies. Aggregate the union of requested chunks;
simulation is a subset of ready residency. Async chunk holders load terrain,
actors and feature overrides before publication. Reject stale completions, stop
obsolete loads promptly, and bound admission and decoded retention.

Remove eager world-wide terrain/actor reads and saved terrain mirrors. Eviction
freezes actors, flushes required revisions, rechecks demand and attachments, and
then releases actors, collision/service membership and decoded data. Failures
retain dirty state and backpressure the producer. Returning interest cancels
retirement. Runtime removal for eviction is not death.

Shared gameplay systems receive active memberships: reduced AI decisions are
separate from fixed-step physics, and complete sleep freezes gameplay timers.
Terrain/height access cannot generate unknown chunks during collision. Test
camera/player divergence, two distant players, attachments, generated origins,
edit/delete/move round trips, cancelled loads, failed saves and long travel.

## Delivery and evidence

One shared RealmStreaming controller now owns player/observer/arrival demand,
readiness and acknowledged retirement. Player demand is full decisions within
2 chunks, reduced decisions within 4, with a resident collision halo of 5.
Camera demand is residency only. Terrain and actor records hydrate by indexed
scope; startup no longer enumerates saved terrain or actors. Unknown collision
remains blocking. Runtime IDs are fresh after rehydration; attachments use stable
IDs and a shared root scope. Generated actors receive durable initialization
markers, including empty origins, and moved props preserve their origin scope.

Actors freeze during retirement; save errors keep their terrain and memberships.
Late cancelled reads cannot publish. Reduced decisions retain velocity between
decisions while movement uses normal fixed steps. Physics, balls, separation,
parent positions and gameplay query/overlap passes use selected active entities.
Tag memberships release on eviction without a death callback. Arrival paths await
readiness. Player mount references survive save/reopen.

Tests cover 1,000 distinct chunks with one retained chunk/actor after each move,
attachment and moved-feature round trips, failed-save retention, cancellation,
renewed interest and distant player/camera unions. Browser testing found a real
query invalidation race: unrelated saves invalidated arrival reads. Query-local
mutation tokens now reconcile moves/deletes through commit and across paged
hydration, with deterministic concurrent-write tests. Saved inspection also
looks up bounded generated candidate IDs when origin chunks lie outside its view.

Validation used a frozen snapshot because concurrent railway/Workshop work was
changing source inventories. Typecheck, lint, build and 1,348 unit cases passed
(the unchanged city generation case required a rerun after a CPU-contention
timeout). The 282-case browser run passed 279 with one skip and two real arrival
failures; after the query fix the affected remote-world, world-map and dense
persistence suites passed. An unrelated review timing failure passed its focused
rerun. Streaming benchmark v4 passed `--assert-ready` on the frozen snapshot.

This is not parent completion. [026](026-persistence-completion.md) owns remaining
world-container/transfer consolidation, traffic records, producer backpressure,
attachment dependency limits, full service audit and real-backend sustained
validation. No host-specific Realm, interest manager or coordinator is permitted.
