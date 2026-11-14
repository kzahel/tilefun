# 249 — One renderer host

Status: in progress. Phases 1a and 1b delivered 2026-11-14; 1c not started.
Slice 1 of [248](248-renderer-unification.md).
Owners: [renderer unification](../topics/renderer-unification.md),
[rendering architecture](../topics/rendering-architecture.md).

Draw the first-person 3D scene through the game's own renderer, so the fixed
view and 3D views share one WebGL context and can sit side by side.

## Phases and exit lists

Each phase is committed on its own.

### 1a — One WebGL context

- The first-person view draws through the render host's `WebGLRenderer` into a
  region of the host's canvas. Its own canvas and context are gone.
- Losing and restoring the graphics context recovers first person without a
  reload.
- Exit: one WebGL canvas while first person draws; first-person
  `render:bench` cells no worse than before, measured in the same session;
  fixed-view cells unchanged; existing fixed-view region and context-loss specs
  pass.

### 1b — One set of vehicle assets

- First person draws the vehicle and train meshes the fixed view already loaded
  (geometry, textures, paint atlases), instead of loading its own copies.
- The fixed view's vehicle pixels are unchanged: first person's shadow shading
  must not leak into the shared materials.
- Exit: one load per vehicle asset with both views used in a session; fixed-view
  vehicle specs pass.

### 1c — First person as a view kind

- A view has a kind (fixed or first person) and a camera policy that can produce
  a 3D eye. 229's `FirstPersonControl` glue goes.
- Look input and camera-relative movement are per seat.
- A first-person view's streaming interest is its own radius, sent as that
  view's visible range. The fixed camera's zoom floor goes.
- Split screen can mix a top-down view and a first-person view.
- Exit: the mixed split-screen capture; single-player first person unchanged;
  `streaming:bench -- --assert-ready` passes.

## Scope change from 248

248 listed "one page atlas and sheet textures" under this slice. It moves to
248 slice 2 (ground artwork). First person's cards and walls use three.js
built-in materials on whole sheet images. Reading the fixed view's page atlas
needs materials that sample a texture array by layer and page rectangle, and a
shared rule for keeping pages resident. Ground artwork needs exactly the same
work, so both are done together there. Until then first person still uploads
its own sheet textures, now into the shared context.

## Progress

### 1a — delivered 2026-11-14

How it works:

- `RenderHost.view3d` (`View3dHost.ts`, implemented in `GpuView3d.ts`) gives a
  3D view the host's renderer with the viewport and scissor set to its region.
  The host restores its own render state afterwards. `GameContext.view3d`
  carries it to the play scene.
- A 3D view draws straight to the canvas, not into the fixed view's world
  target. three.js encodes colours for display only when drawing to the canvas,
  and the canvas has its own depth buffer. The world target is untouched, so
  fixed and 3D views of one frame can follow each other in any order.
- A region with a diagonal mask is refused (`draw` returns false and the fixed
  view draws). Masked 3D regions are a 1c decision.
- `FirstPersonView` takes the renderer per frame and owns only scene content.
  Disposing it no longer loses a context.
- Context loss: `draw` returns false while graphics are lost, so play falls back
  to the fixed-view path and gives back ordinary controls. After a restore
  three.js re-uploads meshes and textures itself; the view compares the host's
  restore count (`generation`) and sets up its cached sun shadow map again.
- Draw calls are counted with `renderer.info.autoReset` off for the view's
  renders and switched back on afterwards, because the fixed view's vehicle
  pass reads the per-render count.
- The feedback capture (`captureFrame`) now includes first person, since it is
  on the world canvas.

Measurements, `npm run render:bench -- --headed --zooms=1 --query=view=fps`,
M4 Pro, 120 Hz, 1280×800, Vite dev modules, one 5 s run per cell, both columns in
the same session. Render is the main-thread p50 / p95 in ms; GPU is the timer
p50. No missed frames.

| Scene | Before: render | GPU | After: render | GPU |
| --- | --- | ---: | --- | ---: |
| city | 0.7 / 1.0 | 0.49 | 0.8 / 1.2 | 0.43 |
| woods | 0.9 / 1.2 | 0.45 | 0.9 / 1.1 | 0.38 |
| crowd | 3.2 / 3.6 | 1.67 | 3.1 / 3.5 | 0.92 |
| drive | 0.8 / 1.0 | 0.50 | 0.9 / 1.2 | 0.44 |

- Main-thread time is within 0.1 ms at p50 either way, which is inside the
  0.3 ms run-to-run spread 247 recorded.
- GPU time is lower in every cell, most in the crowd.
- Fixed view after the change: city 0.6 / 1.0 at 1× and 0.9 / 1.2 at 0.25×,
  crowd 1.9 / 2.1 and 3.1 / 3.6. These match the same day's earlier fixed-view
  run (248).

Validation:

- `scripts/first-person/capture.mjs`: one WebGL canvas in every shot; four
  headings, driving, the editor drawing the fixed view; a new step loses and
  restores the context (`contextLoss` in the report: not drawing while lost,
  drawing again after, sun map redrawn). `capture-rooms.mjs`: rooms draw. No
  page errors in either.
- `tests/gpu-renderer.spec.ts`: "split views compose into their regions" and
  "real graphics loss recovers resources" pass.
- Node: `src/rendering/firstperson`, `src/scenes/firstPersonPlay.test.ts` and
  `src/client` pass (30 files, 232 tests). Typechecks (game, server, worker,
  tools), Biome and knip pass. The ratchet reports only `PhysicsScene.ts`
  (881 → 884), which this work does not touch; `FIRST_PERSON_TERRAIN` moved to
  `FirstPersonControl.ts` to keep `GameClient.ts` within its baseline.
- Not run: the full unit and browser suites; phone, Deck and headset.

Scripts changed: `render:bench` measures first person on the game's own
context; the capture scripts report `drawing` instead of a second canvas.

### 1b — delivered 2026-11-14

How it works:

- `View3dTarget.meshes` (`SharedMeshAssets`) lends a 3D view the fixed view's
  loaded vehicle and train meshes and its paint atlases. `GpuView3d.ts` adapts
  `GpuMeshBodies`; the first sight of an asset in either view starts its one
  load, and it becomes drawable at the next display frame, as before.
- `FirstPersonVehicles` no longer loads or owns assets. For each shared asset it
  makes one lit copy of each material (the copy carries the view's shadow
  shading and shares the original's textures). Per draw it poses the asset with
  the shared pose, binds the paint to the asset's own materials, copies what the
  pose and paint changed onto the lit copies (paint atlas, emergency-light
  colour and gain, opacity, visibility), swaps the copies in for the render and
  swaps the originals back.
- The fixed view therefore still compiles and draws the original materials. 247
  edited the shader of the view-owned copies of the assets; with shared assets
  that edit would have reached the fixed view's vehicle pass.
- `View3dTarget` also carries `generation`, so `View3dHost` is only `draw`.

Validation:

- Node: `FirstPersonVehicles.test.ts` (lit copies are drawn and follow the
  shared material; originals and their shader hook are restored; nothing draws
  before the asset is ready; a bound paint atlas reaches the copy).
  `src/rendering/firstperson` and `GpuRasterSurface.test.ts`: 49 tests pass.
- `capture.mjs` now counts `.glb` requests: 15–16 files in a run that shows the
  fixed view, first person, driving and the fixed view again, none requested
  twice. Vehicles draw painted and shaded in first person and unchanged in the
  fixed view afterwards. The context-loss step still passes.
- `tests/gpu-renderer.spec.ts` and `tests/car-projection.spec.ts`, the six cases
  matching paint, mesh and graphics loss: pass.
- `render:bench --query=view=fps`, M4 Pro: crowd (49 cars) 3.1 / 3.4 ms and
  drive 0.9 / 1.4 ms, against 3.1 / 3.5 and 0.9 / 1.2 after 1a.
- Typechecks, Biome and knip pass. The ratchet reports only `PhysicsScene.ts`.
- Not measured: how much memory one copy saves. Not run: full suites, devices.

Limit: each first-person view makes its own lit material copies. They are small
(no textures or geometry), but two first-person views compile two sets.
