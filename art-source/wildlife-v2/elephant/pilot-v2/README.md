# African elephant fresh pilot

Current pixels: `elephant-pilot-v2-drawing-01`; motion: `elephant-pilot-v2-motion-01`.
Motion is exactly inherited from final `elephant-pilot-v1-motion-04`, geometry
from `elephant-pilot-v1-geometry-06`. This revision changes only the up-facing
heel pad: `rearHeel` is a separate letter master with continuous gray shading
and no ivory front toenail row. Other feet retain the original master.
Decoded sheets differ by 170 pixels in 21 rear frames, only four interior heel
row positions per visible foot; alpha, bounds and contact placement are unchanged.
Coordinator and human review are pending. This source is an elephant-only draft.

`build.py` creates an isolated Blender 5.2.2 scene: a ring-built sloping torso,
fixed skull/jaw/forehead volumes, closed African ear fans, short two-part tusks,
two-link pillar legs, five retained trunk segments and an articulated tail.
The editable source is `elephant.blend`. Object controls and baked translation/
rotation keys are retained; this is not a skinned engine skeleton export.
No external model, texture or generated image is an input.

The camera reads `../../camera.json`: orthographic, 40 degrees **above ground**,
50 degrees from vertical, direction yaws down/up/left/right 180/0/100/260.
The 112-square canvas uses orthographic scale 11.2, shift Y 24/112 and a fixed
ground-origin pixel anchor (56,80), maintaining 10 pixels per world unit.
Elephant construction dimensions are multiplied by 1.12 once and baked into
mesh coordinates and translations; mesh/object scale stays one in every pose.
Idle projected pixel heights are left51/right52/down64/up65. Facing bounds are
not normalized. Native sprites are never resampled.

Idle is source frame1. Twelve walk samples use frames10–21 with closure22 at
5fps (2.4 seconds). Footfall order is hind-left, fore-left, hind-right, fore-right
at sample0/3/6/9. Each limb has 75% stance, 25% low swing with two passing samples,
fixed segment lengths 1.232/1.0976 and in-place contact travel. The body shifts
laterally toward the supported side without scale keys. Trunk curl uses frames
30–37 with closure38; five segments each retain length0.616, while joint angles
curl the tip. Tail follow-through makes the occluded rear action visible.

`projected-guides.json` contains actual projected mesh convex hulls, bounds,
depths, landmarks, limb joints and contacts for 84 poses. Full mesh geometry
stays in the `.blend`; hashes and topology are recorded once, not repeated in
every pose. Workbench guide renders are in the public `guides/` folder.
`audit.py` loads the saved source in a fresh Blender process and independently
checks geometry, fixed scales, camera, projections, contacts and footfall order.

`masters.json` is the editable palette-letter drawing source. `author_masters.py`
retains the deliberate integer contour/light-band decisions that produced it.
The drawings were authored against the 96px guide grid, then placed with an
eight-pixel padding offset on the 112px canvas; there is no sprite stretch.
Head/ears/tusks remain complete stable templates. `finish.py` uses Pillow integer
composition plus projected rigid limb/trunk joints, without reading render colors.
Side baked shading intentionally mirrors. The far-ear upper rim is rounded with
up to two pixels of contour expansion; feet use a readable rounded sole about
one pixel below the analytical contact. These are stylizations, not exact mesh
silhouette equivalence.

Reproduce from the repository root using the local Python and Blender executable:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/elephant/pilot-v2/build.py
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/elephant/pilot-v2/finish.py
```

The saved-source audit, deterministic replay and bundled Chromium capture have
separate retained entry points `audit.py`, `replay.py`, `capture.mjs` and
`verify_capture.py`. Concrete visual observations, current hashes and validation
reports live in the public pilot folder. Failed internal drawings remain in
immutable pilot-v1 under `iterations/`; they were not copied into this revision.
The saved `.blend` is byte-identical to final pilot-v1. Its embedded origin/render
paths retain that provenance; all copied executable builders, audits, finishing
and playback paths target v2. No source geometry or animation was rebuilt here.
