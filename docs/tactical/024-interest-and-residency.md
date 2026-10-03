# 024 — Shared interest, readiness and actor residency

Status: planned next slice. Parent [019](019-entity-streaming-and-persistence.md).
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

Plan detailed gates after 021 integration evidence. No host-specific Realm,
interest manager or coordinator is permitted.
