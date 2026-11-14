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
