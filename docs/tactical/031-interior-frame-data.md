# 031 — Interior frame data and owned room resources

Status: delivered. Parent: [022](022-renderer-backend-decoupling.md), R2.

## Inspected coupling

`renderInterior.ts` holds a module-global Canvas renderer/atlas and creates one
closure per actor per frame. `CachedInteriorRenderer` caches native floor/wall
images and wall-band callbacks; `FurnishedInterior` mixes pure layout/order rules
with Canvas drawing. Review and furniture playtest callers use the same callback
shape. Preserve furniture/support groups, wall-band IDs and tie ordering, content
Y offsets, native coordinates, shadow placement and exact source rectangles.

## Delivery plan

Extract furniture compilation/order/signature/preparation into a neutral module.
Introduce a client-owned interior presentation cache: static room content identity,
compiled furniture geometry and reusable dynamic actor commands. It emits ordered
floor, walls, wall-band, furniture, shadow and actor data without images/callbacks.
Separate static content preparation from frame submission on `RenderBackend`.
Canvas owns rasterized room resources; room/asset changes and teardown discard
only that backend's resources. Remove module-global gameplay caches.

Use the same ordering rules for production, review and playtest actors, replacing
actor callbacks with data. Keep Canvas review composition adapters only where
needed to preserve existing hashing/context behavior; full consumer assembly
migration belongs to R4. Any remaining adapter must call the shared presentation
rules and have an explicit removal/migration record, not duplicate ordering.

## Validation

Tests cover actor/furniture/wall ties, support groups, content offsets, room and
asset replacement, independent clients, stale content and reusable/released actor
storage. Prove an indoor frame can be collected/submitted with a recording backend
and no DOM. Run typechecks, all unit tests, lint, catalog/manifest, build and full
browser suite; verify exact candidate identities. Run indoor cache parity and
ordinary/edited-room gameplay runners. Preserve original references; investigate
any changed pixels rather than accepting new art identities for this refactor.

## Evidence

Typechecks, all 1,412 unit tests, lint (existing warnings), catalog/manifest,
production build and all 293 browser tests pass. All 551 review candidate records
are unchanged. [Interior evidence](../benchmarks/031-interior-frame.json) records
81 exact pre/post-refactor pixel hashes across rooms, furniture edits, actor
depths and scales, plus ordinary/edited-room gameplay and return-to-street checks.
Cached drawing retains five image draws per reference frame; no phone-wide FPS
claim follows from these local fixtures.

`FurnitureLayout` and room-map data contain no Canvas drawing. `InteriorPresentation`
creates ordered, borrowed commands; per-client SceneFrame owns its lifetime.
`CanvasInteriorResources` owns the rasterized shell and wall bands. Backend asset
replacement, realm reset and teardown clear room resources along with terrain.
Tests exercise real indoor orchestration without a DOM, independent clients,
static reuse, stale/reset content rejection and released actor references.

All actor draw callbacks are removed, including playtest/benchmark callers.
Native review and uncached reference adapters remain Canvas composition code;
they use shared layout/order rules and neutral actor data. R4 migrates the
remaining consumer assembly/lifecycle; R5 removes unnecessary compatibility
exports and audits the completed boundary.
