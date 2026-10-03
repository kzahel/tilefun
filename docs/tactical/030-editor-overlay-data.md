# 030 — Editor overlay data

Status: delivered. Parent: [022](022-renderer-backend-decoupling.md), remaining R1.
Depends on [029](029-outdoor-frame-contract.md).

## Inspected scope

`EditorRenderer.ts` calculates brush/grid/pattern/room/remote-cursor geometry while
mutating Canvas state and reading sprite images. Only `EditScene` calls these
functions. Replace them with pooled, explicit screen-space geometry records and
resource IDs. The Canvas backend interprets geometry, without editor models or
world access. This is a semantic overlay pass, not a saved sequence of Canvas
state changes. Preserve grid, tint, brush, preview and remote-cursor order.

Keep coordinate rounding, line overlap/compositing, sprite source rectangles,
alpha and text alignment unchanged. No new atlas/pixels or gameplay rules.
Overlay buffers belong to the client, are borrowed synchronously and released
after submission; cap retained geometry and clear strings/IDs on release.

## Acceptance and validation

Cover each brush family, room and pattern previews (including errors), remote
cursor labels and indoor/outdoor phase order. Verify warm record reuse, bounded
retention and no Canvas/image reference in outputs. Run typechecks, unit tests,
lint, art catalog then manifest, build and full browser checks. Existing editor,
mobile and screenshot tests validate the integrated path. R1 completes only
when this and 029 are delivered, with evidence recorded in the parent.

## Evidence

Typechecks, all 1,409 unit tests, lint (existing warnings), catalog/manifest,
production build and all 293 browser tests pass. All 551 review candidate records
remain unchanged. The old Canvas-based `EditorRenderer` is removed.

Before removal, compared effective draw operations against the original at
`d613cfd` for 16 scenarios: positive/erase/bridge, subgrid sizes 1–3, cross/X,
corner/erase, elevation, props, room/pattern previews and their error displays.
Every comparison includes remote cursors, non-integer camera position/scale,
styles, source geometry and text alignment. The regression tests retain those
original operation hashes; they do not regenerate expected output.

`OverlayFrame` reuses up to 2,048 geometry records, clears labels and resource
keys after consumption, and shrinks retained records after sustained underuse.
Production editor submission uses the backend interface and releases borrowed
geometry in a finally block. Indoor overlays retain their after-actors phase;
outdoor overlays remain between terrain and actors. This finishes R1's overlay
portion; indoor room data and full backend lifecycle remain R2/R4.
