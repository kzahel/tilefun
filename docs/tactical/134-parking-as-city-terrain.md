# 134 — Parking as city terrain

Owner request (2026-10-18): remove the parking composite cache, make parking part
of normal city planning, align or remove the separate playable fixture, and commit.

## Delivered architecture

- Regional `ParkingLayout` owns the source-backed shopping layout; the district
  planner writes 84 ordinary 16px cell patterns into roadGrid IDs 79–162. Existing
  IDs and the Uint8 persistence/wire representation are unchanged.
- `TileRenderer` composes pavement, transparent bay paint, crossings, curbs and
  island ground into existing native terrain chunks. Panning, zooming and resize
  reuse those chunks. Normal content/source/lifecycle invalidation still applies.
- Twenty ordinary object props per center remain (shops, trees, carts, pay station).
  Pavement props and camera-dependent `StaticSpriteCache`/probe/hooks are removed.
  Saved retired pavement IDs 20–39 reconstruct inert objects, not crop arrays.
- Existing explored terrain is not migrated. Fresh generation uses the new cells;
  old saved centers lose their obsolete overlay and retain their saved underlying
  terrain. Development worlds are disposable; no automatic world rewrite is added.
- Both playable parking URLs use `CityParkingRecipe`, production city generation,
  native parked-car population and one staged incoming road car. The recipe opts
  into normal traffic population rather than the staged-fixture spawn suppression.
  Shared road
  admission, car/shopper collision, saved visits and departure remain unchanged.
  The authored recipe is retained only for headless simulation tests.
- Static parking pattern studies and promoted banks remain independent and immutable.
  No parking-specific screen cache replaces the removed cache under another name.

## Evidence

Before: 4× CPU-throttled bundled Chromium, 390×844 CSS viewport, zoom 0.1,
five-second moving main-game samples measured about 20 FPS with screen composites,
versus 44 FPS bypassing them with native vehicle meshes retained. Around 536
composites were rebuilt per sample. Unthrottled desktop samples at zoom 0.5 and
0.25 were around 60 FPS, so the owner's exact desktop slowdown was not reproduced.
These are diagnostic desktop samples, not physical phone results.

Replacement: [raw summaries](../benchmarks/134-parking-terrain-2026-10-18.json)
record about 60 FPS stationary and moving at desktop 1280×900, zoom 0.5/0.25.
At 390×844, 4× CPU throttling, zoom 0.1, native meshes retained, both samples also
held about 60 FPS; moving render p95 was 9.7ms. The previous matching moving
sample was about 20 FPS with the cache. This is one short diagnostic comparison,
not a physical phone or all-city guarantee. New chunks streaming into view still
perform ordinary terrain rows/uploads; stationary warm terrain built zero rows
(and the throttled sample made zero uploads). Camera movement never rebuilds
parking screen composites because that path no longer exists.

Typechecking, 2,648 units, lint (existing warnings), art catalog, Workshop manifest
and production build pass. Three static parking render fingerprints match HEAD
exactly; source revisions correctly change after the move. Native cell tests cover
source-layer clipping, saved road-grid round trips, inert retired props and stable
terrain resource identities through pan/zoom/1280–3840px resize.

The affected 32-browser suite passes (shared GPU/Canvas rendering, terrain pacing,
traffic lifecycle, parking visits and exact static patterns). After enabling normal
lab population, all four parking integration checks pass again against the final
build, including Canvas/GPU shopper cycles, 18 generated parked cars plus the visitor,
paused save/reload, default 3D cars and the ordinary main-game handoff. All three
static pattern pixels also pass the final-build browser comparison. Road-car pose
checks retain saved position/heading; ordinary ambient car animation restarts on
the next authority tick. Pausing still freezes the exact live animation payload.
Settled Canvas/GPU/default-3D screenshots were inspected: complete chunk terrain,
normal parked cars and a visible shopper alongside its car.

`npm run streaming:bench -- --assert-ready` passes: cold, standing, walk, sprint,
reverse and zoom-out end with zero missing, incomplete or stale terrain. This is
readiness evidence, separate from the parking frame-cadence measurements above.
The benchmark/manifest tools retain their isolated Vite cache directories from
46a13b5; the owner's live server remains running. Fresh bundled Chromium checks
of the public live origin pass after these tools: the lab has 19 compact cars,
GPU mesh draws, zero pending terrain rows and no script/5xx errors or special
sprite cache. A new main-game world has 3,136 visible parking cells, no compound
pavement props, settled terrain and no script errors.

Next: owner desktop playtest while panning through a fresh generated city at the
reported zoom; physical phone measurement remains separate evidence.
