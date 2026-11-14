# 250 — Ground artwork and shared pages

Status: in progress, started 2026-11-14. Phase 2a delivered; 2b not started.
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

### 2a — delivered 2026-11-14

How it works:

- **The seam.** `View3dTarget.pages` (`SharedPages`, implemented in
  `GpuView3d.ts`) lends a 3D view the fixed view's page atlas: the atlas texture
  and `ground(chunk)`, the atlas region of that chunk's prepared ground image.
  Asking for a page marks it used this frame, exactly as when the fixed view
  draws it, and uploads it if it is new.
- **The mesh.** A chunk's ground mesh carries two more vertex attributes
  (`FirstPersonGround.ts`): `groundTexel`, the vertex's place in the chunk's
  256 × 256 image, and `groundPage`, the page's corner and layer in the atlas.
  The page is per vertex, not per mesh, so slice 3 can merge chunks into one
  draw. Cliff walls carry no texel and keep their baked shading.
- **The shader.** The ground material is still three.js's basic material with
  the sun shadow; `shadeMaterial` splices in the atlas lookup. Lookups are
  clamped to the chunk's page, since its neighbours in the layer are other
  images. Atlas bytes are display-encoded and are decoded to linear light before
  shading.
- **Fallback.** A chunk with no page yet has layer −1 and draws its flat
  colours. When the page arrives the view rewrites that chunk's `groundPage`
  values (1,536 vertices) and nothing else.
- **Preparation.** `renderViews` now includes views drawn in 3D in the frame's
  one terrain preparation, over the view's interest range. Before, a session
  with every view in 3D prepared no ground images at all.

Residency rule (decided):

- A view drawn in 3D asks terrain preparation for the chunks of its interest
  range, the square of its view distance around its seat. Fixed views ask for
  their camera rectangle as before. All views share the frame's one budget
  (2 ms or 128 rows), and a chunk image no view asks for is dropped, as before.
- Each frame the view asks for the page of every chunk it draws, nearest first.
  A page it asks for cannot age out. Pages it stops asking for leave through the
  atlas's normal ageing (120 frames).
- One view uploads at most four new ground pages a frame (1 MiB); later chunks
  keep flat colours until their turn.
- There is no cap below the view distance. The far setting is the costly case
  (table below). A cap, or a fade to each tile's average colour, stays open if
  the phone shows a problem.

Texture memory by view distance, `scripts/first-person/ground-pages.mjs` in the
bench's city, one first-person view and no fixed view (so every page is a
ground page):

| View distance | Chunks drawn | Ground pages (GPU) | Ground images (CPU) |
| --- | ---: | ---: | ---: |
| near (400 px) | 32 | 8.0 MiB | 42 images, 10.5 MiB |
| medium (800 px, default) | 71 | 17.8 MiB | 81 images, 20.3 MiB |
| far (1,600 px) | 194 | 48.5 MiB | 240 images, 60.0 MiB |

- The CPU count is higher because preparation keeps a one-chunk halo.
- The atlas allocates whole layers and shrinks late: it held 8 layers (32 MiB)
  at near and medium and 18 (72 MiB) at far.
- On arrival every drawn chunk wore its page 1.3 s after the first 3D frame,
  within about 40 ms of the chunk itself arriving. The paced uploads did not
  fall behind chunk streaming.
- Driving (bench `drive`, 508 px in 5 s): 14 ground pages uploaded over 14
  frames, never more than 256 KiB in a frame, worst frame 10.4 ms, none missed.

Sampling at a distance (decided: four samples per pixel):

- The atlas is unfiltered and has no mip levels. On far ground many texels land
  in one pixel, so one sample per pixel picks among them and thin lines break up
  and crawl as the view moves.
- The ground shader takes four samples inside each pixel (a rotated grid) and
  averages them in linear light. Near ground stays crisp; far ground is
  smoothed.
- Measured in `ground-pages.mjs` with entities frozen: the view tilts 0.0002 rad
  a step for 21 steps and the script adds up each pixel's change in a far-ground
  band beyond its net change. One sample 15.3, four 11.1, eight 7.2, against 2.2
  with no motion. Turning sideways showed no difference (1.9 to 2.8, at the
  noise level). The band also contains building walls, which are unfiltered in
  every case.
- GPU time p50, city / woods / drive: one sample 0.49 / 0.43 / 0.56 ms, four
  0.55 / 0.50 / 0.65, eight 0.62 / 0.58 / 0.76. Four was chosen as the cheaper
  step until a phone is measured; eight is a one-line change (`GROUND_TAPS`).

Cost, `npm run render:bench -- --headed --zooms=1 --query=view=fps`, M4 Pro,
120 Hz, 1280×800, Vite dev modules, one 5 s run per cell, same session, the
before column from the stashed tree. Render is main-thread p50 / p95 in ms; GPU
is the timer p50. No missed frames.

| Scene | Before: render | GPU | After: render | GPU | Draws before → after |
| --- | --- | ---: | --- | ---: | --- |
| city | 0.6 / 0.9 | 0.41 | 0.6 / 1.0 | 0.55 | 55 → 56 |
| woods | 0.8 / 1.0 | 0.38 | 0.9 / 1.1 | 0.50 | 35 → 35 |
| crowd | 2.9 / 3.8 | 0.90 | 3.0 / 3.4 | 1.09 | 326 → 333 |
| drive | 0.7 / 1.1 | 0.44 | 0.8 / 1.4 | 0.64 | 74 → 71 |

- Main-thread time is within 0.1 ms at p50. GPU time is 0.12 to 0.20 ms higher:
  the ground now reads a texture four times per pixel.
- Fixed view, before → after: city 0.6 / 0.9 → 0.6 / 1.0 at 1× and 0.9 / 1.2 →
  0.7 / 1.0 at 0.25×; crowd 2.0 / 2.4 → 2.0 / 2.4 and 3.4 / 3.9 → 3.6 / 4.2.
  Unchanged within run-to-run spread.

Validation:

- Captures, `scripts/first-person/capture.mjs`: crosswalks, lane dashes and
  sidewalk paving on foot and from the chase camera; park paths and grass from a
  raised eye (`--lift=140`); the woods. All 71 (city) and 69 (woods) drawn
  chunks wore their page. Mixed split screen draws the artwork in both layouts.
  The context-loss step still recovers: the atlas forgets its pages, the view
  gets new regions on the next frames and rebinds.
- Node: `FirstPersonTerrain.test.ts` (tile tops placed in the image at any
  height, cliff walls without), `FirstPersonGround.test.ts` (flat until bound,
  rebinding, and that the shader edit still finds its anchors in three.js's
  shader text), `GpuView3d.test.ts` (paced uploads, resident pages cost none, no
  page without an image or when the atlas is full), `View.test.ts` (3D views'
  interest ranges are prepared, also with every view in 3D). 100 tests in
  `src/rendering/firstperson`, `src/session`, `GpuView3d.test.ts` and
  `firstPersonPlay.test.ts` pass.
- `npm run streaming:bench -- --assert-ready` passes. Typechecks, Biome and knip
  pass; the ratchet reports only `PhysicsScene.ts` (881 → 884, not this work).
  `art:catalog` and `workshop:manifest` regenerated.
- Not run: full unit and browser suites. Not measured: phone, Deck, headset.

Scripts:

- New `scripts/first-person/ground-pages.mjs` reports the fill on arrival, the
  table above and the shimmer measure.
- `render:bench`: the `drive` scene now waits for arrival before spawning its
  car. In first person nothing used to prepare terrain, so the bench's settle
  wait returned at once and the spawn could be sent while edits are still
  dropped (the cell then timed out).

Limits:

- A page changes the ground from flat colours to artwork in one frame. The flat
  colours are hand-picked, not the artwork's averages, so the change is visible
  when it happens in view.
- Far ground is smoothed, not mip-mapped: beyond about four texels per pixel it
  still aliases.
- With the far view distance and a fixed view in split screen, page memory can
  pass the page store's 64 MiB mark, after which pages unused for two frames are
  dropped at once instead of after 120.
- Grass blades, decals and particles are not ground images and are still
  missing in 3D (parity checklist).
