# Corner-Based Terrain Architecture

## Goal
Unify on TerrainId (7 actual tileset terrains), derive adjacency from BlendGraph,
implement corner-based blend masks (no fan-out), and add edit propagation with bridge insertion.

## The Single Canonical Type: TerrainId (unchanged)
```
DeepWater=0, ShallowWater=1, Sand=2, SandLight=3, Grass=4, DirtLight=5, DirtWarm=6
```
These map 1:1 to ME autotile sheets. Forest/DenseForest are removed from the terrain system.

## Adjacency Graph

### Tier 1: Dedicated pair sheets (high-quality pixel-art transitions)
```
DeepWater ── ShallowWater ── Sand ── SandLight ── Grass ── DirtLight
                  │                                │
                  └────────────────────────────────┘── DirtWarm
```
7 undirected edges from 7 dedicated ME sheet pairs:

| Sheet | Primary | Secondary | Pair |
|-------|---------|-----------|------|
| me16 | water_deep | water_shallow | DeepWater ↔ ShallowWater |
| me08 | sand | water_shallow | Sand ↔ ShallowWater |
| me09 | sand | sand_light | Sand ↔ SandLight |
| me07 | sand_light | grass | SandLight ↔ Grass |
| me03/#15 | water_shallow / grass | grass / water_shallow | ShallowWater ↔ Grass |
| me01 | dirt_light | grass | DirtLight ↔ Grass |
| me02/#12 | dirt_warm / grass | grass / dirt_warm | DirtWarm ↔ Grass |

### Tier 2: Alpha overlay sheets (generic semi-transparent blending)
Two alpha overlay sheets extend the adjacency graph with lower-quality but functional transitions:

| Sheet | Terrain | Effect |
|-------|---------|--------|
| me13 | Grass (alpha) | Grass can alpha-blend onto ANY terrain |
| me10 | Sand (alpha) | Sand can alpha-blend onto ANY terrain |

Alpha overlays enable direct adjacencies that have no dedicated pair sheet. For example:
- **Grass ↔ Sand** — no dedicated sheet exists, but me13 (grass alpha) can blend Grass
  directly onto Sand (or vice versa with me10). Visually acceptable, not pixel-perfect.
- **Sand ↔ DirtWarm** — me10 (sand alpha) blends Sand onto DirtWarm.

#### Two-tier adjacency model
- **Tier 1 (dedicated)**: Always valid, best quality. Used for bridge insertion.
- **Tier 2 (alpha)**: Valid but lower quality. Optional — enables more terrain
  combinations without requiring bridge terrains. Not used for bridge insertion
  (bridges always route through Tier 1 edges).

The TerrainAdjacency class should support both tiers:
```typescript
isValidAdjacency(a, b, tier?: "dedicated" | "any"): boolean
```
- Bridge insertion uses `tier="dedicated"` (strict, insert intermediates)
- Validation/rendering uses `tier="any"` (permissive, alpha fallback is OK)

This means painting Sand directly next to Grass could be allowed (alpha blended),
but painting DeepWater next to Sand still requires bridge insertion (ShallowWater).

#### Future: promoting alpha pairs to dedicated
If a dedicated sheet is later added (e.g., a sand/grass sheet), the alpha pair
automatically upgrades to Tier 1 with no code changes — BlendGraph already prefers
dedicated entries over alpha fallbacks.

## Implementation Phases

### Phase 1: New pure modules (no existing code changes)

**New `src/autotile/TerrainAdjacency.ts`**
- `TerrainAdjacency` class, constructed from `BlendGraph`
- Scans BlendGraph entries: non-alpha → Tier 1, alpha → Tier 2
- Precomputes all-pairs BFS bridge lookup on Tier 1 edges: `bridgeNext[from][to] → next step`
- API:
  - `isValidAdjacency(a, b)` — true if Tier 1 or Tier 2 edge exists
  - `isDedicatedAdjacency(a, b)` — true only for Tier 1 (dedicated sheet)
  - `getBridgeStep(from, to)` — next terrain on shortest Tier 1 path
  - `getBridgePath(from, to, maxSteps=3)` — full bridge path (Tier 1 only)
- Max graph diameter = 3 (DeepWater→DirtLight: Deep→Shallow→Grass→DirtLight)

**New `src/autotile/CornerBlend.ts`**
- `computeCornerMask(nw, ne, sw, se: boolean) → 8-bit mask`
- Cardinals: `N = nw && ne`, `W = nw && sw`, etc.
- Diagonals: `NW = N && W && nw`, etc.
- Pure function, no dependencies

### Phase 2: Add new functions to existing modules

**`src/autotile/terrainMapping.ts`** — add:
- `terrainIdToTileId(TerrainId) → TileId` (SandLight→Sand, DirtLight→DirtPath, etc.)
- `biomeIdToTerrainId(BiomeId) → TerrainId` (Forest/DenseForest→Grass, Grass→Grass)
- Mark `tileIdToBiomeId`, `biomeIdToTileId` as `@legacy`

**`src/autotile/TerrainGraph.ts`** — rewrite:
- `deriveTerrainFromCorners(nw, ne, sw, se: TerrainId) → TerrainId` using TERRAIN_DEPTH
- Returns lowest-depth corner (base terrain for rendering)
- Mark old BiomeId-based `isValidAdjacency`/`getValidFallback` as `@legacy`

**`src/autotile/Autotiler.ts`** — add:
- `computeChunkCornerBlend(chunk, blendGraph)` — the new entry point
  - Reads chunk's own corners (TerrainId), no cx/cy/getTerrain params needed
  - For each tile: read 4 corners → find base (lowest depth) → for each overlay terrain:
    compute corner mask → `blendGraph.getBlend(overlay, base)` → GM_BLOB_LOOKUP → pack
  - Handles inverted entries, multi-terrain junctions, depth-sorted stacking
- Mark `computeChunkBlendLayers` as `@legacy`

### Phase 3: Switch corner storage from BiomeId to TerrainId

**`src/world/Chunk.ts`** — update doc: corners store TerrainId (still Uint8Array)

**`src/generation/FlatStrategy.ts`** — use `TerrainId.Grass` instead of `BiomeId.Grass`

**`src/generation/OnionStrategy.ts`** — mark `@legacy`, add `biomeIdToTerrainId()` call when writing corners

### Phase 4: Editor changes

**`src/editor/EditorPanel.ts`**:
- Palette uses TerrainId: Grass, Water, Deep, Sand, Lt Sand, Lt Dirt, Dirt
- Remove Forest/DenseForest/Empty (or keep Empty for erasing)
- `selectedTerrain: TerrainId` instead of `TileId`

**`src/editor/EditorMode.ts`**:
- `PendingCornerEdit.terrainId: TerrainId` replaces `tileId: TileId`
- `selectedTerrain: TerrainId`
- Tile-mode paint → set all 4 corners of target tile (equivalent to corner paint)

### Phase 5: Game.ts integration

**`src/core/Game.ts`**:
- Add `private adjacency: TerrainAdjacency` (constructed from blendGraph)
- `applyCornerEdit(gx, gy, terrainId: TerrainId)`:
  1. `setGlobalCorner(gx, gy, terrainId)`
  2. Check 4 cardinal neighbor corners
  3. If not `isDedicatedAdjacency`: `getBridgeStep(painted, neighbor)` → recursively set bridge corner (depth limit 2)
  4. Re-derive terrain + collision for all affected tiles
  5. Alpha-only adjacencies are left alone (valid Tier 2, no bridge needed)
- `rederiveTerrainAt` uses `deriveTerrainFromCorners` (TerrainId) → `terrainIdToTileId` → chunk.setTerrain
- Sync `editorPanel.brushMode` to `editorMode.brushMode`

**`src/world/World.ts`**:
- `computeAutotile`: call `computeChunkCornerBlend(chunk, blendGraph)` instead of `computeChunkBlendLayers`

### Phase 6: Mark legacy code

Add `@legacy` JSDoc to: OnionStrategy, NoiseMap, BiomeMapper, computeChunkAllLayers, TERRAIN_LAYERS, computeChunkBlendLayers, old BiomeId-based functions in TerrainGraph/terrainMapping.

## Key Design Decisions

1. **Corners store TerrainId directly** — no BiomeId→TerrainId translation at render time
2. **Adjacency = dedicated blend sheet exists (Tier 1)** — BlendGraph is the single source of truth
3. **Alpha overlays extend adjacency (Tier 2)** — lower quality but enables more direct pairings
4. **Corner-based masks eliminate fan-out** — tile only shows transitions its own corners dictate
5. **Bridge insertion uses only Tier 1 edges** — ensures high-quality pixel-art transitions in bridges
6. **Bridge insertion is bounded** — max depth 3 (graph diameter), prevents runaway propagation
7. **TileId kept for chunk.terrain** — needed for collision, detail tiles; `terrainIdToTileId` mapping
8. **Tile brush → corner brush** — tile paint sets all 4 corners, unifying the editing model

## Critical BiomeId→TerrainId numeric mismatch
```
BiomeId.Grass=3        → TerrainId.Grass=4     (NOT 3, which is SandLight!)
BiomeId.Forest=4       → TerrainId.Grass=4
BiomeId.DenseForest=5  → TerrainId.Grass=4
```
Must use explicit mapping function, not cast.

## Corner → 8-bit blob mask mapping
```
Corners:         Blob mask bits:
NW --- NE        NW  N  NE
|  tile |         W  .  E
SW --- SE        SW  S  SE

Cardinals (edge = both adjacent corners agree):
  N = nw_in && ne_in
  E = ne_in && se_in
  S = sw_in && se_in
  W = nw_in && sw_in

Diagonals (standard blob rule: only when both adjacent cardinals set):
  NW = N && W && nw_in
  NE = N && E && ne_in
  SW = S && W && sw_in
  SE = S && E && se_in
```

## Per-tile blend layer logic
For each tile:
1. Read 4 corners, each is a TerrainId
2. If all same → skip (no blend needed)
3. Find base terrain (lowest TERRAIN_DEPTH) and collect overlay terrains (sorted by depth)
4. For each overlay terrain:
   a. `blendGraph.getBlend(overlayTerrain, baseTerrain)` → BlendEntry
   b. If entry not inverted: compute corner mask for WHERE OVERLAY IS PRESENT
   c. If entry inverted: compute corner mask for WHERE BASE IS PRESENT
   d. Skip degenerate masks (0 = fully base, or 255 for inverted = fully overlay)
   e. GM_BLOB_LOOKUP[mask] → sprite position, pack into chunk.blendLayers

## Files changed (ordered by dependency)

| File | Change |
|------|--------|
| `src/autotile/TerrainAdjacency.ts` | **NEW** — adjacency graph (Tier 1 + Tier 2) + bridge BFS |
| `src/autotile/CornerBlend.ts` | **NEW** — computeCornerMask pure function |
| `src/autotile/terrainMapping.ts` | Add terrainIdToTileId, biomeIdToTerrainId |
| `src/autotile/TerrainGraph.ts` | Rewrite deriveTerrainFromCorners for TerrainId |
| `src/autotile/Autotiler.ts` | Add computeChunkCornerBlend |
| `src/world/Chunk.ts` | Doc update (corners = TerrainId) |
| `src/generation/FlatStrategy.ts` | TerrainId.Grass corners |
| `src/generation/OnionStrategy.ts` | @legacy, biomeIdToTerrainId for corners |
| `src/editor/EditorPanel.ts` | TerrainId palette, 7 terrain entries |
| `src/editor/EditorMode.ts` | TerrainId types |
| `src/core/Game.ts` | TerrainAdjacency, bridge insertion, corner edit rewrite |
| `src/world/World.ts` | Switch to computeChunkCornerBlend |

## What stays unchanged
- `BlendGraph` — adjacency graph and sheet lookup (already correct, source of truth)
- `GM_BLOB_LOOKUP` — 256 → sprite mapping
- `TileRenderer.rebuildCacheGraph` — reads chunk.blendLayers in same packed format
- `TerrainId`, `TERRAIN_DEPTH`, `TERRAIN_COUNT` — already the right canonical type

## Verification
1. `npx vitest run` — all unit tests pass (update existing + add new)
2. `npx tsc --noEmit` — type check passes
3. `npm run build` — builds clean
4. Manual: open editor, corner mode, paint single water corner → transitions appear with NO fan-out
5. Manual: paint DeepWater next to Grass → ShallowWater auto-inserted as bridge
6. Manual: paint Sand next to Grass → alpha blend (Tier 2), no bridge inserted
7. Manual: paint all 7 terrain types, verify dedicated transitions where sheets exist
