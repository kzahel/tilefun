# 020 — Shared record persistence contract

Status: contract complete; production integration continues in 021. Parent: [019](019-entity-streaming-and-persistence.md).
Owner: [entity activation](../topics/entity-activation.md).

## Scope

Phase A establishes a platform-neutral record executor and shared coordinator:
individual versioned records, bounded spatial pages, atomic puts/deletes,
immutable snapshots, revision sequencing, pending-write visibility, bounded
admission, acknowledged flush/close and retained state on failure. The memory
executor supplies deterministic race/fault fixtures. Production save cutover and
real SQLite/IndexedDB adapters follow immediately in the next slice.

Current baseline: `Realm.buildSaveMeta` traverses all authored actors and props
for each metadata snapshot; `SaveManager.loadChunks` reads the whole collection.
For N unchanged actors and one edit, the snapshot visits N actors. The new
record-level fixture holds 100, 10,000 and 100,000 actors and requires exactly one
record write for the same edit. This fixture verifies the storage contract;
production amplification is not fixed until the Realm cutover.

## Gates

- [ ] Same shared coordinator for both production adapters (021 integration gate).
- [x] Immutable writes; newer mutations survive older acknowledgements/failures.
- [x] Atomic move/delete groups and correct indexed pending-write visibility.
- [x] Count/byte pressure rejects the complete incoming group before admission.
- [x] One-record edit is independent of total saved population.
- [x] Typecheck, unit tests and lint before the contract commit.

The next slice selects Node's built-in SQLite executor on a storage worker and
IndexedDB transactions, then cuts production over to per-record saves. No
legacy-world migration or duplicated host simulation is authorized.

Validation: typecheck, all 1,335 unit tests and lint passed (existing lint warnings only). Production behavior is unchanged in this slice.
