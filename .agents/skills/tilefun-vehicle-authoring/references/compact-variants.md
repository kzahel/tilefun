# Compact palette variants

Run from the Tilefun repository root. Locate the installed Blender executable and
pass it explicitly; require host Python/Pillow and Blender's bundled NumPy.
Normal game builds use retained assets and never run authoring.

Prerequisite: restore the local v7 template bundle referenced by
`compact-variant-template.json`. Its `.blend`, atlas, windshield and rig records
live in ignored `art-source/vehicles/` and `public/demos/authored-car/`; they are
not present in a fresh clone. Preserve their recorded hashes. A newly authored
template needs its own configuration/pins, not a bypass of these checks.

```text
python scripts/authored-assets/author_variant.py --vehicle compact-4 --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_WORKSPACE
```

The checked template is `scripts/authored-assets/compact-variant-template.json`.
It pins the blue compact v7 scene/atlas, carries four camera hypotheses and lists
explicit policies for authored colours that do not occur in the original sprite.
The command rejects an existing workspace, a changed source/template, a different
silhouette/physical layout or inconsistent palette correspondence.

Outputs include:

- `recipe.json`, frozen target `refs/` and `template-refs/`.
- `atlas.png`, `transfer.json` with source-derived correspondence and authored roles.
- `projection-001/`: this variant's visibility-tested draft and uncertainty mask.
- `render-001/`: source/render 4×2, native images, overlays, GLB, mesh audit and
  novel views. Source cameras are family hypotheses, not the gameplay camera.
- `inspection-001/`: contour sheet, novel-angle strip and native top-ink probe.
- `car.blend`: cleaned atlas plus this variant's unused, packed source draft.
- `wheel-roll.gif` and fixed-body motion evidence.

The runner is an offline replay, not an automatic approval or publisher. Retain
local results in new ignored revision folders and preserve their hashes outside
Git. Production review registration requires an explicitly retained review bundle;
normal Workshop and game builds do not depend on these exploratory files.

For actual GLB wheel verification, `verify_wheel_rig.mjs` exercises ground contact,
hierarchy, forward/reverse roll, independent motion and front steering in full
Playwright Chromium. Choose the retained revision it supports; adapt expectations
from a new family's recorded rig/audit instead of assuming 55 meshes or radius 4.1.
This gallery harness needs that local revision's gallery and exports. Reusable
GLB imports, wheel transforms and pixel-outline shader code live in
`scripts/authored-assets/runtime/`, separately from the ignored galleries.

If correspondence fails, preserve the failure and switch to a new fitting/paint
recipe. An ambulance requires a longer/taller body, new wheel positions, separate
cab/box windows and source-owned graphics; copying the compact body is inadequate.
