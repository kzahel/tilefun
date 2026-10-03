# 026 — Persistence completion, traffic and admission budgets

Status: complete. Parent 019. Checkpoint: 97fad70; final recovery commit follows.

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
  8,192 records/8 MiB per spatial collection, 65,536 records/64 MiB queued, and
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

## Evidence

The common `StreamingConformance` fixture passes on real SQLite and IndexedDB:
3,000 distinct chunks: 1,000 single-player steps with settled maxima of one
chunk/actor/feature, then 1,000 steps with two distant moving player tickets,
retaining exactly two chunks/actors/features/holders and draining pending writes
after each settled step. Restart, attachment/AI state, moved prop timer and
deletion checks follow. Browser executor tests additionally prove atomic abort and exclusive
writer leases. SQLite process-kill tests prove acknowledged WAL recovery,
uncommitted rollback and `integrity_check=ok`. Focused storage/traffic tests and the final lifecycle audit pass.

Checkpoint validation: frozen source passed all three typechecks, 1,360 unit
tests, lint (existing warnings), production build, 285 browser tests (one
existing skip), and `streaming:bench -- --assert-ready`. The final audit found
background save failures could still stop the Worker; recovery hardening and
its focused regressions are included in final validation below.


## Final lifecycle audit

Expected save failures no longer kill authority. Worker flush/shutdown receipts
carry failure explicitly, preserve the running instance and allow retry; the
flush chain recovers after rejection. Shared realm/global player-location
pressure freezes producers on every host. Shutdown quiesces admission/load work
and flushes all realms before tearing any down; a failed realm close resumes its
holders without discarding live actors or scripts.

A failed player-location commit can already have staged the destination pointer.
Transfer rollback now supersedes it with the original location before retry or
close can commit it. Tests inject failure after staging, not just before save.
Successful teardown releases live actors, props, replication and tag references.

Attachment admission validates merged group size, chain depth and bounded
relative offsets. Stored groups validate before publication. Dependency readiness
uses resolved parent-relative positions and inherited motion; riding players pin
the root. Physics resolves up to the admitted depth and refreshes active spatial
membership after separation/parent motion. Sleeping overlap pairs are forgotten
without a gameplay exit; waking can issue a fresh enter. Script tags/attributes
remain transient, as declared by the record codec.

Managed activity tests cover frozen balls/tent clocks/script queries, reduced AI
with fixed motion steps, wake without catch-up, saved player mounts and retryable
failed close. Realm population-spawner cadence is transient; per-actor AI, route,
death and tent timers are durable. There is no offline progression.


Editor entry now acknowledges/discards pending movement inputs and stops residual
horizontal velocity; inputs received while editing cannot replay on exit. A real
Vite full reload exposed the previous drift. The dense saved-world inspection
test now awaits the Worker save/shutdown receipt before navigating away, instead
of relying on a best-effort unload message.

## Final validation and limits

Validation used an isolated frozen copy of the implementation, excluding the
concurrent Workshop edits in the shared checkout:

- All three typechecks; 1,369 unit tests; lint with 124 existing warnings and no
  errors; generated inventory checks and production build pass.
- Full browser run: 283 passed, one existing skip and two failures. After fixing
  editor drift and the missing save acknowledgement, all 12 relevant browser
  checks pass, including both failures, Worker lifecycle and dense interiors.
  Seven additional remote multiplayer, room editing, character persistence and
  interior checks pass. No assertions were weakened.
- Real SQLite and browser IndexedDB pass the same extended 3,000-chunk fixture.
  Fault tests cover save pressure/retry, partial publication, query reconciliation
  limits, prepared player-location rollback and shutdown/fatal-error boundaries.
  A failed idle world's save does not pause a healthy world's player.
- `streaming:bench -- --assert-ready` passes on Apple M4 Pro, macOS 25.6 arm64,
  bundled headless Chromium 153, 1280×900, seed 2026. Across 12 regional-v4/v10
  samples, input acknowledgement p95 is 49.8–66.8 ms and server tick p99 is
  0.7–2.0 ms. Walk/sprint/reverse have no missing terrain or incomplete-cache
  frames. The v10 cold sample has two missing-data frames; cold/zoom presentation
  is outside this benchmark's movement-readiness gate.

The travel fixture proves bounded retained objects and durable save progress for
its fixed sparse demand, not a universal heap/allocator bound or acceptable
arbitrarily dense crowd latency. Timings are machine-dependent. Browser storage
acknowledgements do not establish SQLite-equivalent power-loss guarantees.
Dense active campfire collision/rendering and gem pickup remain the independent
next investigation in the owning topic.
