# Suffolk ewe / fresh draft-v1

Standalone editable44-mesh sheep.blend and repeatable bpy builder. Fixed wildlife-v2
camera40 degrees ABOVE GROUND, polar50 degrees, accepted facing yaws,10px/world unit;
48px canvas, ortho4.8, shiftY11/48, constant anchor(24,35).
Geometry02/drawing02. Own Suffolk proportions, fleece volumes, long black face,
three fixed leg links per limb, paired hooves, short wool tail and rigid ear pivots.
No scale keys or root travel.16-pose lateral four-beat walk,8-pose listening ears.

Run Blender5.2.2 isolated with `-b --factory-startup --python-exit-code 1 --python build.py`.
Run workspace-local Python/Pillow on author-masters.py, then finish.py.
Run fresh Blender `-b sheep.blend --python-exit-code 1 --python audit.py`.
Run Python verify.py --replay; node capture.mjs uses bundled full Chromium and closes
its browser/server; then Python verify.py --browser. Run from repository root,
using each script's complete workspace-relative path. Compact projected-guides.json
contains actual hulls/bounds/landmarks/contacts; complete meshes remain in .blend.
Final pixels are palette-letter masters plus integer Pillow composition.

Public outputs: public/demos/wildlife-v2/sheep/draft-v1.
See review-observations.md there for precise observed art findings, rejected source
evidence, commands/exits and limitations. Draft only; human review pending.
