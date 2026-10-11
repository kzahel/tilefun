---
name: tilefun-vehicle-authoring
description: Reconstruct Tilefun vehicle sprites as editable Blender meshes with source-matched UV paint, native-pixel comparisons and independently rotating wheels. Use for another vehicle or a vehicle-family refinement; other asset classes need their own geometry templates.
---

Work in the Tilefun repository root (contains `src/traffic/vehicles-v1.json` and
`scripts/authored-assets/pipeline.py`). Read `AGENTS.md`,
`docs/topics/3d-assets.md` and `docs/topics/art-review.md` for current state and
review contracts. Use the repository's deterministic Blender tools; this task
needs coherent geometry and reusable UVs, rather than a generated bitmap.

## Choose the route from evidence

Identify the requested sprite in the vehicle bank before choosing a template.
`python scripts/authored-assets/pipeline.py list` lists extraction support,
not completed models. A small red compact is `compact-4`; an ambulance is
`ambulance`. Inspect original directional crops when the description is ambiguous.

For compact palette variants, run the validated recipe in
[references/compact-variants.md](references/compact-variants.md). It checks all
four source alpha masks, physical metadata and a consistent colour correspondence
before reusing the fitted mesh/UVs. Unmapped authored colours require explicit
material roles. Do not bypass a mismatch with nearest-colour guesses or hide
shape errors by moving cameras.

Exact final blue/green/red bundles are tracked in `art-source/vehicle-models/`,
with self-contained GLBs in `public/assets/models/vehicles/`. The default compact
palette replay uses these pinned, tracked dependencies and works in a fresh clone.
Run `verify_bundles.py` before using them. Older experiments/galleries stay ignored.
Do not silently replace missing inputs or overwrite a retained final revision.

For a different body, use `scripts/authored-assets/README.md` and the generic
`pipeline.py init → calibrate → project → evaluate` tools. Author or fit a new
family template. Camera fitting needs correspondences spanning depth and height;
record pixels in raw crops, including the narrower front/back crops. Offsets into
the comparison canvas are handled separately. Preserve family assumptions in a
recipe instead of treating the compact's camera or landmarks as universal.

## Fit and inspect the things that mattered

- **Shape first:** compare all source silhouettes at native resolution. Check
  wheel contacts/axles, hood slope, roof height, rear profile, sill and fender
  radius/flare. Whole-car IoU can miss oversized internal fenders; inspect their
  boundaries too. Sprite shadows affect occupancy scores.
- **Separate window ownership:** side windows need continuous islands. Windshield
  glass belongs inside its aperture; guard cabin corners against duplicated
  projected glass. Check top/front corner intersections and all window borders.
- **Ink at final pixels:** outer silhouette ink is a logical-pixel pass after
  alignment; internal ink is atlas paint. A painted atlas border can disappear
  after sampling. Inspect every border in every native source view, especially
  the windshield top. Widen deliberately where needed, then verify joins and
  glass loss. GLB includes internal ink; it needs a separate outer-ink renderer.
- **Wheels as rigid components:** tire and hub share a centered roll pivot;
  optional steering is a parent of that pivot. Keep body/fenders static. Verify
  ground contact, independent wheel motion and forward/reverse quarter turns on
  the actual exported GLB. Compact forward is -X; inspect export axis conversion.
  Distance-driven roll is `-distance/radius`. A working pivot does not prove
  steering clearance.
- **Preserve uncertainty:** raw projection, conflicts and unseen masks are
  separate from cleaned paint. Choose source owners for disagreeing UV regions;
  author hidden surfaces explicitly. A palette transfer inherits hidden surfaces
  and does not make them observed.

## Deliver something reviewable

Render the actual mesh with emission/unlit materials, nearest sampling and
transparent background. Show a four-column/two-row sheet: original sprites above
matched Blender renders, plus native contour differences and novel angles. Check
the exported GLB/rig, not just the working scene. Save a self-contained `.blend`
with cleaned atlas and its own unused draft, atlas, GLB and recipe/provenance.

Use fresh offline workspaces and retained revision directories. Preserve earlier
candidate bytes. Keep exploratory outputs in the ignored vehicle folders or
`data/authored-assets/`; normal builds and Workshop must not require them.
Retain explicitly requested final models and required source dependencies in
the tracked bundle directories, with exact hashes and portable recipes.
When preparing a production review slice, register the new exact candidate/batch
using retained, available review assets; chat feedback is not a formal promotion.
Follow the project's validation and
inventory commands, reporting existing platform failures separately. Update
the owning topic and tactical, and name the next family-specific fitting step.
