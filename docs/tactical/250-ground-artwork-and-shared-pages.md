# 250 — Ground artwork and shared pages

Status: in progress, started 2026-11-14.
Slice 2 of [248](248-renderer-unification.md).
Owners: [renderer unification](../topics/renderer-unification.md),
[rendering architecture](../topics/rendering-architecture.md).

The 3D scene draws the fixed view's ground artwork, and its sprite cards read
the fixed view's page atlas, so both renderers keep one copy of each image on
the GPU.

## Starting point

- The fixed view rasters each chunk's ground on the CPU (`TileRenderer`, one
  256 × 256 image per chunk, built within a per-frame budget) and uploads it as
  a page of the page atlas (`GpuPages`, one texture array of 1,024-texel
  layers). Sprite sheets are uploaded the same way, in pages of at most 512
  texels, the first time a sprite in the page is drawn.
- The 3D scene draws one flat-coloured quad per tile. Its cards (actors,
  standing props, forest rows) read whole sheet images that it uploads as
  separate textures, so a sheet both renderers use is on the GPU twice.
- Terrain images are only prepared for fixed views. With every view in 3D none
  are prepared.

## Phases and exit lists

Each phase is committed on its own.

### 2a — Ground artwork

- A 3D view borrows the host's pages: the atlas texture and the page of a
  chunk's ground image (`View3dTarget.pages`).
- Ground top faces sample their chunk's page. Cliff walls keep their baked
  shading. A chunk without a ready page draws its flat colours, and changes
  over when the page arrives.
- 3D views take part in terrain preparation: a view drawn in 3D asks for the
  chunks of its interest range, with the same shared budget as fixed views.
- Residency rule decided and recorded: which chunks keep a ground page for a 3D
  view, how uploads are paced, and what that costs in texture bytes at the
  near, medium and far view distances.
- Sampling at a distance looked at (unfiltered pixels shimmer when many texels
  land in one pixel) and a choice recorded.
- Exit: first-person and chase captures with road markings, grass and paths;
  page uploads and texture bytes recorded for the three view distances;
  `render:bench` first-person cells against the same session's before run;
  fixed-view cells unchanged; `streaming:bench -- --assert-ready` passes; the
  context-loss capture step still recovers.

### 2b — Cards from the page atlas

- Actor cards, standing prop cards and forest rows sample the page atlas.
  First person no longer uploads whole sheet images.
- A sprite frame that crosses a page boundary draws as one card per page.
- Standing cards are baked into merged meshes, so their pages are kept
  resident, and the cards are rebuilt if the atlas forgets its pages (restored
  context, changed assets).
- Exit: no whole-sheet texture uploads from the 3D view (texture count and
  bytes before and after recorded); actor, tree, forest and room-furniture
  captures unchanged by eye; draw calls recorded; mixed split screen and
  context loss still pass.

Out of scope: the composed artwork that prop boxes and room shells wear. Those
images are made by the 3D view, are often wider than a page, and stay as its own
textures.

## Progress

Nothing delivered yet.
