# 247 — First-person shadows, walls and forest cards

Status: delivered for owner play · 2026-11-13. The first-person view stays an
opt-in experiment ([229](229-first-person-view.md)).
Owner request, 2026-11-13: make the 3D view look better, with shadows, without
costing frame rate; buildings and dense forests showed artwork on one side only.
Owners: [rendering architecture](../topics/rendering-architecture.md),
[229 first-person view](229-first-person-view.md).

## What changed

- **Sun shadows.** Buildings, decks, cliffs, trees, posts and forest rows cast
  shadows onto the ground, each other, actors and vehicles. The sun is in the
  south-east (30° east of south, 52° high), so shadows fall north-west and the
  faces the fixed view draws (south) are lit.
- **Contact shadows.** Every actor and vehicle has a soft dark footprint on the
  surface under it: ovals for actors, rounded rectangles for vehicles.
- **Walls on every side.** A building's east, west and north walls wear its south
  face. They were one flat colour.
- **Forest rows as trees.** A row of the dense forest was one box with a picture
  on its top and south side. It is now a line of upright cards cut from the same
  picture, which turn to the eye like single trees.
- **Standing props cost nothing per frame.** Trees, posts and signs were rewritten
  into vertex buffers every frame. They are now static meshes.

`r_fpshadows 0` (console) or `?fpshadows=0` turns both kinds of shadow off.

## Sun shadow map

`FirstPersonSun.ts` (math), `FirstPersonShadows.ts` (`SunShadows`).

- The map is the ground seen along the sun's rays. A point lands on the texel of
  the ground position its shadow falls on, and the texel keeps the highest point
  on that ray. It is an oblique orthographic projection, set as a custom camera
  projection matrix.
- It never rotates and one texel is one world pixel (2048² over a 2048 px square),
  so shadow edges sit on the world's pixel grid and do not crawl when the camera
  moves. The origin moves in 128 px steps.
- **It is cached.** Only static content is drawn into it. It is redrawn when:
  - static content inside the fog changes (a chunk built, rebuilt or released);
  - the eye crosses a 128 px step;
  - 400 ms after content beyond the fog changed, if no step came first.
  A steady camera redraws nothing. Driving 428 px in 5 s redrew it 8 times.
- Casters opt in by layer: prop solids, and ground chunks that have cliff walls.
  One pass draws them with a depth-only override material. A second small pass
  draws the standing cards turned across the sun's direction, sharing the visible
  cards' buffers, so trees cast tree-shaped shadows.
- Receivers add one hardware depth comparison (four blended tests) per pixel,
  through `shadeMaterial` (`FirstPersonMaterials.ts`), which edits the shader of
  Three's built-in materials. Three kinds:
  - `faces` (ground, prop solids): the face normal comes from screen-space
    derivatives. Faces turned from the sun keep their baked shade; lit faces
    sample one pixel off their surface.
  - `body` (vehicles, actors): not in the map, so every pixel samples at its own
    position. An actor half inside a building's shadow is half dark.
  - `card` (trees, forest rows): they are in the map facing the sun, so they
    sample from the sunny side of their own shadow card. Only neighbours darken
    them. Forest interiors are dark below and lit on top.
- Positions are relative to the map origin before they reach the shader, so
  precision does not fall with distance from the world origin.
- Shadows fade out 760–872 px from the eye. Rooms have no sun.
- Cost: a 16-bit depth texture (8 MiB) and its required colour attachment (R8,
  4 MiB).

## Contact shadows

`BlobShadows` draws all of them in one alpha-blended draw, after the world and
before vehicles.

- Shapes come from the shared collector: first person now collects with
  `depthShadows`, so casters carry the same `GpuShadow` the fixed view's depth
  pass uses, with the same masks.
- `GpuShadow` gained `support` (the height of the surface under the caster's
  centre, which the collector already resolved) and `upright` (an actor's oval,
  squashed north–south for the fixed view; first person draws it round). The
  fixed view ignores both. The three raster collector digests were re-recorded
  for these keys only; with them omitted all five earlier digests reproduce.
- First person collects without surface receivers (as the fixed view does below
  0.2×), so a body above the terrain also checks the static decks and ramps under
  it. A car on a bridge keeps its shadow on the deck.
- A grounded vehicle's footprint follows its underside plane, so it lies along a
  ramp. In the air it falls level onto the support.
- A vehicle drawn as its sprite fallback gets none: the sprite has one baked in.

## Walls and forest rows

- `appendPropGeometry` textures all five drawn faces of a solid. Side walls
  continue the south face around their south corner at the artwork's own scale
  (mirror-repeated if the wall is deeper than the picture is wide). The north wall
  repeats the south face unmirrored, so signs read correctly.
- Textured faces carry a baked grey per vertex: top and south 1, east 0.92, west
  0.72, north 0.66. West and north never face the sun.
- `propForm` returns `cards` for `pattern:forest-thicket-v1` rows. `propSlices`
  cuts each piece of the row's artwork into slices at most 64 px wide, standing
  at the middle of the row's 48 px body. From the south they line up into the
  fixed view's picture.
- No new textures: side walls reuse the opaque composition, and forest cards read
  the sheet directly.

## Cards

`FirstPersonBillboards.ts`.

- A card is four vertices that all carry the foot centre, plus a corner offset
  and UV. The vertex shader offsets them along one horizontal axis held in a
  uniform. Turning the camera changes the uniform, not the buffers.
- `StaticCards` keeps each chunk's cards and merges all resident chunks into one
  mesh per texture. A merged mesh is rebuilt only when one of its chunks changes.
- `BillboardBatches` (moving actors) writes the same layout each frame, without
  the temporary arrays the old writer allocated per quad.

## Measurements

`npm run render:bench -- --headed --scenes=… --zooms=1 --query=view=fps`. The
bench now measures the first-person context when play is drawn there (GPU timer,
finish window, draw calls, shadow-map redraws inside the window).

M4 Pro, headed bundled Chromium, 120 Hz, 1280×800, Vite dev modules, medium view
distance. Render is the main-thread callback, p50 / p95 in ms; GPU is the timer
query's p50. No run missed a frame (0 of 600).

| Scene | Before: render | GPU | Shadows off: render | GPU | Shadows on: render | GPU |
| --- | --- | ---: | --- | ---: | --- | ---: |
| city | 0.6 / 1.0 | 0.32 | 0.5 / 0.7 | 0.42 | 0.6 / 0.9 | 0.48 |
| woods | 0.8 / 1.1 | 0.37 | 0.8 / 1.0 | 0.40 | 0.8 / 1.1 | 0.47 |
| crowd (1,000 rabbits, 49 cars) | 2.8 / 3.1 | 0.99 | 2.9 / 3.4 | 1.34 | 3.3 / 3.7 | 1.74 |
| drive (428 px in 5 s) | not measured | — | 0.7 / 0.9 | 0.43 | 0.7 / 1.0 | 0.50 |

- "Shadows off" is this slice with `fpshadows=0`: textured walls, forest cards and
  static cards, no sun map and no contact shadows.
- City, woods and driving: main-thread time is unchanged. GPU time rises by about
  0.15 ms in total, of which the shadows are about 0.07 ms.
- Crowd: about 0.4 ms more main-thread time and 0.4 ms more GPU time, for 1,057
  contact shadows per frame. Repeated runs of one cell vary by about 0.3 ms.
- The sun map was redrawn 0 times in the steady scenes and 8 times in the drive.
- Not measured on the Pixel 7a or the Steam Deck. The per-pixel cost is one depth
  comparison; a map redraw is one depth-only pass over the static prop meshes.

## Validation

- Node: new tests for the sun projection and stepping, redraw range, contact
  shadow corners, card buffers and merging, forest slices, wall artwork and
  support lookup. `src/rendering/firstperson`, `src/scenes`, `src/client` and the
  collector tests pass (36 files, 394 tests).
- Typechecks (game, server, worker, tools), Biome and knip pass. The ratchet
  passes for every file changed here: `FirstPersonView.ts` shrinks from 570 to
  489 lines (`FirstPersonPropMeshes.ts` and `FirstPersonVehicles.ts` split out).
  It still reports `PhysicsScene.ts` (881 → 884 lines) from an earlier commit.
- Browser captures (`scripts/first-person/capture.mjs`, evidence only, not
  committed): city and woods at four headings, from above (`--lift`), a forest
  thicket from the south and the side, driving, the editor hiding the view, and
  rooms (`capture-rooms.mjs`). No page errors.
- `capture.mjs` gained `--arrival=x,y`, `--looks-only`, `--pitch`, `--lift`,
  `--query` and a list of nearby forest rows in its report.

## Independent review

A separate read-only review session (general-purpose agent, fresh context) read
the diff and Three 0.187's source. It found the camera, layers, render target,
state restoration, Y-mirror signs, redraw logic and disposal sound, and reported
five items:

1. **Fixed.** With shadows off from the start (`?fpshadows=0`, or entering first
   person inside a room) the depth texture was never created, so every receiver
   had a non-depth texture on its shadow sampler and its draws were rejected.
   The map is now created on the first frame whether or not it is lit. The
   earlier "shadows off" measurements (GPU 0.11 ms in every scene) were of that
   broken state and are replaced above.
2. **Fixed.** A wall deeper than its artwork is wide interpolated one UV across
   the mirror turn and smeared. Walls are now cut into strips at each turn
   (Node test).
3. **Fixed.** Actor ovals kept the fixed view's north–south squash and looked
   long from the east or west. `GpuShadow.upright` marks them and first person
   draws them round. The collector digests cover both new keys.
4. **Open, older than this slice.** A composed prop image evicted from the
   256-image cache while a mesh still draws it is uploaded again by Three and
   then never disposed. It needs more than 256 distinct compositions in a session.
5. **Open, not measured.** Any chunk change re-merges all resident cards of the
   textures it touches. Forest rows share one sheet, so at the far view distance
   in woodland each chunk build copies the whole forest's card buffer.

## Known limits

- Moving bodies cast only contact shadows, not sun shadows.
- Side and north walls repeat the south face, including its signs and doors.
- A forest card's edge is a straight vertical cut where a slice ends. It shows
  on the outline of a row seen from its end.
- The sun never moves, and nothing is lit at night.
- A body riding another vehicle's bed or a transporter deck above the terrain
  uses the collector's support, which has no receivers in this view.
- Ground is still flat colour per tile.

## Direction for the first-person view

Recommended order. Each is a separate slice.

1. **Ground artwork.** The fixed view's ground is already a top-down picture, so
   it maps straight onto the ground quads: road markings, grass, paths. This is
   the largest visible gain left. The terrain images belong to the GPU backend
   and may not leave it, so do it together with item 2, or give the view its own
   `TileRenderer` and accept rasterising chunks twice.
2. **One renderer.** Draw first person through the GPU host's `WebGLRenderer`
   (226 requirement 4). It removes the second WebGL context and the duplicate
   vehicle assets, allows split screen with mixed views, and gives access to the
   terrain pages for item 1.
3. **Building tops and backs from recipes.** Building recipes know their pieces
   (ground floor, upper floors, roof). Side and back walls could repeat an upper
   floor instead of the shop front.
4. **Sky.** A gradient, a sun disc where the light comes from, and drifting
   cloud cards. Then a time of day that moves the sun, which the shadow map
   already supports (one redraw per change).
5. **Touch look and a controller toggle** (229 next steps), so it is playable on
   the phone and the Deck without a keyboard.
6. **Moving shadows.** Vehicles into a second, small per-frame map near the eye,
   only if contact shadows prove too plain.
