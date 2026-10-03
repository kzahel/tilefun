# Spatial indexing and entity tick scheduling

Current behavior checked 2026-10-03. The
[original optimization plan](archive/spatial-optimization-plan.md) is historical;
it incorrectly describes tick tiers as still wholly pending for today's code.

## Implemented behavior

- [SpatialHash](../src/entities/SpatialHash.ts) is a chunk-sized secondary index
  over EntityManager's entities. Movement changes buckets when crossing a chunk
  boundary. Removal finds the entity within its bucket before swap-removing it;
  the whole removal operation is not strictly constant-time.
- [Realm](../src/server/Realm.ts) computes effective entity tick durations across
  all active sessions' visible ranges. Nearby entities step each simulation
  substep, mid-range entities accumulate time and step at a reduced cadence,
  and far entities are omitted. Players/ridden entities have special treatment.
  Use `computeEntityTickDtsMulti` and its constants for exact policy.
- [tickAllAI](../src/server/tickAllAI.ts) uses that map and freezes non-ticking
  AI velocity. [EntityManager](../src/entities/EntityManager.ts) gates movement,
  ground tracking, overlap separation and animation work with the same map.
  Separation buckets only selected NPCs and uses each participant's effective
  dt for pair nudges; player penetration correction remains instantaneous.
- Spatial queries also serve overlap checks and replication visibility.
  [RealmReplicator](../src/server/RealmReplicator.ts) includes the controlled player
  and mount even when outside its ordinary nearby query.
- [renderWorld](../src/scenes/renderWorld.ts) routes scene rendering; visibility
  filtering and depth ordering are presentation concerns, distinct from authority
  tick eligibility.

## Limits and follow-up

Tick gating does not remove every full collection pass: spatial-hash updates,
parent resolution and the separation input list still traverse entities.
Don't describe dormant entities as doing literally zero work.

The old proposal's exact distances, once-per-second tier assignment, active-only
animation rule and speedup estimates are not current contracts. General entity
streaming/unloading should not be assumed complete from terrain streaming or
specialized procedural residency paths.

Measure a concrete entity-heavy scenario before choosing further optimizations.
[Entity activation](topics/entity-activation.md) owns simulation/unloading gaps;
[performance](topics/performance.md) owns broader priority and timing evidence;
[SpatialHash tests](../src/entities/SpatialHash.test.ts),
[AI tests](../src/server/tickAllAI.test.ts) and
[replication tests](../src/server/buildGameState.test.ts) cover relevant contracts.
