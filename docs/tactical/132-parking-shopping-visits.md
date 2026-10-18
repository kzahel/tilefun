# Parking and shopping visits

Status: implemented and validated; broader browser limitations recorded below.
Owner request: 2026-10-18. Continue [131](131-parking-lot-patterns.md) with a complete
shopping trip and only one or two cars parking/leaving at once.

## Delivered behavior

[Parking lot lab → Watch shopping trips](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/parking-lab?play=1)
adds four shopping visits to the big native-tile lot. Cars reserve distinct paired
pull-through bays before entry, park, release one shopper beside the car, wait
while the shopper enters a shop, collect the returning shopper and leave through
the outer aisle. They can return for another visit after a short absence.
The paired space behind each active bay stays empty for a forward exit.

Two independent aisle reservations admit at most two car maneuvers globally and
one on each side. Pedestrian trips reserve the same aisle, so arrivals/departures
wait until its shoppers have crossed. A player or other obstacle can deliberately
hold up a route; movement waits rather than teleporting or deleting the obstacle.
Shop visits are a timed absence at the storefront doorway, not an interior simulation.

`ParkingSystem` is a bounded Realm service, supplied by plain-data `ParkingLot`
routes through `ScenarioRecipe.parking`. Native `drivenCarPose` sweeps the complete
car body against terrain, props and actors; existing moving-support queries carry
roof riders. Shoppers use ordinary EntityManager collision, animation and binary
replication. Only the Realm ticks trips. React supplies input, diagnostic datasets,
camera intent and pause/reset/reload controls through ScenarioPresentationHost.
Scenery uses the native atlas and ordinary props, with ground pieces grouped into
chunk-sized compound props. The shared prop snapshot codec now preserves its
existing `sortOffsetY` field: dropping it had allowed pavement to cover cars and
storefronts. A snapshot regression and native browser captures qualify this fix.
The bounded lot keeps a dependency interest ticket so zooming does not evict a
route's terrain. No new asset bank or lab-only renderer is introduced.

Each lot stores one `parkingVisits` record containing all bounded trip phases,
waypoint progress, remaining authority time, counters and native actor poses.
These service-owned actors bypass generic actor persistence to prevent duplicates.
Reload recreates bodies with fresh network IDs; pause does not spend shop time or
advance motion. Unsupported terrain pauses service progress. Static layout review
identities remain independent and unchanged. A separate `geometry:parking-visits-v1`
behavior candidate is registered in the `parking-visits` batch as an interactive
experiment, not an immutable art snapshot. No human feedback events were written.

This slice is available in the lab. It does not yet select shopping centers in
regional generation or divert ordinary road traffic into them. The four visitors
have authored reserved destinations; general public parking allocation and road
entry/exit connectors are follow-up work.

## Validation

- Realm integration exercises complete cycles for all four visits, the two-car
  cap, nonoverlapping bodies, mutually exclusive aisle/crossing ownership, every
  phase across save/reload and obstruction stop/resume.
- Canvas/GPU browser checks exercise native Worker trips, frozen pose reload,
  completed trips, phone width and returning to static layout previews.
- Typechecks, production build and lint pass (119 existing warnings / 34 infos).
  The full unit run passes 2,640 cases; an additional three-aisle global-cap test
  also passes in the focused 51-case parking/serialization run.
- Streaming readiness benchmark passes. The generated manifest verifies all 815
  candidates in normal Chromium at retina scale. Three static parking candidates
  remain byte-for-byte unchanged. The shared runtime changes renew 170 existing
  live behavior fingerprints (152 nature, 12 geometry, six character); no frozen
  art pixels, approved banks or review events were rewritten.
- Public preview loads the current shopping-trip view without browser errors;
  its manifest is byte-identical to the generated file. Temporary browser probes
  use bundled Chromium and close their own processes.
- Full browser run: 636 passed, two failed (638 total, 26.2 minutes). All four
  parking tests pass, covering the static previews and both live renderers.
  The existing `authored-train.spec.ts:11` failure again observes an empty transient
  carriage list while switching backends, as recorded in 131. The ordinary GPU
  driving check in `vehicle-driving.spec.ts:74` timed out with zero displacement
  after a tap; it passes unchanged on an isolated immediate rerun (5.8 seconds).
  Canvas, mesh driving and the parking cycle pass. This is not a clean full-suite
  pass; investigating those broader timing/scene failures remains separate work.
- The source tree passes `git diff --check`. Test preview servers and owned browser
  probes are closed; the owner's development server remains available.

Next: inspect the shopping animation, then connect an approved lot composition
to selected town shopping centers and normal road traffic.

## Phone slowdown follow-up (2026-10-18)

The owner reported roughly 1 FPS in the live lab. The original correctness,
phone-width and pixel checks did not measure physical phone pacing. The lot's
roughly 5,000 pavement/paint crops were grouped only as simulation props: the
collector expanded them back into individual sorted sprites and Canvas image,
save and restore operations every frame. A main-thread CPU profile attributes
most samples to Canvas restore; bounded shopping authority is not the dominant
cost in that capture.

Shared `collectScene` now retains large multipart props through semantic scene
submission. `RasterRenderBackend` owns static composites for both Canvas and GPU;
the game and all scenario labs use this same path. Actors remain separate, live
native bodies. Stationary snapped views reuse projected composites, while moving
views draw their original pieces until settled. Slab ordering and frameless art
references retain independent parts. Immutable crop identity, placement/height,
source identity and view qualify reuse; retention is capped at 128 entries and
16 MiB including scratch, with 120-frame expiry and explicit asset/reset/disposal
cleanup. Shared recipe arrays at different placements retain separate entries.
The parking canvas exposes the ordinary host diagnostics for measurement.

A striped-texture comparison caught nearest-neighbor texel ties changing when a
crop is rasterized at a local origin. The cache now draws original absolute screen
rectangles into a bounded scratch surface before cropping. Thirty-two Canvas/GPU
comparisons across four fractional zooms and four camera positions match the
independent original Canvas draws exactly. Additional checks cover array edits,
shared-array placement reuse, moving-view fallback, unchanged warm builds, capacity,
source replacement, recovery, expiry and disposal. GPU's moving fallback retains
its existing native sprite sampling; the cached comparison qualifies static imagery.

Follow-up validation: typechecks, all 2,642 unit tests, lint (119 existing warnings /
34 infos), inventories and production build pass. All 29 renderer/Traffic/parking
browser cases pass, plus two ordinary forest/game handoff cases on Canvas/GPU.
The shopping checks cover complete trips, two-car admission, frozen reload,
phone controls and returning to static layouts; all three static review pixel
identities still match. Streaming readiness passes. No approved source bank or
human feedback event was changed. The configured Android testbed is unavailable,
so desktop CPU throttling below is not a physical phone FPS claim. Public preview
serves the new cache; owned browser probes and temporary preview servers are closed.

[Sanitized timing evidence](../benchmarks/132-parking-cache.json) records the source
hashes, bundled Chromium version, viewport and resource counters. Apple M4 Pro,
production build, 390×844 CSS viewport with the lot scrolled into view, 4× CPU
throttle and five-second capture:

| Lane | Callback cadence | Median / p95 | Static cache builds during capture |
| --- | --- | --- | --- |
| Original Canvas profile, after readiness | 35 callbacks / ~5 s | 166.6 / 166.7 ms | No cache |
| Cached Canvas, 10 s settling | ~60 FPS | 16.7 / 16.8 ms | 0 |
| Cached GPU, 10 s settling | ~60 FPS | 16.7 / 16.8 ms | 0 |

Canvas image operations fall from roughly 5,047 per callback in the initial profile
to 107 per callback in the settled sample. Twenty composites retain 5,379,628 bytes
including scratch. Both final lanes advance authority by 301 ticks during capture
with no page errors. The initial profile is attribution evidence, not a paired
steady-state ABBA run; these desktop results do not guarantee a phone frame rate.

Next: refresh and check the lab on the owner's phone, then continue the separately
planned shopping-center/ordinary-traffic integration.
