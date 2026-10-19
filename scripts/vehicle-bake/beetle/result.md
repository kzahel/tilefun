Beetle v1 author delivery is complete and awaits OWNER REVIEW. No gameplay
activation, commits, pushes, shared manifests, roster or shared renderer edits.

- Public candidate: `public/demos/vehicle-bake/beetle/v1/`.
- Editable low/rig: `art-source/vehicle-bake/beetle/v1/car.blend`.
- Editable separate semantic components: `art-source/vehicle-bake/beetle/v1/master.blend`.
- Atlas, GLB copy, recipe, family config, palette planning draft and replay scripts
  are retained beside the scenes. Both scenes pack their image dependencies.
- Public `report.json` is `complete`, art decision `awaiting-owner-review`.

Final model SHA-256:
`4e5094968f9eb2e734dd3aea694d302f9cef519f5501a2a61961973f0c368de1`.
Actual exported count: **2,554 triangles, 5,462 UV-split vertices, five meshes /
five primitives, one opaque unlit material, one 512×512 atlas, 198,312 GLB bytes**.
Atlas: 4,679 bytes. All four radii are 6.782608695652176 exported world units
(.39 source units × 80/4.6). Blender forward -X/up +Z; glTF roll [0,0,-1],
steer [0,1,0], standard FL/FR/RL/RR steer > roll > mesh hierarchy. Source
ground contacts are at zero and no camera/height/lateral correction was added.

The independent family recipe creates a longitudinal egg-shaped loft, domed roof,
sloped rounded hood/rear engine lid, broad swept pontoon fenders, genuinely open
wheel arches, narrow central underside, running boards, round lamps and restrained
bumpers. Paint is original semantic surface authoring, not the coupe's projected
paint or a high-to-low transfer. Coachwork/glass/panel details share continuous
actual skin UVs; trim/fenders/wheels use intentionally shared padded role swatches.
This removes the draft's intersecting glass overlays. The named component master
uses economical topology, not a separately claimed high-detail model. Outer ink
comes only from the unchanged shared engine outline pass.

Evidence retained in `art-source/vehicle-bake/beetle/v1/evidence/`:

- `shared-clearance.json`: exact final hash passes whole fixed-body triangle vs
  measured wheel-cylinder envelopes for every neutral roll angle. Minimum gap
  **.9657946073 exported world units**. Deliberately colliding body rejected;
  restored baseline passes. Full tire/hub geometry participates.
- `upper-wheel-coverage-final.json`: exact final hash, independent explicit Beetle
  sample region, all four wheels **25/25 broad supported crown rays**; body-removal,
  broad-panel and displaced-panel controls pass. This sampled support is separate
  from visual silhouette/occlusion inspection.
- `engine-capture.json` and public `engine/capture.json`: exact final hash, actual
  GLB through unchanged compiled CarMeshAsset/CarPixelOutline/VehicleGeometryBatches,
  bundled full Chromium; **16 headings × study/game cameras**, no clipping/errors,
  all wheels independent quarter-turns with fixed pivots/body, forward/reverse
  distance phase and absolute reset. Eight roll phases at 45° steps are captured.
- `replay-verification.json`: fresh source-only replay yields byte-identical GLB
  and atlas; no ignored scratch inputs.
- `prior-retained-preservation.json`: independent pre-authoring baseline checked
  **2,988 prior files, zero differences**.

Visually inspected `inspection-study.png`, `inspection-engine.png` and
`inspection-roll.png` at native/3× pixels. Far crowns remain under physical yellow
fender shells; near wheels sit in open arches. Continuous glass borders and broad
blue clusters replace the broken draft roof/window joins. Final public views,
comparison, wireframe, turntable and receipts all come from the exported GLB.
Obsolete quick captures, old coverage receipt and Blender backup files moved to
ignored `data/vehicle-bake/beetle/obsolete/`.

Replay/verification from repository root (Blender 5.2.2, four threads):

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/beetle/build.py -- --scratch
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/clearance.py -- art-source/vehicle-bake/beetle/v1/evidence/clearance-input.json data/vehicle-bake/beetle/recheck-clearance.json
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/beetle/v1/model.glb --config scripts/vehicle-bake/beetle/coverage-region.json --output data/vehicle-bake/beetle/recheck-coverage.json
npx biome check scripts/vehicle-bake/beetle/capture.mjs art-source/vehicle-bake/beetle/v1/capture.mjs
```

Original pre-completion capture/assembly commands were
`node scripts/vehicle-bake/beetle/capture.mjs` and
`python scripts/vehicle-bake/beetle/sheets.py`; preserve their retained final pixels.
Biome now passes both capture scripts; log is `data/vehicle-bake/beetle/check-errors.log`.
Python syntax and Node syntax checks pass. Broad npm checks/inventory regeneration
were left to the coordinator per the route's worker scope. GLB exporter declares
nearest magnification / nearest-mipmap-nearest minification; shared CarMeshAsset
uses nearest min/mag with mipmaps disabled.

Limits: owner appearance decision pending; nonzero steering/suspension clearance
and gameplay physical bounds/handling are unqualified. Small trim/vent features
retain ordinary native-pixel angle aliasing. Next step is coordinator independent
final QA and owner review, with no runtime activation implied.

Final portability checkpoint: repo-relative report paths and all source/retained
hash-table keys use forward slashes. Both build/finalize recipes and their retained
copies generate POSIX paths. Source script/receipt hashes were refreshed after
this metadata-only correction. A retained-script scratch replay still produces
the exact final GLB and atlas; Linux path/hash verification passes. All Blender,
GLB, atlas, PNG and GIF bytes are unchanged. QA can prepare again from the final
report, then freeze the review snapshot.

Linux verification resolved and verified 19 source-hash entries and 80 retained
file entries; all 61 retained art files are byte-unchanged. Receipt:
`data/vehicle-bake/beetle/linux-portability.json`. Final metadata is stable and
ready for QA to prepare again before freezing.
