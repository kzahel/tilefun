# Outdoor Geometry presentation host

Date: 2026-10-04. Owner: [embedded engine labs](../topics/embedded-engine-labs.md).

## Scope and delivery

Migrate `OutdoorGeometryTest` from its variable-step rAF loop and directly created
Canvas backend to `ScenarioPresentationHost`. The lab already used production
scenario authority; presentation now also uses the production fixed clock,
prediction history, scene collector, ordering and selectable Canvas/GPU host.
Both candidate props and the walker are rendered from the replicated world.

The host exposes fixed camera coordinates, optional terrain, a scoped asset loader,
pixel-exact shadows and semantic underlay/overlay hooks. The default Traffic policy
is unchanged. Geometry retains its diagnostic grid, anchor, depth, footprint and
collider outlines. Grid lines replace redundant per-cell rectangle strokes.
Walker outlines interpolate using the same function and prediction history as the
scene collector. Position commands preserve the fixed camera.

Each mount owns its character bitmap, frame storage, renderer and Worker. Asset
failure and late arrival respect host disposal. The catalog's HTML source image
is borrowed and survives teardown. This removes a pre-existing overwritten cleanup
callback that disposed the scenario but leaked its renderer. Blur and visibility
changes clear held input; metadata changes create a new scenario; teleport resets
the walker without creating a second host.

## Evidence

- Unit coverage: fixed framing across ticks and position commands, underlay/scene/
  overlay ordering, custom asset ownership and shared predicted pose interpolation.
- Full Chromium browser coverage in `tests/outdoor-presentation.spec.ts`: Canvas
  and GPU mesh selection, production collision, fixed framing, reset, blur release,
  repeated metadata edits and close/reopen, one live Worker, bounded GPU surfaces,
  phone viewport alignment and pixelated GPU canvas scaling. Select the fixture by
  stable asset ID: other review tests intentionally change its display name.
  Existing outdoor catalog/correction tests also pass.
- Captured and inspected the interactive Canvas/GPU fixtures. These captures are
  diagnostic evidence, not new approval references.
- Typechecks, lint and all 1,454 unit tests pass. Lint retains existing repository
  warnings; the changed TypeScript files have no diagnostics.
- `art:catalog` and `workshop:manifest` regeneration verify all 552 candidate
  identities unchanged, including full Chromium at retina scale. Only source
  provenance and input digests change; no approvals or snapshots are synthesized.
- `streaming:bench -- --assert-ready` passes the current-generator Canvas traversal
  on headless Chromium/macOS arm64: cold, standing, walk, sprint, reverse and
  zoom-out finish with zero missing, incomplete or stale terrain. This run checks
  readiness, not isolated performance.
- Final `npm run build && npx playwright test`: all 308 browser tests pass,
  including the renamed-fixture ordering regression and the final GPU scaling fix.

## Limits and next work

This establishes shared presentation and lifecycle behavior, not an FPS improvement
claim. GPU diagnostics use the existing raster overlay adapter; grid and foreground
overlays may still cause texture uploads. Performance work should measure this
fixture before changing overlay caching. Frozen reference renderers remain separate.

Next migrate `CharactersPage` interactive presentation, keeping its source-hashed
approval renderer and review identity contract intact. Indoor playtests need a
separate shared room adapter after that.
