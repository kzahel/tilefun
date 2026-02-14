# Spatial Optimization & Entity Tick Throttling

Multi-phase plan to handle hundreds of entities efficiently. Inspired by Minecraft's chunk ticking model — entities near the player get full simulation, distant ones sleep.

## Current State

| Aspect | Status | Details |
|--------|--------|---------|
| Entity AI | Partial | Frozen beyond 512px (Chebyshev) in `tickAllAI.ts` |
| Entity physics | All | `EntityManager.update()` runs collision for ALL entities |
| Entity rendering | Viewport-culled | `renderEntities()` filters to viewport bounds before Y-sort |
| Entity animation | All | Sprite frame ticks for ALL entities |
| Collision detection | O(k^2) per cell | Spatial hash queries nearby entities, not all |
| Y-sort for depth | O(v log v) | Sorts only visible renderables (v << n) |
| Spatial index | Spatial hash | `SpatialHash` class, cell = 1 chunk (256px) |
| Chunk awareness | Terrain only | `ChunkManager` loads/unloads terrain; entities are unpartitioned |
| Overlap detection | O(nearby) | `OverlapServiceImpl` uses spatial hash for pair checks |

### Remaining bottlenecks (Phase 3+)

- **NPC physics loop**: Still iterates ALL entities — Dormant entities with zero velocity still enter `resolveCollision()`. Tick tiers would skip them entirely.
- **Separation loop**: `separateOverlappingEntities()` builds its own per-frame spatial hash (tile-sized cells). Could be replaced with the chunk-level spatial hash.
- **Animation ticking**: All entities animate every frame. Non-visible entities don't need frame updates.
- **AI tick**: Already distance-culled, but tick tiers would unify this with a cleaner abstraction.

---

## Architecture: Tick Tiers + Spatial Hash

### Tick Tiers (Minecraft-inspired)

Entities are assigned a **tick tier** based on distance from the camera/player:

| Tier | Distance | Tick rate | AI | Physics | Collision | Render | Animate |
|------|----------|-----------|-----|---------|-----------|--------|---------|
| **Active** | Viewport + 1 chunk | Every frame | Full | Full | Full | Yes | Yes |
| **Near** | 2-4 chunks | Every 4th frame | Throttled | Simplified | Skip | No | No |
| **Dormant** | 5+ chunks | Never | Skip | Skip | Skip | No | No |

Tier assignment happens once per second (not per-frame) based on the camera's visible chunk range, stored on the entity as a lightweight field.

**Key insight from Minecraft**: "If a sheep is 12 chunks away, and no one sees it, does it tick?" ([Does It Tick? mod](https://modrinth.com/mod/does-it-tick))

### Spatial Hash Grid

A secondary index over `EntityManager.entities[]`. Cell size = 1 chunk (256px). See `src/entities/SpatialHash.ts`.

```
Map<number, Entity[]>  keyed by packed integer ((cx+0x8000)<<16 | (cy+0x8000))
```

- **Insert/remove**: O(1) — swap-remove, entity tracks its current cell key
- **Query range**: O(cells in range) — for collision, overlap, rendering
- **Rebuild frequency**: Entity movement triggers cell transfer only when chunk boundary crossed
- **Tested**: 10 unit tests in `SpatialHash.test.ts`

The `EntityManager` remains the authority. The spatial hash is a derived index, like a database index.

### Entity-Entity Collision

With spatial hash: only check entities in same + adjacent cells (9 cells max). Cost drops from O(n^2) to O(k^2) where k = entities per cell, typically < 20.

---

## Implementation Phases

### Phase 1: Spatial Hash Grid -- DONE

**Files**: `src/entities/SpatialHash.ts` (new), `src/entities/SpatialHash.test.ts` (new), `src/entities/EntityManager.ts`, `src/scripting/OverlapServiceImpl.ts`

`SpatialHash` class with cell size = 1 chunk (256px), packed integer keys, O(1) swap-remove:
- `insert(entity)`, `remove(entity)`, `update(entity)` — re-buckets only on chunk boundary crossing
- `queryRange(minCx, minCy, maxCx, maxCy)` — returns entities in chunk coordinate range
- `queryRadius(wx, wy, radius)` — returns entities within world-pixel radius
- `getCell(cx, cy)` — returns entities in a single chunk cell

**Integration**:
- `EntityManager.spawn()` → `spatialHash.insert()`
- `EntityManager.remove()` → `spatialHash.remove()`
- After all entity movement in `update()` → `spatialHash.update()` for all entities
- `makeExtraBlocker()` (collision blocker) → queries nearby chunks instead of all entities
- Push detection (player pushing entities) → queries spatial hash instead of scanning all
- `OverlapServiceImpl.tick()` → queries same + adjacent chunks per tagged entity

**Impact**: Collision blocker cost dropped from O(n) per check to O(nearby). Push detection from O(n) to O(nearby). Overlap detection from O(tagged * n) to O(tagged * nearby).

### Phase 2: Render Culling -- DONE

**Files**: `src/scenes/renderWorld.ts`

`renderEntities()` now filters entities and props to viewport bounds (+ 48px world-pixel margin for large sprites like the player) before Y-sorting. Uses `camera.screenToWorld()` to compute world-space viewport bounds.

**Impact**: Only visible entities are Y-sorted and drawn. With 200 entities and ~20 on screen, sort + draw cost drops ~10x.

### Phase 3: Tick Tier Assignment

**Files**: new `src/entities/TickTier.ts`, modify `GameServer.ts`, `tickAllAI.ts`, `EntityManager.ts`

Add a `tickTier` field to `Entity`:

```typescript
// On Entity:
tickTier: TickTier;  // 0=Active, 1=Near, 2=Dormant
tickTierFrame: number;  // last frame tier was assigned
```

Tier assignment (once per second or on camera move):

```typescript
function assignTickTiers(
  entities: Entity[],
  visibleRange: ChunkRange,
  spatialHash: SpatialHash,
): void {
  // Active: entities in visible chunks + 1
  // Near: entities in visible chunks + 2..4
  // Dormant: everything else
}
```

Modify `EntityManager.update()` to skip physics for Dormant, throttle for Near:

```typescript
// Phase 3 (move NPCs):
if (entity.tickTier === TickTier.Dormant) continue;
if (entity.tickTier === TickTier.Near && frameCount % 4 !== 0) continue;
```

Modify `tickAllAI()` to use tick tiers instead of its current distance check (which becomes redundant).

**Impact**: With 200 entities and 30 Active, physics cost drops ~7x. AI cost already handled but becomes cleaner.

### Phase 4: Animation & Interpolation

**Files**: modify `EntityManager.ts` (animation tick), `EntityRenderer.ts` (interpolation)

- Skip animation frame updates for non-Active entities
- When a Near entity wakes up to Active, snap its animation to a reasonable frame (don't resume mid-sequence)
- Consider: Near entities that become Active should interpolate smoothly (they had throttled updates)

**Impact**: Minor CPU savings, but prevents visual glitches at tier transitions.

### Phase 5: Streaming Entity Load/Unload (Future)

Only relevant for multiplayer / very large worlds. Entities beyond UNLOAD_DISTANCE could be serialized to IndexedDB and unloaded from memory, similar to how chunks work.

Not needed now — hundreds of entities in memory is fine. But the spatial hash makes this possible later.

---

## Reference Material

### Conceptual Foundations

- [Game Programming Patterns: Spatial Partition](https://gameprogrammingpatterns.com/spatial-partition.html) — Robert Nystrom's chapter; covers grids, BSP, k-d trees, quadtrees with clear tradeoffs. Key insight: "A grid is a persistent bucket sort."
- [Red Blob Games: Spatial Hash Demo](https://www.redblobgames.com/x/1730-spatial-hash/) — Interactive visual demo of spatial hashing by Amit Patel
- [SimonDev: Spatial Hash Grids](https://www.youtube.com/watch?v=sx4IIQL0x7c) — Video walkthrough of building a spatial hash grid in JS with hundreds of agents

### Spatial Index Libraries (JS/TS)

| Library | Type | Dynamic? | Best for |
|---------|------|----------|----------|
| [RBush](https://github.com/mourner/rbush) | R-tree | Yes | Rectangles, dynamic entities (Phaser 3 uses this) |
| [Flatbush](https://github.com/mourner/flatbush) | R-tree | No (static) | Static world queries, props |
| [KDBush](https://github.com/mourner/kdbush) | k-d tree | No (static) | Point queries |
| [HSHG](https://github.com/kirbysayshi/HSHG) | Hierarchical hash grid | Yes | Mixed-size objects |
| [grid-index](https://github.com/mapbox/grid-index) | Flat grid | Yes | Simple AABB queries (Mapbox) |

**Recommendation**: Roll our own simple grid hash (cell = chunk = 256px). Our entities are uniform size, move frequently, and we already have chunk coordinates everywhere. A 50-line `SpatialHash` class is simpler than adding a dependency, and we control the API.

### Minecraft Chunk Ticking

- [Technical Minecraft Wiki: Game Tick](https://techmcdocs.github.io/pages/GameTick/) — The authoritative tick loop order documentation
- [Minecraft Wiki: Chunk Loading](https://minecraft.fandom.com/wiki/Chunk) — Documents the three loading levels: Fully Ticked, Entity-Ticking, and Lazy
- [Cuberite source: Chunk.h](https://github.com/cuberite/cuberite/blob/master/src/Chunk.h) — C++ Minecraft server; has `m_AlwaysTicked` reference-counting pattern (multiple systems can request a chunk stays active)
- [Does It Tick? mod](https://modrinth.com/mod/does-it-tick) — Distance-based entity tick throttling with whitelists
- [Spark: The Tick Loop](https://spark.lucko.me/docs/guides/The-tick-loop) — Practical guide to Minecraft tick performance

### ECS & Browser Game Architecture

- [bitECS](https://github.com/NateTheGreatt/bitECS) — Most performant JS ECS; SoA with TypedArrays. Reference for data-oriented patterns (we don't need to adopt it, but good for ideas)
- [Web Game Dev: Spatial Partitioning](https://www.webgamedev.com/performance/spatial-partitioning) — Browser-specific spatial partitioning guide
- [Web Game Dev: ECS](https://www.webgamedev.com/code-architecture/ecs) — Comparison of JS/TS ECS options

---

## Decision: Why Not a Scene Graph?

Tilefun entities are single sprites with components — there are no multi-part objects (a door made of 5 parts + script + sound, like Roblox). A scene graph's hierarchy (parent → children) would add complexity without benefit.

**Flat list + spatial hash** is the right fit:
- ECS-compatible (entities are just IDs with components)
- No ownership transfer headaches when entities cross chunk boundaries
- Spatial hash is a secondary index, not a structural constraint
- Can always add hierarchy later if multi-part objects emerge

---

## Success Metrics

| Metric | Before Phase 1 | After Phase 1+2 (current) | After Phase 3 (est.) |
|--------|---------------|---------------------------|---------------------|
| 200 entities: collision blocker | O(200) per check | O(nearby) per check | O(nearby), skip dormant |
| 200 entities: render sort+draw | 200 entities | ~20 visible | ~20 visible |
| 200 entities: overlap detection | O(tagged * 200) | O(tagged * nearby) | O(tagged * nearby) |
| 200 entities: NPC physics loop | 200 iterations | 200 iterations | ~30 (Active only) |
| 200 entities: AI time | ~0.3ms (all iterated) | ~0.3ms | ~0.05ms (tier-filtered) |

Target: 200+ entities at 60fps with < 1ms entity budget (of ~16ms frame budget).

---

## Non-Goals

- **Full ECS migration** — current ECS-lite (plain objects) is fine for our scale
- **Quadtree / BVH** — overkill for uniform-size 2D sprites; flat grid is simpler and faster
- **Entity streaming to disk** — not needed until worlds have 10K+ entities
- **Worker thread offload** — not needed at this entity count; adds complexity
- **External spatial library** — our needs are simple enough for a 50-line class
