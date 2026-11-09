# WebGL2-only renderer

Status: parent plan; planned 2026-11-09, slices 1–4 authorized for autonomous delivery.
Owner direction, 2026-11-09: "having two renderers seems useless"; remove the
Canvas renderer and its fallback, require WebGL2, then make the GPU-only
optimizations that Canvas parity blocked. Run tests locally before touching CI.
Owners: [rendering architecture](../topics/rendering-architecture.md),
[performance](../topics/performance.md), [testing](../topics/testing.md).

## Decisions

- **One renderer: WebGL2 through Three.js.** Three 0.187's `WebGLRenderer` is
  WebGL2-only; "WebGL" in our code means WebGL2. The sprite shader already uses
  WebGL2 features (`textureSize`).
- **No Canvas fallback.** A device or browser without WebGL2 gets a clear
  "Tilefun needs WebGL2" screen instead of a degraded game.
- **No WebGPU backend now.** The remaining costs are fixable on WebGL2 (texture
  arrays, direct sprite batches). 230's WebXR plan uses the shared WebGL renderer,
  and WebXR with WebGPU is still experimental. Keep WebGL specifics inside the GPU
  backend so a later move (for example Three's `WebGPURenderer`, which needs our
  GLSL shaders ported to TSL) touches one module. Revisit on a measured need for
  compute or when WebXR/WebGPU ships.
- **The GPU sprite-vehicle mode was already removed** (commit `2d9f0aab`).

## Evidence before starting

Local M4 Pro, bundled Chromium with hosted-CI flags
`--use-angle=swiftshader --enable-unsafe-swiftshader --disable-gpu`, the 68 spec
files that force Canvas (339 tests, 2 workers):

| | Canvas (today) | GPU, software WebGL |
| --- | --- | --- |
| Wall time | 1,186 s | 1,868 s |
| Summed test time | 2,323 s | 3,652 s (1.57×) |
| Failures | 5 | 19 |

The same 5 fail on both lanes (frog/robin/duck ball reactions,
`streaming.spec.ts:6`, `gpu-renderer.spec.ts:576`); they are not caused by this
work. Of the 14 new failures, 8 assert the Canvas renderer (renderer selector,
p2p menu, player markers, terrain pacing, character/furniture/outdoor lab views,
tow truck). About 6 are timing or readback sensitive: the every-animal preview loop
(180 s timeout), controller menu (30 s), room-editing walk distance (304 < 360 px),
train recall, furniture motion (reads 0 visible player pixels, likely the UI canvas
rather than the world).

## Testing strategy

A full browser run takes ~30 minutes, so it is not the inner loop.

- Per change: unit tests for touched modules, then only the touched spec files on
  ordinary local GPU Chromium.
- Per slice: re-run the touched specs once under the software-WebGL flags, plus any
  previously failing spec in that area.
- One full local software-WebGL run at the end of slice 1 (it touches every spec),
  and one at the end of the tactical. Record wall time, failures and the slowest
  files here.
- Slice 1 adds a committed local Playwright config/script for the software-WebGL
  lane so these runs need no temporary files.
- CI workflow, timeout and shard changes wait until the local suite passes. Then
  adjust them from the measured local ratio and record the hosted result.

## Process per slice

1. Compact the agent session through the yepanywhere API (localhost:3400).
2. Implement and run the slice's targeted checks.
3. One independent review: Opus 5.5, High, bypass permissions, Work-claude pool
   (weekly pace), started through the yepanywhere API. Address material findings.
4. Commit. Record the review and checks in this file. Run `npm run dev:ready` after
   playable changes.

## Slices

### 1 — Game and labs require WebGL2

- `requestedRenderer`/`SelectableRenderHost`: no Canvas mode. The `?renderer=`
  parameter is ignored. Remove the debug panel's renderer selector and
  `RenderHost.rendererControl` if nothing else needs them.
- `GpuRenderHost` construction failure shows a "needs WebGL2" screen in the game and
  in labs (`LabView`), instead of returning a Canvas host. Keep graphics-loss
  recovery unchanged.
- Remove `renderer=canvas`/`renderer=legacy-canvas` from the 68 spec files and
  `tests/helpers/p2pSession.ts`. Update the 8 renderer assertions. Fix the
  timing/readback failures in the tests where they are test assumptions (e.g. read
  the composed world frame through `captureFrame`), not by weakening behavior.
- Keep the Canvas-vs-GPU parity specs and probes that build `CanvasRenderBackend`
  directly; slice 2 replaces them.
- Add the software-WebGL Playwright lane (config + npm script) and document it in
  testing.
- Exit: touched specs pass on GPU locally; full local software-WebGL run recorded,
  with no new failures beyond the 5 pre-existing ones (or each explained);
  typecheck, lint, knip, generated inventories, build, `--assert-ready`.

### 2 — Move direct Canvas users to GPU

Direct `CanvasRenderBackend`/`drawScene2D` users: explorer `TilePreview`, building/
street/dense-district showcases, `PatternRuntime`, renderer lab reference view,
`CameraStabilityProbe`, `SpriteSeamProbe`, `ViewRegionProbe`,
`WorldRegistrationProbe`, `InteriorPresentation.test`, `CanvasInteriorMap`
consumers (first-person/character test scene), and the Canvas legs of
`gpu-renderer.spec.ts` (fractional seams, world composition, split views, room
reference, grass LOD) and other canvas/gpu parity specs.

- Move each to the GPU backend, or delete it if it only existed for parity.
- Replace Canvas-vs-GPU comparisons with GPU invariants (seams, registration,
  composition, order) or explicit expected values. Where a reference image is
  unavoidable, it follows the human review rules: never auto-approve changed pixels.
- **Review risk:** any tool whose output is a human-reviewed or promoted snapshot
  (showcases, art catalog/manifest rasters) changes pixels when it changes renderer.
  Check before switching. Promoted banks and exact review snapshots stay immutable;
  if a reviewed raster would change, keep that offline raster path or return it to
  review, and record the decision here.
- Exit: no runtime `CanvasRenderBackend` use outside slice 3's deletion list; checks
  as in slice 1, with only the touched specs.

### 3 — Delete the Canvas renderer

- Delete `CanvasRenderHost`, `CanvasRenderBackend` and Canvas-only branches
  (`worldRaster === false` paths, the `RendererMode` type, Canvas fallback in labs).
- Scripts: drop `--renderer=canvas` from the streaming bench/matrix, realm-physics
  bench, `city-audit`, `car-driving-browser`, and update `streaming-matrix-lib` tests.
- Code shared with the GPU path (`Canvas2DRenderer` scene drawing, `TileRenderer`,
  terrain/interior/overlay resources) stays until slice 4 replaces it; rename only
  where the name now misleads.
- Docs: rendering architecture, testing, performance, embedded labs, 3D assets,
  boats, ROADMAP ("Canvas fallback" delivered item).
- Exit: no Canvas renderer references in `src/`, `tests/`, `scripts/` except the 2D
  UI/HUD canvas and offline raster tools kept by slice 2; full checks.

### 4 — GPU-native sprite path

Goal: 0.1× city sprinting holds 120 Hz (`streaming:bench -- --headed
--zoom-motion --zooms=0.1 --noclip --renderer=gpu --viewport=1728x1117
--arrival=-380,-364 --scene=city`; baseline 40–41 of ~918 motion frames over
cadence, render p50/p95 5.1/8.4 ms).

- Draw sprites and ellipse shadows directly from scene items into the GPU batch,
  without the Canvas-shaped `RasterSurface` calls (save/restore, `drawImage`,
  path/ellipse emulation), keeping the same pixels, depth and order.
- Put sprite sheet pages in a `TEXTURE_2D_ARRAY` (or a few) so interleaved sheets
  no longer split batches at the 8-slot limit (~76 draw calls per frame at 0.1×).
- Measure flush cost through Three's `render` per batch; replace it with a direct
  draw only if the measurement shows it matters.
- Keep each step measurable: A/B `submit:scene` with `--profile-stage=stationary`
  and the headed 120 Hz run; no step lands without its number.
- Exit: the 120 Hz goal or a recorded reason it is not reachable on WebGL2; GPU
  browser specs (order, batching, depth, decals, grass LOD), readiness gate,
  final full local software-WebGL run.

## Progress

None yet.
