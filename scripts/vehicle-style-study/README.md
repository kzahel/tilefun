# Original sports-car style study

Offline experiment, owned by [tactical 141](../../docs/tactical/141-sports-car-style-experiments.md).
All four initial routes are delivered. Run `python scripts/vehicle-style-study/assemble.py`
to validate and repackage the retained comparison; it refuses to overwrite
different retained source bytes. The generated standalone viewer is
`data/vehicle-style-study/standalone.html`. Run
`node scripts/vehicle-style-study/capture.mjs` for isolated browser checks.

Do not overwrite or integrate existing vehicle assets. Each YA agent owns only
`scripts/vehicle-style-study/ROUTE/`, `data/vehicle-style-study/ROUTE/`, and
`public/demos/vehicle-style-study/ROUTE/`. The coordinator owns shared docs/gallery.
Do not commit, create branches, change global settings or spawn more agents.

## Common art and render contract

- Original red Ferrari-inspired sports coupe: long low nose, compact swept cabin,
  wide haunches, dark side intakes, sporty rims, distinctive front/rear lamps.
  Use no downloaded model. Aim for coherent editable geometry, not assembled
  boxes alone; exaggerate features enough to read at the existing vehicle scale.
- Model units: length 4.6, width about 1.9, roof about 1.05; forward is local -X;
  four wheel centers/axles and tire ground contact are explicit. Z is up.
- Fixed orthographic camera at (0, -12*cos(50deg), 12*sin(50deg)), aimed at origin,
  orthographic scale 7.2, square image. Rotate model about Z through
  0,45,90,135,180,225,270,315 degrees. Keep the light/camera fixed.
- Render transparent 512x512 RGBA; reduce to 128x128, then apply one constant
  translation (0,+28) to every view, putting world-origin ground center at
  (64,92). Preserve canvas and scale; never independently fit or crop views.
  Detail routes may use more samples but keep CPU thread count <=4 and rendering
  bounded. Use Eevee or a low-sample CPU renderer; do not monopolize the GPU.
- Final sprites: 128x128 RGBA, binary alpha; coherent shared palette sampled from
  `art-source/vehicle-models/compact-4/v1/refs/*.png`, supplemented only by explicit
  named red/glass/trim roles when needed. No per-view adaptive palette or dither.
  Character pipeline references: `docs/blender-pixel-characters.md`,
  `scripts/blender/pack_tiger.py`, wildlife finish scripts. Reuse its principles,
  not tiger-specific dimensions, camera, facial features or anatomy.
- Add restrained one-native-pixel dark ink; inspect native pixels, glass borders,
  wheel placement and near/far side visibility. Document any authored clusters.

## Required route outputs

Under `public/demos/vehicle-style-study/ROUTE/` deliver:

- `view-0.png` through `view-7.png` (final native sprites).
- `raw-0.png` through `raw-7.png` (512px unprocessed renders).
- `sheet.png` (8 columns, one row, 1024x128).
- `comparison.png` (readable labelled process/contact sheet with native and 4x
  nearest views, plus existing source references).
- `turntable.gif` (eight directions, nearest enlargement, consistent ground anchor).
- `report.json`: route, title, method, evaluated triangle/mesh counts, nativeSize,
  palette and colour count, blend/source paths, commands, limitations, and any
  genuine visual inspection performed. Include `status: complete` only when all
  expected outputs exist and have been inspected. Save an editable source scene
  and a replayable constructor in the route's directories.

An optional `result.md` explains what worked and what remains uncertain. A small
GLB is welcome for the low-poly baseline; high-poly routes need not ship runtime
geometry. No production qualification or approval is implied.

Blender on this machine: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`.
Use command-driven background Blender in a fresh scene; do not touch live Blender.
Use Python/Pillow for finishing (this task explicitly asks for a scripted 3D pixel
pipeline). All Git operations, if needed for inspection, must go through WSL.
