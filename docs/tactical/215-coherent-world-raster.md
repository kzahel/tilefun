# Coherent world raster and fractional actor placement

Status: delivered and qualified; owner playtest next.
Updated: 2026-11-03.

Owner authorizes the robust repair recommended by [214](214-world-registration.md).
Preserve both stationary scenery registration and steady followed-actor movement.
No physics, prediction, body coordinates, camera-follow timing or input policy changes.

## Rendering contract

`WorldRasterFrame` scopes aligned projection to world collection and rendering.
Terrain, props, grass, surface/editor overlays and clip rectangles therefore share
the same integer camera translation. Canvas/GPU hosts draw into a viewport-sized
world image with two guard pixels on every edge. Visible chunk admission includes
the guard. `endWorld` restores logical continuous projection and applies the camera's
fractional remainder once to the world image, before HUD, touch and debug UI.
Picking retains its ordinary continuous inverse. Explicit `?pixelsnap=1` holds the
fractional remainder at zero for comparison.

GPU uses a retained RGBA8 render target and one fullscreen GPU pass, without a
per-frame GPU readback or Canvas upload. Canvas uses a retained OffscreenCanvas
and a smoothed, unscaled final blit onto the input/HUD canvas. Resize, recovery,
renderer switching, captures, game Play/Edit/prop editing and ScenarioPresentationHost
share the lifecycle. Exceptional teardown restores the camera scope too. UI-only
frames clear the previous world; captures include the completed world plus HUD.

Actor sprites are marked by ownership, including while stationary. Their destination
positions stay fractional inside the world frame and their raster dimensions stay
fixed at a given zoom, computed directly from dimensions rather than subtracted
projected edges. The rounded image pins its physical foot anchor, including odd
dimensions at half zoom. Canvas scales isolated crops nearest once in a bounded cache,
then translates them with screen-pixel filtering. GPU performs the equivalent
premultiplied four-tap screen-pixel filtering in the existing ordered texture batch.
Neighboring atlas frames cannot bleed; crops crossing texture pages are isolated
before filtering, avoiding source-over seams between two filtered page halves.
Meshes, sprite vehicle families, passengers and ordinary characters follow the
same actor policy. There is no moving/stopped renderer switch.

Indoor actors previously rounded at native resolution under an outer scale. The
production room path now renders commands at screen resolution inside the same
world frame, so actor movement does not acquire a separate 3px grid. Reference
interior adapters retain native placement and scale.
Static room edges and elevated tiles use shared integer edges inside the world
frame; Canvas reuses their scaled rasters too, avoiding independent texel phases.

Terrain seam coverage extrudes its final source row/column instead of stretching
the whole chunk image. Immutable reference adapters retain their original overscan.
Removing stretching exposed nearest-sampling ties at half zoom: integer translation
could change which boundary texel was selected. The composed GPU shader resolves
ties consistently; Canvas reuses scaled static rasters at nonintegral scales.
Canvas actor/static caches have 8/64MiB budgets and 512-entry caps (one oversized
image may remain); integer-scale static images bypass the scaled cache. Actor
shadows reuse local rasters, without per-frame fractional-phase cache churn.

The extra GPU bounds attributes increase raster vertex stride from 9 to 13 floats;
ordered eight-texture batching and indexed quad capacity remain. Diagnostics expose
world target bytes/composite count, and Canvas reports its raster-cache bytes.
The 960x640 lab target is 2,483,264 bytes; a 1280x900 target is about 4.4MiB.
Filtering can soften an edge over approximately one output pixel; crisp source
texels remain nearest-scaled before the screen-pixel translation filter.
Ordinary static draws retain a direct sampling path with consistent texel-boundary
selection, including rescaled furniture/crops at integral camera zoom. Actors use
the isolated filter. Bounds write directly into the retained vertex buffer without per-quad arrays.

## Evidence and validation

[Compact evidence](../benchmarks/215-coherent-world-raster.json) retains all measured
lanes and the initial crowded outlier. Raw frame traces/screenshots remain local.

- The actual-host combined pixel probe runs 20 groups: Canvas/GPU, five zooms,
  positive/negative world regions, camera settling and a continuously followed
  actor, including the indoor path. It also checks hostile neighboring atlas pixels,
  texture-page crossing, a fixed HUD marker in captures, and camera-scope restoration.
  Desktop static/actor centroid ranges stay below 0.011/0.009px; the physical
  Chromebook stays below 0.020/0.009px. Canvas/GPU actor channel differences are at
  most 1/255. These are filtered 8-bit measurements, not hard pixel bbox guarantees.
  Raised-terrain registration stays below 0.015px on both devices. The final actor
  fixture has odd width, crossing an atlas page and half-pixel dimension ties.
- Two ordinary Worker game sessions each capture walk, release, run and a driven
  mesh car. Final stationary suffixes contain 223/222 frames with exactly fixed XY
  and zero player/terrain horizontal draw-offset variation. Release can still have
  legitimate predicted/reconciled travel; the artifact explicitly excludes that
  travel from stationary registration. Steady walk/run draw ranges remain below
  0.017px, and car ranges below 0.001px. Actual GPU presentation offsets are observed.
- 125 focused native checks in nine files pass, including world-scope restoration,
  guard chunks, projection/inverse, terrain resources, scene collection, interior
  presentation and embedded lifecycle. All three TypeScript projects pass.
- All 25 selected production browser checks pass in bundled full Chromium: the
  complete GPU renderer suite, ordinary Worker car ramp/seat persistence, road
  traffic pause/reload, and actual indoor walking/door selection/save/reload.
- Art catalog and all 2,120 Workshop candidate identities validate; the production
  build passes. Runtime review fingerprints include the new composition, sampling,
  actor collection, camera and vehicle-family sources. Source banks and approvals
  are not regenerated. Manifest changes record runtime fingerprints/source locations.
- GPU/meshes streaming readiness at desktop CPU rate 4 passes: cold, standing,
  walking, sprinting, reversal and zoom-out all retain about 16.8ms frame p99, with
  zero missing-data/stale-cache frames and zero final incomplete terrain.

Repeat with Node 24 and bundled full Chromium:

```sh
node scripts/instrumentation/camera-registration.mjs --output=/tmp/tilefun-registration
node scripts/instrumentation/movement-pacing.mjs --output=/tmp/tilefun-pacing
npm run streaming:bench -- --assert-ready --renderer=gpu --meshes --cpu=4
```

The registration runner now qualifies actual production hosts; 214's isolated
floor/composite controls remain historical evidence at its source checkpoint.
The existing GPU browser case checks both the preserved snapped reference and
the actual-host static/moving contract, rather than silently qualifying only
the old reference camera mode.

The broader indoor traversal check now uses bundled full Chromium, like the GPU
renderer qualification. Its unchanged 75ms key pulses/time assertions pass in
before/after full-Chromium controls. Headless-shell production runs show presentation
stalls long enough for those down/up events to coalesce between updates, leaving
authority stationary. Observed JS draw submissions remain around 0.5ms; this does
not isolate the external presentation cost. The test's movement, physics and
timing expectations are not loosened. Software/headless-only presentation throughput
remains a recorded limitation rather than an all-browser performance guarantee.
An earlier headless-shell pixel diagnostic also shows coarser filter precision:
actor centroid variation below 0.07px and channel differences up to 30/255. Its
strict pixel gate fails; it is not substituted for the desktop/device qualification,
and the full-Chromium thresholds are unchanged.

## Chromebook cost and limits

Physical ChromeOS Chrome 150, four logical cores, 8GiB device-memory bucket,
reported viewport 800x1200/DPR2, 960x640 lab. Two balanced trials each at 0/96 NPCs
use 3s warmup/6s samples, followed by two balanced 96-NPC trials with 4s warmup/8s
samples. Baseline restores `88f4ed60` runtime modules through an isolated Vite
transform, with identical assets and shared physics; both lanes use the same
render timing hook. Only owned tabs, forwards and servers are created/retired;
the device browser and its configuration remain running/unchanged.

Sparse render means increase about 0.13–0.14ms. The first ordinary crowded pair
increases about 0.50ms. One later composed crowded capture has seven slow intervals
(frame p99 33.4ms/max50ms) and a simultaneous Worker slowdown. Do not discard it or
claim causality. In the two balanced crowded repeats, composed render means are
2.65–2.82ms versus 2.39–3.27ms before; all four runs retain 16.8ms frame p99 and
zero intervals over 25ms. Upload/residency counts remain comparable, with one extra
GPU draw per frame. Short samples do not qualify sustained thermal load, every
Chromebook or heavy city scenes; there is no constant-cost/speedup claim.

An intermediate normal-scale pair after the static fast path/vertex allocation cleanup
measures render means of 3.32ms before and 2.66ms composed. Before has seven slow
intervals (frame p99 33.3ms); composed has one (frame p99 16.8ms). Preserve these
variations alongside the balanced repeats; they do not establish a general speedup.
The final delivery pair, with consistent sampling for all composed static images,
measures 2.39ms before versus 2.67ms composed render mean (about +0.28ms). Both lanes
retain 16.8ms frame p99 with zero intervals over 25ms.

Next: owner Save and reload, then inspect walking/stopping beside trees at normal
and half zoom, running and driving. Retain the combined static/moving pixel gate
for future renderer work; profile a sustained natural/city scene if device tails recur.
