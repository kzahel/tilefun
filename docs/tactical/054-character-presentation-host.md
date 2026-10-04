# Interactive character presentation host

Date: 2026-10-04. Owner: [embedded engine labs](../topics/embedded-engine-labs.md).
Character controls/reviews: [characters](../topics/characters.md).

## Delivered boundary

`CharactersPage` no longer owns a rAF accumulator, copies predicted actors into a
local scene or uses `CharacterTestScene` for interactive drawing. It creates a
`ScenarioPresentationHost` over the existing character recipe. Movement, prediction
history, scene collection, depth ordering, Canvas/GPU configuration and lifecycle
use the shared engine path. Candidate settings remain scoped to that Worker.

The host adds live viewport resize, diagnostic background color and explicit
four-direction pose cycling. Resize preserves the Worker and camera framing.
Inspection pauses authority, advances on the shared visible clock and overrides
only a presentation copy of the sprite; it cannot alter replica/predictor poses.
Leaving inspection clears held input and restores normal gameplay animation.

The page owns controls and verification, plus backend-neutral grid, label and
geometry overlays. Ground/height overlays follow interpolated body position and
height. Settings recreate the session; character switches dispose it; zoom does
neither. Verified HTML images and generated fixture canvases are borrowed through
an independently owned asset map, so retiring one host cannot clear the next host's
images. Late verification results cannot revive an unmounted view.

## Approval boundary

`CharacterTestScene`, `CharacterRecipe`, the fingerprint formula, authored PNGs and
`approved-v1.json` are unchanged. `buildCharacterCandidate` still verifies the same
sixteen reference poses before enabling reviews. It now also returns the verified
fixture sheets for the interactive host, avoiding another fixture-art generator.
Interactive diagnostics are not claimed to be immutable approval captures.

The live inbox was read before this work: six character candidates were marked
changed, with no active Needs changes reports. This migration does not synthesize
approvals or act on art fixes. Saved decisions remain attached to their exact
candidate/settings identities.

## Validation

An isolated source snapshot excludes concurrent unrelated renderer edits. Its
Playwright copy uses a separate preview port and matching auth helper; test
assertions and application code are unchanged by that test isolation.

Typechecks, lint, all 1,464 unit tests and production build pass. Lint retains the
existing repository warnings. Catalog/manifest regeneration verifies all 553
candidate identities unchanged, including the six characters, in headless-shell
and full Chromium at retina scale. The original reference renderer, recipes,
authored images and promoted bank are unchanged.

`streaming:bench -- --assert-ready` passes on headless Chromium/macOS arm64: cold,
standing, walk, sprint, reverse and zoom-out finish with no missing, incomplete or
stale terrain. This is readiness evidence, not an isolated frame-rate comparison.

The isolated full browser suite passes 313 tests; one source-atlas capture skips
because that optional original source pack is absent from the snapshot. Coverage
includes presentation-only cycling/resumption and resizing without Worker
replacement, plus full Chromium Canvas/GPU movement, fixed camera,
zoom, settings/character changes, phone scrolling and disposal. Existing tests
cover jumps, directional animation, touch, saved drafts, offline feedback, review
pausing and rejection of mismatched candidate fingerprints. The concurrent surface
fix subsequently landed as `49035da`; the character overlay now consumes its shared
height-interpolation helper. The final integrated typecheck, lint, production
build and all 1,474 unit tests pass. All 19 targeted browser tests pass across
Character, Outdoor Geometry, World Geometry and Traffic, including Canvas/GPU
paths, review rejection, interpolation, context recovery and disposal. Regenerated
inventories again preserve all 553 candidate records relative to that integrated
base. Canvas/GPU captures were inspected; no review artifacts were rewritten.

## Limits and next work

This is shared engine presentation and lifecycle evidence, not an FPS claim.
Diagnostic overlays still use the existing GPU raster-overlay path. Next extract
the indoor presentation adapter for `interiors/playtest/main.ts`, keeping immutable
furniture approval images separate from its interactive host.
