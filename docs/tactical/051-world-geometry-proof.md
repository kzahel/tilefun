# 051 — First world geometry engine proof

Date: 2026-10-04. Owner: [world geometry](../topics/world-geometry.md).
Status: implemented and validated; ready for user review.

## Scope and design

The user authorized the proposed first slice: a shared-engine ramp, raised deck
and passage underneath, reviewed in a standalone lab before world generation.
The fixture is tile-aligned and deliberately schematic. It adds no world generator,
promoted artwork, terrain excavation or indoor realm migration.

The first query model is a rectangular planar surface with a constant vertical
thickness. Footprint queries return minimum/maximum top and underside heights;
movement uses maximum support height and minimum headroom across the overlap.
This keeps an upright actor clear of the whole slope. Directional rise supports
either horizontal axis; the first visual fixture rises eastward. Ground retains
the existing terrain contract. A surface may carry stable space/neighbor IDs,
but collision follows actual geometry rather than an artificial level switch.

An optional `PropCollider.surface` transports this data through the existing
production prop path. It replaces that collider's legacy Z-box semantics and is
validated at scenario creation. Ordinary props keep their previous behavior.
This adapter keeps the proof bounded without deciding the eventual terrain schema.

Horizontal motion allows a supported step onto a nearby plane, then checks all
slabs at the proposed foot height for clearance. Falling may land only on a surface
that was below the previous foot height; upward motion clips to the first slab
underside. Both authority and prediction call these shared functions.

Reload testing exposed missing vertical player persistence. `SavedPlayerData`
now includes optional `wz`, `groundZ`, `jumpVZ`; old records still load. Explicit
door/world arrivals reset vertical motion at their destination. Existing mount
and moving-roof restoration retain their more specific placement behavior.

## Lab and presentation

[World geometry lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/world-geometry)
uses `ScenarioPresentationHost`, real Worker authority, normal packet replication
and `PlayerPredictor`. Reset and memory save/reload stay isolated from player worlds.
Keyboard and touch controls exercise ordinary movement; start buttons are authority
teleports to the ramp, deck and passage. Pause and view selection are host controls.

`SurfacePresentation` emits schematic backend-neutral overlays before/after the
replicated actor scene. The production outdoor scene and lab both call it.
Automatic cutaway hides a patch above the observer's occupied footprint; manual
views show the lower passage, upper surfaces or everything. It changes no physical
state. Whole-patch hiding and observer-relative ordering are a bounded diagnostic,
not general portal rendering, stacked multi-actor occlusion or final building art.
The shared scene collector projects actor shadows onto the highest slab beneath
their feet, preserving ground shadows for actors below the same slab.

Register the tool, batch and source-hashed experiment candidate. The candidate is
explicitly excluded from immutable art approval, like the car projection study;
no human verdicts are created. Rebuild ordinary inventories, never promoted banks.

## Acceptance and evidence

- Headless production Realm: continuous ramp ascent/descent and deck join;
  stepping off an edge; passage below; jump into underside; low headroom;
  save/reload on the slope, deck and below; normal binary replica/predictor parity.
- Query checks: overlap extrema with signed slopes and invalid patch rejection.
- Browser: Canvas/full Chromium GPU, real Worker movement, view selection without
  physical changes, reload/reset, phone layout/touch release and Worker disposal.
- Required gates: typechecks, full unit/lint, art catalog then manifest, production
  build and full Playwright suite. Record results below after completion.

2026-10-04 validation: typechecks and lint pass (existing warnings remain);
all 1,462 unit tests in 172 files pass with two workers. An earlier broad parallel
run timed out one existing furniture test; focused rerun and the final full run
pass. Both inventories rebuild, with 553 Workshop candidates verified in normal
Chromium at retina scale; production build passes. The initial three geometry
browser checks passed for Canvas, GPU and phone controls. The final 311-test
browser run passed 310 and found one stale tools-index count (22 rather than 23).
Updated that count, added an explicit World geometry card assertion, and all
three tools-index tests passed on rerun. No application changes followed the
full browser run. Inspected desktop Canvas/GPU cutaway and phone screenshots;
the player's deck shadow now follows the shared surface.

`npm run streaming:bench -- --assert-ready` also passes on the current generator:
cold, standing, walking, sprinting, reverse and zoom-out samples all recorded zero
missing-data or incomplete-cache frames. This is readiness evidence, not a new
performance comparison or evidence for generated multilevel terrain.

## Mobile control follow-up (2026-10-04)

Lab buttons now suppress context menus, selection and WebKit touch callouts;
movement pointer-down also prevents default focus/selection behavior. The phone
regression uses Chromium touch input held beyond the long-press threshold, checks
continued movement and release/cancellation, and verifies ordinary tap and
keyboard activation of scene controls. Native iOS callouts are covered by CSS,
not a physical-device test. Typechecks, all 1,462 unit tests, inventories, build
and the three geometry browser tests pass. The full browser suite passes all 311
tests. Repository-wide lint passes with existing warnings.

## Projected cutaway follow-up (2026-10-04)

Replaced ground-footprint reveal with fixed-projection sprite/slab overlap. The
slab silhouette is clipped to the sprite's X interval before its projected north
edge and south fascia are compared; this avoids the false positives from a whole
ramp bounding box. Supported actors keep their floor visible and behind them,
using the same 1px tolerance in both decisions. Previously the cutaway tolerated
1px but draw order used a strict height comparison, allowing float noise to put
a visible ramp over its rider. Shared XY/Z interpolation now drives both the
actor and the surface policy in game and scenario rendering.

This remains whole-patch hiding with conservative sprite-frame bounds, not an
opaque-pixel mask, soft fade or general stacked-actor depth solution. Unit
regressions cover north/south coverage, fascia-only coverage, slopes, visual
offsets, manual modes, support noise and interpolated poses. Browser regressions
compare rendered player pixels with the unobstructed lower view in Canvas and
GPU modes, and require automatic/all views to match when the lower actor is
already visible near the south edge.

Validation: shared-checkout typechecks, 1,474 unit tests, lint (existing warnings),
catalog/manifest, production build and all 316 browser tests pass. Inspected north
and south screenshots in Canvas and GPU. The commit's source-only snapshot also
regenerates both inventories and builds independently of concurrent character-lab
changes; no approved art pixels or promotions changed.

## Ramp boundary follow-up (2026-10-04)

Reproduced both reported one-frame artifacts in regression tests before changing
the implementation. When the sprite overlapped the low ramp entrance but its feet
collider did not, draw ordering incorrectly used the whole ramp's maximum height.
It now samples the nearby edge, retaining exact local support heights when the
feet overlap. Shadows now use the same 1px support tolerance as surface ordering
and clamp their height to the displayed feet. This avoids dropping to ground at
the ramp/deck join when interpolation puts feet a fraction below the physical top.
Tests cover the entrance at multiple interpolation fractions, opposite slope
directions, both directions across the top join, and shadows staying below the
deck for actors in the lower passage. Player-centered/growing cutaway holes remain
deferred as requested; collision and simulation are unchanged.

Validation: typechecks, all 1,480 unit tests, lint (existing warnings), rebuilt
catalog/manifest, production build and all 317 browser tests pass. The only
candidate identity change is the excluded World geometry engine experiment;
approved art and promotions are unchanged.

## Follow-on boundary

Review this proof before extending it. Next decide how a passage replaces the
terrain's blocking base and how connected interior floors relate to current
per-floor realms. The two-storey garage remains the next broader design exercise.
Train articulation/grades, NPC navigation, balls, general editor authoring, full
sector visibility, renderer depth integration and chunk-boundary structures are
not established by this first player fixture.
