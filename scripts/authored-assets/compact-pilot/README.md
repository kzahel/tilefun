# Initial compact geometry and paint

Preserved constructors from the 097 Blender pilot, separate from its generated
scene and demo. These scripts create the initial 47-mesh / 438-triangle car from
the committed, licensed vehicle atlas. They do not recreate the fitted v7 template
or its exact Blender bytes; the parent workflow documents later refinements.

Run from the repository root with Python/Pillow and Blender installed. Select a
fresh ignored workspace with `TILEFUN_COMPACT_PILOT`; the default is
`data/authored-assets/compact-pilot`. Preparation rejects an existing workspace,
and construction rejects an existing scene. Each Blender invocation uses its own
factory-startup process.

```powershell
$env:TILEFUN_COMPACT_PILOT = "$PWD/data/authored-assets/NEW_PILOT"
$blenderExe = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
python scripts/authored-assets/compact-pilot/prepare.py
& $blenderExe --background --factory-startup --python-exit-code 1 --python scripts/authored-assets/compact-pilot/build.py
python scripts/authored-assets/compact-pilot/paint.py
& $blenderExe --background --factory-startup "$env:TILEFUN_COMPACT_PILOT/source/car.blend" --python-exit-code 1 --python scripts/authored-assets/compact-pilot/finish.py
& $blenderExe --background --factory-startup "$env:TILEFUN_COMPACT_PILOT/source/car.blend" --python-exit-code 1 --python scripts/authored-assets/compact-pilot/audit.py
python scripts/authored-assets/compact-pilot/panels.py
```

`source/` contains exact reference crops, generated geometry and editable Blender
scene. `render/` contains the atlas, uncertain projection, portable GLB, actual
mesh renders, inspection sheets, turntable and hashes. All are local outputs.
`panels.py` records hashes of the retained constructors rather than looking for
scripts beside generated source files. Candidate records are offline evidence;
these commands do not register anything in Workshop or promote game assets.

This initial geometry uses the older approximate projection and lit inspection
views. For native source matching, use the parent pipeline's camera fitting,
visibility-tested projection, unlit evaluation and family-specific refinements.
Source artwork is Modern Exteriors by LimeZu; see
[asset credits](../../../public/assets/SOURCES.md).
