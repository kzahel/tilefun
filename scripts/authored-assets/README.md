# Reusable sprite-matched Blender authoring

Offline tools for [3D assets](../../docs/topics/3d-assets.md), introduced in
[098](../../docs/tactical/098-reusable-sprite-authoring.md). The goal is source
fidelity with coherent 3D geometry. A source-pixel projection is a draft, not a
finished asset. Geometry, camera registration, unseen surfaces and artist cleanup
remain explicit work. Normal builds never run this pipeline.

## Source and local output boundary

Before choosing a batch, run the four-view source classifier:

```text
python scripts/authored-assets/audit_vehicle_families.py --out data/authored-assets/NEW_FAMILY_AUDIT
python -m unittest discover -s scripts/authored-assets -p test_vehicle_families.py
```

It separates exact alpha/occupancy families, reversible and one-way global
palette maps, physical registration and near matches. Source contact sheets,
minimum paint-exception counts and input-pinned pair results stay in the fresh
ignored output. See [121](../../docs/tactical/121-vehicle-source-families.md) for
the 45-set findings. Identical silhouettes alone do not qualify window/fender
geometry, hidden surfaces or authored atlas color roles.

Git retains the exact final blue/green/red compact and ambulance model bundles in
[`art-source/vehicle-models/`](../../art-source/vehicle-models/README.md), with
self-contained GLBs in `public/assets/models/vehicles/`. Blender scenes, cleaned
atlases, frozen crops, portable recipes and rig/windshield records are included.
Their original model/texture bytes are preserved and pinned in the bundle catalog.

The default `compact-variant-template.json` and `compact-final-setup.json` use
only tracked inputs. Exact finished models are available immediately in a fresh
clone; replay is optional, not a substitute for retaining the deliverables.

Every finished vehicle retains its exact final bundle by default. Follow the
[next-vehicle commit checklist](../../art-source/vehicle-models/README.md#next-vehicle-what-to-commit-and-why)
for required files, their purpose and verification without ignored dependencies.

```text
python scripts/authored-assets/verify_bundles.py
node scripts/authored-assets/verify_wheel_rig.mjs data/authored-assets/NEW_RIG_CHECK --bundles
python scripts/authored-assets/pipeline.py evaluate --recipe art-source/vehicle-models/compact-4/v1/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_INSPECTION
```

Older intermediate scenes, scratch galleries and new exploratory outputs remain
local in ignored `art-source/vehicles/`, `public/demos/authored-car/` and `data/`.
The historical construction recipes below can require those intermediate bundles;
they are not prerequisites for the final models or the default palette replay.
Normal builds never regenerate the retained models. Reusable browser helpers live
in `runtime/`; the `--bundles` rig check needs no gallery. Legacy gallery checks
still need the particular local revision they exercise.

## Ambulance family

The ambulance uses a new cab/box template, not the compact palette route. Start
from a fresh workspace; `ambulance-family.json` records its dimensions, wheel
positions and four diagnostic source cameras. The constructor freezes the original
views, assigns owned affine UV paint and records explicit inferred fills. Its
own visibility-tested projection remains separate from the cleaned atlas.

```text
python scripts/authored-assets/author_ambulance.py --out data/authored-assets/NEW_AMBULANCE --blender BLENDER_EXECUTABLE
python scripts/authored-assets/pipeline.py project --recipe data/authored-assets/NEW_AMBULANCE/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_AMBULANCE/projection-001
python scripts/authored-assets/pipeline.py evaluate --recipe data/authored-assets/NEW_AMBULANCE/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_AMBULANCE/render-001
python scripts/authored-assets/pipeline.py evaluate --recipe art-source/vehicle-models/ambulance/v1/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_AMBULANCE_REPLAY
```

Retained v1 includes the exact GLB/packed scene, atlas, crops, recipe, rig, family
configuration, paint ownership, draft/coverage and audits. Its 4×2, novel-angle
strip and contour sheet are exact tracked review snapshots, not a scratch gallery.
The renderer overscans meshes that exceed the origin-centered raw frame before
applying camera registration, preserving the eight-samples-per-world-pixel scale.
Existing frames remain unchanged when geometry already fits. Verification uses
each bundle's audited mesh/triangle counts and recorded wheel radii; the ambulance
must not inherit compact-only assertions. Body/roof paint contradictions and
steering clearance remain review/qualification work. Game integration is pending.

V2 refines only the roof lights from tracked v1, retaining body/windows/wheel UVs:

```text
python scripts/authored-assets/refine_ambulance_lights.py --out data/authored-assets/NEW_AMBULANCE_LIGHTS --blender BLENDER_EXECUTABLE
python scripts/authored-assets/pipeline.py evaluate --recipe art-source/vehicle-models/ambulance/v2/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_AMBULANCE_V2_REPLAY
node scripts/authored-assets/verify_vehicle_lights.mjs data/authored-assets/NEW_FLASH_CHECK
```

Its `lights.json` records six lens nodes, groups/phases and double pulses. Blender
custom properties become versioned GLB extras. Fixed bases are not tagged. The
shared `VehicleEmergencyLights` helper clones tagged materials and modulates their
existing emissive/unlit paint; explicit enabled/time inputs prevent state leaking
between cached draws. The real GLB probe checks the declared lens count/groups/
phases, off/A/B pixels and fixed paint.
This is asset capability and shared appearance code, not wired gameplay control.
See [116](../../docs/tactical/116-ambulance-beacons-and-light-tags.md).

## Police and fire families

`emergency-families.json` records independently fitted sedan and truck dimensions,
source cameras, wheel radii and paint decisions. The generic component builder
consumes an explicit mesh spec; it does not infer family shape from a palette.

```text
python scripts/authored-assets/author_emergency_vehicle.py --vehicle police-car --out data/authored-assets/NEW_POLICE --blender BLENDER_EXECUTABLE
python scripts/authored-assets/author_emergency_vehicle.py --vehicle fire-truck-ladder-1 --out data/authored-assets/NEW_FIRE --blender BLENDER_EXECUTABLE
python scripts/authored-assets/pipeline.py project --recipe data/authored-assets/NEW_POLICE/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_POLICE_PROJECTION
python scripts/authored-assets/pipeline.py evaluate --recipe art-source/vehicle-models/police-car/v1/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_POLICE_REPLAY
node scripts/authored-assets/verify_vehicle_lights.mjs data/authored-assets/NEW_POLICE_FLASH /tilefun/assets/models/vehicles/police-car-v1.glb . art-source/vehicle-models/police-car/v1/lights.json
```

Use the analogous fire paths for its light check and retained-scene replay.
Each vehicle has two lens nodes; the light verifier reads its contract rather
than assuming ambulance's six. Keep bases/body paint untagged. `Ladder_Hinge`
parents only fire rails/rungs and declares its glTF axis; `--bundles` verifies
independent hinge motion without moving the body/wheels. It does not qualify
equipment clearance or establish a match to the raised source pose.

Both source bundles retain their own visibility-tested draft/coverage, cleaned
atlas, packed scene, component spec and portable recipe. Camera/canvas offsets
are independent of the compact/ambulance defaults. Police east faces the opposite
screen direction from fire/ambulance, and its repeated source lamp colors conflict
with fixed physical placement. Hidden roof fills remove duplicate lamp/ladder
paint; those fills are explicit authoring decisions. Preserve earlier reviews,
register the new retained inspection and follow the commit checklist above.
See [117](../../docs/tactical/117-police-and-fire-truck-models.md).

The initial fire constructor is retained v1. For the wheel-fit correction, use
the separate refinement and measured `fire-wheel-fit.json` configuration:

```text
python scripts/authored-assets/refine_fire_wheels.py --out data/authored-assets/NEW_FIRE_WHEELS --blender BLENDER_EXECUTABLE
python scripts/authored-assets/pipeline.py evaluate --recipe art-source/vehicle-models/fire-truck-ladder-1/v2/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_FIRE_V2_REPLAY
```

It checks the tracked base scene, refits axles/fenders, opens the underfloor
and rectifies wheel-local paint without moving cameras or fixed detail meshes.
`rig.json`'s `wheelWellFit` records measured source centers and camera parameters.
The actual GLB `--bundles` probe verifies those centers within two native pixels
and checks floor/tire intersection at rest (circular roll preserves clearance).
Negative probes must reject a displaced front axle and a solid floor. A working
roll/steer hierarchy alone does not qualify wheel placement or steering clearance.
See [118](../../docs/tactical/118-fire-truck-wheel-alignment.md).

## Six-wheel garbage truck

`author_garbage_truck.py` and `garbage-truck-family.json` define the green truck's
own cab/container/loader geometry, measured landmarks, per-axle radii/tracks and
UV ownership. Six tires/hubs have separate steer/roll nodes; only the front pair
steers. The loader mouth has actual walls/sill/recess and a separate hinge.
The smaller source rear caps and inconsistent roof depth are diagnostic fitting
choices, not collider measurements or clearance qualification. Orange requires
its own eligibility/paint check before transferring the family.

```text
python scripts/authored-assets/author_garbage_truck.py --out data/authored-assets/NEW_GARBAGE --blender BLENDER_EXECUTABLE
python scripts/authored-assets/pipeline.py project --recipe data/authored-assets/NEW_GARBAGE/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_GARBAGE_PROJECTION
python scripts/authored-assets/pipeline.py evaluate --recipe data/authored-assets/NEW_GARBAGE/recipe.json --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_GARBAGE_RENDER
python scripts/authored-assets/inspect_vehicle.py --run data/authored-assets/NEW_GARBAGE_RENDER --out data/authored-assets/NEW_GARBAGE_INSPECTION
node scripts/authored-assets/verify_vehicle_lights.mjs data/authored-assets/NEW_GARBAGE_FLASH /tilefun/data/authored-assets/NEW_GARBAGE_RENDER/asset.glb . data/authored-assets/NEW_GARBAGE/lights.json
```

The light contract reuses isolated emission gain, with optional `tilefun_signal`
set to `warning`. One lens brightens at .05s and is dim at .55s; the probe verifies
declared gains, visible contrast and exact off reset without assuming two groups.
The fixed physical lamp reverses sides in south/west despite repeated sprite placement.
The rig probe discovers roll nodes, compares them to the retained declared wheel
set, checks every wheel independently, and exercises all tagged equipment hinges.

## Retaining a source-owned family checkpoint

After inspection, pack its own unused projection draft into the evaluated scene
with `pack_draft.py`. `retain_vehicle.py` copies exact final bytes into a new
revision, creates the 4×2/angle/contour/real-GLB flash review and appends its catalog
record without changing earlier records. It needs a constructor's mesh/config/rig/
paint/light records and a completed light probe; it is not a regeneration or
promotion command. The existing committed checkpoints never need this command.

```text
python scripts/authored-assets/retain_vehicle.py --model data/authored-assets/NEW_GARBAGE --render data/authored-assets/NEW_GARBAGE_RENDER --projection data/authored-assets/NEW_GARBAGE_PROJECTION --inspection data/authored-assets/NEW_GARBAGE_INSPECTION --flash data/authored-assets/NEW_GARBAGE_FLASH --packed data/authored-assets/NEW_GARBAGE_PACKED.blend --config scripts/authored-assets/garbage-truck-family.json --constructor scripts/authored-assets/author_garbage_truck.py --constructor scripts/authored-assets/author_emergency_vehicle.py --constructor scripts/authored-assets/build_emergency_vehicle.py --revision vN --name "Green garbage truck" --note "Exact checkpoint limits and next review work"
```

Use a new numeric revision. The tool formats the new review JSON before pinning
it; do not reformat frozen review/source files afterward. Register the retained
candidate in Workshop, update the collection/queue, then run catalog and manifest
generation after all public review inputs are final. Verify from tracked files
alone using the delivery checklist. See [119](../../docs/tactical/119-six-wheel-garbage-truck.md).

## Engine readiness

The exported self-contained GLB contains the mesh, UV texture, flat emissive/unlit paint
and rigid wheel hierarchy. Actual Three.js GLTFLoader import/render and independent
wheel rotation were checked; Blender is not needed to consume the GLB at runtime.
The optional game/lab mesh path now loads blue compact-1 v7 through
`src/rendering/CarMeshAsset.ts`; see [108](../../docs/tactical/108-authored-blue-car-gameplay.md).
It normalizes GLB axes once, retains the authored world-pixel ground center,
disposes resources/bitmaps, falls back to the sprite and adds native silhouette
ink and distance-driven wheel roll. Internal window ink stays in the atlas.
Green/red are retained inputs for later integration. Front steering remains
neutral pending clearance qualification; physical rotated collision is separate.

## Shared process and family templates

The reusable agent entrypoint is
[`$tilefun-vehicle-authoring`](../../.agents/skills/tilefun-vehicle-authoring/SKILL.md).
The first checked replay is the red compact in
[105](../../docs/tactical/105-red-car-and-authoring-skill.md).

For compact palette variants, run one command into a **new** offline workspace:

```text
python scripts/authored-assets/author_variant.py --vehicle compact-4 --blender BLENDER_EXECUTABLE --out data/authored-assets/NEW_WORKSPACE
```

The compact configuration pins v7's fitted scene/atlas. `transfer_variant.py`
requires identical source alpha and physical metadata in all four views and a
consistent original-colour correspondence. Additional authored colours have
explicit roles; there is no nearest-RGB fallback. The runner retains this
variant's own raw projection/uncertainty, renders the actual Blender mesh,
checks native windshield-top continuity, saves a packed editable source and
renders independently rotating wheels. A mismatch routes to a new fit/paint
recipe. Ambulance and other body families are not covered by this template.
`inspect_vehicle.py` also supplies generic native contour and novel-angle sheets;
its optional windshield probe uses the compact aperture's declared top band.

The runner writes only its fresh workspace. Register/preserve a new exact
candidate separately; it neither replaces game sprites nor approves artwork.

Use the same sequence for every asset:

1. Freeze original directional crops, their hashes, anchors and metadata.
2. Select or author a family template: compact/sedan, long vehicle, utility vehicle,
   furniture/frame, building, or foliage. Begin with simple closed forms and named
   UV islands. Keep visual geometry separate from collision/support metadata.
3. Trace meaningful correspondences: wheel contacts, roof corners, hood boundaries,
   windows, posts and other structure. Fit the camera, then adjust the template
   geometry. Iterate against **all** available views using overlays. Do not
   compensate for every shape error by moving the camera.
4. Bake visible original pixels into the authored atlas. Inspect the coverage map;
   occluded or absent observations stay unknown. Disagreements between drawings
   and shared UV surfaces need a deliberate choice or improved UV islands.
5. Clean the draft without repainting the whole design: straighten seams, restore
   details/outlines, pad island gutters and author the remaining surfaces. Preserve
   draft and cleaned files separately. Use flat emission and nearest sampling to
   retain painted lighting and pixel colors.
6. Render the same mesh/atlas from all source cameras **and** unobserved angles.
   Review silhouettes, landmarks, colors, outlines and cross-view continuity.
7. Save the recipe, editable scene, atlas, portable export and exact inspection
   snapshot as a new art revision. Register a candidate before human review or
   promotion. Measurements do not approve artwork.

Steps 1, camera fitting, projection, rendering, comparison and export are shared
tools. Template selection, geometry fitting, named UVs and final paint are currently
artist/agent work. There is no automatic template fitter yet. A good compact-car
template could serve palette variants; a bus needs different geometry. Trees and
thin frame/cloth objects need their own construction methods. Single-view assets
have less observed evidence and need more authored hidden surfaces.

## Commands

Run from the repository root with Python, Pillow and Blender available. Tested
with Python 3.13, Pillow 12.2.0 and Blender 5.2.2. Blender's bundled NumPy is used
by the projection baker; scientific Python packages are not needed in the host
Python environment. Install dependencies in your chosen environment with
`python -m pip install -r scripts/authored-assets/requirements.txt` if necessary.
Pass the actual Blender executable; commands work with paths containing spaces.
Every workspace, projection and evaluation output must be a new directory.

```powershell
$blenderExe = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
python scripts/authored-assets/pipeline.py list
python scripts/authored-assets/pipeline.py init --vehicle compact-1 --setup scripts/authored-assets/compact-final-setup.json --out data/authored-assets/my-compact-v2
```

`init` creates frozen `refs/*.png`, editable `recipe.json` and an optional
`working.blend` copied from the setup template. The final compact setup uses the
tracked v7 model and retained source cameras. Copying it is a starting point for
editing; use the guarded palette runner for a source-matched variant. Original
atlas pixels, source approvals and retained model bytes are never changed. The input adapter covers all 45 vehicle
IDs in the existing bank, **not** 45 completed models.

Open `working.blend` and edit the geometry/UVs. Keep the asset in world-pixel units,
Z up and its intended ground at Z=0. The current car family faces -X. Apply
modifiers before projection; hide reference planes and scene helpers from render.
The baker targets one explicitly selected atlas material with UVs inside 0..1.

Record landmarks in the appropriate recipe view. `world` is a point in the authored
Blender scene; `pixel` is its corresponding position in the **original crop**, not
the padded comparison canvas. Use at least four landmarks spanning ground depth
and height; coplanar ground-only observations cannot recover the height mapping.
The following shows the record format, not a measured correspondence:

```json
{ "name": "roof corner", "world": [-3, 7.5, 20.2], "pixel": [27, 26] }
```

```powershell
python scripts/authored-assets/pipeline.py calibrate --recipe data/authored-assets/my-compact-v2/recipe.json --out data/authored-assets/my-compact-v2/calibrated.json
```

The solver keeps the declared azimuth and fits horizontal scale/offset plus ground
and height coefficients for an affine orthographic projection. Elevation and screen
stretch derive from those coefficients. It reports landmark residuals and rejects
rank-deficient or wrong-facing fits. It does not infer arbitrary perspective,
choose landmarks or resolve contradictory hand-drawn views. Separate camera
hypotheses are allowed for those drawings; the game camera remains a separate
shared-engine contract, not an arbitrary per-asset fit.

```powershell
python scripts/authored-assets/pipeline.py project --recipe data/authored-assets/my-compact-v2/calibrated.json --blender $blenderExe --out data/authored-assets/my-compact-v2/projections/draft-001
```

The visibility-aware baker ray-tests each candidate source observation against the
mesh. It chooses the most face-on visible source pixel without averaging colors.
The draft atlas accompanies a coverage mask: green observed, pink unobserved,
orange overlapping UV surfaces, yellow disagreeing source colors, dark unused UVs.
Counts measure UV texels, not surface area or accuracy. Shared tire/body UVs may
need reorganizing. Silhouette shadows can still contaminate observed colors; mask
or clean them explicitly rather than treating source opacity as semantic truth.

When the selected material has a matching authored atlas, an additional
`projection-with-authored-fill.png` retains that existing paint in unknown/shared
regions. The coverage mask does not change. This is a cleanup starting point with
inferred paint, not recovered source evidence. Copy the chosen draft to a separate
`clean-atlas.png`, clean it, and keep unknown/conflict decisions recorded. Gutters
must be padded during cleanup; the raw baker does not add them.

```powershell
python scripts/authored-assets/pipeline.py evaluate --recipe data/authored-assets/my-compact-v2/calibrated.json --atlas data/authored-assets/my-compact-v2/clean-atlas.png --blender $blenderExe --out data/authored-assets/my-compact-v2/runs/clean-001
```

Omit `--atlas` to evaluate the scene's current materials. The explicit override
binds the recipe's `projection.material` and `projection.textureNode`. Default
inspection converts a direct Principled surface to unlit emission without changing
the mesh or paint; complex node graphs require an authored unlit material or
`appearance: "lit"`. Alpha is preserved. Source comparison uses logical native
pixels, enlarged with nearest-neighbor sampling. The report includes a 4×2 sheet
for four-view inputs, half-opacity overlays, difference images, silhouette/opaque
overlap color measurements, four extra angles, packed `.blend`, GLB and hashes.
Painted shadows remain in silhouette metrics unless a view's `ignoreMask` is
provided as a logical-canvas-sized grayscale image (nonzero means ignore).

## Other assets and repeatability

```powershell
python scripts/authored-assets/pipeline.py init --spec scripts/authored-assets/picnic-table-spec.json --out data/authored-assets/my-table-v1
```

The generic specification accepts an asset ID, family, source image/hash and any
number of named source rectangles, anchors and camera hypotheses. The table
example freezes an existing sprite; it does not supply a table model. Author/select
that family's Blender file, set `workingBlend` and its atlas material/node, then
use the same fitting → projection → cleanup → evaluation commands. No car-specific
names or shape assumptions are present in the renderer or baker.

Evidence under `data/authored-assets/` is ignored local work. Retain useful runs and
their hashes; changed registered art always gets a new revision. To qualify the
workflow for production, first bring compact-1 close to its originals, confirm the
same geometry template on another vehicle and then test a structurally different
vehicle. Only broaden to another asset class after that fidelity gate.

```powershell
python -m unittest discover -s scripts/authored-assets -p 'test_*.py'
python scripts/authored-assets/verify_projection.py --blender $blenderExe --out data/authored-assets/projection-check-001
```

Tests cover camera recovery/invalid fits, source hashes, exact crops, overwrite
guards and measurement semantics. The real Blender smoke checks visible source
bytes, occlusion rejection, ambiguous overlapping UVs and explicit source-view
ownership. All Blender operations
run in isolated background processes and never drive the user's open scene.

## Historical compact-family construction

The remaining sections document the original intermediate fitting/paint sequence.
Their named v1–v6 scene/demo inputs remain ignored local evidence. Use the tracked
final bundle and palette route above for a fresh-checkout replay; older construction
is optional and requires restoring its explicitly named intermediate inputs.

## Compact-family window and fender refinement

099 preserves the registered 097 source and supplies a separate editable template
with four continuous window/frame panels and four curved, beveled wheel-arch lips.
The 47 original meshes keep their vertex positions; their UVs move into the
top-left quarter of a 1024-square atlas. Eight new islands occupy separate regions.
The same geometry and cleanup commands work on compact-1 and compact-2.

Start from the retained refined template in a NEW workspace:

```powershell
python scripts/authored-assets/pipeline.py init --vehicle compact-1 --setup scripts/authored-assets/compact-refined-setup.json --out data/authored-assets/my-refined-compact
python scripts/authored-assets/pipeline.py project --recipe data/authored-assets/my-refined-compact/recipe.json --blender $blenderExe --out data/authored-assets/my-refined-compact/projections/draft-001
python scripts/authored-assets/clean_compact.py --recipe data/authored-assets/my-refined-compact/recipe.json --projection data/authored-assets/my-refined-compact/projections/draft-001/projection-with-authored-fill.png --geometry public/demos/authored-car/v2/geometry.json --out data/authored-assets/my-refined-compact/clean-atlas.png
python scripts/authored-assets/pipeline.py evaluate --recipe data/authored-assets/my-refined-compact/recipe.json --atlas data/authored-assets/my-refined-compact/clean-atlas.png --blender $blenderExe --out data/authored-assets/my-refined-compact/runs/clean-001
```

Replace the vehicle ID to test the second palette variant. Window islands copy
the original side-window/frame crop; fender bands use explicitly authored paint
from four source-palette landmarks. Eight-texel gutters surround the new islands.
Neither operation changes the projection's uncertainty mask. The shared
`compact-refinement.json` records traced window boundaries, side-plane parameters,
arch cross-section/taper and palette sample positions. These assumptions apply to
this compact family, not arbitrary vehicles.

To author another geometry revision, make a 1024-square base atlas with the old
`public/demos/authored-car/v1/car-atlas.png` pasted at (0, 0); fill the remainder
with an authored body color. Run the constructor on an isolated load of the 097
scene, choosing a new output directory:

```powershell
& $blenderExe --background --factory-startup art-source/vehicles/compact-car/blender-v1/car.blend --python-exit-code 1 --python scripts/authored-assets/refine_compact.py -- data/authored-assets/my-new-template scripts/authored-assets/compact-refinement.json data/authored-assets/my-base-atlas.png
```

Its geometry record supplies the new island rectangles and source owners. Copy
the refined setup, point `blend` to the new template, and copy the geometry
record's `sourceViews` into `projection.sourceViews`, retaining the cabin owners.
Then repeat extraction, projection, cleanup and evaluation into new directories.
Do not construct over a registered source or output directory.

The generic baker also accepts `projection.sourceViews`: region name → array of
allowed view IDs. It uses an object's `uv_region` property, falling back to its
name; unspecified regions retain normal visibility-based selection. An empty
array deliberately leaves that region unobserved. Unknown view IDs fail. This
keeps conflicting front/top drawings out of side-window islands without blending
colors or inventing recovered evidence. This refinement still needs closer
windshield/hood/roof fitting and human review before family-template acceptance.

## Pixel outline and silhouette fitting

100 supplies `compact-outline-setup.json` and `compact-outline-refinement.json`:
the same family with smaller arch radius/flare and source-dark wheel-well paint.
Initialize a NEW workspace using the outline setup, run projection, then run
`clean_compact.py` with `--geometry public/demos/authored-car/v3/geometry.json`
and `--config scripts/authored-assets/compact-outline-refinement.json`. Evaluate
with that atlas into a new run. Both compact variants use the same commands.
The setup carries this explicit style into the recipe:

```json
"pixelStyle": { "outline": "inner", "outlineColor": [58, 58, 80], "logicalPixelWidth": 1 }
```

The inward pass inks one four-neighbor contour pixel while preserving every
alpha byte and darker existing paint. `off` disables it; `outer` is a diagnostic
that grows occupancy. Other widths fail. It runs after native camera/pixel
alignment and before nearest enlargement; unoutlined renders remain separate.
Novel mesh angles use the same logical canvas and treatment. Recipes without
the option keep their previous appearance.

GLB and Blender materials do NOT contain the image-space outline. The reusable
GLSL/helper is `scripts/authored-assets/runtime/pixel-outline.*`; the local v3 gallery retains
immutable copies. It processes native RGBA colors, uses alpha-neighbor
`texelFetch`, and preserves source encoded colors without lighting/tone mapping.
The gallery toggles the real GPU pass over saved Blender renders; gameplay
integration remains separate. Internal window/door lines stay in the atlas;
polygon edges and texture contrast are not automatically inked.

```powershell
python scripts/authored-assets/silhouette_report.py --before data/authored-assets/previous-run --after data/authored-assets/new-run --out data/authored-assets/new-silhouette-report
python scripts/authored-assets/verify_pixel_style.py --out data/authored-assets/new-pixel-browser-check
```

The silhouette report checks identical sources, displays source contours and
missing/extra occupancy, and records IoU plus mean/max bidirectional boundary
distance in logical pixels. Alpha threshold is 128; source painted shadows stay
included. Whole-car occupancy can conceal wrong internal arches, so inspect
local boundaries and landmarks too. The browser check verifies GPU/reference
bytes, threshold/partial alpha, all outline modes, desktop/phone layout and both
actual GLBs, closing its isolated server/browser.

## Body fitting and independent rigid wheels

101 starts from a COPY of v3 and records body/window/axle parameters in
`compact-body-rig.json`. `rig_compact.py` authors the profile correction plus
`CarRoot → Body` and four `Steer → Roll → tire + hub` chains. Mesh topology/UVs
stay; vertices deliberately change. Wheel radius/rest contact remain. Use
`compact-rigged-setup.json` for a NEW workspace, then project and clean with
the same v3 island record and outline-family config. Author the hub paint into
a separate atlas and evaluate it:

```powershell
python scripts/authored-assets/pipeline.py init --vehicle compact-2 --setup scripts/authored-assets/compact-rigged-setup.json --out data/authored-assets/my-rigged-compact
python scripts/authored-assets/pipeline.py project --recipe data/authored-assets/my-rigged-compact/recipe.json --blender $blenderExe --out data/authored-assets/my-rigged-compact/projections/draft-001
python scripts/authored-assets/clean_compact.py --recipe data/authored-assets/my-rigged-compact/recipe.json --projection data/authored-assets/my-rigged-compact/projections/draft-001/projection-with-authored-fill.png --geometry public/demos/authored-car/v3/geometry.json --config scripts/authored-assets/compact-outline-refinement.json --out data/authored-assets/my-rigged-compact/clean-atlas.png
python scripts/authored-assets/paint_wheel_hubs.py --recipe data/authored-assets/my-rigged-compact/recipe.json --atlas data/authored-assets/my-rigged-compact/clean-atlas.png --out data/authored-assets/my-rigged-compact/animated-atlas.png
python scripts/authored-assets/pipeline.py evaluate --recipe data/authored-assets/my-rigged-compact/recipe.json --atlas data/authored-assets/my-rigged-compact/animated-atlas.png --blender $blenderExe --out data/authored-assets/my-rigged-compact/runs/fitted-001
```

To construct another body/rig revision, run the constructor on an isolated v3
source, with NEW output/config and absolute paths for media:

```powershell
& $blenderExe --background --factory-startup art-source/vehicles/compact-car/blender-v3/car.blend --python-exit-code 1 --python scripts/authored-assets/rig_compact.py -- data/authored-assets/my-new-body scripts/authored-assets/compact-body-rig.json
& $blenderExe --background --factory-startup data/authored-assets/my-rigged-compact/runs/fitted-001/asset.blend --python-exit-code 1 --python scripts/authored-assets/render_wheel_roll.py -- data/authored-assets/my-wheel-frames public/demos/authored-car/v4/rig.json
python scripts/authored-assets/wheel_roll_panels.py --frames data/authored-assets/my-wheel-frames --out data/authored-assets/my-wheel-roll.gif
node scripts/authored-assets/verify_wheel_rig.mjs data/authored-assets/my-wheel-browser-check
```

`runtime/wheel-rig.mjs` takes the loaded per-car GLTF scene and THREE namespace. Use
`setTravel(signedPathDistance)`, `setWheelTravel(id, distance)` or
`setSteering(radians)`. Phase is `-distance/radius` about exported local -Z,
with forward -X; stopping/reverse follow signed distance rather than idle time.
Front steering uses a separate parent pivot about exported +Y. The exporter
selects tagged rig ancestors and preserves radius/axis extras. GLB has no baked
clip; pixel outlines still need a separate render pass. Steering clearance and
gameplay integration are unqualified. Hub spokes are explicit authored paint;
these family assumptions do not apply to arbitrary source vehicles.

## Windshield aperture and cabin corner paint

102's `compact-windshield-setup.json` loads the retained v5 family template with
the same cameras, outline and wheel nodes. Initialize a NEW workspace, project,
then perform the v3 window/fender cleanup and hub paint as above. Finally run:

```powershell
python scripts/authored-assets/paint_windshield.py --recipe data/authored-assets/my-windshield-car/recipe.json --atlas data/authored-assets/my-windshield-car/animated-atlas.png --geometry public/demos/authored-car/v5/windshield.json --config scripts/authored-assets/compact-windshield.json --out data/authored-assets/my-windshield-car/windshield-atlas.png
python scripts/authored-assets/pipeline.py evaluate --recipe data/authored-assets/my-windshield-car/recipe.json --atlas data/authored-assets/my-windshield-car/windshield-atlas.png --blender $blenderExe --out data/authored-assets/my-windshield-car/runs/boundary-001
node scripts/authored-assets/verify_wheel_rig.mjs data/authored-assets/my-windshield-browser-check v5
```

The frame and glass exactly partition the original windshield surface. Glass
uses the front sprite's original crop; perimeter bands and the forward cabin
wedge use body palette. This prevents front-glass paint from appearing on the
side corner. Coverage/unknown diagnostics remain independent and unmodified.
The JSON crop is in the original unpadded 32×64 south source coordinates, not
the 64-square comparison canvas. The side-window leading boundary is in mesh
X/Z coordinates. These landmarks must be authored for another family.

To build a NEW aperture revision, load a COPY of v4 (with its original one-face
windshield), choosing a new output and parameter file:

```powershell
& $blenderExe --background --factory-startup art-source/vehicles/compact-car/blender-v4/car.blend --python-exit-code 1 --python scripts/authored-assets/refine_windshield.py -- data/authored-assets/my-new-windshield scripts/authored-assets/compact-windshield.json
```

Point a copied setup at the new source, and pass its `windshield.json` to paint.
The constructor leaves other meshes/UVs, outer seam and wheel transforms fixed.
Inspect the side and front cameras plus diagonal angles: source silhouettes
alone do not detect cross-surface paint, and wider coherent pillars can differ
from the deliberately stylized sprite. GLB outline and steering-clearance limits
from the preceding section still apply.

103 adds the missing dark windshield border as an optional separate frame-paint
step, preserving the aperture/glass/cabin correction. After 102 cleanup, run:

```powershell
python scripts/authored-assets/ink_windshield.py --recipe data/authored-assets/my-windshield-car/recipe.json --atlas data/authored-assets/my-windshield-car/windshield-atlas.png --geometry public/demos/authored-car/v5/windshield.json --aperture scripts/authored-assets/compact-windshield.json --config scripts/authored-assets/compact-windshield-ink.json --out data/authored-assets/my-windshield-car/inked-atlas.png
```

Evaluate that new atlas into a new run. The frame band is 0.85 world units,
sampled from original window navy, with square corner joins and no changes to
glass pixels, other islands or alpha. It is included in GLB paint, while outer
silhouette ink remains a render pass. Validate the retained v6 exports/gallery
with `verify_wheel_rig.mjs NEW_OUTPUT v6`. Editable inked sources live in
`art-source/vehicles/compact-car/blender-v6/`; geometry is identical to v5.

104 corrects a top band that existed in the atlas but disappeared at native side
scale. After 103's ink step, run this optional top-only correction and evaluate
its new atlas into a new run:

```powershell
python scripts/authored-assets/ink_windshield_top.py --recipe data/authored-assets/my-windshield-car/recipe.json --atlas data/authored-assets/my-windshield-car/inked-atlas.png --geometry public/demos/authored-car/v6/windshield.json --aperture scripts/authored-assets/compact-windshield.json --config scripts/authored-assets/compact-windshield-top-ink.json --out data/authored-assets/my-windshield-car/top-atlas.png
```

The 1.85-world-unit total top stroke extends into glass; side/bottom frame paint
and other islands stay fixed. Confirm actual native renders at the relevant
cameras, because an atlas border can be subpixel after projection. Retained
v7's `top-edge-probe.json` records continuous navy segments over the full aperture
width in all four cameras and both palettes. Run `verify_wheel_rig.mjs NEW_OUTPUT
v7` for real exports/gallery. Future camera scales can require other stroke
weights; there is no universal one-pixel guarantee under arbitrary projection.

## Complete compact family checkpoint

After strict `author_variant.py` eligibility/paint replay, `retain_variant.py`
copies the final checkpoint into a fresh tracked revision, including the packed
scene, atlas, own draft/coverage, frozen crops, portable recipe, provenance and
exact review snapshots. It preserves every earlier catalog/file byte. Final
assets are required deliverables; exploratory work stays under ignored `data/`.

```text
python scripts/authored-assets/retain_variant.py --model data/authored-assets/NEW_VARIANT --revision v1 --name "Cyan compact"
node scripts/authored-assets/verify_engine_vehicles.mjs data/authored-assets/NEW_ENGINE_PROBE
```

The engine probe uses bundled Chromium and the actual shared GPU backend. It
checks each registered vehicle's own GLB, visible pixels, cold-load fallback,
absolute pose/light reset, simulation isolation, unknown IDs and disposal. An
optional second argument selects a tracked-only checkout root. Browser gameplay
checks additionally cover every compact selection and a failed GLB load. See
[122](../../docs/tactical/122-complete-vehicle-port.md) for checkpoint evidence.
