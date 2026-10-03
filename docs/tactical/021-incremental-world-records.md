# 021 — Incremental world records and platform adapters

Status: delivered, 2026-10-03. Parent [019](019-entity-streaming-and-persistence.md),
contract [020](020-shared-record-persistence.md).

Implement SQLite on a Node IO worker and IndexedDB behind the shared record
coordinator. Use exclusive writer leases and transactional spatial indices.
Cut Realm saves over to durable actor/prop identities, per-record semantic
snapshots and mutation tracking; remove entity arrays from world metadata.
Inject host dependencies rather than importing browser defaults in GameServer.
Legacy saves are incompatible, not migrated. Readiness and eviction follow in
the next slice; any temporary eager hydration is explicitly transitional.

Required evidence: executor conformance on real SQLite and browser IndexedDB,
atomic rollback and lock contention, close/reopen identity/state, one-actor
write amplification in production, unchanged world/editor/interior behavior,
typecheck/unit/lint, build/browser suite and streaming readiness.

## Delivered evidence

Production hosts now use a shared RecordPersistenceStore and coordinator over
real IndexedDB or SQLite (Node IO worker, WAL/FULL and a lifetime writer lease).
GameServer has required injected dependencies; browser composition lives in its
host module. Async shutdown drains saves before releasing the writer. Live
inspection borrows the writer rather than attempting a second lease.

Stable actor identities, semantic motion/AI state, attachment IDs, authored props
and per-feature overrides replace metadata actor arrays. Mutation tracking writes
one record for one changed actor at resident populations 100 and 10,000; the
coordinator fixture also covers 100,000. New format worlds are selected explicitly;
old saves are left intact and cannot be joined. No migration is attempted.

Real SQLite and browser IndexedDB tests cover writer contention, rollback,
indexed moves, deletes, typed payloads and reopen. Typecheck, 1,339 unit tests,
lint and build passed. The 282-test browser suite had one real regression (tree
brush undo retained removed records) and one stale-inventory failure from source
changes during the run. The regression was fixed with a reload/undo/redo unit
case; all affected browser suites then passed. Streaming benchmark v4 passed
`--assert-ready`. Inventories were regenerated before the final browser runs.

Transitional limits: Realm still eagerly hydrates bounded pages and saved terrain
mirrors; the traffic population remains a bounded metadata array. Tick tiers and
retained actor memory are not yet the target. These are owned by
[024](024-interest-and-residency.md), along with read readiness, admission pressure,
attachment residency and save-acknowledged eviction. This checkpoint proves the
incremental write cutover, not completion of the parent architecture.
