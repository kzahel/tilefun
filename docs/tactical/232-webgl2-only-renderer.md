# WebGL2-only renderer

Status: parent plan; planned 2026-11-09, slices 1–4 authorized for autonomous delivery;
slices 1–4 delivered 2026-11-09. Next: the CI step (see Slice 4 progress).
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

- Delete `CanvasRenderHost` and Canvas-only host branches (the `RendererMode` type,
  Canvas fallback in labs, `FirstPersonControl`'s non-GPU branch).
- Keep the native raster that slice 2 kept for fingerprinted review rasters
  (`CanvasRenderBackend` used by the showcases and `PatternRuntime`). Rename it to
  say that, or document it as such. Keep the non-world-raster
  (`worldRaster === false`) drawing path: the review rasters and the
  standalone GPU backends (explorer, renderer lab, probes) use it.
- Scripts: drop the `--renderer` option (GPU-only since slice 1) from the streaming
  bench/matrix, realm-physics bench, `city-audit`, `car-driving-browser`, and the
  `renderer` field from `streaming-matrix-lib` plans where it no longer helps.
- Code shared with the GPU path (`Canvas2DRenderer` scene drawing, `TileRenderer`,
  terrain/interior/overlay resources) stays until slice 4 replaces it; rename only
  where the name now misleads.
- Docs: rendering architecture, testing, performance, embedded labs, 3D assets,
  boats, ROADMAP ("Canvas fallback" delivered item).
- Exit: no Canvas renderer references in `src/`, `tests/`, `scripts/` except the 2D
  UI/HUD canvas and offline raster tools kept by slice 2; full checks.

### 4 — GPU-native sprite path

Goal: 0.1× city sprinting holds 120 Hz (`streaming:bench -- --headed
--zoom-motion --zooms=0.1 --noclip --viewport=1728x1117
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

### Slice 1 — delivered 2026-11-09

- `SelectableRenderHost`, the debug panel's renderer selector and
  `RenderHost.rendererControl`/`RendererMode` are gone. `loadRenderHostFactory`
  (game and `LabView`) runs `requireWebGl2` (a released probe context, remembered
  after success) and then loads the GPU host. `GameClient` requires a host factory.
  `?renderer=` and `meshes` are ignored.
- No WebGL2: the game shows a "Tilefun needs WebGL2" dialog without a stack and
  does not report a fault; labs show the same message in their error area. A GPU
  backend that fails after a successful probe is an ordinary reported fault (not
  "needs WebGL2"). Graphics-loss recovery is unchanged.
- Specs: ~76 files lost `renderer=canvas`/`legacy-canvas`/`meshes`; Canvas-only and
  Canvas+GPU loops were unwrapped; the selector and Canvas-fallback specs became a
  needs-WebGL2 case (game and lab), a probe-passes-backend-fails case, and an
  ignored-`?renderer=` assertion. The two terrain-pacing cases merged into one GPU
  case at the 0.25 overview with the upload assertions. Test-side fixes: furniture
  motion reads the composed frame through a playtest `__capture` hook; room editing
  gets 90 s (31 s on hardware GPU); the co-op door check in tap movement compares
  inside one task; two per-test deadlines scale from the config instead of `CI`.
- Bench and instrumentation scripts default to GPU and reject `--renderer=canvas`;
  the streaming matrix plans GPU only (slice 3 removes the option).
- Software-WebGL lane: `npm run test:e2e:software-webgl` /
  `playwright.software-webgl.config.ts`. It spreads the base config: `defineConfig`'s
  merge would also run the hardware `chromium` project.
- Full local software-WebGL run (M4 Pro, 2 workers, 621 tests in 130 files):
  36.5 min wall, 14 failures. 5 are the pre-existing ones (frog/robin/duck ball
  reactions, `streaming.spec.ts:6`, `gpu-renderer.spec.ts:577` room reference). 8
  were a migration bug (a `GAME` constant lost its `?`, so `${GAME}&generation=…`
  was not a game URL) and 1 a tap-movement race; all 9 pass on re-run under the
  software lane (tap movement ×3). The slowest file was `animal-browser.spec.ts`
  (9.9 min). The earlier timing failures (every-animal preview, controller menu,
  train recall, room-editing walk) passed in this run.
- Hardware GPU: the 22 hand-edited or previously failing spec files passed
  (139 tests, 7.9 min) before the review fixes; the review-fix cases re-ran.
- Checks: typecheck, Biome, knip, `test:streaming`, touched unit tests, art catalog
  and workshop manifest, build, `streaming:bench -- --assert-ready` (GPU).
  Code-health ratchet: `src/main.ts` +9 lines, `src/interiors/playtest/main.ts` +3
  (the ratchet already failed on main for unrelated files).
- Review (Opus 5.5 High, Work-claude pool, bypass): fixed the strict-mode locator
  and stackless dialog, backend errors mislabeled as "needs WebGL2", P2P host left
  open after init failure, script defaults that silently measured GPU as "canvas",
  `CI`-only deadlines, leftover `meshes` params, stale comments/docs, lab error text
  prefix and repeated probes. Not changed: CI. Before the first push, the smoke
  files now run on GPU under hosted software WebGL; measure them with the local lane
  against the 20-minute smoke budget (left for the CI step after slice 4's final
  run, per the testing strategy).

### Slice 2 — delivered 2026-11-09

- **Review rasters stay native (decision).**
  - Kept on the native Canvas raster (`CanvasRenderBackend`): the building, street
    and dense-district showcases and the pattern candidates. Their approval
    fingerprints (`renderFingerprint`) hash those pixels; a GPU raster would change
    every fingerprint and send approved work back to review.
  - Also kept native, for the same reason: the source-hashed `CharacterTestScene`
    (`drawScene2D`), the indoor review/workbench rasters (`CanvasInteriorMap`) and
    `FurnishedInterior`.
  - `FirstPersonInterior`'s map texture is raster preparation for the GPU, not a
    renderer.
  - A boundary test (`RenderingBoundary.test.ts`) allows `CanvasRenderBackend` and
    `CanvasRenderHost` imports, static or dynamic, only in those review rasters and
    slice 3's deletion list (`CanvasRenderHost`, `RenderHost.test`). The slice 3
    bullets now keep this review raster and the non-world-raster drawing path.
- **Explorer.**
  - `TilePreview` draws on an offscreen WebGL2 `GpuRenderBackend` at device pixels
    and copies the frame into the map canvas over the regional map.
  - The coverage overlay now draws over props and actors too; before, only terrain
    sat under it.
  - A WebGL2 or backend failure is remembered once. Tiles then stay off with the
    message in the diagnostics, and the map stays usable.
  - Context loss and restore recover the backend and redraw.
  - A new 2× display test at a fractional zoom checks that the GPU frame covers
    every quadrant of the map.
- **GPU clips.** Clip edges now snap to whole pixels (`disjointRects`). Before,
  Three rounded each scissor's position and size separately, so strips sharing a
  fractional edge left 1 px gaps or blended a column twice. This was reachable at
  fractional explorer zooms and in vehicle-bed clips. A unit test covers it.
- **Renderer lab and probes.**
  - The lab is now called "Renderer lab" (was "Renderer comparison") and has no
    Canvas reference.
  - `probeSpriteSeams`, `probeCameraStability`, `probeWorldRegistration` and
    `probeViewRegions` run on the GPU only.
  - `probeWorldRegistration` replaced actor parity with absolute actor placement.
    The actor's drawn height snaps to whole pixels. Measured: ≤0.005 px on
    hardware, ≤0.033 px on SwiftShader.
  - `InteriorPresentation.test` uses the shared `RasterRenderBackend`.
- **What replaced the Canvas-vs-GPU comparisons.** They became GPU invariants or
  explicit values (`RendererLabChecks`, with unit tests):
  - Clip-union consistency, and the unclipped frame has content outside the union.
  - Disabled and failed meshes fall back to exactly the plain sprite car.
  - Grass LOD fades linearly on non-overlapping blades; frame digests cover the
    return to full detail and the hide.
  - Smooth and pixel-exact shadows agree on darkening mass and centroid. Asserted
    within 5% and 0.25 px; measured 1.5%/0.05 px on hardware and 1.2%/0.17 px on
    SwiftShader.
  - The editor overlay stays inside its box, and its fill blends at the item's
    alpha.
  - The zoom-1 scene (8 colors) and room (11 colors) have recorded color counts and
    per-color pixel bounds, so mirroring and shifts fail too. They were taken from
    the GPU while it matched Canvas exactly, with a tolerance of 2, and are
    identical on hardware and ARM SwiftShader.
  - The car-width registration test compares the mesh with the GPU sprite frame.
  - The room/overlay test, which failed before slice 1 on both lanes, now passes.
- **Not changed:** the indexed-batch test's plain Canvas2D reference. It checks
  `GpuRasterSurface`'s Canvas2D emulation contract, not the Canvas renderer, and
  slice 4 revisits it.
- **Known risk:** the recorded counts and bounds are validated only on ARM
  (hardware and SwiftShader). Hosted CI runs x64 SwiftShader, where
  nearest-neighbor ties can differ; the lab keeps integer texel scales to avoid
  them. Check this on the first hosted run.
- **Review** (Opus 5.5 High, Work-claude pool, bypass). Fixed:
  - the clip-edge gaps;
  - mirroring and shifts that the counts alone could not see;
  - the explorer's retry on failure and its context loss;
  - absolute actor placement;
  - slice 3 plan text that contradicted this slice;
  - missing unit tests for the checks;
  - checks that broke when lab modes combined;
  - "group alpha" wording;
  - Windows path separators and host imports in the boundary test;
  - disposal and stale comments.

  Not changed: the explorer's terrain memory estimate (CPU only) and the
  `MAX_VIEWPORT_DIMS` diagnostic.
- **Checks after the review fixes.**
  - Hardware GPU: `gpu-renderer`, `world-explorer`, `natural-landscapes`,
    `vehicle-depot` and `vehicle-geometry` (46 tests) pass. Earlier,
    `dense-review`, `city-places-review` and `tools-index` passed.
  - Software-WebGL lane: `gpu-renderer`, `world-explorer`, `vehicle-depot` and
    `vehicle-geometry` (41 tests, 1.6 min) pass. Earlier, 53 tests including
    `natural-landscapes`, `dense-review` and `city-places-review` passed.
  - Also passing:
    - typecheck, Biome on the touched files, and knip;
    - 716 related unit tests;
    - the art catalog and workshop manifest (renderer-lab line references and the
      tool name only), and the build;
    - `streaming:bench -- --assert-ready`;
    - `camera-registration.mjs` (10 groups; actor placement errors ≤0.0043 px).
  - Code-health ratchet: `TilePreview.ts` grew by 56 lines and its worst function
    by 1.

### Slice 3 — delivered 2026-11-09

- **Deleted.** `CanvasRenderHost` and its host tests (resize, recovery listeners,
  region composition). The GPU host covers the same contracts in the browser:
  graphics-loss recovery and `probeViewRegions` in `gpu-renderer.spec.ts`. Slice 1
  had already removed the `RendererMode` type and the labs' Canvas fallback.
- **Dead branches removed.**
  - `FirstPersonControl`'s non-GPU branch: the game always has the GPU world canvas.
  - The view regions' Canvas clip polygon and `isWholeCanvas`: only the Canvas
    host used them; the GPU composes regions with the half-plane mask.
  - `ViewRegionProbe`'s renderer check, which could not fail after
    `createGpuRenderHost`.
- **Review raster (decision).** `CanvasRenderBackend` is now `ReviewRasterBackend`,
  documented as the native Canvas2D raster for fingerprinted review images only.
  The boundary test allows only the three showcases and `PatternRuntime` to import
  it. Fingerprints hash pixels, not source, and drawing is unchanged, so no review
  state changes.
- **Shared tests.** The resource-lifetime and visible-only multi-view refusal tests
  now run on the shared `RasterRenderBackend` (`RasterRenderBackend.test.ts`).
- **Scripts.**
  - Removed the `--renderer` option, the `renderer=`/`meshes` URL params (the game
    ignores them) and the `renderer`/`meshes` report fields from the streaming bench,
    realm-physics bench, `city-audit`, `car-driving-browser`, `movement-pacing`, the
    first-person captures. Deleted the unused `train-refresh-probe.mjs`.
  - `city-audit`'s `--meshes=false` had done nothing since the GPU sprite-car mode
    was removed.
  - The streaming matrix no longer has a renderer column or `-gpu-` in run ids.
  - Old commands that still pass `--renderer=gpu` keep working; the option parsers
    ignore unknown flags.
- **Docs.** Updated current guidance in rendering architecture, testing,
  performance, embedded labs, 3D assets, boats, trains, ROADMAP and the
  instrumentation README. Dated evidence paragraphs stay as history.
- **Checks.**
  - Typecheck, knip, and Biome on the changed files. The only findings are two
    existing `innerText` lint lines in untouched code.
  - Full vitest: 5,062 pass. The 4 failures are `BallCommands` (dog, capybara,
    frog, robin) and fail the same way on HEAD without this slice.
  - `streaming-matrix.test.mjs`, the art catalog and workshop manifest (input
    digest only), and the build.
  - `gpu-renderer`, `split-screen`, `dense-review`, `street-review`,
    `building-review`, `city-places-review` and `pattern-studio` passed 59/59 on
    hardware GPU and 59/59 under software WebGL.
  - `streaming:bench -- --assert-ready`.
  - Code-health ratchet: this slice only removes lines. The ratchet still fails on
    `GpuRasterSurface.ts` and `RasterRenderBackend.ts` growth from earlier commits.
- **Review** (Opus 5.5 High, Work-claude pool, bypass): approved with no must-fix
  items. Fixed:
  - the docs that still described the clip polygon and the matrix's renderer
    dimension;
  - the stale-link assertion, restored as `?renderer=legacy-canvas&meshes` in the
    default-host test;
  - the boundary test, which now also requires that only the GPU and review rasters
    extend `RasterRenderBackend` and that production code never builds it directly;
  - first-person comments that still described the Canvas case;
  - present-tense Canvas mentions (also `characters.md`);
  - the dead `--renderer` flag in slice 4's goal command;
  - the unused train refresh probe.

  Not changed: old `--renderer`/`--meshes` flags are ignored rather than rejected,
  and reports no longer carry a renderer field. There is still no unit test for
  `GpuRenderHost.dispose` idempotence; add one if slice 4 touches the host. After
  the fixes, the boundary and first-person unit tests, typecheck, knip, the rebuild
  and the restored default-host spec pass.

### Slice 4 — delivered 2026-11-09

Measured on the M4 Pro's 120 Hz built-in display. "Stationary" is
`streaming:bench -- --headed --zoom-motion --zooms=0.1 --noclip
--viewport=1728x1117 --arrival=-380,-364 --scene=city --profile-stage=stationary`
(2,291 scene entries, 940 actors, 2,075 props); "motion" is the goal command
without `--profile-stage`. Two runs per row unless noted.

| Step | Stationary render p50/p95 | `submit:scene` / `submit:terrain` | Draws/frame | Motion frames over cadence | Motion render p50/p95/p99 |
| --- | --- | --- | --- | --- | --- |
| HEAD `91566d65` | 4.7/5.3 ms | 1.30 / 0.67 ms | 91 | 20, 29 of ~935 | 4.3/7.7/8.8 ms |
| Page atlas, direct array uploads | 4.2/4.7 | 1.21 / 0.36 | 8 | 46, 47 (regression) | 4.0/9.5/17.4 |
| Page atlas, staged uploads | 4.1/4.7 | 1.13 / 0.34 | 8 | 9, 5 | 3.8/7.1/8.2 |
| + direct sprites and shadows | 3.8–4.0/4.3–4.5 | 0.94–1.01 / 0.31–0.36 | 8 | 7, 7 | 3.8/7.0/8.3 |
| + rail raster culling | — | — | 8 | 2, 4 | 3.8/6.2/7.2 |
| Final (code split into modules) | 4.0–4.1/4.6 | 1.03–1.05 / 0.33 | 8 | 3, 3 of 956 | 4.0/6.5/7.3 |
| After review fixes (edge clamp) | 4.0–4.1/4.6 | 0.97–1.03 / 0.34 | 8 | 3, 4 of 956 | 3.9–4.2/6.4–6.5/7.3 |

- **Why the draw calls were there.** A temporary flush counter showed ~80 flushes
  per frame, almost all from the 8 texture slots filling: 384 terrain chunk rasters
  (256×256, ~39 flushes), actor sheets (~23), shadow ellipses (~7) and prop sheets
  (~7). Terrain was half of it, so the atlas takes every paged image, not only
  sprite sheets.
- **Page atlas (`GpuPageAtlas`, `AtlasAllocator`, `GpuPages`).**
  - One `TEXTURE_2D_ARRAY` of 1024² layers holds every page: sprite sheets,
    terrain chunks, shadow ellipses, actor crops and overlays. Layers are packed
    with power-of-two shelves over a 1-D row buddy system, so emptied shelves
    merge back into whole layers.
  - The array grows by half when full (GPU copy of the old layers) and halves when
    eviction empties its top three quarters. Doubling went to 64 layers (256 MiB)
    for 136 MiB of pages; growing by half stops at 41 layers (164 MiB). Before the
    atlas the same pages used 136 MiB of separate textures. Cap: 256 MiB or
    `MAX_ARRAY_TEXTURE_LAYERS`; beyond it a page falls back to its own texture
    (`atlasMisses`, 0 in every run).
  - **Uploads go through a 2D staging texture and a GPU copy.** Uploading canvases
    straight into the array (`texSubImage3D`) read them back through the CPU:
    1.07 ms/frame in motion and twice the missed frames (row 2). The staging
    texture also flips rows like the old 2D pages (`UNPACK_FLIP_Y`, which WebGL
    rejects for array uploads from canvases), so layers hold each page bottom row
    first and nearest lookups match the old pages. Staging textures are reused per
    page size within 8 MiB (`stagingBytes`, 5.2 MiB at 0.1×).
  - Unfiltered atlas quads carry their page rectangle as `bounds`, and the shader
    clamps lookups to its edge texel centers: CLAMP_TO_EDGE for the 2D page it
    replaces. Without it a lookup exactly on a page's top or right edge would read
    the neighboring region (another page or stale texels).
  - A resize holds the old and new arrays until the copy completes: growing
    41 → 62 layers peaks at ~412 MiB for one frame.
  - Sampler budget: seven image/depth slot pairs plus the atlas (15 of WebGL2's 16
    units); `batchTextureLimit` now reports 7. Mesh composites and the white
    texture still use slots.
- **Direct sprites and shadows.** `RasterSurface` gained two optional GPU-only
  methods, `drawSpriteImage` and `fillShadow`. The shared scene drawing computes
  the same geometry and calls them instead of save/alpha/scale/`drawImage`/restore
  and path/ellipse/fill. The native review raster does not have them and draws
  through Canvas state unchanged. Emergency-flash sprites keep the Canvas-shaped
  path (their lamp draws inside the sprite's state).
- **Flush cost through Three.js (decision: keep).** With ~8 batches per frame,
  `flush` is 0.07–0.09 ms/frame (~10 µs per `WebGLRenderer.render`). A direct
  WebGL draw cannot save a measurable amount.
- **Rail raster culling.** In the slowest motion ticks the per-pixel rail
  rasterizer (`nearestRail` over every segment of every path, for every pixel of a
  railway tile) took ~2.5 ms (profiled). `drawRailTile` now skips segments whose
  bounds are more than 23 px from the tile; they can never color a pixel. A unit
  test compares every pixel of 100+ tiles, two crossing paths, against
  `railPixel`.
- **Same pixels.**
  - The renderer lab's recorded color counts and bounds pass unchanged.
  - A new spec draws the lab with the atlas and with separate page textures
    (`setPageAtlas(false)`) at zooms 1, 0.5 (exact texel-edge ties), 0.375, 1.3
    and 0.1, with clips and the overlay, an interior and grass: identical digests.
  - `probeWorldRegistration(false)` repeats the composed-world probe without the
    atlas. Every frame's nearest-sampled scenery (rows above the actor: terrain,
    prop and slab, at zooms 0.4–1.3 including 0.5's all-tie sampling) is
    byte-identical on hardware and SwiftShader, and centroids match exactly.
    **Filtered (subpixel) actor edges round differently**: layer-space UVs carry
    less precision than a small page's. Measured ≤1 color level on hardware and ≤2
    on SwiftShader, moving actor centroids ≤0.005 px; the spec allows 0.01 px.
    These are gameplay pixels, not review rasters (those stay native), so nothing
    returns to review.
  - Without world composition (explorer, renderer lab, probes) lookups use the
    hardware's unbiased nearest rule, so a pixel center exactly on a texel edge
    falls to interpolation rounding on both paths and can resolve differently.
    The lifecycle spec found one at 2.5× magnification; it uses 8:3 instead.
  - A lifecycle spec caps the atlas at 2 layers and compares with separate page
    textures exactly (hardware and SwiftShader): growth 1 → 2 with quads queued,
    4 pages falling back to separate textures in the same batches, a page
    re-uploaded between two queued draws, shrinking after every page ages out,
    and new pages reusing evicted regions. The batch-order spec now runs with and
    without the atlas.
- **120 Hz verdict.** Reached: 3 of 956 motion frames miss the 8.3 ms cadence
  (0.3%, from 2–3%), render p99 7.3 ms. The remaining misses are CPU bursts from
  terrain cache builds (`Spritesheet.drawTile` composition) and scene collection,
  not WebGL2 limits; draw calls are no longer a factor. Larger next steps (not
  part of this slice): `collectScene` (~1.4 ms/frame at 0.1×), and a terrain LOD
  for overviews — 0.1× keeps 384 full-resolution chunk rasters (~96 MiB) resident.
- Instrumentation: `streaming-profile.mjs`, the streaming bench's `pageMs` and
  `city-audit-profile.mjs` (upload sources, `page` timing) now wrap
  `GpuPages.get`/`remove` (the surface's page methods moved there). City audit's
  batch census counts the atlas as one texture, so its probe output changes.
  `ordered-texture-batch-entry.mjs` measures slot batching (180) and turns the
  atlas off.
- **Checks.**
  - Full local software-WebGL run (M4 Pro, 2 workers, before the review fixes):
    616 passed, 7 failed, 34.1 min wall (slice 1: 36.5 min); the slowest file is
    `animal-browser.spec.ts` (10.5 min). Four failures are pre-existing (frog,
    robin and duck ball reactions, `streaming.spec.ts:6`). `train-recovery:275`
    (player x after reload), `workshop-standalone:9` (login click) and
    `world-map:58` (map settle) pass on rerun under the software lane with the
    final build.
  - After the review fixes, software lane: `gpu-renderer` (27, including the new
    atlas specs), those three, `railway`, `rail-crossing`, `terrain-pacing`,
    `split-screen`, `world-explorer` and `vehicle-geometry`: 57/57, 2.6 min.
  - Hardware GPU: `gpu-renderer` 27/27 after the review fixes. Before them,
    `gpu-renderer`, `split-screen`, `world-explorer`, `terrain-pacing`,
    `vehicle-geometry`, `vehicle-rendering`, `vehicle-depot`, `railway`,
    `rail-crossing`, `authored-train`, `natural-landscapes`, `player-markers` and
    `furniture-motion`: 67/67.
  - Typecheck, knip, Biome on changed files (only the existing `innerText`
    warning), full vitest (5,067 pass; the 4 `BallCommands` failures also fail
    on HEAD), art catalog, workshop manifest, build, and
    `streaming:bench -- --assert-ready` before and after the review fixes.
  - Code-health ratchet: `GpuRasterSurface.ts` is 1,011 lines (1,004 at HEAD;
    page residency moved to `GpuPages`) and its worst function is unchanged.
- **Review** (Opus 5.5 High, Work-claude pool, bypass): approve after two
  must-fixes, both fixed: the status line claimed the final run before it was
  recorded, and `city-audit-profile.mjs` still instrumented the removed
  `surface.page` (and counted atlas layers as textures). Also fixed:
  - the page-edge clamp (above);
  - an exact composed-world A/B for nearest-sampled scenery;
  - lifecycle coverage (growth, fallback, mid-batch re-upload, shrink, reuse)
    and the batch-order spec without the atlas;
  - a bound and a stat for staging memory, and the documented resize peak;
  - no growth for a page no layer can hold;
  - stats updated when they change, a guard that batch slots stay below the
    atlas slot, the probe-length assertions, comments and doc wording, and an
    embedded-labs note.

  Not changed: growth is not capped to keep old + new under 256 MiB (documented
  instead). The accepted filtered-edge rounding stands, recorded above.
- **CI step (next, not done).** Measure the smoke files under the software lane
  against the 20-minute smoke budget, then adjust the workflow, timeouts and
  shards from the local ratio. On the first hosted x64 SwiftShader run, check the
  renderer lab's recorded color counts (validated only on ARM) and the new exact
  atlas parity specs.
