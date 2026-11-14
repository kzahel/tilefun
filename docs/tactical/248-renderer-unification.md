# 248 — Renderer unification

Status: parent sequencing plan, recorded 2026-11-14. Slice 0 (spike and plan) is
done; no implementation slice has started.
Owner decision, 2026-11-14: commit to one world renderer. Keep the fixed 2D view
as the default top-down renderer until the unified one is good enough. WebXR is
wanted on the same renderer. Test devices are available: the M4 Pro Mac, a Pixel
7a, a Steam Deck and a Quest 3.
Owners: [renderer unification](../topics/renderer-unification.md) (status,
parity checklist, device scorecard, gates),
[rendering architecture](../topics/rendering-architecture.md).
Builds on [226](226-player-views-and-local-split-screen.md) (views),
[229](229-first-person-view.md) and [247](247-first-person-shadows-and-walls.md)
(the 3D scene), and [230](230-3d-cameras-stereo-and-webxr.md) (cameras, stereo,
XR).

## Direction

The first-person 3D scene becomes the one world renderer, and top-down becomes a
camera on it. The fixed 2D backend is not extended to do first person or XR, and
the first-person view is not folded into it. The
[topic](../topics/renderer-unification.md) records the reasons and guardrails.

This replaces two earlier positions:

- 230 said the 3D scene's top-down would be an orbit camera with a narrow field
  of view. On a flat screen the exact oblique camera below is better: sprites do
  not foreshorten. The orbit presets remain for stereo, tabletop and headsets.
- 247's "Direction" list is absorbed here. Its items 1 and 2 are slices 2 and 1.

## Spike

Question: what does the first-person scene cost, and look like, through the
fixed view's camera?

A 56-line change (not committed) added `?fpoblique=1` to the first-person view:

- **Projection.** The camera sits at the fixed camera's centre with no rotation
  and a custom projection matrix. In the view's scene axes (X east, Y north, Z
  up, relative to the centre), with `s` screen pixels per world pixel and a
  `W × H` canvas, row-major:

  ```text
  2s/W   0      0       0
  0      2s/H   2s/H    0
  0      1/h    −1/h    m/h
  0      0      0       1
  ```

  A point lands on screen `(x, y − z)`, as `projectWorld` does. Depth is nearness
  along a view ray, which is the south offset plus the height. The spike used
  `h = H/(2s) + 2200` and `m = 1000`.
- **Cards** expand along east, so every card faces south, and four-direction
  actors pick their row as seen from the south.
- **Fog** is off; three.js measures fog from the view matrix, which is a plain
  translation here.
- **Collection** culls to the fixed camera's visible rectangle with a margin
  below it for tall things, and keeps the player's own body.
- **Residency** covers the rectangle's half-diagonal. The fixed camera's zoom is
  not floored.

Result by eye: buildings, lamp posts, trees, actors and vehicles land where the
fixed view draws them. The differences are flat-coloured ground, no grass blades,
and sun and contact shadows in place of the fixed view's body shadows.

`npm run render:bench -- --headed` with no query, then with
`--query=view=fps&fpoblique=1`. M4 Pro, 120 Hz, 1280×800, Vite dev modules, one
5 s run per cell, no missed frames in any cell. Render is the main-thread
callback and GPU is the timer query, both p50 in ms.
Full cells: [evidence](../benchmarks/248-oblique-camera-spike.json).

| Scene | Zoom | Fixed: render | GPU | Draws | 3D scene: render | GPU | Draws |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| city | 1 | 0.7 | 1.01 | 9 | 0.5 | 0.44 | 33 |
| city | 0.25 | 0.9 | 1.77 | 15 | 0.8 | 0.60 | 112 |
| city | 0.1 | 1.2 | 1.61 | 14 | 1.4 | 1.06 | 461 |
| crowd | 1 | 2.0 | 2.41 | 13 | 1.9 | 0.70 | 30 |
| crowd | 0.25 | 3.3 | 10.98 | 38 | 3.1 | 1.50 | 426 |
| crowd | 0.1 | 4.3 | 18.64 | 50 | 4.0 | 2.89 | 819 |
| woods | 1 | 1.1 | 0.62 | 4 | 0.5 | 0.39 | 14 |
| woods | 0.25 | 1.3 | 0.62 | 4 | 0.9 | 0.52 | 58 |
| woods | 0.1 | 2.3 | 0.80 | 7 | 1.7 | 1.29 | 263 |

With `fpshadows=0` the 3D scene's render time is 0 to 0.3 ms lower and its GPU
time within 0.3 ms either way.

What this shows and does not show:

- On this Mac the 3D scene through the top-down camera costs no more main-thread
  time than the fixed view, and usually less GPU time.
- The 3D scene is doing less: flat ground, no grass, particles or decals. Part
  of its lead goes when it draws ground artwork.
- Its draw calls are 4 to 60 times higher: one mesh per chunk's ground, one group
  per chunk's props, one render per vehicle. This is not measured on the Pixel
  7a or the Deck, where each call costs more.
- The fixed view's crowd GPU time at 0.25 and 0.1 (11 and 19 ms) is far above
  236's recorded 5 ms. It was not investigated.
- At 0.1× the sun shadow map (2,048 px square) covers only the middle of the
  view.
- The two views disagree about cars parked north of the shop row in `crowd`:
  over the roofs in the fixed view, behind the buildings in 3D.

## Slices

Each slice gets its own tactical on arrival, fixes its exit list before work
starts, gets one independent review and updates the
[topic's tracker](../topics/renderer-unification.md#slice-tracker). A slice must
not slow or change the fixed view; check the affected `render:bench` cells when
shared code changes.

### 1 — One renderer host

Draw the 3D scene through the GPU host's `WebGLRenderer` as a view kind
(226 requirement 4).

- A 3D view draws inside `beginView`/`endView` regions like a fixed view.
- One page atlas and sheet textures, one set of vehicle assets and mesh poses.
- The second canvas and WebGL context are removed. Context loss recovery follows
  the host's.
- 229's temporary glue becomes a camera policy that produces a 3D eye, a
  view-owned streaming interest (radius, not a floored zoom), and per-seat look
  input.
- Showcase: split screen with one top-down view and one first-person view.
- Exit: no second context; first-person `render:bench` cells no worse than 247's;
  fixed-view cells unchanged; labs unaffected.

### 2 — Ground artwork

The 3D ground samples the fixed view's terrain pages instead of flat colours.

- Chunk ground meshes take UVs into the shared atlas page of their chunk. Cliff
  walls keep their shading.
- A chunk whose page is not ready draws its flat colours, so nothing blanks
  while streaming.
- Decide how pages stay resident for chunks beyond the fixed camera's rectangle
  at first-person view distances, and record texture memory.
- Exit: first-person and chase captures with road markings, grass and paths;
  page uploads and texture bytes recorded; `streaming:bench -- --assert-ready`
  passes.

### 3 — Top-down camera, parity probe, draw calls, device scorecard

Land the spike's camera as an opt-in view, and make its gaps measurable.

- A top-down camera preset on the 3D scene, selected by a query parameter and
  console variable. The fixed view stays the default.
- A renderer-lab probe that draws one scene through both renderers and reports
  where pixels differ, by category, so the parity checklist has numbers.
- Merge neighbouring chunks' ground and static props into fewer meshes. Record
  draw calls and rebuild cost when a chunk changes (247's open review item 5 is
  the same concern).
- `render:bench` cells for the top-down camera on the Mac, the Pixel 7a and the
  Deck, before and after the merge.
- Exit: scorecard rows filled in the topic; a go or no-go note on phone and Deck
  draw-call cost.

### 4 — XR on the shared scene

230 slices 5 to 8, on the shared renderer from slice 1. Does not wait for
top-down parity.

- XR-compatible shared context; `GameLoop` driven by the session's frame
  callback.
- Headset screen (quad layer from a view's render target), then XR controllers
  as a seat input device, then immersive first person, then tabletop.
- The sun shadow map is view-independent, so both eyes share one cached map.
  Cards turn to the head's yaw.
- Stereo doubles draw calls, so slice 3's merge comes first or alongside.
- Quest 3 runs are the evidence: frame pacing, comfort and controller mapping.

230's slices 3 (orbit camera) and 4 (stereo page output) can land any time after
slice 1.

### 5 — Top-down parity

Work through the [parity checklist](../topics/renderer-unification.md#top-down-parity-checklist),
one tactical per group. Order by what the probe and play review show. Likely
groups:

- sprite edges, pixel snapping and stable sampling;
- grass, particles, decals and contact effects;
- cutaways, slab fades and roofless rooms;
- tow and bed groups, emergency lights, excavations;
- picking, tap and hold destinations, editor overlays;
- labs, explorer and probes.

### 6 — Opt-in, default, retirement

Three owner decisions with the evidence listed in the
[retirement gate](../topics/renderer-unification.md#retirement-gate). No slice
here deletes fixed-view code before the third decision.

## Validation approach

- Node tests for camera math (the oblique projection against `projectWorld`),
  mesh merging and page UVs.
- The renderer lab for pixel comparisons between the two renderers.
- `render:bench` for cost, on real devices for any device claim.
- Browser checks only for a browser contract: one context, region composition,
  XR session start and end.

## Progress

### Slice 0 — spike and plan (2026-11-14)

- Spike measured and reverted; evidence saved as
  [248-oblique-camera-spike.json](../benchmarks/248-oblique-camera-spike.json).
- Device access confirmed the same day: Quest 3 and Pixel 7a over adb, the Deck
  through `npm run deck:status`.
- Topic, tracker, parity checklist and gates recorded.
