# Reduced source + projected paint (red coupe only)

**Next owner review: mid-fenders-v3 / 2,299 triangles.** The coordinator has
registered this corrected revision in the final frozen manifest. Its integrated
shoulders cover the far tire crowns while keeping a continuous low body line.
See `result.md` for exact paths, validation and remaining limits. Owner art
acceptance remains pending.

`budget-mid`, `v5` and `budget-low-v4` are preserved pre-correction history, not
current recommendations. Circular-cap trials `mid-fenders-v1/v2` are rejected.
All completed candidate bytes remain frozen.

## Replay into a new revision

From the repository root, with Python/Pillow, retained 141 inputs, installed npm
dependencies and Blender 5.2 available:

```powershell
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/a-reduced-projection/refine_fenders.py -- art-source/vehicle-bake/a-reduced-projection/mid-fenders-v3/input-recipe.json NEW_REVISION
python scripts/vehicle-bake/a-reduced-projection/finish.py NEW_REVISION
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/a-reduced-projection/audit.py -- NEW_REVISION
node scripts/vehicle-bake/a-reduced-projection/capture.mjs NEW_REVISION
python scripts/vehicle-bake/a-reduced-projection/review.py NEW_REVISION
```

V3 uses the retained `budget-mid/car.blend` and its byte-identical atlas as direct
inputs. Its pinned recipe and `replay.md` own the exact refinement commands;
the original `run.py` reduction CLI does not apply the fender correction.
Existing output revisions are refused. New runs remain draft until visual review.
The V3 source bundle retains executable snapshots under `scripts/`, which resolve
the repository root by AGENTS.md. No replay or regeneration is needed for review.

The earlier reduction CLI remains available for historical experiments. Its
`--triangles` selects an allocation, not an exact exported count; subsequent well
cuts and component minima affect the total. Keep all such experiments in fresh
revisions and do not treat them as corrected V3 candidates.

The recipe names the immutable source Blend, target drawings, semantic guides,
output revision, requested budget, allocation factor, component minima, camera,
atlas size and export world scale. Four CPU threads and the shared camera/scale
contract remain fixed. No ignored data is needed to replay. `capture.mjs` reads
the coordinator's existing viewer and loads a candidate through its public API;
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
7. V3 corrects a source defect that clearance alone did not detect: exposed upper
   tire crowns. Replace thin arch tubes with broad tapered shoulders, flatten the
   crown to `.72`, and tuck each wheel `.08` inboard. Keep axle X, radius, ground
   contact, wheel vertex/normal/UV data and atlas bytes. Check upper coverage and
   actual 0/180 silhouettes separately from collision clearance.

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
