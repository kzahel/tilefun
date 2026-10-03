# 019 — Incremental persistence and entity streaming

Status: **planned parent sequence; implementation not started**.
Created: 2026-10-03. Scope of this task is research and documentation only.
Owner: [entity activation](../topics/entity-activation.md).
Contract: [target architecture](../entity-streaming-architecture.md).
Evidence: [Java Minecraft and mclone research](../research/entity-streaming-reference.md).

## Objective and priority

Replace world-wide entity snapshots and eager durable-state loading, then make
placed actors genuinely unload under one readiness/interest policy. Existing
world compatibility is not required. Preserve gameplay semantics and immutable
generator/art identities.

The **first useful production win is incremental saves**: changing one actor
must no longer rebuild the full entity list. Establish only the identity,
codec and transaction machinery needed to deliver that vertical slice on both
backends. Do not spend the first release building every ticket type or a generic
database framework. Actual eviction follows readiness and persistence safety.

Create a bounded child tactical for each selected implementation slice using
the next free number. This parent owns ordering and acceptance, not a claim
that one commit can safely deliver the entire refactor.

## Sequence

All phases preserve [one authoritative implementation](../entity-streaming-architecture.md#one-server-implementation-injected-host-adapters).
In A, inventory host dependencies and define the required ports. In B, move
browser defaults out of `GameServer` into composition entry points while adding
the storage adapters. Shared coordination, save scheduling and lifecycle barriers
must not be reimplemented in either adapter or host wrapper.

| Phase | Work and dependency | Delivered benefit / exit gate |
| --- | --- | --- |
| A: Baseline and minimum contract | Measure current save serialization/writes, startup reads and retained actor/terrain counts. Define durable IDs, per-kind field inventories, revisioned record envelope, atomic mutation and async completion semantics. Memory/fault executor; no production behavior change yet. | Reproducible amplification baseline and contract tests for revision races, atomic groups and errors. Keep this prerequisite bounded. |
| B: Incremental storage, both platforms | Depends on A. Implement IndexedDB and Node SQLite adapters, writer leases, per-entity/prop records with spatial indices, per-feature overrides, dirty revisions, deletes, flush/close and new-format world creation. Move growing arrays out of metadata. | Editing one entity writes only that entity and required related records, independent of total world population. Restart preserves semantic state/relationships on both backends. This is the first intended runtime release. |
| C: Shared interest and readiness | Depends on B for durable identity. Introduce player/observer/dependency tickets and holders; separate requested activity from ready terrain/entities. Maintain bounded collision support and group memberships. Keep runtime residency conservative until D. | No actor simulates without ready terrain; camera pan cannot strand a player; distant multiplayer demand remains a union. Unify policy before enabling eviction. |
| D: Lazy loading and acknowledged eviction | Depends on B/C. Replace global `getAll` startup and durable mirrors with bounded indexed loads; activate only after hydration. Evict placed actors/props and terrain after required commits, release caches and reject stale loads. Seed procedural actors once. | Startup and fixed-interest travel scale with local demand. Unload/reload preserves actors, edits, deletions and relationships exactly once; dirty save failure prevents unsafe eviction. |
| E: Complete activity scheduling | Transition memberships can begin in C; full delivery depends on D's lifecycle. Apply active sets to AI, physics/balls, separation, spatial and parent updates, services and scripts. Separate reduced decisions from safe physics. | Sleeping actors receive no gameplay work; interaction boundaries are correct; far populations add no full-world per-tick scan. Measure dense active crowds separately. |
| F: Budgets and sustained validation | Bounds and failure tests are required throughout A–E. Here tune numeric budgets, fair IO scheduling and pressure UX with long travel, slow storage, distant players and dense creative scenes. | Stable retained memory/queue high-water marks at fixed interest, fair durable-save progress, useful diagnostics and acceptable measured latency. No unbounded emergency fallback. |

Phase B may temporarily load entity records eagerly via bounded pages while
retaining current simulation behavior. That is a documented transitional state,
not completion of lazy loading. It must not introduce a new world-wide in-memory
database mirror or keep a parallel legacy save format. Phase D removes the
eager population load and saved-terrain mirrors.

An active-set optimization under the existing tick policy can be a separate
early slice if measurements justify it, but must preserve the existing contract
until C and must not become a second permanent interest manager. Dense nearby
campfire collision/pickup behavior remains an independent investigation.

## Validation gates

Use deterministic operation counts before setting hardware-dependent timing
thresholds. Scenarios below are proposed tests, not existing passing evidence.

| Concern | Required evidence |
| --- | --- |
| Save amplification | With total populations such as 100, 10,000 and 100,000 and fixed changed population, change one actor. Count serialized records, bytes, transactions and index mutations. Work must not grow with unchanged population; larger atomic gameplay operations scale with their actual participants. |
| Identity and state | Spawn/edit/move, flush, close the store, recreate authority, reload. Durable IDs and declared semantic fields survive; runtime IDs need not match. Test riders, route progress, gameplay timers, authored props and player references. |
| Atomicity and write races | Inject failures before/within/after a batch and reorder completions. Cross-chunk moves, pickup/inventory and relationship changes must be wholly committed or absent. Acknowledging revision r cannot clear dirty r+1. Reads/queries must honor pending moves and deletes. |
| Pagination and cancellation | Move/delete actors during paged loads; lose/regain interest while IO is pending. No missing/duplicate actor publication, stale holder resurrection or fresh generation over unknown saved data. |
| Procedural continuity | Initialize empty and nonempty chunks; move/kill generated actors; move/delete generated props across chunks; reload origin/destination in either order. No resurrection or double seeding. |
| Residency | Traverse many thousands of distinct chunks with fixed player/view demand and return. Measure live actors, holders, decoded terrain, indices, pending bytes and process memory separately. Settled retained work plateaus within configured budgets rather than growing with distance traveled. |
| Activity boundaries | Full/reduced/sleep crossings, balls/projectiles, collision pairs, parented groups, follower targets, fast bodies, camera pan/zoom, distant/overlapping players, session disconnect and debug pause. No missing-terrain integration or wall-clock catch-up. |
| Failure and pressure | Slow/failed reads, quota/disk-full writes, lock contention, shutdown during a save and process termination around commits. Durable state is retained or explicitly backpressured; reads cannot starve writes. Verify restart consistency and SQLite integrity; distinguish committed data from unacknowledged recent edits. |
| Platform parity | Run real IndexedDB in bundled Playwright Chromium and real SQLite through the Node adapter. Shared memory tests alone do not prove either transaction lifecycle. Single-player Worker, browser host and dedicated server follow the same semantic fixtures. |
| Shared implementation boundary | Verify all host entry points assemble the same server/coordinator classes; shared domain modules have no concrete platform-adapter imports. Run common command/step fixtures through each host adapter and compare semantic outcomes, allowing documented IO timing/durability differences. Matching APIs over duplicated server logic does not satisfy this gate. |
| Replication | Interest exit is not death. Reentry publishes exactly one actor. Delayed messages cannot address a retired incarnation; local and remote transports agree. |

Each runtime slice runs `npm run typecheck`, `npm test`, `npm run check` and
focused tests. Integration changes also run `npm run build && npx playwright test`.
Streaming/execution changes require
`npm run streaming:bench -- --assert-ready`; use isolated worlds/auth and bundled
test browsers as described by [performance](../topics/performance.md).
Run render inventory generation only if the slice changes rendering/recipes/input.

Collect counters for loaded/active/sleeping actors, dirty records, oldest pending
save, queue count/bytes/high-water, cancelled loads, index pages, serialized bytes,
commit latency and simulation time. Record fixture seed/revision, backend,
population, active demand and hardware with timings. Do not call a worker move
or a single short traversal proof of bounded memory.

## Decisions deliberately deferred

- Exact SQLite driver and packaging across the supported Node versions.
- Numeric queue/byte/record-size limits and activity radii after measurements.
- Detailed per-kind state codecs and script persistence declarations during A/B.
- Cross-world atomic transfers, cloud sync, migration tooling, offline progression
  and an optional journaled file adapter; none blocks the initial architecture.

## Execution record

- 2026-10-03: researched local Java 1.17.1 and mclone persistence/streaming;
  documented target and this sequence. No runtime refactor performed.
- Documentation validation: all local links resolve and `git diff --check`
  passes. On an isolated `a576b68` snapshot plus these seven documentation files,
  typecheck, all 1,249 unit tests and lint passed (existing lint warnings remain).
  The concurrent shared workspace passed typecheck but had seven Workshop test
  failures and 35 lint errors outside this documentation change. No unrelated
  runtime files were changed to address those results. Build, browser and
  streaming runs are reserved for implementation changes.
- Next bounded implementation: A's minimum contract and baseline, followed
  directly by B's incremental-save vertical slice; actual unloading begins only
  after the readiness and durability gates above are satisfied.
