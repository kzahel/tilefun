# Corner-Based Blend Mask Computation

## Problem
The current `computeChunkBlendLayers` computes autotile masks by scanning 8 **neighboring tiles**.
This causes "fan-out": grass tiles adjacent to a 2x2 water pond draw water-grass transitions on
themselves, even though their corners are all-grass and shouldn't show any transition.

## Solution
Replace neighbor-tile-based mask computation with **corner-based** mask computation.
Each tile derives its blend mask from its own 4 corners only. Tiles with uniform corners
produce no blend layers — transitions are self-contained within mixed-corner tiles.

### Corner → 8-bit blob mask mapping
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

### Per-tile blend layer logic
For each tile:
1. Read 4 corners, map to TerrainId
2. If all same → skip (no blend needed)
3. Find base terrain (lowest TERRAIN_DEPTH) and collect overlay terrains (sorted by depth)
4. For each overlay terrain:
   a. `blendGraph.getBlend(overlayTerrain, baseTerrain)` → BlendEntry
   b. If entry not inverted: compute corner mask for WHERE OVERLAY IS PRESENT
   c. If entry inverted: compute corner mask for WHERE BASE IS PRESENT
   d. Skip degenerate masks (0 or 255 for inverted)
   e. GM_BLOB_LOOKUP[mask] → sprite, pack into chunk.blendLayers

## Files to modify

### `src/autotile/Autotiler.ts`
- **Add** `computeCornerMask(nw, ne, sw, se)` — pure function, 4 booleans → 8-bit mask
- **Add** `computeChunkCornerBlend(chunk, blendGraph)` — reads chunk.corners, fills chunk.blendLayers
  - No `cx, cy, getTerrain` params needed (everything from chunk's own corners)
  - Uses `tileIdToTerrainId` to map BiomeId corners → TerrainId
  - Reuses existing `BlendGraph`, `GM_BLOB_LOOKUP`, `packBlend`, `MAX_BLEND_LAYERS`
  - Note: chunk corners store BiomeId, need `biomeToTerrainId` mapping (BiomeId→TerrainId via tileIdToTerrainId∘biomeIdToTileId)

### `src/world/World.ts`
- In `computeAutotile`: call `computeChunkCornerBlend(chunk, blendGraph)` instead of `computeChunkBlendLayers(chunk, cx, cy, getTerrain, blendGraph)`
- Keep old `computeChunkBlendLayers` code in Autotiler.ts (don't delete, just stop calling it)

### `src/autotile/Autotiler.test.ts`
- Add tests for `computeCornerMask`:
  - All same → mask 255
  - Single corner different → mask with 3 edges + 1 diagonal
  - Two adjacent corners → mask for half-tile
  - Opposite corners → cardinals only, no diagonals
- Add integration test for `computeChunkCornerBlend`:
  - Flat grass chunk, set 1 water corner → only the 4 sharing tiles get blend layers
  - Adjacent grass tiles get NO blend layers (no fan-out)

## What stays unchanged
- `BlendGraph` — adjacency graph and sheet lookup
- `GM_BLOB_LOOKUP` — 256 → sprite mapping
- `TileRenderer.rebuildCacheGraph` — reads chunk.blendLayers in same packed format
- `deriveTerrainFromCorners` — min-priority rule from earlier fix
- `TERRAIN_LAYERS` / `computeChunkAllLayers` — kept but not deleted (legacy path)

## Verification
1. `npx vitest run` — all unit tests pass
2. `npx tsc --noEmit` — type check passes
3. Manual test: open editor, corner mode, paint single water corner → see small pond with NO fan-out
