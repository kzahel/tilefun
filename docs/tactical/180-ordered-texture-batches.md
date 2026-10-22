# 180 · Ordered texture batches

Status: delivered and qualified on desktop and native Pixel 7a · 2026-10-22.
Owners: [rendering architecture](../topics/rendering-architecture.md),
[performance](../topics/performance.md).

## Scope

Reduce the 168–212 raster submissions/frame left after 179, keeping native pixels,
the existing alpha/painter order, local car depth and outlines. Shared GPU surface
changes serve the game and embedded labs. Authority and source art stay unchanged.

First measure real quad texture switches and hard flush boundaries. Compare a
bounded multi-texture batch with atlas packing: retaining separate textures can
avoid copies, gutters and mutable atlas lifetime while permitting the same ordered
quads in one draw. Keep explicit upload, clip, target-write and pass boundaries.
Unchanged car images can join ordinary raster batches once their forced flush is
removed; borrowed dirty body/outline images must be submitted before reuse.

## Qualification plan (executed below)

- Current-source wide-track and fleet flush census; one/two/four/eight-texture
  order-preserving batch estimates retain existing hard barriers.
- Exact full Chromium RGBA comparison against one-texture submission, including
  mixed raw/sRGB textures, transparency, source edits, clips, capacity and recovery.
- Existing shared game/lab renderer boundaries plus required typechecks, unit
  tests, lint, catalog, manifest, production build and browser suite.
- Same-source native Pixel 7a controls, sequential and thermally gated, with
  authority cadence and scene work counts. Keep timing separate from attribution
  and validation. Record limitations, cleanup and next work here and in a receipt.

## Implementation and initial evidence

The selected prototype retains individual textures and uses up to eight samplers
per indexed batch (clamped to the device limit). Each quad adds one exact integer
slot value to its four vertices; the index/quad order is unchanged. Sampler
selection uses constant GLSL indices, with the original raw/sRGB conversion and
premultiplied blending for the selected source. White fills share a slot too.
Vertex records grow from eight to nine floats; the reusable buffer grows by
32 KiB. Texture/page and car-image residency budgets stay unchanged.

Uploads, clip transitions, capacity, pass endings and dirty body writes still
drain submissions. Cached cars can stay queued with surrounding sprites. A dirty
body drains the queue before changing targets or admitting/evicting images;
disabling meshes, recovery and disposal also drain pending car quads.

The native-viewport desktop census counts about 167 track draws/frame and 213
fleet draws/frame. Its unchanged-hard-boundary eight-texture estimate is about
25 / 69 batches respectively. Most fleet hard boundaries are the immediate
cached-car flush removed by this slice. This census is attribution, not timing.

Full Chromium pixel qualification passes 18 exact RGBA pairs (nine boundaries at
four/eight slots), plus 144 car-image comparisons. Explicit checks cover a queued
cached image evicted by the next dirty render, and queued pixels surviving mesh
disable. The retained outline-fusion diagnostic still passes all 72 pairs when
explicitly using its one-texture shader. The existing GPU capacity/order test now
mixes four textures in 4,101 quads and checks the new upload accounting.

Exploratory native phone captures hold about 60 FPS at both four/eight slots.
Eight uses about 25 draws/frame wide and 24 in the fleet, versus about 41 / 46
at four. Final acceptance uses the saved actual pre-change surface, with the
current remaining engine, rather than attributing diagnostic one-slot overhead
to the optimization. The first final wide pair is 41.01 → 60.02 FPS and about
168 → 25 raster calls/frame. The following fleet setup trips thermal status one
at 29.9°C, before sampling; stop, cool, then resume after validation jobs finish.
No warm/failed setup is admitted as a timing result.

Typechecks, lint (121 existing warnings / 42 infos), catalog, manifest and the
production build pass. All 19 focused GPU browser cases pass, including mixed
texture capacity/order/upload accounting, real context recovery, live backend
replacement and failed-asset fallback. Manifest regeneration preserves the other
1,977 fingerprints; only the two excluded truck/towing engine identities change.
The final unit suite passes 6,640 tests in 366 files, plus the Node visual
comparison. The complete browser suite passes **829/829** in 35.7 minutes,
including the Canvas deer case that was intermittent in 179. GPU + meshes
streaming `--assert-ready` also passes. No test tolerance/deadline or AI behavior
was changed.

## Final acceptance

The [receipt](../benchmarks/ordered-texture-batches.json) pins source/probe/asset
hashes, all controls and the excluded thermal setup. Strict controls substitute
the saved actual pre-change `GpuRasterSurface.ts` while retaining the same current
remaining engine and immediate cached-car submission. Its hash matches the
surface qualified in 179; runtime diagnostics also confirm the old surface was
loaded. The new eight-texture path is the production default.

| Native Pixel 7a case | Original raster FPS | New FPS | Raster calls/frame, old → new | Frame p95, old → new |
| --- | ---: | ---: | ---: | ---: |
| Wide track, zoom 0.1 | 41.01 | 60.02 | 167.88 → 25.15 | 33.4 → 16.7ms |
| Cached 45-model fleet, zoom 0.1 | 40.27 | 59.98 | 212.00 → 23.75 | 33.4 → 16.8ms |

Callback FPS rises 46% / 49%; raster submissions fall 85% / 89%. Inclusive main
render elapsed time falls 5.25→4.37ms wide and 5.74→4.61ms in the fleet. Fleet
controls keep 51 image hits/frame, zero mesh/outline calls and the same 6.55 MiB
image residency; no geometry/outline work reduction is counted again from 179.
Normal view is 59.99 FPS; native touch walking is 59.92 FPS over about 783px.
All six accepted 12-second captures (after 12-second warmup) retain about 60Hz
authority, thermal status zero at 24.4–29.7°C, and zero page errors. No validation
runs during timing. The first fleet attempt was rejected before sampling when
thermal status became one; remaining captures resume only after the long cooldown.

Both desktop Chromium 153 and native phone Chrome 155 pass **18 exact mixed-
texture RGBA pairs and 144 exact car-image pairs**, including raw/sRGB sampling,
overlap, clips, source edits, capacity, reset/recovery and queued-image lifetimes.
These compare all channels with zero tolerance. The native probes use owned tabs
and the same bundled source, without viewport emulation or user-origin cleanup.

This is fresh generated track and a synthetic fleet that blocks racers, not the
owner's saved depot or unchanged race workload. The two final pairs run in opposite
orders across the cases, not repeated paired samples of each individual case.
Short 60Hz-capped rAF samples do not establish sustained display/GPU timing, power
use or hardware-normalized headroom. Four-texture candidates also reach 60Hz;
eight is selected for fewer submissions, not a demonstrated power advantage.

Owned tabs/routes/relay are closed, original routes and foreground restored.
Post-cleanup doctor is ready/unlocked, thermal status zero, battery 26.3°C.

## Next work

Qualify the actual saved depot and moving/driving overview before another renderer
change. The measured standing wide/fleet cases now reach the phone's 60Hz cadence.
Profile any remaining cost in those acceptance scenes before choosing a deeper
atlas, car outline-fusion or shared-depth change. Preserve 162's separate world-
depth correctness work; this slice changes no world-depth or simulation policy.
