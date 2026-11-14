# 251 — Top-down camera, parity probe and merged meshes

Status: in progress, started 2026-11-14.
Slice 3 of [248](248-renderer-unification.md).
Owners: [renderer unification](../topics/renderer-unification.md),
[rendering architecture](../topics/rendering-architecture.md).

The 3D scene gets the fixed view's camera as an opt-in top-down view, a probe
measures where its pixels differ from the fixed view, its chunk meshes are
merged into fewer draws, and the result is measured on the Mac, the Pixel 7a and
the Steam Deck.

## Starting point

- The 3D scene draws first person and a chase camera. Top-down play is drawn
  only by the fixed view. 248's spike put the fixed view's projection on the 3D
  scene in 56 uncommitted lines.
- The parity checklist has no numbers: "matches by eye".
- The 3D scene draws one mesh per chunk's ground, and per chunk one mesh of
  flat-coloured prop faces plus one per artwork texture. The spike counted 4 to
  60 times the fixed view's draw calls.
- Slice 2 was measured on the Mac, with two standing-still cells on the Pixel
  7a. The bench's `drive` scene does not start on the phone.

## Phases and exit lists

Each phase is committed on its own.

### 3a — Top-down camera

- The fixed view's camera is a preset of the 3D scene: the oblique projection,
  cards that face south and show their drawn rows, no fog, the player's own body
  shown, and chunks kept for the ground on screen.
- Selected by `?view=topdown3d` and the `r_topdown3d` console variable, for
  every top-down view of the device. Off by default. A seat can still choose
  first person.
- Controls, markers, tap destinations and streaming interest stay the fixed
  view's, since the camera is the same.
- Rooms, the editor, masked regions and lost graphics fall back to the fixed
  view.
- Exit: Node test of the projection against `projectWorld`; captures at zooms 1,
  0.25 and 0.1; `render:bench --query=view=topdown3d` cells on the Mac against
  the same session's fixed view; fixed-view cells unchanged.

### 3b — Parity probe

- One frozen frame of the real game drawn through both renderers into the same
  region and read back.
- Differences are reported by category (ground, grass, solid props, standing
  cards, actors, vehicles, shadows, everything): how much of each category's
  picture both renderers cover, the shift that best aligns them, and how far the
  colours differ where both draw.
- Exit: numbers for `city`, `woods` and `crowd` at zooms 1 and 0.25 in the
  parity checklist; a registration tolerance recorded for the opt-in gate; the
  comparison maths tested in Node.

### 3c — Merged chunk meshes

- Neighbouring chunks' ground draws as one mesh per group of chunks, and their
  static prop faces likewise, without redoing a whole group when one chunk
  changes.
- Exit: draw calls before and after for first person and the top-down camera;
  the cost of a chunk change before and after; captures unchanged by eye;
  context loss still recovers; the parity numbers do not get worse.

### 3d — Device scorecard

- The bench's `drive` scene starts on the phone.
- `render:bench` cells for the top-down camera and first person on the Mac, the
  Pixel 7a and the Deck, before and after the merge, beside the fixed view.
- Exit: scorecard rows filled in the topic; a go or no-go note on phone and Deck
  draw-call cost.

## Progress

### 3a — delivered 2026-11-14

How it works:

- **The camera.** `ObliqueCamera.ts` holds the fixed view's projection as a
  matrix for the 3D scene. In the scene's axes (X east, Y north, Z up, relative
  to the camera's centre), with `s` screen pixels per world pixel and a `W × H`
  region, row-major:

  ```text
  2s/W   0         0          0
  0      2s/H      2s/H       0
  0      2/(n+f)   −2/(n+f)   (n−f)/(n+f)
  0      0         0          1
  ```

  A point lands on screen `(x, y − z)`, as `projectWorld` puts it. Depth is
  nearness along a view ray: farther south and higher up are both nearer. `n`
  and `f` reach 1,536 px towards the viewer and 1,024 px away, beyond the ground
  on screen. The camera has no rotation, like the one the fixed view draws
  vehicle meshes with.
- **The preset.** `FirstPersonFrame.topDown` carries the scale. With it the view
  uses that camera, turns its cards along east, shows each actor's drawn row,
  drops the fog, clears to the fixed view's backdrop colour and keeps the chunks
  under the ground on screen plus 128 px at the sides and top and 512 px below
  (tall props south of the bottom edge stand up into the view).
- **Choosing.** `FirstPersonControl.topDown` is one choice for the device, set
  by `r_topdown3d` or `?view=topdown3d`. Every view that is not in first person
  then draws through the 3D scene. A seat that switches between first person and
  top-down keeps its scene and its built chunks.
- **What stays the fixed view's.** A top-down 3D view sets `View.topDown3d`, not
  `drawn3d`. Movement, look, pointer lock, the aiming mark, tap destinations,
  player markers and streaming interest all read `drawn3d`, so they behave as in
  the fixed view; the cameras are the same, so markers and taps land correctly.
- **Fallbacks.** Rooms (the fixed view draws them roofless; the 3D scene has only
  walled rooms), the editor, a masked region, lost graphics and a scene still
  loading draw the fixed view.

Not in this phase, and recorded in the parity checklist: grass blades,
particles, decals, cutaways and slab fades, door overlays, pixel snapping, and
the fixed view's body shadows (the 3D view keeps its sun and contact shadows).

Cost, `npm run render:bench -- --headed`, M4 Pro, 120 Hz, 1280×800, Vite dev
modules, one 5 s run per cell, fixed view and `--query=view=topdown3d` in the
same session. Render is main-thread p50 / p95 in ms; GPU is the timer p50. No
cell missed a frame.

| Scene | Zoom | Fixed: render | GPU | Draws | Top-down 3D: render | GPU | Draws |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| city | 1 | 0.6 / 0.9 | 0.96 | 9 | 0.5 / 1.0 | 0.50 | 30 |
| city | 0.25 | 0.8 / 1.1 | 1.79 | 15 | 0.9 / 1.5 | 0.79 | 104 |
| city | 0.1 | 1.2 / 1.5 | 1.69 | 14 | 1.5 / 1.8 | 1.25 | 442 |
| crowd | 1 | 2.0 / 2.3 | 2.61 | 13 | 1.8 / 2.1 | 0.51 | 27 |
| crowd | 0.25 | 3.4 / 3.9 | 15.27 | 34 | 3.2 / 3.5 | 1.45 | 417 |
| crowd | 0.1 | 4.4 / 4.8 | 13.30 | 46 | 4.3 / 4.8 | 1.45 | 798 |
| woods | 1 | 1.2 / 1.5 | 0.62 | 4 | 0.5 / 0.8 | 0.44 | 12 |
| woods | 0.25 | 1.1 / 1.6 | 0.62 | 4 | 0.9 / 1.2 | 0.71 | 51 |
| woods | 0.1 | 2.3 / 2.6 | 0.85 | 7 | 1.8 / 2.1 | 1.92 | 232 |
| drive | 1 | 0.8 / 1.1 | 1.09 | 10 | 0.6 / 1.0 | 0.53 | 30 |

- These are the "before merge" cells for phase 3c. The 3D scene's draw calls
  grow with the chunks on screen; the fixed view's do not.
- The 3D view still draws less than the fixed view (no grass, particles or
  decals), so equal time is not yet equal work.
- Driving, three runs: 78, 418 and 418 px in 5 s. The 78 px run was the bench's
  autopilot held up in traffic, not the view.
- First person in the same session: city 0.7 / 1.1 ms, woods 0.8 / 1.1, crowd
  2.8 / 3.1, drive 0.8 / 2.0, matching 250's last numbers.

Captures (`--screenshots`) at the three zooms show buildings, props, actors,
vehicles and ground artwork where the fixed view draws them. At 0.1× the sun
shadows cover only the middle of the view: the shadow map is 2,048 px square and
its shadows fade out 760 to 872 px from the centre.

Validation:

- Node: `ObliqueCamera.test.ts` (screen positions equal `projectWorld` at four
  zooms; the matrix as a three.js camera; depth order along a view ray and the
  clip range; the ground rectangle; chunks nearest the centre first),
  `FirstPersonBillboards.test.ts` (an actor's row for an eye and for the
  top-down camera), `firstPersonPlay.test.ts` (a top-down 3D view keeps the
  fixed view's controls and interest; first person and back in the same scene;
  the frame drawn through the view's own camera; rooms left to the fixed view).
  298 tests in `src/rendering/firstperson`, `src/session`, `src/client` and
  `firstPersonPlay.test.ts` pass.
- Typechecks, Biome and knip pass; the ratchet reports only `PhysicsScene.ts`
  (881 → 884, not this work). `art:catalog` and `workshop:manifest` regenerated.

### 3b — delivered 2026-11-14

How it works:

- **The probe.** `canvas.__parity()` (`RendererParityProbe.ts`, loaded on first
  use) takes the current moment of outdoor play with `?view=topdown3d` and draws
  it through both renderers into seat 0's region, in one task, so no simulation
  step falls between two pictures. The camera is moved to a whole screen pixel
  first: the fixed view composes its picture at the camera's fraction of a
  pixel, which is filtering and not placement.
- **One kind of content at a time.** The fixed view is given part of the scene
  (no props, only solid props, only mesh bodies, and so on). The 3D scene hides
  kinds through `FirstPersonView.layers`. Sixteen pictures are read back.
- **Footprints.** A kind's footprint is the pixels that change when it is added
  to that renderer's own ground-only picture. `RendererParity.ts` reports, per
  kind: the pixels each renderer draws, the share of the union both draw
  (overlap), the whole-pixel move of the 3D picture that overlaps best (within 3
  px), and how far colours differ where both draw (pixels beyond 24 of 255 on
  any channel, and the mean).
- **The script.** `node scripts/first-person/parity.mjs --headed` runs the probe
  in the bench's `city`, `woods` and `crowd` at zooms 1 and 0.25, prints the
  numbers and writes each cell's two pictures and a difference picture.

Change from 248: the plan said a renderer-lab probe. The lab's fixture scenes
have no generated world, streamed chunks or real props, so the probe runs in the
game on the bench's scenes. Its comparison maths is a plain module with Node
tests.

Numbers, M4 Pro, headed Chromium, 1280×800, before the merge of phase 3c. A cell
reads "overlap; share of differing pixels where both draw", with the best move
when it is not (0, 0). The last three columns are shares of the whole picture
that differ.

| Scene | Zoom | Ground | Solid props | Standing cards | Actors | Vehicles | All kinds, no grass or shadows | As played |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| city | 1 | 0.0% | 53.8%, (0, 3); 0.0% | none | 100.0%; 0.0% | 96.8%; 24.3% | 3.3% | 3.7% |
| city | 0.25 | 1.1% | 85.7%; 13.2% | 93.4%; 8.5% | 84.0%; 25.9% | 94.5%; 31.7% | 8.5% | 12.0% |
| woods | 1 | 0.0% | none | 97.6%, (−1, 0); 9.0% | 82.9%; 8.5% | none | 2.5% | 8.9% |
| woods | 0.25 | 0.0% | none | 93.4%, (−1, 0); 25.9% | 67.2%; 40.3% | none | 6.9% | 11.9% |
| crowd | 1 | 0.0% | 53.8%, (0, 3); 0.0% | none | 88.0%; 10.0% | 96.8%; 25.7% | 3.7% | 4.3% |
| crowd | 0.25 | 1.1% | 85.7%; 13.2% | 93.4%; 8.5% | 68.1%; 49.8% | 97.1%; 14.9% | 11.7% | 15.1% |

What the numbers say:

- **Ground.** Identical at 1×. At 0.25× in the city 1.1% of pixels differ, on
  crosswalk stripes and lane dashes: the 3D ground averages four samples per
  pixel and the fixed view takes one.
- **Actors.** Identical in the city at 1× (the player and one walker: 3,735
  pixels each, none different). Wildlife and rabbits overlap 83 to 88% at 1×:
  the fixed view blends the soft shadow painted into those sprites, and the 3D
  cards cut artwork off at half opacity. At 0.25× overlap falls to 67 to 84%,
  because the fixed view filters small sprites and the 3D scene takes one
  sample.
- **Standing cards.** Trees and forest rows overlap 98% at 1×, and best after
  moving the 3D picture one pixel left. The fixed view floors a static sprite's
  screen edges to whole pixels; the 3D card is rasterised where it falls.
- **Solid props.** The largest gap, and a new finding: 54% overlap at 1× and 86%
  at 0.25×. The 3D scene draws 53,248 pixels of buildings where the fixed view
  draws 28,672. Its volumes use the colliders' physical heights, which are
  taller than the artwork implies, so each building shows a band of stretched
  roof above the fixed view's picture.
- **Vehicles.** Silhouettes overlap 95 to 97% with no move. A quarter of their
  pixels differ in colour: the 3D scene shades the bodies with its sun.
- **Grass.** The fixed view draws 1,200 (city) to 30,254 (woods) pixels of grass
  blades at 1×. The 3D scene draws none.
- **Shadows.** Not comparable yet: the fixed view draws 340 to 6,800 pixels of
  body shadow, the 3D scene 5,500 to 72,000 of sun and contact shadow.

Registration tolerance recorded for the opt-in gate: ground, actors and vehicles
must align best at (0, 0), and standing cards within one pixel, at zooms 1 and
0.25. That holds today. Solid props do not have the same silhouette, so their
best move (0, 3 at 1×) measures the height difference, not placement.

Validation:

- Node: `RendererParity.test.ts` (footprints and noise, a registered pair, a
  picture two pixels off, colour apart from coverage, a kind neither draws,
  whole pictures and their alignment, the tolerance, the difference picture).
- Browser: the script above; pictures looked at for each scene.
- Typechecks, Biome and knip pass; the ratchet reports only `PhysicsScene.ts`.
  `FirstPersonView.ts` passed 600 lines, so its chunk helpers moved to
  `FirstPersonChunks.ts`.

Also in this phase: the bench's `drive` scene now starts on the phone. In first
person there a traffic car that had stopped for the player stood on the spawn
spot, and the server drops a blocked spawn without an answer. The bench now
tries six spots around the player and looks for a car that was not there before.

### 3c — delivered 2026-11-14

How it works:

- **Ground tops.** `buildTerrainChunk` now returns a chunk's tile tops apart
  from its cliff walls. Tops are always 1,536 vertices, so `GroundTops` gives
  every chunk a slot in a mesh of 32 slots. A chunk that arrives, is edited,
  gets its ground page or leaves writes its own slot and uploads only that
  range (`addUpdateRange`), 68 KiB at most. More chunks add another block of
  2.2 MiB; nothing is copied or uploaded again. A block whose chunks have all
  left is freed. 71 chunks (first person, default distance) are 3 draws and 247
  (top-down at 0.1×) are 8, where each chunk was one.
- **Cliff walls and flat prop faces.** `MergedFaces` merges them per area of
  4 × 4 chunks. A chunk change puts together only its own area.
- **Prop faces wearing artwork.** One mesh per artwork texture across every
  resident chunk: a row of the same shop is one draw, where each chunk drew its
  own copy. These meshes are small (about 30 vertices a building), so putting
  one together again is cheap.
- **Shadows.** Only walls and prop faces are drawn into the sun's map now. A
  chunk with any cliff used to draw all its tops there as well; tops never
  shadow anything a wall does not.
- Chunks no longer own meshes. `FirstPersonView` keeps what was built for each
  chunk (revisions, the page its tops wear, prop surfaces) and three roots, one
  per kind of static content.

Decided against, for now: moving the artwork of solid props into the page atlas
so that they share one material. It needs faces cut at page boundaries and the
same residency rule as cards, and would take the city's remaining 12 draws to 1.
Vehicles are the larger remainder (below).
