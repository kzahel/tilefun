# Entity persistence and streaming references

Researched: 2026-10-03. This is evidence for the proposed
[Tilefun architecture](../entity-streaming-architecture.md), not a claim that
Tilefun already implements it. Continuing status belongs to
[entity activation](../topics/entity-activation.md).

## Provenance and limits

Inspected the sibling `mclone` checkout at commit
`f9efb9be7d64baafe660a1cd1a5322d17b47a6b3`, including its local decompiled
**Minecraft Java 1.17.1** reference under
`reference/minecraft-1.17.1/src/net/minecraft/`. Paths below are relative to that
checkout unless identified as Tilefun paths. This is a specific historical Java
implementation, not a survey of current Minecraft editions. The checkout's
newer partial world-generation reference is not evidence about entity storage.
No reference Java source, binaries or assets are copied into Tilefun.

## Minecraft Java findings

| Source / symbols | Observed behavior | Lesson for Tilefun |
| --- | --- | --- |
| `server/level/DistanceManager.java`, `TicketType.java` | Owner/reason-specific tickets determine chunk demand; minimum ticket levels propagate. Some ticket types expire. Player demand and forced demand have distinct sources. | Centralize demand, release and expiry instead of independently computing terrain, AI and replication rectangles. Do not copy Minecraft's numerical radii. |
| `server/level/ChunkHolder.java`, `FullChunkStatus` | Runtime states distinguish inaccessible, border, ticking and entity-ticking chunks, separately from generation progress. | Requested activity and data readiness are different dimensions. Loaded need not mean simulated. |
| `world/level/entity/Visibility.java` | `HIDDEN`, `TRACKED` and `TICKING` distinguish accessibility from simulation. | A camera can observe resident actors without activating their AI. |
| `world/level/entity/PersistentEntitySectionManager.java`, `updateChunkStatus` | Tracking and ticking start/end through separate callbacks. Hidden chunks enter an unload queue. | Maintain activity memberships on transitions; do not repeatedly scan every saved actor. |
| Same class, `storeChunkSections`, `requestChunkLoad` | Load status is fresh, pending or loaded. Saving waits for a pending load; a fresh section containing actors first requests its saved entities instead of overwriting unknown storage. | Unknown storage is not an empty chunk. Load/merge before authoring or replacing a chunk population. |
| Same class, `processChunkUnload`, `saveAll` | Unload submits entity storage and removes runtime actors/passengers. `saveAll` drains load/save work and flushes. Ordinary eviction does **not** await a physical disk flush for each actor. | Separate removal from death; define acknowledgement semantics explicitly. Tilefun's proposed commit-before-eviction contract is a deliberate stronger coordination rule. |
| `world/level/chunk/storage/EntityStorage.java` | Entity NBT is stored as a **list per chunk**, with position and data version; an empty list removes the chunk record. | Java avoids one world-wide entity list, but still rewrites a local chunk population. Per-entity records are a Tilefun design choice, not what this Java code does. |
| `world/level/chunk/storage/IOWorker.java` | Pending writes coalesce by chunk; reads can see pending data; synchronization waits for outstanding writes and optionally flushes. | Preserve pending-write visibility and revision ordering. A queue also needs explicit capacity and scheduling limits. |
| `server/level/ChunkMap.java`, `processUnloads`, `scheduleUnload` | Unloading is scheduled and rechecks the chunk future before proceeding. | Late asynchronous results must not retire a newly demanded or superseded chunk. |
| `world/entity/Entity.java`, `EntityType.java` | Numeric runtime IDs are allocated during construction. UUID and semantic entity fields are saved; generic runtime tick count is not. Loading constructs a new runtime object. | Keep durable identity independent of network/runtime identity. Save meaningful state, not every live field. |

These sources support Minecraft-style residency and activation boundaries.
They do **not** establish a universal vanilla rule that distant AI runs at a
lower frequency. Tilefun's existing reduced-rate tier and the proposed
decision-rate policy are Tilefun extensions.

## Mclone findings

Mclone provides an implemented cross-platform reference, not a library to port
wholesale. Its Rust engine and 3D chunk assumptions differ from Tilefun.

- `docs/topics/unified-persistence-interface.md` and
  `native/crates/mclone-server/src/persistence.rs` define one typed asynchronous
  request/completion boundary. Shared coordination owns codecs, ordering,
  dirty state, pending-write visibility and lifecycle. Executors own physical
  storage. Native worlds use SQLite; browser worlds use IndexedDB.
- `native/crates/mclone-server/src/persistence/record_executor.rs` defines
  namespaces, keys, versioned/revisioned payloads and atomic mutation batches.
  The SQLite executor in `persistence.rs` commits a batch in a transaction.
  World-scoped writer leases are retained through close. The browser executor
  is `native/apps/mclone-web-client/www/mclone-web-persistence-executor.ts`.
- `docs/topics/persistent-actor-identity.md` and
  `native/crates/mclone-server/src/entity/store.rs` separate durable actor IDs
  from reconstructed runtime IDs. Relaunch tests check identity and subtype
  state, not equality of runtime IDs or generic tick counters. Authored actors
  seed a persistent destination once; reopening it must not duplicate them.
- `native/crates/mclone-server/src/distance_manager.rs` maintains resident and
  simulation interest separately, with simulation contained in residency.
  Player/observer tickets, aggregate interest deltas and limited promotions
  provide useful models for a shared policy owner.
- `docs/tactical/275-bounded-persistence-streaming.md` records an important
  failure: long travel accumulated obsolete reads, cache work and write
  starvation. The completed fix bounds queue counts **and bytes**, cancels
  obsolete interest immediately, rejects stale completions, releases decoded
  caches and schedules writes fairly. Durable writes are retained under
  pressure; disposable generation-cache work may be skipped. Its constants
  are evidence about mclone, not justified Tilefun budgets.

Mclone also uses entity-chunk records (`EntityChunkRecord` contains an entity
vector). Tilefun should borrow the shared coordinator and lifecycle discipline
while using individual records to avoid dense-chunk write amplification.

## Tilefun audit

Audited against `a576b68` and the working source on 2026-10-03. These are code
findings, not measured performance claims.

| Source | Present limitation |
| --- | --- |
| [SaveManager](../../src/persistence/SaveManager.ts), [Realm](../../src/server/Realm.ts), `buildSaveMeta` | Saved metadata contains the entire authored entity/prop list and procedural edit/deletion collections. A metadata save rebuilds that list. The entity record contains type, position and optional procedural identity, not a general semantic snapshot. This does not mean every simulation tick currently saves every entity. |
| `Realm.loadWorld`, `SaveManager.loadChunks` | Startup reads all saved terrain records and hydrates the saved entity list. Live terrain chunks are lazy, but their durable array mirrors remain in memory. |
| [ChunkManager](../../src/world/ChunkManager.ts) | Unloading live terrain does not release all saved terrain mirrors or placed actors. |
| [PersistenceStore](../../src/persistence/PersistenceStore.ts), [FsPersistenceStore](../../src/persistence/FsPersistenceStore.ts) | The interface promises an atomic batch; the file backend replaces each file independently. This is not atomic across related records. The existing IndexedDB backend uses a transaction. |
| [ProceduralActors](../../src/generation/ProceduralActors.ts), [ProceduralProps](../../src/generation/ProceduralProps.ts) | Generated actors have a special removal/regeneration path; edits and tombstones are global metadata. General persistence must prevent regeneration from resurrecting moved/deleted actors. |

The [activation topic](../topics/entity-activation.md#current-behavior) owns the
current tick tiers, separation fix and remaining simulation gaps.

## Backend decision evidence

SQLite supports transactions spanning related record changes and offers WAL
mode with concurrent readers and one writer. This fits a single authoritative
world writer; checkpointing and transaction size still need bounds.
[Atomic commit](https://www.sqlite.org/atomiccommit.html) and
[WAL documentation](https://www.sqlite.org/wal.html).

IndexedDB can atomically update several object stores in a transaction, but
transaction lifetime is tied to the event loop and durability guarantees vary.
The shared contract must distinguish a committed transaction from an absolute
power-loss guarantee. [IDBTransaction documentation](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction).

Node exposes SQLite APIs, including a synchronous database interface. The
driver and supported Node-version matrix must be verified during implementation;
the adapter should execute blocking database work outside the simulation loop.
[Node SQLite documentation](https://nodejs.org/api/sqlite.html).

Recommendation: SQLite for Node, IndexedDB for browser authority, and a memory
executor for conformance/fault tests. A file backend is possible only with an
atomic journal/recovery design; it is not required for the first implementation.
