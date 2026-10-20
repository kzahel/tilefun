# Vehicle paint variants

The first paint study contains six Beetle colors, four pickup schemes (including
two cream roofs), and four sports-coupe schemes (including navy/cream twin
stripes). The owner authorized gameplay integration on 2026-10-20. These fourteen
schemes are now registered for normal editor/traffic presentation on the same
three vehicle types; vehicle IDs, geometry and handling stay unchanged. Frozen
study pages retain their capture-time review/integration labels.

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

## Runtime integration

Choose a model and paint under **Edit → Vehicles**, then place it normally. The
swatch bar stays above the scrolling vehicle grid and preserves keyboard/controller
focus when choosing a color. **Original** retains the original palette. Traffic
inspection offers the same schemes in its Paint selector through the production
Realm; it has no separate paint implementation.

`src/traffic/vehicle-paints-v1.json` is the generated runtime catalog. It owns
friendly labels, original/secondary swatches, atlas/sprite paths and traffic
weights. `VehiclePaint.ts` validates each scheme against its model. A car's optional
`paintSchemeId` belongs to authority and durable traffic records. Old records
without that field keep the original paint. New ordinary traffic chooses once
from a stable identity hash and family-specific weights; restoring or driving a
car never rerolls it. Coupe stripes have weight 1 versus cherry/default 4;
other colors favor practical/common paints while retaining every reviewed option.

The entity baseline carries one optional dictionary byte (presence bit 17), and
the delta carries a nullable byte at bit 18. Snapshot reuse, replicas and local
mount prediction retain the choice; null restores the original. The append-only
wire dictionary is in `VehiclePaint.ts`. Frame tag **0x06** requires matching
updated client/server builds; earlier 0x01/0x04/0x05 frames are rejected explicitly.
The optional bed-profile bit added in [164](tactical/164-playable-truck-bed.md)
does not alter the paint byte/dictionary.

`GpuMeshBodies` keeps the existing one mesh asset per model. `VehiclePaintResources`
loads each requested atlas lazily and publishes it at a frame boundary. Rendering
temporarily binds that shared texture to the existing atlas-owned materials,
then restores their original maps in `finally`. Geometry/material objects, wheel
rigs and draw counts are shared across schemes; there is no per-car mesh clone.
ResourceSlot cleanup discards late loads, and scene teardown disposes the cache.
The catalog bounds it to fourteen possible additional textures, each 1 MiB decoded
RGBA before GPU bookkeeping. These atlases are not eagerly loaded.

Fourteen exact 192×896 cardinal sprite sheets join the normal startup sprite
manifest (9.19 MiB total decoded RGBA). Each uses four 192×224 frames with unchanged
ground registration (96,144). Canvas, disabled/loading/failed meshes, failed
paint-atlas loads and the editor ghost use the selected scheme's sheet. They
preserve the same color while mesh/atlas loading is pending or unavailable.

Runtime assets are retained under `public/assets/vehicles/paint-v1/`. They are
copied/packed from the frozen study without new rendering or resampling:

```sh
python scripts/vehicle-bake/export-paints.py --check
python scripts/vehicle-bake/export-paints.py --output-root data/vehicle-bake/NEW-RUNTIME-REPLAY
node scripts/vehicle-bake/paint-runtime-parity.mjs
```

The export receipt in `art-source/vehicle-bake/paint-runtime/v1/receipt.json`
pins every consumed source, the exporter, generated catalog and normal PNGs.
Normal builds use committed assets and never run these authoring commands.
The parity runner builds only ignored QA files: three original runtime GLBs with
fourteen external atlases reproduce all 672 reviewed RGBA frames exactly,
including signed wheel phases. Every scheme keeps the same mesh/geometry/material
objects and restores the original paint exactly after drawing.

[156](tactical/156-vehicle-paint-gameplay.md) records the gameplay validation.
The next expansion can assign owned paint regions to more original families and
add schemes to this catalog. Do not recolor a family whose paint and protected
materials share RGB values without first providing explicit UV ownership.
