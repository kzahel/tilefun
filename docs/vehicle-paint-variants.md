# Vehicle paint variants

The first paint study contains six Beetle colors, four pickup schemes (including
two cream roofs), and four sports-coupe schemes (including navy/cream twin
stripes). These are review assets; current game colors and vehicle IDs are unchanged.

Open the committed comparison at
`public/demos/original-vehicles/paint-study-v1/index.html` through a static server.
The ignored `data/vehicle-bake/paint-study-v1/index.html` is a self-contained,
network-free capture gallery. Each committed scheme also has an interactive
actual-GLB page using the existing shared vehicle renderer.

## Paint ownership and palette

`scripts/vehicle-bake/paint-variants-v1.json` owns seven curated six-step ramps:
cherry, butter, cream, teal, powder blue, forest and navy. The steps are deep,
shadow, mid, base, light and highlight. Pickup uses the first five steps because
its original paint has five roles. Glass, rubber, ink, metal, lamps and pickup
bed lining retain their original colors.

Every family explicitly declares its original paint RGB values and protected
RGB values, and pins its original GLB and editable Blender source. Unknown or
ambiguous colors fail rather than receiving a nearest-color guess. The retained
grayscale role mask uses zero for protected pixels and 1–6 for ramp steps.
This exact-color method is qualified for these three owned atlases. If another
family shares a paint color with a protected material, provide explicit ownership
from its constructor/UV charts before recoloring it.

The pickup secondary mask uses its existing roof chart (PNG rows 352–399).
Sports-coupe twin stripes are rasterized into owned body UVs using the actual
GLB's local lateral coordinates, height and upward-facing normals; they are not
drawn into captured views. Shared UV texels with conflicting stripe ownership
fail. Internal ink, glass and rear engine vents stay protected beneath the pattern.

The shared outline shader retains a source edge when its linear RGB sum is
darker than the ink threshold. Consequently, even the deepest paint step must
stay above that threshold. The initial dark-green trial exposed this constraint;
forest/navy shadows were lifted and all views recaptured. The safety test checks
both ordered luminance steps and this linear-color threshold. No shader changes
or whole-texture tinting are needed.

## Repeat the study

Host Python needs Pillow; Blender 5.2 is needed only to pack/verify editable
source scenes. Normal builds consume committed assets and never run Blender.

```sh
python scripts/vehicle-bake/test_paint_variants.py
python scripts/vehicle-bake/paint-variants.py verify
python scripts/vehicle-bake/paint-review.py verify
python scripts/vehicle-bake/paint-variants.py build --output-root data/vehicle-bake/NEW-REPLAY
python scripts/vehicle-bake/paint-variants.py verify --output-root data/vehicle-bake/NEW-REPLAY
```

A scratch replay creates fourteen GLBs and atlases from the pinned base models
and configuration. Compare them with the committed files. Each GLB appends its
new embedded PNG and redirects only the existing image buffer view. Original
binary data remains an exact prefix; all non-image GLTF metadata is unchanged.
The unused old embedded PNG remains as a small source-preservation overhead.
No additional active texture, material, mesh or draw primitive is introduced.

Do not rebuild the frozen v1 study in place. For a new revision, change the
revision paths/IDs in new adapters, then follow this sequence:

1. Build the new source/atlas/GLB set. Open each inherited `.blend`, replace its
   texture, pack it and save into the new source directory. The
   `paint-source-blender.py` adapter records how v1 does this; it does not re-export
   the GLB. `paint-source-verify.py` proves inherited source mesh, UV, hierarchy,
   transforms and object properties remain exact, with the correct packed PNG.
2. Build the unchanged `family-viewer.mjs` through `family-build.mjs` into the
   new comparison directory. The capture adapter copies this bundle per scheme.
3. Capture through full bundled Chromium and the shared loader. V1 checks
   16 headings and eight signed wheel phases in both cameras, against freshly
   rendered original GLBs. Every alpha channel and every non-paint pixel must
   remain exact. Exercise independent wheels and all viewer controls.
   Move the temporary top-level `viewer.js` into ignored `data/` after capture;
   per-scheme viewer bundles are final registered review assets.
4. Assemble the comparison, inspect actual native frames and contact sheets,
   and run desktop/mobile/network-free offline gallery checks. Write an honest
   agent inspection record. This is not human approval.
5. Freeze/register new candidate IDs, retain source and dependency hashes, then
   run `npm run art:catalog` followed by `npm run workshop:manifest`.

Scratch renders, browser captures, replay directories and caches belong under
ignored `data/`. Packed final scenes, atlases, masks, recipes, exact models and
registered review evidence are committed. The frozen receipt is
`art-source/vehicle-bake/paint-study/v1/retained.json`.

## After appearance review

The next implementation slice is a shared per-vehicle `paintSchemeId`, saved and
replicated with the car. Keep one vehicle definition per geometry; paint choices
must not multiply the normal spawn catalog. The editor should offer swatches,
and traffic should choose from family-specific weighted schemes once per car.
Older saves should resolve to the original default scheme.

Use shared model geometry and cache generated textures/materials by model and
scheme, not by entity. Each additional decoded 512² RGBA atlas costs 1 MiB
before GPU bookkeeping; avoid eagerly loading every fleet color. Generate exact
cardinal sprite fallbacks for each selected scheme so disabled, loading and
failed meshes retain the same paint. Preserve identity through save/reload,
multiplayer, pooling and game/lab presentation. These runtime behaviors are
planned, not delivered by this appearance experiment.
