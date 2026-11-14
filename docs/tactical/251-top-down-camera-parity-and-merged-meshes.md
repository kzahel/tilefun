# 251 — Top-down camera, parity probe and merged meshes

Status: delivered 2026-11-14 (phases 3a to 3d, independent review applied), for
owner play.
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
  kinds through `FirstPersonView.layers`. Seventeen pictures are read back.
  Shadows are taken off every picture but the last two pairs, and slabs draw at
  full opacity (the 3D scene has no cutaways). The fixed view draws entities
  from the 3D views' own scene frame, so both renderers pose vehicles alike.
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

Numbers, M4 Pro, headed Chromium, 1280×800, from the final probe (after the
merge of phase 3c and the review's fixes; ground, solid props and standing cards
read the same before the merge). A cell
reads "overlap; share of differing pixels where both draw", with the best move
when it is not (0, 0). The last three columns are shares of the whole picture
that differ.

| Scene | Zoom | Ground | Solid props | Standing cards | Actors | Vehicles | All kinds, no grass or shadows | As played |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| city | 1 | 0.0% | 53.8%; 0.0% | none | 100.0%; 0.0% | 97.0%; 21.5% | 3.2% | 3.6% |
| city | 0.25 | 1.1% | 85.7%; 13.2% | 93.4%; 8.5% | 86.6%; 36.6% | 94.9%; 31.2% | 8.5% | 12.0% |
| woods | 1 | 0.0% | none | 97.6%, (−1, 0); 9.0% | 82.9%; 8.5% | none | 2.5% | 8.9% |
| woods | 0.25 | 0.0% | none | 93.4%, (−1, 0); 25.9% | 67.4%; 41.6% | none | 7.0% | 11.9% |
| crowd | 1 | 0.0% | 53.8%; 0.0% | none | 88.8%; 10.0% | 96.8%; 25.8% | 3.7% | 4.3% |
| crowd | 0.25 | 1.1% | 85.7%; 13.2% | 93.4%; 8.5% | 68.4%; 49.3% | 97.1%; 15.0% | 11.7% | 15.1% |

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
- **Vehicles.** Silhouettes overlap 95 to 97% with no move. A fifth to a third
  of their pixels differ in colour: the 3D scene shades the bodies with its sun.
- **Grass.** The fixed view draws 1,200 (city) to 30,254 (woods) pixels of grass
  blades at 1×. The 3D scene draws none.
- **Shadows.** Not comparable yet: the fixed view draws 340 to 6,800 pixels of
  body shadow, the 3D scene 5,500 to 72,000 of sun and contact shadow.

Registration tolerance recorded for the opt-in gate: ground, actors and vehicles
must align best at (0, 0), and standing cards within one pixel, at zooms 1 and
0.25. That holds today. Solid props also align best at (0, 0), but they do not
have the same silhouette, so overlap is the number to watch for them.

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

Cost of a chunk change, M4 Pro, headed Chromium, top-down 3D view. Time inside
the view's frame including `gl.finish()`, in ms, from a throwaway script that
wraps `FirstPersonView.render` (the same script on both trees):

| What happens | Scene | Before: mean / p95 | After: mean / p95 |
| --- | --- | --- | --- |
| 247 chunks arrive after zooming out to 0.1×, three built a frame | city | 1.90 / 2.6 over 163 frames | 1.64 / 2.4 over 162 |
| | woods | 1.68 / 2.6 over 179 | 1.35 / 2.2 over 175 |
| The same view once nothing is being built | city | 1.14 / 1.3 | 0.87 / 1.3 |
| | woods | 0.77 / 0.9 | 0.38 / 0.5 |
| One chunk's ground changes at 0.25× (30 times) | city | 0.94 / 1.2 | 0.73 / 0.9 |
| | woods | 0.58 / 0.7 | 0.38 / 0.5 |
| Frames between those changes | city | 0.63 / 1.4 | 0.52 / 1.3 |
| | woods | 0.38 / 1.1 | 0.27 / 1.0 |

- A chunk change costs 0.1 to 0.3 ms over a quiet frame on this Mac, before and
  after. The merge did not make changes dearer: the bytes uploaded per chunk are
  the same (one slot is what one chunk mesh was), and no mesh, geometry or
  vertex array object is made per chunk any more.
- The first design kept all tops in one buffer that doubled. At 0.1× that would
  have uploaded 17 MiB again in one frame on the way to 256 slots, so it became
  fixed blocks before anything was measured on a device.

Draw calls, M4 Pro, same bench as 3a (`--query=view=topdown3d`, then
`view=fps` at zoom 1):

| Scene | Zoom | Top-down 3D before | After | Fixed view, with its vehicle meshes |
| --- | --- | ---: | ---: | ---: |
| city | 1 | 30 | 22 | 35 |
| city | 0.25 | 104 | 44 | 88 |
| city | 0.1 | 442 | 193 | 114 |
| crowd | 1 | 27 | 19 | 126 |
| crowd | 0.25 | 417 | 358 | 346 |
| crowd | 0.1 | 798 | 549 | 593 |
| woods | 1 | 12 | 4 | 4 |
| woods | 0.25 | 51 | 6 | 4 |
| woods | 0.1 | 232 | 15 | 7 |

- First person: city 48 → 20, woods 29 → 6, crowd 325 → 297, drive 63 → 39.
- **The fixed view's count was understated.** The bench counted its sprite
  batches only. It also draws each moving vehicle's meshes into an image
  (`GpuMeshBodies.drawCalls`), 26 to 547 calls a frame in these cells. The bench
  now reports them (`meshDrawCallsPerFrame`), and the last column adds them.
  248's "4 to 60 times the draw calls" compared the 3D scene's whole count with
  the fixed view's batches.
- What is left in the 3D scene is vehicles: about 8 to 16 meshes a car, one
  render per car. In the city at 0.1× they are roughly 170 of the 193 calls.
  Static content is 4 to 25 draws at any zoom.

Validation:

- Node: `FirstPersonGround.test.ts` (flat until bound; one slot uploaded per
  change; a slot reused and a freed slot drawing nothing; a second block added
  without touching the full one, gaps filled first, an empty block freed;
  malformed tops refused), `FirstPersonFaces.test.ts` (one mesh per bucket; only
  touched buckets rebuilt; the same artwork merged across chunks; empty buckets
  dropped; one mesh object per bucket across rebuilds), `FirstPersonTerrain.test.ts`
  (tops always 1,536 vertices, walls apart and untextured, a wall along a lower
  neighbour's edge). After the review's additions, 390 tests in
  `src/rendering/firstperson`, `src/scenes`, `src/session`, `src/client` and the
  parity and host tests pass.
- `scripts/first-person/capture.mjs`: four headings, driving, mixed split
  screen, the editor, and context loss and recovery with the merged meshes. New
  steps: both seats top-down in 3D, first person beside top-down 3D, and back to
  the fixed view. `capture-rooms.mjs`: rooms draw. No page errors.
- Raised ground (a plateau made with the editor's elevation edit; the generated
  world is flat): cliff walls and their sun shadows draw in first person and
  top-down from the merged wall mesh.
- Parity probe after the merge: ground, solid props and standing cards read the
  same numbers as before it; actors and vehicles differ by under two points, as
  moving things do between runs.
- `npm run streaming:bench -- --assert-ready` passes. Typechecks, Biome and knip
  pass; the ratchet reports only `PhysicsScene.ts`. `art:catalog` and
  `workshop:manifest` regenerated.

### 3d — delivered 2026-11-14

`npm run render:bench`, one 5 s run per cell. Render is the main-thread render
callback, p50 / p95 in ms. The fixed view's column is from the same session as
the "after" column; its draws include vehicle meshes. "Before" is commit
`6fd0d4be` (one mesh per chunk), run from an exported copy of that commit while
the merge was written. Full cells:
[evidence](../benchmarks/251-device-scorecard.json).

M4 Pro Mac, headed 120 Hz, 1280×800, Vite dev modules. No missed frames.

| Scene | Zoom | Fixed: render | Draws | Top-down 3D before: render | Draws | After: render | Draws |
| --- | --- | --- | ---: | --- | ---: | --- | ---: |
| city | 1 | 0.6 / 0.8 | 35 | 0.5 / 1.0 | 30 | 0.5 / 0.8 | 22 |
| city | 0.25 | 0.8 / 1.2 | 88 | 0.9 / 1.5 | 104 | 0.8 / 1.3 | 44 |
| city | 0.1 | 1.1 / 1.4 | 114 | 1.5 / 1.8 | 442 | 1.0 / 1.4 | 193 |
| crowd | 1 | 2.0 / 2.3 | 126 | 1.8 / 2.1 | 27 | 2.0 / 2.2 | 19 |
| crowd | 0.25 | 3.7 / 4.2 | 346 | 3.2 / 3.5 | 417 | 3.0 / 3.4 | 358 |
| crowd | 0.1 | 4.3 / 4.9 | 593 | 4.3 / 4.8 | 798 | 3.8 / 4.3 | 549 |
| woods | 1 | 1.0 / 1.4 | 4 | 0.5 / 0.8 | 12 | 0.5 / 0.9 | 4 |
| woods | 0.25 | 1.2 / 1.5 | 4 | 0.9 / 1.2 | 51 | 0.9 / 1.1 | 6 |
| woods | 0.1 | 2.1 / 2.4 | 7 | 1.8 / 2.1 | 232 | 1.6 / 2.0 | 15 |
| drive | 1 | 0.7 / 0.9 | 49 | 0.6 / 1.1 | 30 | 0.6 / 1.2 | 23 |

GPU timer p50 after the merge: top-down 3D 0.45 to 1.59 ms; fixed view 0.61 to
15.63 ms (the crowd at 0.1×).

Pixel 7a, Chrome over CDP, 60 Hz, 411×789 portrait canvas, Vite dev modules,
battery 28.2 → 33.0 °C in the before session and 31.5 → 35.2 °C in the after
session.

| Scene | Zoom | Fixed: render | Missed | Draws | Top-down 3D before: render | Draws | After: render | Missed | Draws |
| --- | --- | --- | --- | ---: | --- | ---: | --- | --- | ---: |
| city | 1 | 3.5 / 4.8 | 0 of 300 | 29 | 2.7 / 3.9 | 18 | 2.7 / 3.8 | 0 of 300 | 14 |
| city | 0.25 | 3.6 / 4.7 | 0 of 300 | 32 | 3.6 / 4.9 | 47 | 3.2 / 4.2 | 1 of 296 | 23 |
| city | 0.1 | 4.7 / 6.6 | 0 of 300 | 141 | 4.6 / 5.9 | 191 | 4.9 / 6.4 | 0 of 301 | 145 |
| woods | 1 | 4.1 / 5.7 | 0 of 300 | 4 | 2.4 / 4.0 | 9 | 2.6 / 3.5 | 0 of 300 | 4 |
| woods | 0.25 | 4.7 / 5.9 | 0 of 300 | 4 | 3.4 / 4.6 | 27 | 3.5 / 4.4 | 0 of 300 | 4 |
| woods | 0.1 | 5.3 / 6.3 | 0 of 300 | 4 | 4.7 / 5.8 | 87 | 4.3 / 5.5 | 0 of 300 | 6 |
| crowd | 1 | 8.0 / 13.2 | 54 of 244 | 71 | 6.1 / 8.7 | 17 | 6.7 / 9.1 | 3 of 298 | 13 |
| crowd | 0.25 | 12.7 / 18.0 | 16 of 180 | 195 | 11.1 / 14.1 | 197 | 11.4 / 14.8 | 99 of 200 | 173 |
| crowd | 0.1 | 18.3 / 23.0 | 0 of 84 | 87 | 17.8 / 20.8 | 521 | 21.1 / 25.1 | 4 of 77 | 425 |
| drive | 1 | 4.1 / 6.6 | 0 of 300 | 32 | 3.6 / 6.6 | 18 | 3.4 / 6.4 | 0 of 300 | 13 |

Steam Deck, packaged shell over CDP, 90 Hz, 1280×800, production build.

| Scene | Zoom | Fixed: render | Missed | Draws | Top-down 3D before: render | Draws | After: render | Missed | Draws |
| --- | --- | --- | --- | ---: | --- | ---: | --- | --- | ---: |
| city | 1 | 2.1 / 3.1 | 1 of 447 | 35 | 1.3 / 1.6 | 30 | 1.4 / 1.7 | 0 of 450 | 22 |
| city | 0.25 | 3.0 / 4.1 | 0 of 450 | 76 | 2.3 / 2.9 | 101 | 1.8 / 2.1 | 0 of 450 | 41 |
| city | 0.1 | 4.9 / 6.3 | 0 of 450 | 165 | 5.2 / 6.3 | 442 | 3.4 / 4.0 | 0 of 450 | 193 |
| woods | 1 | 3.3 / 4.3 | 1 of 447 | 4 | 1.5 / 2.0 | 12 | 1.4 / 1.9 | 0 of 450 | 4 |
| woods | 0.25 | 4.0 / 5.0 | 0 of 450 | 4 | 2.5 / 3.2 | 51 | 2.1 / 2.9 | 0 of 450 | 6 |
| woods | 0.1 | 6.1 / 8.2 | 2 of 449 | 7 | 6.3 / 7.7 | 232 | 4.9 / 6.3 | 0 of 450 | 15 |
| crowd | 1 | 7.6 / 10.0 | 115 of 337 | 117 | 6.7 / 8.2 | 28 | 6.5 / 8.4 | 64 of 385 | 19 |
| crowd | 0.25 | 14.1 / 18.3 | 10 of 196 | 462 | 11.3 / 12.7 | 419 | 11.1 / 12.7 | 6 of 248 | 356 |
| crowd | 0.1 | 17.0 / 21.2 | 1 of 156 | 441 | 14.1 / 15.8 | 765 | 12.9 / 15.3 | 5 of 202 | 530 |
| drive | 1 | 2.4 / 3.3 | 0 of 450 | 48 | 1.7 / 2.4 | 29 | 1.6 / 2.4 | 0 of 450 | 22 |

GPU timer p50 on the Deck after the merge: top-down 3D 0.84 to 1.42 ms; fixed
view 0.47 to 3.0 ms.

First person at zoom 1, render p50 / p95 before → after:

| Scene | Mac | Pixel 7a | Steam Deck |
| --- | --- | --- | --- |
| city | 0.7 / 1.1 → 0.7 / 1.5 | 3.8 / 4.9 → 3.8 / 5.1 | 2.1 / 2.5 → 1.8 / 2.3 |
| woods | 0.8 / 1.1 → 0.9 / 1.1 | 3.6 / 4.6 → 3.4 / 4.4 | 2.6 / 3.8 → 2.5 / 3.3 |
| crowd | 2.8 / 3.1 → 2.9 / 3.6 | 12.5 / 16.2 → 20.3 / 24.1 (see below) | 10.5 / 13.4 → 10.6 / 12.1 |
| drive | 0.8 / 2.0 → 0.8 / 1.5 | 5.1 / 7.2 → 4.4 / 6.4 | 2.6 / 4.7 → 2.7 / 4.9 |

What the device runs show:

- **`city`, `woods` and `drive` hold the display's cadence in the top-down 3D
  view on all three devices at every zoom**, before and after the merge (one
  frame of 296 missed on the phone at city 0.25×; two of the fixed view's cells
  on the Deck missed one or two).
- **The top-down 3D view costs less main-thread time than the fixed view** in
  every `city`, `woods` and `drive` cell after the merge, except the phone's
  city at 0.1× (4.9 against 4.7 ms). On the Deck it is 0.7 to 1.9 ms cheaper.
  It still draws less (no grass, particles or decals).
- **Draw calls mattered on the Deck and not on the phone.** On the Deck the
  merge took city at 0.1× from 5.2 to 3.4 ms (442 → 193 calls) and woods at 0.1×
  from 6.3 to 4.9 ms (232 → 15). On the phone the same cells moved by 0.4 ms or
  less either way: its portrait canvas shows fewer chunks (87 to 191 calls
  before), and its time is elsewhere.
- **The crowd is not a clean render measurement on the phone or the Deck.** The
  authority's tick is 16 to 42 ms there (236 found the same), so frames arrive
  in bursts. Missed-frame counts in those rows compare cadences that differ
  (the fixed view's crowd at 0.1× runs at 15 to 30 Hz).
- **The phone's first-person crowd cell (12.5 → 20.3 ms) is heat and authority
  load, not the merge.** It was the last cell of a 25-minute session, at 35 °C.
  Run again alternately on both trees at that temperature, the merged tree read
  12.6 / 16.9 and 16.9 / 21.2 ms (ticks 24 and 46 ms) and the older one
  19.7 / 25.0 ms (tick 42 ms); its second run failed when the phone's authority
  stopped answering.
- **Driving on the phone, measured for the first time** (the bench's car now
  spawns): first person 4.4 / 6.4 ms with a worst frame of 16.8 ms and no missed
  frame; 11 to 22 pages uploaded in 5 s, at most 960 KiB in a frame. Slice 2's
  unpaced card uploads fit the phone's frame.

**Go or no-go on phone and Deck draw-call cost: go.** After the merge the 3D
scene's static content is 4 to 25 draws at any zoom and neither device spends
more main-thread time in the top-down 3D view than in the fixed view, bar one
cell within noise. The remaining calls are vehicles, and the fixed view makes a
similar number of them into its vehicle images. Vehicle meshes are the next
draw-call work if stereo (slice 4) doubles them; they are not a reason to hold
the top-down camera back.

Not measured: the Quest 3 (slice 4), the far view distance's texture memory on
the phone, and four against one or eight ground samples on the phone (250's
open choice; it needs a build-time constant changed).

## Limits

- The top-down 3D view is an experiment behind `r_topdown3d` and
  `?view=topdown3d`, with no Options entry. That is the owner's first gate.
- It lacks what the parity checklist lists: grass, particles, decals, cutaways,
  door overlays, soft sprite edges, pixel snapping, the fixed view's shadows.
- Zoomed out, the sun's shadows cover only the middle of the view (the map is
  2,048 px square).
- Solid props stand taller than their artwork from above (54% overlap at 1×).
- Raised ground looks different: the fixed view tints raised tiles and draws
  cliff artwork; the 3D scene wears the plain ground image and flat brown walls.
  The generated world has no raised ground, so the probe's scenes do not show it.
- Ground images are prepared for the camera's rectangle only. The 3D view keeps
  chunks up to 512 px south of it for tall props, and their ground would draw
  flat colours if raised ground there reached into view.
- Each top-down 3D view has its own scene, so split screen builds chunks once
  per view, and each view keeps up to 256 composed prop images. Whether a 0.1×
  view can need more than 256 at once, which would evict images still in use,
  was not checked.
- Vehicles are 8 to 16 draws each and one render per car.
- The probe compares top-level vehicles and actors. A towed car or a truck's
  load counts with the body that carries it.

## Independent review (2026-11-14)

A separate read-only session (general-purpose agent, fresh context) reviewed the
three phases against three.js 0.187's source. It found no defect in the camera,
the merged meshes or first person, and reported these as sound: `GroundTops`
slot, block and upload bookkeeping (including a new buffer, a restored context
and two cameras in a frame); `MergedFaces` bookkeeping, shadow layers and
bounding spheres under the mirrored root; that ground tops were never needed as
shadow casters (terrain is a heightfield with walls wherever it drops); rooms
entered, edited and left; the oblique camera's depth, handedness and culling;
and the `topDown3d` and `drawn3d` flags in every reader. It ran five test files
and nothing in a browser. Its findings were in the probe, the bench and the
tests:

1. **Fixed.** The probe passed the view's own slab fades to the fixed view, and
   pictures without props reset them: a roof that play had faded drew opaque,
   and stayed reset afterwards. The probe now uses its own.
2. **Fixed.** The probe removed shadows from top-level sprites only; a towed car
   or bed contents kept theirs.
3. **Fixed.** Pictures without entities made play's scene frame forget its
   vehicle poses, so the fixed view drew fresh poses and the 3D scene
   accumulated ones. Entity pictures now use the 3D views' frame and the others
   a scratch frame. The fixed side now splits vehicles from actors as the 3D
   scene does (a mesh that is ready).
4. **Fixed.** Of several moves that aligned equally well the probe reported the
   first it tried, not the shortest, and a silhouette moved off the picture
   counted as agreement. That had produced the solid props' "best move (0, 3)";
   it is (0, 0).
5. **Fixed.** The probe read the canvas back on every warm-up frame and could
   run past the atlas's page age; "as played" forced the 3D shadows on.
6. **Fixed.** The bench's new car finder could have picked a passing traffic
   car of the same model. It now looks at the spot it asked for.

Test gaps it named, now covered in Node: `FirstPersonView`'s own chunk loop
with a stub renderer (one ground mesh for nine chunks, walls only where ground
is raised and on the shadow layer, the same chunks kept across a switch to the
top-down camera, an edited chunk rebuilt in its slot, a new world freeing the
old); the probe's tie-break and off-picture pixels; a part added and removed
before a flush; geometry freed on dispose; upload versions on set and delete;
culling through the oblique matrix; a guest leaving, the editor and dispose with
top-down on; and the host refusing to draw. Two test names that claimed more
than they checked were changed. Still not covered in Node: rooms with the merged
meshes (the room capture covers them), and the probe itself, which needs a GPU.

The fixes are in the probe, the bench and tests only, so the device cells above
stand. The parity table above is from the fixed probe.

## Scripts

- `scripts/first-person/parity.mjs` (new) runs the parity probe and writes its
  pictures.
- `scripts/first-person/capture.mjs` gained the top-down 3D split-screen steps.
- `scripts/benchmark-render.mjs`: `view=topdown3d` cells use the 3D view's own
  draw count; the fixed view's vehicle mesh calls are reported; the `drive`
  scene's car spawn tries several spots.
- Not run in this slice: the full unit and browser suites.
