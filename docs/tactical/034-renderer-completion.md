# 034 — Renderer boundary proof and integrated completion

Status: complete. Parent: [022](022-renderer-backend-decoupling.md), R5.
Depends on [033](033-shared-terrain-and-consumers.md).

## Inspected remaining work

Remove the unused combined terrain draw API and pure furniture re-export aliases;
all runtime terrain consumers now explicitly prepare, collect and submit. Preserve
fixed native Canvas reference adapters and their immutable source identities.
Add an import/type dependency guard for neutral contracts, presentation builders
and simulation data. Guard the backend-selection seam and prohibit concrete
renderer access from gameplay orchestration. Document independent HUD/debug and
native review composition exceptions with their exact scope.

Use a recording backend with the same neutral terrain/elevation builders to run
real outdoor, editor and indoor entry points, including content changes, camera
movement, realm reset, independent resources and disposal. Assert only data crosses
the boundary, borrowed frames are copied/released and simulation inputs do not
change. This proves replaceability of the contract, not GPU raster parity.

## Completion evidence required

Types, all unit tests, lint, generated inventories, build and full browser suite;
full candidate record comparison with the pre-series baseline. Fresh matched
allocation/retention probes and room parity checks. Streaming readiness on desktop
and the attached Android phone, including current v11. Record device conditions,
actual movement, errors, readiness and limits separately from timing. Clean up
owned test tabs, processes and USB forwarding. Update parent, topic and index to
reflect actual delivery; commit only after all applicable gates pass.


## Delivery and validation

- Removed `TileRenderer.drawTerrain` and its preparation/placement adapter.
  `CanvasRenderBackend` owns a `TerrainFrame` directly; terrain resources expose
  IDs only. Pure furniture imports now name `FurnitureLayout`, including browser
  test helpers. Fixed native reference adapters remain documented in the topic.
- Added a graphics-free recording backend exercising actual `renderWorld`,
  `renderEntities` (outdoor and indoor) and `EditScene.render`. It covers actor,
  shadow, elevation, grass, particle and overlay data, room content reuse,
  independent handles, replacement/invalidation/recovery, copied submissions,
  frame release and unchanged simulation inputs. Accessing the UI context throws.
- Added dependency guards for neutral contracts/builders/chunk data and the
  production host-selection seam. These are focused source dependency checks,
  not a proof against arbitrary dynamic imports or unsafe casts.
- Typechecks, all **1,420 unit tests**, lint (124 pre-existing warnings/32 infos),
  catalog/manifest generation, production build and **293 browser tests** pass.
  All **551 candidate records** match both the previous slice and pre-series
  `98ee708`; all **81 room pixel hashes** match the pre-indoor-refactor capture.
- [Final evidence](../benchmarks/034-renderer-completion.json) contains allocation,
  retention, desktop readiness and Android results. For the same 27,000 terrain
  placements, sampled bytes fell from 4,528,388 to 1,686,192 (about 63%); geometry
  hashes match. Elevation remains nine layouts/3,456 descriptors, with identical
  hashes and about 1.3% sample variation. Scheduler samples differ under 1%, with
  identical job ordering and only 80 resident records for 3,000 frames.
- Grass counters/hashes are identical. Initial samples were above the historical
  13.46 MB capture, so fresh controls loaded pre-series source read-only through
  Vite: 19.31 MB before, 13.49 MB after, while other unchanged-current runs ranged
  18.24–20.03 MB. The relevant source/dependencies/probe are byte-identical across
  this series. Treat these sampled-byte differences as measurement variation,
  not a new grass optimization or regression. Retention after two discarded
  1,000-chunk batches grows only 15,496 then 2,776 bytes after forced GC.
- Desktop and physical Android v4/v10/v11 readiness assertions pass, with zero
  walking/sprint/reversal/zoom gaps or page errors. Desktop checks overlapped
  the browser suite; their timings are not used as comparative evidence.
- Pixel 7a, Android 17, Chrome 154, native 411×789 CSS viewport / DPR 2.625,
  real touch controls: movement frame p95 16.7–16.8 ms. v4/v10 sprints move about
  744 pixels; v11 moves about 459 pixels in its different scene. This is not a
  matched speed comparison between generation revisions. Cold entry still has
  22–24 unfinished-cache frames and 0–3 missing-data frames.
- Phone indoor and edited-room frame p95 are 16.7 ms; a touch move advances
  12.8 pixels and return to the street succeeds, with no page errors. The device
  was charging at 30.5–30.8°C during traversal, thermal status 0 afterward. All
  task-owned tabs, servers and USB routes were closed; final Machine Control
  doctor is ready. No browser profile or installed app was replaced.

## End state and separate follow-up

All five parent milestones are delivered. Seven bounded slices were used instead
of the original 4–6 estimate: metadata, outdoor, overlays, indoor, host lifecycle,
remaining consumers and final proof. Splitting protected pixel/lifetime invariants
and kept every delivered runtime commit validated.

A second backend now implements `RenderBackend` and supplies a platform host,
reusing the shared presentation policy. Canvas remains production and reference.
Next, consider a bounded terrain/sprite GPU prototype with measured upload/copy,
startup, memory and recovery costs. Cold-entry presentation and intermittent
phone hitches remain separate performance work; this refactor does not claim
that all stuttering is fixed or that Rust/WASM is required.
