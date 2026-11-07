# First-person view experiment

Status: experiment delivered for owner play; opt-in, not a supported render path.
Its integration glue is temporary and is replaced by the
[226](226-player-views-and-local-split-screen.md) view/seat work.
Owner request, 2026-11-07: a "Duke Nukem style" first-person render option. Very
basic is fine: flat colours for terrain, 3D models only for cars, collision volumes
for everything else, and entities as sprites, using Three.js. Decision (same day):
build the experiment now rather than wait for 226, keep it inside the seams 226 will
create, and record what a second view type needs from 226's design.
Owners: [rendering architecture](../topics/rendering-architecture.md),
[226 player views](226-player-views-and-local-split-screen.md).

## Try it

- **V** toggles it in play, or open **☰ → Debug → First-person view**. Add
  `?view=fps` to start in first person. Console: `r_firstperson 1`.
- Requires the GPU renderer (the default). Legacy Canvas keeps the fixed view.
- Look: click the game to lock the pointer, then move the mouse (Esc releases).
  A controller's right stick also looks. WASD, the left stick and the touch
  joystick move relative to where you look. Tap/hold destinations are disabled
  while first person is shown (they would aim through the hidden fixed camera).
- Driving switches to a chase camera that swings back behind the vehicle 1.5 s
  after the last manual look. Indoors (interior realms) falls back to the fixed view.

## What it draws

- **Ground:** one mesh per chunk, one flat-coloured quad per tile at its terrain
  height, with cliff walls where a tile drops to a lower neighbour. Colours come
  from the semantic layers: road cells first (painted lines and crossings blend
  toward asphalt to approximate their average), then water collision and terrain.
  A stable ±5% per-tile brightness gives flat ground a sense of motion. Baked
  sector-style shading: south faces brightest, north darkest.
- **Solid props** (buildings, fences, benches, decks): their physical colliders as
  boxes. Unlimited-height walls take their height from the artwork (in the fixed
  view a box of height H covers screen rows boxTop − H to boxBottom, so
  H = boxTop − artTop). Top and south faces wear the fixed-view artwork, projected
  back through the same `x, y − z` projection, so facades, shop signs and roofs read
  the same in both views. North, east and west faces use the art's average colour.
  Walkable surfaces (bridge decks, ramps) are plain slabs with undersides.
- **Billboards:** actors, plus props with no body or a body under half the artwork's
  width (trees, lamp posts, signs). Upright quads face the camera plane, Doom/Build
  style. Four-direction actors reselect their row for the side facing the eye.
- **Vehicles and trains:** the authored GLBs with their full shared pose (physical
  orientation, wheel travel, beds, lights). Loading or failed meshes draw the sprite.
- Sky colour plus linear fog to the draw radius.

## Architecture

```text
Worker authority / prediction (unchanged)
        ↓ read-only replicated + predicted state
collectWorldSprites (shared)       Chunk layers, props (read-only)
   ↓ fixed view: sort + project        ↓ first person: chunk meshes, prop solids
   ↓                                   ↓
RenderBackend (unchanged)          FirstPersonView (own Three.js renderer/canvas)
```

- **One presentation evaluation.** `collectWorldSprites` (`collectScene.ts`) is
  the existing actor stage, split out of `collectScene`: interpolation, displayed
  height, frames, mesh poses and vehicle grouping inside a world box. The fixed view
  calls it with its viewport; first person with its draw radius and its own
  `SceneFrame` (view-owned mesh-pose cache). With the new `facing` key omitted, the
  five collector characterization digests reproduce exactly; they were re-recorded
  only for that field.
- **One vehicle pose and loader.** `applyMeshInstance` and `loadAuthoredMesh`
  (`AuthoredMeshPose.ts`) moved out of `GpuMeshBodies`, which now calls them.
  Fixed-view car images are unchanged; first person poses the same shared asset per
  draw and renders each car into the scene depth. Grouped composition (a towed car
  posed relative to its truck, bed contents) stays in `GpuMeshBodies`; first person
  draws group members as separate bodies (see known limits).
- **One "drawn in first person" answer per frame.** `FirstPersonControl.drawing`
  is true only after the play view actually drew a first-person frame. Camera-
  relative movement, look input, the streaming zoom floor, tap/hold suppression and
  click-to-lock all follow it, so every fixed-view fallback (indoors, loading,
  legacy Canvas, editor, other opaque scenes) keeps ordinary controls. Switching
  back to the GPU renderer restores the view without toggling.
- **Axes.** Content is built in game axes (X east, Y south, Z up). The view mirrors
  Y once in its scene roots so the world is right-handed for Three and east stays on
  the right looking north; Three flips face winding for the negative determinant.
  Both views therefore show the same side of every vehicle and building.
- **No simulation change.** Movement is rotated by the camera heading before
  quantisation (facing north is the identity). Trains and steering-mode cars keep
  their vehicle axes; tap/hold destinations are suppressed while first person is
  drawn. A stationary throw aims where the camera looks (`playThrow.ts`).
- **Pure, Node-tested modules** under `src/rendering/firstperson/`: camera math and
  sprite-row selection, terrain meshing, prop forms/solids/projected UVs. Three.js
  stays in `FirstPersonView`, `FirstPersonBillboards` and `FirstPersonImages`.
- **Lifetimes.** Turning first person off disposes the view (meshes, textures,
  vehicle slots) and forces loss of its WebGL context. A world or realm change
  resets every cached chunk; ground also rebuilds when a chunk object is replaced.
  `facing` is set only for players and turning wanderers whose row is the facing
  row; single-row sprites (cows, fish, balls) keep their authored row.

### Temporary glue (replace in 226)

- `FirstPersonControl` (one per `GameClient`): active flag, look state, pointer lock,
  right-stick look and the lazily imported view. It becomes per-seat input plus a
  view's camera policy.
- `firstPersonPlay.ts`: the per-tick look/input step and the render branch in
  `PlayScene`. It becomes a view kind selected by layout.
- Streaming: while active, the fixed camera's zoom is floored at 0.5 so its visible
  range covers the fog radius. It becomes a view-owned interest radius.
- A separate WebGL context and canvas between the GPU world canvas and the UI
  canvas, with its own vehicle assets. It should share the host renderer.

## Requirements recorded in 226

A second, non-top-down view type exercises 226's design. The view/camera-policy
work should allow:

1. Camera policies that produce a 3D eye (position, yaw, pitch), not only x/y/zoom.
2. Input composition that takes a movement frame from the seat's view, so movement
   can be camera-relative; vehicle-axis controls stay unturned.
3. View interest as a radius or frustum, not only a screen rectangle.
4. Heterogeneous viewports in one render host: a 3D viewport sharing the GPU host's
   Three.js renderer and loaded vehicle assets (`GpuRasterSurface` already owns a
   `WebGLRenderer`), so one player can play top-down beside another in first person.
5. Per-view HUD choices (crosshair, no world-anchored markers in 3D views).

## Validation (2026-11-07)

- Node: 25 new unit tests (camera, terrain, props, chunk residency, drawing-gated
  input, throw aim, `facing` selection); collector digests re-recorded only for
  `facing`, after an identity check with it omitted reproduced the pre-229 digests;
  the full unit suite (395 files / 4,707 tests) passes. One test failed once while
  the Workshop manifest's Chromium job ran concurrently; two later full runs passed.
- Static: `tsc` passes for the game, server, worker and tools configs apart from an
  `XRSessionManager.ts` WebXR layer typing error already on `main`. Biome and knip
  are clean. The ratchet passes for every file changed here: `GameClient` and
  `PlayScene` shrink (the interior route parser moved to `InteriorCatalogRoute.ts`,
  throw aim to `playThrow.ts`). The ratchet still reports growth in five files from
  earlier commits (`presentSurfaceScene`, `SurfacePresentation`,
  `RasterRenderBackend`, `SurfaceReceivers`, `ScenarioPresentationHost`).
- Browser (`scripts/first-person/capture.mjs`: isolated Vite server, bundled
  Chromium, fresh regional world): four headings plus the fixed view in town,
  boarding and driving with the chase camera, the editor hiding the view, and an
  outskirts highway. Facing east, W moved the player +46px east; facing south,
  +45px south; D facing east strafed +36px south. Downtown: 55 resident chunks,
  69 draw calls, 8 car meshes; no page errors. Captures are evidence, not image
  assertions, and are not committed.
- Production bundle: `vite build` emits `FirstPersonView` as a separate lazy chunk
  (16.5 kB, 6.5 kB gzip); the ordinary game does not load it.
- Embedded labs consume the same collector and vehicle pose code with unchanged
  output; they do not get the first-person view until 226 moves them onto views.

## Independent review (2026-11-07)

A read-only Opus 5.5 high-effort review returned REVISE with nine findings; all
were addressed before commit:

1. First-person input stayed camera-relative while a fixed-view fallback was shown
   (indoors, loading, legacy Canvas) and Canvas set a sticky unsupported flag →
   the per-frame `drawing` gate; no sticky state.
2. An editor click could lock the pointer → click-to-lock and mouse look require
   `drawing`; pausing/leaving play hides the view and releases the pointer.
3. After loading another world, cached ground could survive (one `World` object,
   same chunk revisions) → reset on world/realm change; chunk identity in the key.
4. `facing` matched single-row sprites by coincidence → players and turning
   wanderers only, with a collector test.
5. WebGL context not released on toggle-off → `forceContextLoss()` before dispose.
6. Evicted prop textures stayed alive through cached materials → eviction disposes
   the material; least-recently-used order.
7. Tow/bed groups are not composed like the fixed view → documented below and in
   `AuthoredMeshPose.ts`.
8. Tap/hold movement aimed through the hidden camera → suppressed while drawn.
9. Test gaps → Node tests for the gate and vehicle-axis exceptions, `facing`, and
   chunk-object rebuilds.

A follow-up pass in the same session confirmed all nine fixes: ACCEPT.

## Known limits

- Fixed-view artwork seen from new angles: sprites show their top-down 3/4 drawing,
  and projected faces assume the art matches its collider.
- Terrain ignores authored excavations (garage ramps below ground), and cliff walls
  at the edge of unloaded chunks stay until the chunk rebuilds.
- A towed car or bed contents draw as separate bodies at their own poses, so on a
  ramp a towed car does not tilt with its truck as it does in the fixed view.
- No shadows, touch look, on-foot chase camera, context-loss recovery or inclusion in
  feedback capture/XR. A click that locks the pointer also reaches ordinary play
  interactions.
- Prop artwork compositions are view-owned: at most 256 cached, plus any still drawn
  by resident chunks until those chunks are released.

## Next

1. Owner/child playtest: feel, motion comfort, field of view, look speed.
2. Touch look (drag on the right half) and a controller button for the toggle.
3. Fold the glue into 226 phases 1, 2 and 4. Showcase: split screen with one top-down
   view and one first-person view.
4. Retire the old `r_show3d` "Legacy box view" once first person can show collision
   volumes directly.
5. Later: real VR from the same 3D scene (the current XR mode shows a flat screen).
