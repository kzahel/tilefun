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

## Follow-on boundary

Review this proof before extending it. Next decide how a passage replaces the
terrain's blocking base and how connected interior floors relate to current
per-floor realms. The two-storey garage remains the next broader design exercise.
Train articulation/grades, NPC navigation, balls, general editor authoring, full
sector visibility, renderer depth integration and chunk-boundary structures are
not established by this first player fixture.
