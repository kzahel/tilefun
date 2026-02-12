# Terrain System Design: Graph-Based Autotile with Alpha Fallbacks

Design doc for rearchitecting terrain rendering and adding player terrain
editing. Multiple generation strategies coexist — rendering and editing
are strategy-agnostic.

## Architecture: Strategy Pattern

```
                  ┌─────────────────┐
                  │  TerrainStrategy │  (interface)
                  │  generateChunk() │
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────┴───┐  ┌────┴─────┐  ┌──┴──────────┐
     │   Onion    │  │  Graph   │  │   Future...  │
     │ (current)  │  │  (new)   │  │              │
     └────────────┘  └──────────┘  └──────────────┘

     Shared: Rendering (per-tile graph lookup) + Editing (brush/fill)
```

### Generation strategies

Each strategy implements `generateChunk(cx, cy) → Chunk` (corners +
terrain + detail + collision). The renderer and editor don't care which
strategy produced the chunk.

- **Onion** (current Session 8 code): Fixed 4-layer nested ring with
  BiomeMapper. Keeps Forest/DenseForest as biome types. Preserved as-is
  for comparison.
- **Graph-based** (new): TerrainId = ground materials only, generation
  driven by adjacency graph, all ME sheets. Described below.

Strategy is switchable at runtime (debug panel / seed regen). Changing
strategy regenerates all unedited chunks; edited chunks are preserved
(they already have concrete terrain data independent of generation).

### Shared rendering

Both strategies produce chunks with the same data: corners, terrain
tiles, collision. The **renderer** operates on terrain tiles regardless
of how they were generated. The per-tile graph lookup rendering model
(described below) works with any terrain data.

The onion strategy's current fixed-layer renderer can coexist as a
legacy path, or the new per-tile renderer can handle both (the onion
terrain values are a subset of the graph terrain values).

### Shared editing

Painting works on any chunk regardless of generation strategy. Once a
chunk is edited, it's persisted and never regenerated — the generation
strategy becomes irrelevant for that chunk.

## Goals

- Multiple terrain generation strategies, switchable at runtime
- Keep current onion generator as baseline for comparison
- New graph-based generator using all ME blend sheets including alphas
- Generation driven by the adjacency graph, not the other way around
- Player can edit terrain with a brush (stamp corners, fill outward)
- Painting works with ANY generation strategy (shared editing layer)
- Edited chunks persist via IndexedDB

## Available ME Sheets (Natural)

```
DEDICATED PAIR SHEETS (opaque, specific A↔B transition):
  #16: water_deep ↔ water_shallow
  #8:  sand ↔ water_shallow
  #9:  sand ↔ sand_light
  #7:  sand_light ↔ grass
  #1:  dirt_light ↔ grass
  #2:  dirt_warm ↔ grass        (reverse: #12 grass↔dirt_warm)
  #3:  water_shallow ↔ grass    (reverse: #15 grass↔water_shallow)

ALPHA OVERLAYS (semi-transparent, blend onto ANY terrain):
  #13: grass alpha (78% opacity)
  #6:  grass alpha (45% opacity, lighter variant)
  #10: sand alpha (65% opacity)
  #5:  grass_muted alpha (45%, night/muted palette)
```

Each sheet is a 12x4 grid of 16x16 tiles, encoding 47 unique GM blob
autotile variants from 8-bit neighbor bitmasks.

Primary = fills center (mask 255). Secondary = shows at edges (mask 0).

## Full Adjacency Graph

```
                        #16
            DeepWater ────── ShallowWater
                              ╱         ╲
                        #8  ╱             ╲  #3/#15
                          ╱                 ╲
                       Sand ──#9── SandLight ──#7── Grass ─┬─#1── DirtLight
                                                           └─#2── DirtWarm

    Alpha wildcards (virtual edges to ALL nodes):
      #13α: grass → anything     #10α: sand → anything
```

Graph distances (shortest dedicated-sheet path):

```
              DW  SW  Sa  SL  Gr  DL  DW2
DeepWater      0   1   2   3   2   3   3
ShallowWater   1   0   1   2   1   2   2
Sand           2   1   0   1   2   3   3
SandLight      3   2   1   0   1   2   2
Grass          2   1   2   1   0   1   1
DirtLight      3   2   3   2   1   0   2
DirtWarm       3   2   3   2   1   2   0
```

Note: Grass↔ShallowWater has distance 1 (direct edge #3/#15), but also
has a longer scenic route via Sand chain. Generation may prefer the
scenic route for beaches; editing uses shortest path.

## The Graph Conflict Problem

The graph has a diamond: ShallowWater connects to BOTH Sand (#8) AND
Grass (#3/#15). This means sandy beaches and grassy shores can coexist.
But at their junction:

- Sand meets Grass → no dedicated sheet, needs SandLight buffer
- SandLight meets ShallowWater → no dedicated sheet exists

This is structurally unsolvable with pure constraint-satisfaction. A
naive local fill/walk hits dead ends — it's analogous to graph coloring
where local greedy choices create global conflicts.

## Solution: Alpha Overlays as Wildcard Edges

Alpha overlays make the graph fully connected for grass and sand:

- Sand ↔ Grass (no pair sheet): use grass_alpha #13 on Grass tiles
- SandLight ↔ ShallowWater (no pair sheet): use grass_alpha #13 or sand_alpha #10
- Any other missing pair: alpha fallback

With alpha wildcards, the generation has NO dead ends. Every terrain can
be placed next to any other terrain — the rendering always has a path.

## Rendering Model: Per-Tile Graph Lookup

Instead of a fixed global layer stack, each tile determines its own
rendering layers based on actual adjacency:

```
For each tile with terrain T:
  1. Find all unique neighbor terrain types in 8-neighborhood
  2. For each neighbor terrain N (where N ≠ T):
     a. Look up (T, N) in the blend sheet graph
     b. If dedicated pair sheet exists → use it (best quality)
     c. Else if alpha overlay covers T → use alpha (universal fallback)
  3. Render base fill, then blend layers in priority order
     (alpha layers composite transparently, so multiple can stack)
```

A tile at a grass/water/sand junction could composite:
- Base: shallow water fill
- Layer 1: sand pair sheet (#8) for sand edges
- Layer 2: grass alpha (#13) for grass edges (transparent, stacks on sand)

### Mask computation per neighbor terrain

For each (MyTerrain, NeighborTerrain) pair, compute the mask with a
targeted predicate: only NeighborTerrain triggers "out of group."

```
isInGroup(n) = (n !== NeighborTerrain)
```

This means: if a grass tile borders both water and sand, the water
transition layer only shows edges toward water (sand is treated as
"in group" for that layer). Each neighbor terrain gets its own clean
mask without interference from other foreign terrains.

### Layer draw order

1. Base fill (tile's own terrain solid sprite)
2. Opaque dedicated pair sheets, ordered by terrain depth
   (water < sand < grass < dirt — deeper terrains rendered first)
3. Alpha overlays last (composited transparently, order between
   alphas matters less)

### Storage: max-layers cap

Fixed cap of 6 layers per tile (a tile rarely borders more than 3
different terrains, and each may need at most 1 dedicated + 1 alpha).

Per chunk: `Uint32Array[6 * 256]` — flat array, 6 slots per tile.
Each entry packs `(sheetIndex << 16 | spriteCol << 8 | spriteRow)`.
Zero = empty slot (no layer). 6 KB per chunk, trivial.

Chunk cache rebuild iterates: for each tile, for each non-zero slot,
draw the sprite from the indexed sheet. Same OffscreenCanvas approach.

## Terrain Types

```
TerrainId (graph-based strategy):
  DeepWater, ShallowWater, Sand, SandLight, Grass, DirtLight, DirtWarm

BiomeId (onion strategy, preserved):
  DeepWater, ShallowWater, Sand, Grass, Forest, DenseForest
```

The graph-based strategy removes Forest/DenseForest as terrain types —
detail scatter (flowers, rocks, mushrooms) driven by moisture noise
directly. The onion strategy keeps them as-is.

The renderer needs a mapping from onion BiomeId to graph TerrainId for
the per-tile blend lookup. Simple: Forest/DenseForest → Grass.

## Generation: Graph-Based Strategy

1. Noise-based initial assignment (elevation + moisture → TerrainId)
2. No strict adjacency enforcement needed — alpha wildcards cover gaps
3. Generation mildly PREFERS dedicated-sheet pairs (e.g., noise shaping
   to create SandLight buffer between Sand and Grass) but doesn't
   enforce
4. Alpha fallback handles any remaining mismatches from noise

## Generation: Onion Strategy (Preserved)

Current Session 8 code. 4-layer nested ring with BiomeMapper. No
changes needed — it continues to produce chunks with corners, terrain,
detail, and collision arrays. The new renderer handles its output via
the BiomeId → TerrainId mapping.

## Terrain Editing

### Brush Model

Player has a terrain brush with configurable radius. The brush stamps
**corners** (the 17×17 vertex grid per chunk) with a chosen TerrainId.

Corner-based editing is natural because:
- The existing generation already uses corners → tile derivation
- Corners provide sub-tile precision (each tile blends 4 corners)
- Autotile masks derive from tile terrain, which derives from corners

### Best-Effort Fill

After stamping, a best-effort fill radiates outward to improve
transitions. No hard constraint solver — alpha fallbacks cover any
remaining gaps.

```
1. User stamps corners within brush radius with terrain T
2. Stamped corners are "pinned" (fill never overwrites them)
3. BFS outward from stamped boundary, ring by ring:
   a. For each free corner adjacent to a pinned/filled corner:
      - Look at the terrain on each side (inner and outer)
      - If they share a dedicated-sheet edge → done, no fill needed
      - Otherwise, assign the next terrain on the shortest graph
        path from inner toward outer
   b. Mark newly filled corners and continue BFS
4. Stop when:
   - All boundary pairs have dedicated-sheet edges, OR
   - Max fill radius reached (brush radius + max graph distance)
5. Alpha covers any remaining mismatches
```

### Directional fill example

Stamp DirtWarm in DeepWater (graph distance 3: DirtWarm→Grass→SW→DW):

```
        DW  DW  DW  DW  DW
     DW  SW  SW  SW  SW  DW
  DW  SW  Gr  Gr  Gr  SW  DW
  DW  SW  Gr  DW2 Gr  SW  DW      (DW2 = DirtWarm)
  DW  SW  Gr  Gr  Gr  SW  DW
     DW  SW  SW  SW  SW  DW
        DW  DW  DW  DW  DW
```

Stamp DirtWarm where one side is DeepWater, other side is Sand
(directional — different intermediates per direction):

```
  Sand  SL  Gr  Gr  SW  DW
  Sand  SL  Gr  DW2 SW  DW
  Sand  SL  Gr  Gr  SW  DW
```

Ring 1 is Grass everywhere (adjacent to DirtWarm in graph).
Ring 2 diverges: SandLight toward Sand, ShallowWater toward DeepWater.

### Incremental refinement

If the player continues painting, the fill progressively produces
cleaner transitions. First stroke might leave some alpha fallback
edges; subsequent strokes fill in dedicated-sheet buffers. This feels
natural — the world responds to the player's intent, getting more
polished with more painting.

## Persistence: IndexedDB

### Minecraft model

Following Minecraft's approach: persist the **whole chunk** on first
edit.

- **Unedited chunk**: regenerated deterministically from world seed,
  zero storage. Identical every time.
- **Edited chunk**: full chunk data persisted. No diffing against
  procedural output. No "replay generation + apply edits" on load.

This is simple and avoids a whole class of bugs around generation
determinism and diff merging.

### Storage format

IndexedDB store keyed by `(seed, chunkX, chunkY)`.

Per edited chunk, store:
- `corners: Uint8Array[289]` — 17×17 TerrainId vertices
- `terrain: Uint16Array[256]` — 16×16 derived TileId
- `detail: Uint16Array[256]` — decorative overlay
- `collision: Uint8Array[256]` — collision flags

Total: ~1.3 KB per edited chunk (uncompressed). Trivially small.
Thousands of edited chunks = a few MB.

Autotile layer data is NOT persisted — it's recomputed from terrain
on chunk load (fast, deterministic from terrain + neighbor terrain).

### Load flow

```
loadChunk(cx, cy):
  1. Check IndexedDB for (seed, cx, cy)
  2. If found → deserialize into Chunk, mark autotileComputed = false
  3. If not found → generate from active strategy (onion or graph)
  4. Compute autotile layers (same path for both)
```

### Save flow

```
editChunk(cx, cy, edits):
  1. Apply corner edits to chunk
  2. Run best-effort fill on affected area
  3. Re-derive tiles from corners
  4. Re-derive collision from tiles
  5. Mark chunk dirty (triggers autotile recompute + render rebuild)
  6. Persist full chunk to IndexedDB
  7. Mark neighbor chunks dirty if edit touches chunk border
```

### Strategy switching

When the player switches generation strategy:
- Edited chunks (in IndexedDB) are untouched — they render the same
- Unedited chunks are regenerated with the new strategy
- This lets the player compare strategies while keeping their edits

## Rendering Priority (blend sheet selection)

When tile T borders neighbor N, select sheet by preference:

```
1. Exact dedicated pair sheet for (T, N)     → best visual quality
2. Dedicated pair sheet via inverted mask     → good (e.g., #9 inverted)
3. Alpha overlay for T                        → universal fallback
4. Alpha overlay for N (from N's perspective) → last resort
```

Mask inversion (using a sheet "backwards"): skip drawing when mask = 0
to avoid the "island" sprite artifact. All other masks invert cleanly
(swap which terrain fills center vs edges).

## Resolved Design Decisions

- **Storage model**: Max-layers cap (6), `Uint32Array` with packed
  entries. Not variable-length per-tile arrays.
- **Performance**: OffscreenCanvas chunk cache amortizes per-tile
  complexity. Dynamic layers only affect cache rebuild, not frame cost.
- **Generation preference**: Mild preference for dedicated-sheet pairs
  via noise shaping. Not enforced — alpha covers gaps.
- **Mask inversion**: Skip mask 0 (island sprite). All others invert
  cleanly.
- **Editing model**: Best-effort fill with alpha fallbacks. No hard
  constraint solver.
- **Persistence**: IndexedDB, whole-chunk-on-first-edit (Minecraft
  model).
- **Multiple strategies**: Strategy pattern, runtime-switchable. Onion
  preserved as baseline.

## Implementation Phases

Each phase is independently testable and shippable. Later phases build
on earlier ones.

### Phase 1: Strategy Interface + Onion Extraction

Pure refactor, no behavior change. Extract current WorldGenerator into
a `TerrainStrategy` interface. Wrap existing code as `OnionStrategy`.
Add strategy switching to debug panel. All existing tests pass unchanged.

**Testing:**
- Pixel-identical regression: render chunks at known seeds to
  OffscreenCanvas, `getImageData()`, compare byte-for-byte before/after.
  Pick seeds that produce water/sand/grass junctions and dirt paths.
  Any pixel difference = refactor bug.
- All existing unit tests (174) and E2E tests (14) pass unchanged.

### Phase 2: Per-Tile Graph Renderer

Core architectural change. New rendering path: per-tile neighbor lookup
→ blend sheet selection (dedicated pair → inverted pair → alpha fallback)
→ layered draw with depth ordering. Works with onion output via
BiomeId → TerrainId mapping (Forest/DenseForest → Grass). Replaces the
fixed 4-layer stack in TileRenderer.rebuildCache.

**Testing:**
- Exhaustive blend sheet selection: test all 7×7 = 49 terrain pairs,
  verify each gets a valid render path (dedicated, inverted, or alpha).
  No pair should produce zero layers.
- Targeted mask computation: given a neighborhood with multiple foreign
  terrains (e.g., grass tile bordering water AND sand), verify each
  neighbor gets an independent mask without interference.
- Chunk render smoke test: render chunks at known seeds, assert no
  exceptions, assert every tile drew at least 1 layer (base fill).
- Visual spot-check: debug page that renders all 49 terrain pairs in
  a grid for human review. Playwright screenshots for the gallery.

### Phase 3: Graph-Based Generator

New `GraphStrategy` implementing `generateChunk()` with the full
TerrainId set (DeepWater, ShallowWater, Sand, SandLight, Grass,
DirtLight, DirtWarm). Noise-shaped buffer zones for dedicated-sheet
pairs. Switchable alongside onion in debug panel.

**Testing:**
- Property test: generate 100 chunks at random seeds, verify every
  tile has a valid TerrainId, every adjacent corner pair is in the
  adjacency graph (or within alpha fallback range).
- Distribution test: generate many chunks, assert all 7 terrain types
  appear (no terrain unreachable by noise).
- Side-by-side visual: Playwright screenshots of same seed with onion
  vs graph strategy, saved adjacent for human comparison.

### Phase 4: Terrain Editing + Brush

Corner-based brush with configurable radius. Best-effort BFS fill
radiating outward from stamped corners. Re-derive tiles and collision
from edited corners. Mark affected chunks dirty. No persistence yet —
edits lost on reload.

**Testing:**
- BFS fill unit tests: stamp DirtWarm in DeepWater, verify intermediate
  rings are Grass → ShallowWater. Stamp at boundary between two
  terrains, verify directional fill diverges correctly. Pure functions
  on corner arrays — no rendering needed.
- Fill invariant test: after any fill, verify every adjacent corner
  pair has either a dedicated-sheet edge or alpha coverage. Run on
  many random stamp scenarios.
- E2E brush test: Playwright simulates click-drag, verifies terrain
  changes via exposed debug API or canvas pixel sampling.

### Phase 5: IndexedDB Persistence

Save edited chunks to IndexedDB keyed by (seed, cx, cy). Load flow
checks IndexedDB before generating. Strategy switching preserves
edited chunks, regenerates unedited ones.

**Testing:**
- Serialization round-trip: generate chunk, serialize to IndexedDB
  format, deserialize, compare byte-for-byte.
- Edit persistence E2E: edit terrain, reload page, verify edits
  survived (Playwright).
- Strategy switch E2E: edit chunk, switch strategy, verify edited
  chunk unchanged while unedited chunks regenerate differently.

Phases 4 and 5 are orthogonal to phase 2/3 internals — they operate
on corners and tiles, not rendering layers. Could potentially be
developed in parallel with phase 3.

## Sheet Reference

| # | Primary | Secondary | Type | Status |
|---|---------|-----------|------|--------|
| 1 | dirt_light | grass | base | NEW |
| 2 | dirt_warm | grass | base | in use |
| 3 | water_shallow | grass | base | available |
| 5 | grass_muted | alpha | overlay | future |
| 6 | grass | alpha (45%) | overlay | available |
| 7 | sand_light | grass | base | NEW |
| 8 | sand | water_shallow | base | in use |
| 9 | sand | sand_light | base | NEW |
| 10 | sand | alpha | overlay | NEW |
| 12 | grass | dirt_warm | base | available (reverse #2) |
| 13 | grass | alpha (78%) | overlay | in use |
| 15 | grass | water_shallow | base | available (reverse #3) |
| 16 | water_deep | water_shallow | base | in use |
