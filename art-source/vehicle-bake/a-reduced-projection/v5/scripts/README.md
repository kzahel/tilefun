# Reduced source + projected paint (red coupe only)

Finished review candidates: **budget-mid / 1,877 triangles** (economy),
**v5 / 2,469 triangles** (fidelity), **budget-low-v4 / 1,376 triangles** (minimum
budget comparison, visibly coarser glass/hubs). See `result.md` for exact paths.
These are engineering/art experiments awaiting owner review, not approved assets.

## Replay into a new revision

From the repository root, with Python/Pillow, retained 141 inputs, installed npm
dependencies and Blender 5.2 available:

```powershell
python scripts/vehicle-bake/a-reduced-projection/run.py --recipe art-source/vehicle-bake/a-reduced-projection/budget-mid/input-recipe.json --revision my-mid-replay --triangles 1800 --capture
python scripts/vehicle-bake/a-reduced-projection/run.py --recipe art-source/vehicle-bake/a-reduced-projection/v5/input-recipe.json --revision my-high-replay --triangles 2500 --capture
python scripts/vehicle-bake/a-reduced-projection/run.py --recipe art-source/vehicle-bake/a-reduced-projection/budget-low-v4/input-recipe.json --revision my-low-replay --triangles 1300 --capture
```

Use the candidate's pinned input recipe to replay its exact geometry rules. The
general `coupe.json` contains the current defaults; `--budget-factor` can expose
another point. `--triangles` selects a budget allocation, not a fake exact count:
post-reduction well cuts and minimum component budgets affect the audited total.
The CLI refuses any existing output revision. Individual writers refuse a
finished (`status:complete`) revision. New runs remain draft until visual review.
The candidate's `scripts/` directory retains its own executable scripts; those
resolve the repository root by AGENTS.md, and can also be run from that location.

The recipe names the immutable source Blend, target drawings, semantic guides,
output revision, requested budget, allocation factor, component minima, camera,
atlas size and export world scale. Four CPU threads and the shared camera/scale
contract remain fixed. No ignored data is needed to replay. `--capture` reads the
coordinator's existing viewer and loads this candidate through its public API;
it neither registers a candidate nor modifies shared files. It launches/reaps
bundled full Playwright Chromium, with no lights and actual engine materials.

## Method and evidence

1. Load the actual 71,390-triangle retained source, freeze evaluated components
   in source world coordinates, lower curve cross sections, then QEM each component.
2. Keep source surface ownership. Consolidate only after painting, into one static
   body and four independent tire/hub meshes. Smart UV packing produces one 512²
   atlas. All exported triangles, UV splits, texture bytes and vertices are counted.
3. Project all eight final sprites using the unchanged 141 cameras. Cast against
   the high mesh; require the same source component, close surface position and
   matching visible semantic pixel. Reject exterior alpha-boundary pixels.
4. Retain raw projection, ownership, conflicting samples and unknown-texel maps.
   Clean glass with source-parametric borders/reflection bands; solidify intakes,
   panels and rubber; simplify deck slats in physical source coordinates; use
   same-owner texture majority cleanup and three-texel island bleed. These edits
   live entirely in the atlas. Hidden paint is explicitly semantic fallback.
5. Clamp QEM tires to the source .34 radial envelope and align a contact vertex
   downward; pull source rear-buttress outer tips inside the tire slab; re-cut
   actual local pockets after body QEM. Low budgets must protect the fender tubes:
   unrestricted collapse creates crossing chords, even with valid body pockets.
6. Export a uniform `80/4.6` root, scaled radius extras, four named Steer/Roll
   hierarchies and one actual KHR_materials_unlit material. The texture's colour
   socket connects directly to Blender output; plain Emission was not exported
   as unlit by this exporter and was rejected in v1.

`view-*.png` are actual textured mesh renders, nearest sampled and translated
by (0,+28), with only an alpha-derived inward outline. `engine/` contains actual
GLTFLoader/CarMeshAsset/CarPixelOutline pixels, 16 study + 16 game headings,
wheel-roll frames and material/rig receipts. `imported/` contains fresh GLB-import
renders. `inspection-*.png`, `comparison.png` and both turntable GIFs aid review.
No final-canvas internal drawing is used.

## What a different family must supply

The geometry adapter and semantic cleanup are explicitly coupe-specific. A
Beetle/bus/pickup author must supply its retained high mesh; coherent target
drawings and camera registration; named semantic components and ownership; glass
patch parameterizations; component budgets and protected silhouette boundaries;
axles, wheel radii/widths/centres and open-pocket geometry; physical dimensions and
world-scale mapping; static/moving hierarchy; palette and hidden-surface policy;
and family-specific feature anchors such as vents/doors/bumpers. Then repeat all
native/intermediate-angle, GLB material, rig and complete neutral-roll clearance
checks. This coupe's buttress/hood/well coordinates must not be copied blindly.
No cross-family validation, steering clearance or runtime activation is claimed.
