# Entity activation, AI and unloading

Topic: entity-activation
Status: overlap separation follows tick selection and accumulated time.
Incremental persistence, ticket-driven residency and general unloading are
designed/planned; the runtime refactor has not started.
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
[Tactical 019](../tactical/019-entity-streaming-and-persistence.md) is the planned
parent sequence. This decision is documentation only, not implemented behavior.

## Current behavior

Source audit on 2026-10-03; these are implementation findings, not measured
performance results or a diagnosis of any individual play report.

- [Realm.computeEntityTickDtsMulti](../../src/server/Realm.ts) uses each active
  session's camera-visible chunk range, rather than a radial player-distance
  test or a loaded-chunk membership check. The most active matching tier wins
  across sessions. Players always receive a tick entry.
- Within the visible range plus two chunks, ordinary AI, movement, ground
  tracking and animation update every tick. The next six chunks use accumulated
  time every four ticks (normally 15 Hz with the default 60 Hz server rate).
  Beyond the eight-chunk margin, those passes skip the entity;
  [tickAllAI](../../src/server/tickAllAI.ts) zeros skipped AI entities' velocity.
- [ChunkManager](../../src/world/ChunkManager.ts) unloads terrain beyond a
  three-chunk margin. Consequently, resident entities can still receive
  reduced-rate simulation after their terrain chunk unloads. Camera movement
  and zoom can change activity independently of player position.
- Manually placed entities remain in the realm's entity manager when terrain
  unloads. [ProceduralActors](../../src/generation/ProceduralActors.ts) separately
  removes generated route actors when no chunk in their route bounding area is
  loaded, except actors with a parented rider/child. Generated actor unloading
  therefore does not provide general unloading for placed entities.
- Realm AI/physics runs when there is at least one session that is neither
  debug-paused nor dormant. This is separate from per-entity activation.
- NPC overlap separation uses the same tick map: omitted NPCs do not enter the
  separation grid or player-overlap checks. Each selected NPC uses its own
  accumulated time for pair nudges; player penetration correction remains
  instantaneous. Existing parented/pre-stepped exclusions, mount handling and
  wall/Z constraints remain. An omitted NPC still exists in the ordinary
  collision index; this change is not unloading or removal of solid blockers.
  [Tactical 018](../tactical/018-tick-aware-npc-separation.md) records the slice.

## Known gaps

1. **Inactive does not mean no work.** Tier selection and AI still scan resident
   entities. [EntityManager.update](../../src/entities/EntityManager.ts) also
   updates spatial-hash membership for all entities and performs parent-position
   bookkeeping regardless of tick tier.
2. **Dense active crowds still cost work.**
   [separateOverlappingEntities](../../src/entities/collision.ts) now excludes
   sleeping NPCs, but dense active cells still produce many collision pairs.
   The separation input list still scans all resident entities.
3. **Ball physics bypasses the tick map.**
   [tickBallPhysics](../../src/physics/BallPhysics.ts) scans and simulates resident
   balls in its own pass. Other gameplay callbacks and overlap services also
   need an explicit activation-policy audit before claiming a realm-wide sleep
   guarantee.
4. **Terrain residency and simulation activity disagree.** The reduced-rate
   tier extends past terrain retention. Collision/height behavior at that
   boundary needs tests before changing distances or introducing sleep.
5. **Placed-entity residency is unbounded by chunk unloading.** Large authored
   populations can retain memory and scanning costs after the player leaves.
   Persistence-aware unloading/reactivation is not yet a general facility.
   [SerializedEntity](../../src/persistence/SaveManager.ts) currently contains
   type, position and optional procedural identity, rather than a complete live
   NPC snapshot. A lossless unload contract needs stable IDs, relevant runtime
   state and relationship handling before reusing persistence for eviction.
6. **Persistence scales with historical world size.** Metadata saves rebuild the
   full authored entity/prop list and procedural edit/deletion collections.
   Startup reads all saved terrain records and hydrates saved actors; saved
   terrain mirrors remain after live chunks unload. This is not a per-entity
   incremental save or demand-driven durable load system.
7. **Storage contracts differ across backends.** The file backend independently
   replaces each record although the store interface promises an atomic batch.
   General actor movement, relationships and gameplay transactions need actual
   cross-record atomicity and distinct missing/error results.

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
- [ ] Establish a bounded save/read/memory baseline and minimum durable identity,
  codec and transaction contract; immediately follow with incremental saves on
  IndexedDB and SQLite. This removes global-list write amplification first.
- [ ] Deliver shared tickets/readiness, lazy indexed loads and acknowledged
  eviction, then complete active-set coverage and reduced-decision scheduling.
  [Tactical 019](../tactical/019-entity-streaming-and-persistence.md) owns phase
  dependencies, acceptance scenarios and failure/pressure gates.
- [ ] Investigate dense active campfire collision and pickup behavior separately;
  general distant-entity unloading does not establish the cause of that symptom.

Create bounded child tacticals as implementation slices are selected. Existing
[AI tests](../../src/server/tickAllAI.test.ts) cover skipping the AI pass, not
complete simulation sleep. Execution changes require the standard checks
and `npm run streaming:bench -- --assert-ready` in addition to focused regression
tests; see [performance validation](performance.md#evidence-and-validation).
