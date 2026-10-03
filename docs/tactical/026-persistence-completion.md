# 026 — Persistence completion, traffic and admission budgets

Status: in progress after 024 integration. Parent 019.

Complete world-scoped shared containers, transactional player-location/transfer
barriers, traffic records and origin suppression, edit readiness and pressure
admission. Validate both real adapters with the same lifecycle fixtures; add
slow-storage/failure and sustained multi-player travel evidence. Remove obsolete
filesystem/migration code and stale metadata fields. Audit all service caches,
attachment dependency tickets and shutdown/rejoin fences before parent completion.

024 resolved distant-origin inspection and paged-query races. Save pressure must stop mutation producers before the
bounded queue rejects an already-performed gameplay operation. Root attachment
records share one spatial scope; player references and dependency halos need
explicit readiness and validation coverage.


## Implemented checkpoint

- Format 3 stores outdoor and interior record namespaces in one world database,
  with one writer/coordinator and reference-counted leases. Same-world transfer
  snapshots commit together. The global player-location record remains the last
  recovery/visibility pointer: a crash before that commit resumes the old visit;
  after it, the complete destination visit is durable. Cross-world travel uses
  this prepare-then-pointer protocol, not a transaction spanning databases.
- Traffic has individual indexed records, stable identities and original spawn
  markers. Route/speed/velocity survive reload; complete batches validate before
  publication. Roof passenger integration passes.
- Shared producer pressure stops simulation and loading, rejects new edits with
  a visible explanation and resumes after acknowledgement. Commands awaiting
  chunk readiness use an ordered 64-entry queue. Tree undo addresses its affected
  span and loads the required anchors before applying history.
- Limits: 4,096 holders, 8 reads/4 evictions, 4,096 live entities, 8,192 props,
  4,096 records/8 MiB per spatial collection, 65,536 records/64 MiB queued, and
  soft pressure at 2,048 dirty/pending records or 8 MiB pending. Ticket priority
  preserves arrivals/player demand before excess observer demand.
- Save barriers acknowledge the caller's accepted epoch even if another realm
  continues writing. Failed commits/close retain state and permit retry. Failed
  synchronous chunk publication rolls back new actors and dirty bookkeeping.
- Attachment dependencies, per-tent timers, active script prop queries and
  spawner eviction cleanup share the same authority code. Clearing optional
  semantic fields preserves mutation observation for subsequent changes.
- `storage_stats`, `/api/world-storage`, and local Worker diagnostics expose
  resident/active counts, load/eviction counters, pending age/bytes, index pages,
  write amplification and commit timing.
- Removed the unused V8-per-record filesystem store and legacy migration path.
  Browser databases use `-records-v3`; old worlds stay explicitly incompatible.

## Evidence so far

The common `StreamingConformance` fixture passes on real SQLite and IndexedDB:
1,000 distinct chunks, settled maxima of one chunk/actor/feature at fixed one-chunk
interest, followed by restart, attachment/AI state, moved prop timer and deletion
checks. Browser executor tests additionally prove atomic abort and exclusive
writer leases. SQLite process-kill tests prove acknowledged WAL recovery,
uncommitted rollback and `integrity_check=ok`. Focused storage/traffic tests pass;
full integration validation and final lifecycle audit are still in progress.

Checkpoint validation: frozen source passed all three typechecks, 1,360 unit
tests, lint (existing warnings), production build, 285 browser tests (one
existing skip), and `streaming:bench -- --assert-ready`. The final audit found
background save failures could still stop the Worker; recovery hardening and
its focused regressions are the remaining work before parent completion.
