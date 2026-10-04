# Fresh fox pilot-v2

Pixel identity: **fox-pilot-v2-drawing-03**. Motion identity:
`fox-pilot-v2-motion-02` (the retained v1 eight-pose contact schedule).
Draft integrity is checked; the coordinator quality gate remains closed and
human review is pending. This revision addresses the coordinator's rejection
of the fresh pilot-v1 front/rear heads. Pilot-v1 is preserved byte-for-byte.

## Editable anatomy and motion

`build.py` constructs an isolated studio with species-specific rigid volumes,
two-segment fixed-length leg IK, keyed paws, ear hinges and four tail joints.
It does not connect to or change a live Blender session. `fox.blend` is the
editable source; there are no downloaded models, external textures or generated
image inputs. Geometry is applied once, then only rotated/translated.

The skull's lateral diameter is 0.78 world units, enlarged from fresh v1's 0.50.
Cream cheek centers are at X +/-0.29 with lateral radius 0.18. Ear hinges are
at X +/-0.40; their tips reach +/-0.46. The torso, head anchor, head height,
longitudinal skull depth, leg dimensions and gait contacts retain v1's values.
Tail radii are 0.16/0.24/0.21/0.11. This widens the head and bushy tail without
scaling the whole animal. Eyes are retained as editable geometry on the face.

Idle is frame 1; walk uses frames 10-17 and closing key 18; tail action uses
30-37 and closing key 38. Root, trunk and head volume/orientation stay fixed.
The feet use a 62.5% stance with a 37.5% swing, 0.40-unit travel and 0.18-unit
peak lift. Forefeet alternate by half a cycle; hindfeet follow a quarter cycle.
Upper/lower leg lengths are 0.36/0.34. Contacts move backward under an in-place
root; preview travel is not baked into the source or sprites.

## Retained camera and native drawing

40 degrees **above ground**, 50 degrees from vertical. Orthographic camera at
`(0,-7.660444,6.427876)`, looking at origin; width 4.8, shift Y 7/48, square
48x48 canvas, anchor `(24,31)`, 10 native pixels/world unit. Yaws are
down/up/left/right = 180/0/100/260 degrees. The profiles turn 10 degrees toward
the viewer. Only the fresh 40-degree setting is used in this revision; it is
a retained art fit, not a measured vendor camera angle.

`masters.json` holds deliberate palette-letter drawings. Front/rear templates
are 11 pixels wide beside the unchanged 7-pixel torso. The front has separate
dark eyes, cream cheek clusters and a tapered muzzle; the rear has an orange
upper skull and neck shading with no eyes, nose or front muzzle. Profiles
retain the coordinator's successful drawings. `finish.py` uses Pillow integer
composition with independently projected head/body/joint/contact positions,
stable complete head templates and connected limb/tail drawings. It does not
sample guide-render colors or resample the finished sprite. The pixel finish
selectively simplifies the guide volumes, especially profile cheek depth;
the retained guides expose that choice for independent review.

Idle heights are down 20, up 25, left/right 14 native pixels. The Explorer and
actual Modern Exteriors roof/tree/four-direction cars are copied at native
density into scene studies. Scene ground is a plain green swatch. These are
authored scene comparisons, not gameplay screenshots. Binary alpha, eight
shared colors, fixed padding and unchanged full walk heads are checked.

## Compact independent guides

`export_saved_guides.py` loads the saved `.blend` in a fresh Blender process.
It recomputes evaluated mesh projections and checks analytical leg joints
against saved segment centers, axes and paw positions. Tail joints are
recovered from saved rigid mesh centers and axes. The exporter renders all 68
poses from that saved scene. No pixel artwork is read by either Blender script.

Schema `bpy-projected-convex-hull-v2` retains each volume's convex hull, bounding
box, camera-depth range and vertex count, plus projected head/body landmarks,
tail joints, hip/knee/foot/ground contacts, contact labels and limb lengths.
Volume screen coordinates are rounded to 0.01 native pixel; depths retain five
decimals. Hulls come from actual bpy mesh vertices. A hull-union head study
shows complete projected volumes; guide renders provide visible occlusion.
Full vertices/topology remain editable in `.blend`; local mesh geometry hashes,
topology counts, saved-source hash and exporter/builder hashes are retained.
Current compact JSON is about 0.94MB instead of the fresh v1's 14.9MB JSON.

## Reproduce and inspect

From the repository root, use the installed Blender 5.2.2 executable or
`BLENDER_BIN`, then the workspace-local Python:

```powershell
& $env:BLENDER_BIN --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/fox/pilot-v2/build.py
& $env:BLENDER_BIN --background art-source/wildlife-v2/fox/pilot-v2/fox.blend --python-exit-code 1 --python art-source/wildlife-v2/fox/pilot-v2/export_saved_guides.py
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/fox/pilot-v2/finish.py
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/fox/pilot-v2/compare.py
& $env:BLENDER_BIN --background art-source/wildlife-v2/fox/pilot-v2/fox.blend --python-exit-code 1 --python art-source/wildlife-v2/fox/pilot-v2/audit.py
node art-source/wildlife-v2/fox/pilot-v2/capture.mjs
& data/wildlife-tools/python/python.exe art-source/wildlife-v2/fox/pilot-v2/verify.py
```

The capture uses bundled full Chromium in a fresh isolated context and a
temporary loopback static server, then closes both. It samples actual browser
playback at native and 4x scale for two full sequences each. `verify.py` checks
every captured scene byte against the authored sheet composition, decodes all
six GIFs, verifies full pose coverage and checks pilot-v1 preservation hashes.
Its capture inputs are in ignored `data/wildlife-campaign-v2/manual-fox-02/browser`.

The public bundle includes all-frame contact sheets, chronological strips,
native/enlarged GIFs, exact v1/v2 static and cycle comparisons, scene studies,
guide renders, browser captures and explicit `review-observations.md`.
Rejected internal drawings 01/02 remain in `iterations`; drawing-01's earlier
guide JSON is losslessly gzip-compressed. They are not candidates or approvals.
Changed reviewed pixels require a new revision/identity. No Workshop registry,
gameplay integration, promotion, publication or Git commit is part of this task.
