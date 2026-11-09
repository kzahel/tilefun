# WebGL2-only renderer

Status: parent plan; planned 2026-11-09, slices 1–4 authorized for autonomous delivery;
slices 1–3 delivered 2026-11-09.
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
