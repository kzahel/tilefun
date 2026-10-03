# Entity activation, AI and unloading

Topic: entity-activation
Status: known technical debt; source audit complete, measurement and improvements
not yet implemented.
Updated: 2026-10-03.

Owns simulation activity, NPC residency and the remaining cost of distant entities.
[Performance](performance.md) owns broader timing evidence and renderer work;
[client/server architecture](../client-server-architecture.md) owns execution
boundaries. Single-player authority runs in a browser Worker using the shared
server implementation, so moving work to that Worker does not eliminate it.

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

## Known gaps

1. **Inactive does not mean no work.** Tier selection and AI still scan resident
   entities. [EntityManager.update](../../src/entities/EntityManager.ts) also
   updates spatial-hash membership for all entities and performs parent-position
   bookkeeping regardless of tick tier.
2. **Overlap separation bypasses the tick map.** Eligible unparented NPCs enter
   [separateOverlappingEntities](../../src/entities/collision.ts) even when their
   ordinary movement is frozen. The spatial grid limits pair candidates, but
   dense cells still produce many pairs; distant NPCs can still be nudged.
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

Campfires have no AI: their definition in
[EntityDefs](../../src/entities/EntityDefs.ts) gives them animation and a solid
collider. Dense nearby fire piles need a separate collision/rendering and gem
pickup investigation; improving distant AI cannot by itself resolve local
crowding. Original reports and pictures remain in the private
[Play ideas inbox](play-ideas.md), not in Git. A reported symptom is not evidence
that these activation gaps caused it.

## Follow-up backlog

- [ ] Build a repeatable headless simulation benchmark with placed NPCs, static
  campfires and balls, varying both population and density. Compare nearby,
  reduced-rate, far and unloaded-terrain locations. Separate Worker simulation,
  replication, client rendering and memory measurements.
- [ ] Define one explicit activation policy and documented exceptions: camera
  interest versus player proximity, loaded terrain, multiplayer union, riders,
  followers, projectiles and gameplay callbacks. Decide whether sleeping actors
  freeze or advance elapsed time when reactivated.
- [ ] Bound inactive work using active sets/spatial queries and make separation,
  ball physics and service callbacks honor the chosen policy where appropriate.
  Preserve interactions across activation boundaries.
- [ ] Evaluate persistence-aware unloading for placed entities. Preserve stable
  identity, edits, deletions, parent relationships and saved state; avoid lost
  or duplicated actors when returning to a chunk.
- [ ] Add regression coverage for tier crossings, unloaded terrain, overlapping
  far NPCs, balls, camera pan/zoom, distant multiplayer players, mounted/following
  actors and save/reload/reactivation. Existing
  [AI tests](../../src/server/tickAllAI.test.ts) cover skipping the AI pass, not
  complete simulation sleep.

Start with baseline measurements and the activation contract. Create a bounded
tactical when an implementation slice is selected; this backlog does not commit
to a particular unloading design. Execution changes require the standard checks
and `npm run streaming:bench -- --assert-ready` in addition to focused regression
tests; see [performance validation](performance.md#evidence-and-validation).
