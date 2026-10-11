# 109: Match the blue car body to its authored cameras

Status: complete. Date: 2026-10-11. Owners: [rendering](../topics/rendering-architecture.md),
[3D assets](../topics/3d-assets.md).

## Problem and correction

The owner reported a tall car when switching from sprites to the authored model.
The first integration used the generic game-local screen mapping `x, y-z` for
model vertices. Its native front/rear blue body was 22 pixels wide versus the
sprite's 30; one front view was 60 pixels tall versus 56. The taller, narrower
appearance was reproducible in the renderer comparison without camera motion.

The retained `compact-final-setup.json` uses a 42-degree side lens with horizontal
scale 1.04/vertical stretch 1.21, and a 70-degree front/rear lens with horizontal
scale 1.3/vertical stretch 0.8186. Shared `CarMeshProjection` now uses those metrics
for the authored body only. Squared ground-forward Y blends the projected axis
coefficients continuously through turns, including cardinal/frame boundaries.
Pitch/roll still rotate model vertices; pitch does not change the heading lens.
The depth axis stays perpendicular to the screen vertical axis for each blend.

World camera, anchor/height projection, input picking, sprite modes, GLB bytes,
wheel transforms, physics, prediction, collision and persistence remain unchanged.
Game, Traffic and renderer comparison all use the corrected shared body path.
This is optional presentation inspection, not a new art approval.

## Evidence and validation

Matched full Chromium blue-paint extents at native 3x enlargement:

| Heading | Sprite W × H | Before W × H | Corrected W × H |
| --- | --- | --- | --- |
| Right | 183 × 105 | 168 × 111 | 174 × 96 |
| Down | 90 × 168 | 66 × 180 | 84 × 165 |
| Left | 183 × 105 | 168 × 111 | 174 × 96 |
| Up | 90 × 165 | 66 × 165 | 84 × 162 |

These measure visible blue body paint, excluding transparent sprite padding,
background, marker, fixture and baked shadow. Geometry/paint differs from the
sprite, so this is a proportion check rather than pixel equality. The new browser
regression compares width, height and aspect within 12% on all four headings at
zoom 0.5/1; the original 27% front/rear width deficit fails this boundary.
Unit checks independently read the tracked camera preset, cover ground anchor,
axis metrics, heading-wrap/frame continuity, pitched turns and vertical poses.

[Corrected sprite/model comparison](/tmp/tilefun-blue-car-proportions.png).
The normal-game blue-car check also passes boarding, rolling wheels, tap driving,
stop, save/reload inside and exit. [Corrected game capture](/tmp/tilefun-driving-car-gpu&meshes.png).

All three typechecks, 2,373 unit tests in 246 files and lint pass (118 existing
warnings/34 infos). Production build passes. All 545 browser checks pass in
22.1 minutes, including all GPU renderer checks, Traffic, model loading/fallback,
live renderer selection, graphics recovery and normal-game blue-car driving.
Catalog generation retains 245 sheets/1,086 uses. All 761 Workshop identities
verify in normal full Chromium at retina scale; candidate fingerprints are unchanged,
with only the broad input digest refreshed.

Validation covers this projection correction against the prior gameplay renderer.
Separate concurrent renderer-default/XR work in the shared checkout is not part
of this change or these results.

## Next step

Review ordinary game turns and roof contacts with the corrected body lens, then
qualify front-wheel steering clearance and measure desktop/phone GPU costs.
