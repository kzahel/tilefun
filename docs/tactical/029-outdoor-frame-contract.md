# 029 — Outdoor frame contract and explicit draw ordering

Status: delivered (outdoor terrain/actors; editor follow-up remains). Parent: [022](022-renderer-backend-decoupling.md), R1.

## Inspected coupling

`scenes/renderWorld.ts` clears the canvas and invokes concrete terrain and scene
renderers. `EditScene.render` inserts editor overlays between those calls.
`TileRenderer.drawTerrain` mixes resource preparation/fallback selection with
placement and drawing. `Canvas2DRenderer` chooses shadow ordering internally.
The existing `SceneFrame` pools collection state, but is not the full backend
submission contract. Metadata prerequisite: [028](028-sprite-metadata.md).

## Delivery

Introduce semantic, data-only rendering passes and an explicit synchronous
submission interface. Camera/view parameters, terrain resource placements,
ordered scene/shadow entries and overlay geometry must contain no images,
contexts, world mutation or callbacks. Keep static resource preparation separate
from submitting those dynamic passes. Use existing Canvas resource caches and
preserve their readiness budgets and fallback behavior.

Extract shadow/main-item ordering into shared presentation code so a second
backend does not rediscover ground/elevated shadow rules. Preserve native review
shadow rendering and equal-depth order. Use retained buffers for scene commands;
release references after submission and bound retained capacity after large views.

Migrate production outdoor terrain and actors in this slice, preserving
clear → terrain → outdoor editor → actors ordering. Editor overlay data emission
is a separate following child because it has its own brush/room/cursor cases;
R1 remains incomplete until that migration passes. Indoor
editing continues to draw overlays after the indoor scene. Indoor callbacks and
full consumer/lifecycle migration remain explicit R2/R4 work. If the overlay
migration needs its own child, record the split and leave R1 incomplete.

## Validation

Contract tests exercise mixed scene ordering, hidden and elevated shadows,
resource expiry, camera-only reuse, exception cleanup and independent storage.
Compare terrain fallback, culling and seam overscan with the current behavior.
Use typechecks, all unit tests and lint; regenerate art catalog then manifest,
verify candidate fingerprints, build and run full Playwright checks. Run traversal
readiness for changes to terrain preparation/execution. Record actual evidence
before declaring the slice done.

## Evidence

Typechecks, all 1,392 unit tests, lint (existing warnings), catalog/manifest,
production build and all 293 browser tests pass. All 551 candidate records match
the previous manifest, including GPU/native review parity.

The production `renderWorld`/`renderEntities` path now submits `RenderPass`
records through `RenderBackend`. Shared `collectSceneOrder` encodes ground and
inline elevated shadows; Canvas consumes that explicit order. A recording test
runs these entry points without a Canvas, including submission-failure cleanup.
Terrain placement records reuse a bounded 2,048-record pool. Partial surfaces
have expiring resource IDs as well as completed surfaces; tests cover rebuild,
replacement, publication and reset retirement. Existing terrain budgets and
fallback imagery are preserved.

[Traversal readiness](../benchmarks/029-outdoor-frame.json) passes for regional-v4
and v10 walking, sprinting and reverse travel with zero visible gaps/unfinished
frames. Cold entry still shows the documented data/cache catch-up; that separate
performance work is not fixed here. The browser suite overlapped part of traversal,
so this run is a coverage check, not a timing comparison.

Remaining: editor geometry (030), indoor data, full lifecycle/consumer migration,
and moving terrain placement policy out of the concrete cache implementation.
The latter is required before declaring the final backend boundary complete.
