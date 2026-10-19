# B: authored semantic approach-3 coupe

Final candidates are `v4` (2,378 triangles) and `budget-low-v4` (1,324).
They use the same 512×512 atlas, byte for byte. `result.md` owns this route's
handoff. No other vehicle, runtime activation or production approval is implied.

The source is 141 approach 3, not approach 4. `paint.py` retains its width/deck
functions and superellipse powers. `build.py` samples those functions into an
economical longitudinal shell, cuts true local wheel pockets, and uses the
retained windshield/roof/side-window landmarks. It spends extra triangles on
the high-budget longitudinal profile, curved cabin patches, fender lips and
wheel envelopes. There is no decimation or screen-space reprojection.

Semantic UV regions own coachwork, front/rear/side glass, roof, end fascia,
fender ribbons, tire tread and five-spoke caps. Source mask/palette histograms
are retained in each source bundle. The body ramp, hood seams, three deck
slats, glass frames and reflection bands are authored in these regions.
Opposing studio highlights cannot coexist in one atlas: the symmetric ramp is
an explicit compromise. Hidden surfaces are inferred. No raw projection was
used, and the empty rejected-projection image does not assert observed coverage.

Each model is one static body plus four independent tire/hub meshes. Actual
exports have one opaque `KHR_materials_unlit` material and five primitives.
The uniform export root scale is `80/4.6`; wheel radius extras include it.
The editable packed source remains in source units and includes the original
orthographic camera. The rear buttress tapers at its lower endpoint to preserve
conservative swept-cylinder wheel clearance. Steering is held neutral.

Use a fresh revision for replay; completed candidates are guarded by manifests.
For example, from the repository root in PowerShell:

```powershell
python -m venv data/vehicle-bake/b-authored-semantic/replay-env
& data/vehicle-bake/b-authored-semantic/replay-env/Scripts/python.exe -m pip install -r scripts/vehicle-bake/b-authored-semantic/requirements.txt
& data/vehicle-bake/b-authored-semantic/replay-env/Scripts/python.exe art-source/vehicle-bake/b-authored-semantic/v4/scripts/paint.py --revision replay-high
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python art-source/vehicle-bake/b-authored-semantic/v4/scripts/build.py -- --revision replay-high --budget high
& data/vehicle-bake/b-authored-semantic/replay-env/Scripts/python.exe art-source/vehicle-bake/b-authored-semantic/v4/scripts/finish.py --revision replay-high
```

Use the low bundle's snapshot and `--budget low` for the lower budget. The
scripts find the repository root from the shared contract's location. Replay
requires the retained 141 target drawings, semantic masks and source evidence,
whose hashes are in each report. It requires no ignored authoring scene or atlas.
Pillow/NumPy are the only external Python packages; Blender carries its own Python.

`build.py` exports before discarding the authoring scene, imports the real GLB,
and renders eight contract headings, four intermediate headings, and four wheel
roll poses. All mesh interiors come from the export. `finish.py` applies nearest
512→128 sampling, constant (0,+28) translation, binary alpha, and a one-pixel
inward alpha-boundary outline. It never redraws interior features or quantizes
rendered colors. `wireframe.png` is an optional proof-material render and is
coarsely sampled; the exported index/vertex audit is the topology authority.

The audit reads actual GLB buffers and hierarchy. It checks exact triangles,
UV-split vertices, materials, primitives, embedded atlas pixels, ground contact,
wheel radii/axes and independent roll/reset. It clips all body triangles against
each wheel's axial slab, proves separation from its full swept cylinder, and
rejects an inserted colliding triangle. This is stronger than testing sampled
roll poses alone; steering clearance remains unqualified.

After an actual visual inspection, `seal.py` preserves the exact recipe scripts,
marks the reports complete with the inspection receipt and limitations, writes
source/output manifests, and guards future overwrites. It can verify a completed
candidate without rendering or changing it:

```powershell
python scripts/vehicle-bake/b-authored-semantic/seal.py --revision v4 --verify
python scripts/vehicle-bake/b-authored-semantic/seal.py --revision budget-low-v4 --verify
```
