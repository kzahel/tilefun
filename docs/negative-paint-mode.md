# Negative Paint Mode — Design Discussion

## What We Have Now (Global Approach)

The current implementation passes `forcedBase` globally to `computeAutotile()`.
When the user is in negative mode with terrain X selected:

- **Every** loaded chunk recomputes autotile with `forcedBase = X`
- This means ALL tiles containing terrain X anywhere in the world get their
  base selection overridden — including procedurally generated terrain the user
  never touched
- Switching paint modes or changing selected terrain invalidates all chunks
- Switching to play mode (editor off) drops the forcedBase entirely — the
  terrain reverts to default base selection

### Why Global Is Wrong

If you paint a small dirt island on grass in negative mode, the dirt island
looks correct (uses sheet #12: grass-on-dirt instead of #2: dirt-on-grass).
But every OTHER dirt path in the world also flips to sheet #12. Previous edits
are retroactively affected.

## The Problem Being Solved

`computeTileBlend` picks a "base" terrain — the background fill. All other
terrains at that tile become overlay layers drawn on top. The base choice
determines which blend sheet is used:

- **Positive** (default): base=Grass, overlay=DirtWarm → sheet #2 (dirt transitions on grass fill)
- **Negative**: base=DirtWarm, overlay=Grass → sheet #12 (grass transitions on dirt fill)

The visual result is fundamentally different transition art. Some terrains look
better one way vs the other depending on context.

The `forcedBase` parameter in `computeTileBlend` (line 89) already handles
this correctly per-tile:

```ts
if (forcedBase !== undefined && seen[forcedBase]) {
  base = forcedBase;
}
```

The question is: **where does the per-tile forcedBase value come from?**

## Design Options

### Option A: Per-Tile Storage in Chunk

Add a `Uint8Array(256)` to Chunk — one byte per tile. 0xFF = no override,
0-12 = forced TerrainId.

- **Paint in negative mode** → write `forcedBase[tile] = selectedTerrain` for
  each affected tile
- **Paint in positive mode** → write `forcedBase[tile] = 0xFF` (clear override)
- **Autotiler** reads `chunk.forcedBase[tileIdx]` per-tile instead of a global param
- **Persistence**: needs to be saved alongside subgrid data (adds 256 bytes per chunk)

Pros: Clean, predictable. Each tile remembers its mode independently.
Cons: Extra storage. Need to save/load it. "Painting" now writes two things
(subgrid + forcedBase), which is a new concept.

### Option B: Infer From Paint History (No Storage)

Don't store forcedBase at all. Instead, when painting in negative mode, paint
the subgrid values in a way that the default base-selection algorithm naturally
picks the "reverse" base.

For example, if you want dirt-as-base instead of grass-as-base, you could
paint the center subgrid point as dirt (so the tile's center terrain IS dirt),
then surround it with grass midpoints. The algorithm would pick dirt as base
because it's the center.

Pros: No extra storage. The subgrid is the single source of truth.
Cons: May not always be possible — the base selection algorithm uses a scoring
heuristic, not just center terrain. Could be fragile. Harder to reason about.

### Option C: Per-Tile Storage, Editor-Only (Not Persisted)

Same as Option A but don't persist the forcedBase array. It's ephemeral
editor state that resets on reload. The subgrid values are saved; the
rendering hint is lost.

Pros: Simpler than A (no save/load changes). Still per-tile during a session.
Cons: Reload = visual change. User might be surprised.

### Option D: Paint Applies Immediately, No Global Effect

Negative mode only affects the **moment of painting**. When you paint in
negative mode, the system:

1. Writes the subgrid values normally (same as positive)
2. Also writes `forcedBase` for each tile whose subgrid was touched
3. Only tiles you paint get the override — existing tiles are untouched

This is essentially Option A with the clarification that switching the UI
toggle doesn't retroactively change anything. The toggle only affects future
paint strokes.

## Current Code Flow

```
EditorPanel.paintMode → EditorMode.paintMode → Game.update():
  ├─ applyTileEdit / applySubgridEdit / applyCornerEdit
  │   └─ applySubgridWithBridges → setGlobalSubgrid → chunk.setSubgrid()
  │      └─ rederiveTerrainAt → chunk.setTerrain/setCollision
  └─ world.computeAutotile(blendGraph, forcedBase?)  ← currently global
      └─ computeChunkSubgridBlend(chunk, blendGraph, forcedBase?)
          └─ computeTileBlend(..., forcedBase?)  ← per-tile ready
```

To make it per-tile (Option A/D), the change is:
- `applySubgridWithBridges` additionally writes `chunk.forcedBase[tileIdx]`
  for affected tiles when `paintMode === "negative"`
- `computeChunkSubgridBlend` reads `chunk.forcedBase[tileIdx]` per-tile
  instead of using a single `forcedBase` parameter
- Remove global invalidation on mode switch

## Open Questions

1. Should forcedBase be persisted? (Affects save format)
2. Should painting in positive mode clear existing forcedBase on touched tiles?
   (Option D says yes — this gives "undo negative" behavior)
3. What happens to forcedBase when the chunk is regenerated from procedural noise?
   (Probably cleared — only editor-painted tiles should have overrides)
4. Should the demo (subgrid-demo.html) also switch to per-tile, or is global
   fine there? (Global is probably fine for the tiny demo grid)
5. Is the concept of "which transition direction to use" something the user
   should control per-tile, or should the base-selection algorithm just be
   smarter? (The scoring heuristic in computeTileBlend already tries to pick
   the best base — maybe it could be improved instead of adding manual control)
