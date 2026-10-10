# 098 — Reusable sprite-matched Blender authoring

Owner: [3D assets](../topics/3d-assets.md). Started: 2026-10-10.
Status: Shared offline workflow delivered; fidelity-qualified family templates open.

The owner wants a repeatable process for all vehicles, potentially other assets,
while preserving the quality of the original sprites. This replaces the next-step
idea of polishing one car with an unrecorded sequence of bespoke adjustments.
097 remains the immutable authored starting point, not accepted production art.

## Delivered process

[`scripts/authored-assets/`](../../scripts/authored-assets/README.md) supplies:

- Source-bank extraction for all 45 vehicles / 180 directional views, preserving
  exact RGBA, facing names, source approvals, anchors and physical metadata.
- A generic asset specification; the existing picnic-table sprite exercises that
  adapter without constructing or claiming a table model.
- Per-asset workspaces with frozen references, editable camera/landmark recipes
  and optional copied Blender templates. Existing output directories are refused.
- Fixed-azimuth affine camera fitting from world/source-pixel correspondences,
  with residuals and rank/facing checks. Camera hypotheses remain explicit.
- Visibility-tested UV projection of original pixels into an authored atlas,
  with separate unseen/overlapping-UV/source-color-conflict statuses. Sampling
  uses the most face-on visible view and never blends conflicting paint.
- Separate optional retention of existing authored paint in unknown/shared UV
  regions. That fill never changes observed coverage counts.
- Flat painted-color inspection with native pixel sampling, original/render
  sheets, overlays, difference maps, silhouette/color measurements, four novel
  angles, packed Blender files, GLB exports and hashes of each immutable run.

The source camera mapping is shared between fitting, texture projection and
image alignment. It is an authoring hypothesis, not a new game projection.
Blender runs in isolated background processes; the user's open scene is untouched.
All generated evidence stays local under ignored `data/authored-assets/`.
No game assets, collision metadata, review decisions or registered 097 bytes change.

## Reuse evidence and fidelity limits

The same setup, projection and evaluation commands process compact-1 and
compact-2 with the same authored geometry/UVs and each variant's own original
sprite pixels. This confirms palette-variant reuse, not support for every vehicle
shape. Source extraction also verifies all 180 crops pixel-for-pixel against the
declared atlas. A fresh recipe adapter freezes the existing picnic-table image.

Compact-1 retains the original mesh silhouette: overlap is about 0.82 on side
views and 0.90–0.91 on longitudinal views, including source shadows. With source
projection plus explicitly retained authored fill, RGB mean error on opaque
overlap drops from 43/43/40/36 to 27/27/17/15 in east/west/north/south. Geometry is
unchanged, so silhouette scores do not improve. These are diagnostic observations;
no acceptance threshold or human approval is inferred. Missing outlines/details,
camera contradictions, body shape and novel-angle texture continuity remain open.

The draft flags 13,312 overlapping UV texels, chiefly shared surface mappings,
and 65,818 texels with disagreeing source colors. UV texel counts are not surface
coverage. Orange/pink diagnostic pixels are retained in the raw draft; a separate
filled draft uses existing authored paint there. Both retain the same coverage map.
Correct the UV layout and landmark registration before treating that paint as clean.

Local evidence:

- `data/authored-assets/086-compact-1/runs/unlit-001/` — authored-paint baseline.
- `data/authored-assets/086-compact-1/projections/draft-003/` — raw projection,
  coverage and separately retained authored fill.
- `data/authored-assets/086-compact-1/runs/projected-filled-002/` — source-pixel
  transfer inspection; four source views and four novel mesh angles.
- `data/authored-assets/086-compact-2/runs/projected-filled-002/` — same method
  and geometry on a second palette variant.
- `data/authored-assets/086-validation/` — exact extraction and validation logs.

## Validation

Eight Python unit checks pass: camera recovery, invalid/unconstrained fits,
measurement semantics, exact reference freezing, tamper detection, invalid crop
and overwrite protection. A real Blender smoke checks three cases: visible
source colors remain exact bytes, an occluder prevents sampling hidden geometry,
and different surfaces sharing UV texels remain marked ambiguous.
Both compact variants produce real four-direction/four-novel-angle renders and
portable exports with the original 47 objects / 438 triangles.
Typecheck, lint and production build pass. Art catalog and Workshop manifest
rebuild; all 762 candidate identities pass normal-Chromium retina verification.
Three tools-index browser checks pass. Bundled full Chromium loads both new
reports at desktop/phone sizes without overflow or broken images, and renders
both actual exported GLBs with 438 triangles, four tires, textured materials and
the expected Y-up bounds. Its browsers and isolated server close after inspection.
The full unit run reports 2,102 passed, ten skipped and
five existing Windows symlink/process-kill failures across `FsSecurity`,
`SqliteRecordStore` and `privateDataPlugin`, matching the earlier 097 limitations.
Game/rendering integration is unchanged; the offline pipeline has its own actual
Blender execution and output inspection rather than a new game integration claim.

## Next fidelity gate

[099](099-compact-windows-and-fenders.md) implements the first bounded family
correction after owner feedback: continuous window panels, explicit source-view
ownership and raised tapered fender lips, replayed on both compact palette
variants. It supplies a new retained template; windshield/hood/roof fitting and
human acceptance still remain open.

First fit compact-1 geometry/UVs and outlines closely to all four reference views
using this shared loop. Record its family parameters and prove the correction on
compact-2 without another custom pipeline. Then test a structurally different
vehicle before expanding to buses/utility vehicles or another asset class.
There is currently no automatic geometry fitter, parametric vehicle factory or
accepted family template. Template selection, geometry fitting and final paint
are still authored work. Broad model production should follow this fidelity gate.
Register new candidates/revisions before human review or promotion; source crops
and metrics do not constitute those candidates or approvals.
