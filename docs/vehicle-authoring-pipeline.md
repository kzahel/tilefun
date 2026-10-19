# Original vehicle authoring pipeline

Owner: [Original vehicles](topics/original-vehicles.md). Current proof is the
red coupe in [142](tactical/142-red-car-low-poly-pipeline.md), derived from the
owner-preferred approach 3 in [141](tactical/141-sports-car-style-experiments.md).
These are hand-authored family examples with reusable inspection stages, not a
validated automatic generator for arbitrary vehicles. The owner accepted corrected v3's appearance on 2026-10-19;
other families remain queued. [145](tactical/145-original-coupe-gameplay.md)
integrates the accepted car with shared spawning, traffic and sprite fallback.

The owner next authorized the Beetle-style compact in
[146](tactical/146-beetle-pipeline-review.md). It tests direct semantic UV painting
on its own rounded-family topology, while reusing the same export, pixel outline,
wheel and actual-GLB inspection contracts. Its editable component master is at
runtime topology; it does not demonstrate automatic high-to-low transfer.
The owner accepted that appearance and authorized its gameplay delivery in
[148](tactical/148-beetle-gameplay.md).

## What each stage owns

| Stage | Output and responsibility |
| --- | --- |
| Art master | Editable detailed geometry, physical dimensions, independent parts and a fixed camera; no runtime triangle restriction |
| Pixel target | Source palette, semantic visibility masks and deliberately simplified glass/lamps/vents/panel ink, rendered at game scale |
| Runtime geometry | Silhouette, cabin, actual wheel openings, ground contact and independent wheels; spend triangles on visible shape |
| Surface transfer | A view-independent UV atlas with owned surfaces, coverage/conflict evidence and explicit cleanup |
| Runtime presentation | Unlit nearest paint and a logical-pixel silhouette outline through shared engine components |
| Acceptance | Real exported GLB counts, rolling-wheel clearance, native/diagonal visual review, exact retained sources and owner decision |

Outer ink is generated from the visible alpha boundary. Interior frames/seams are
atlas paint or purposeful geometry. A screen silhouette from one view must not
be painted onto an interior surface visible from another angle. Final image-space
feature redraw is useful while designing the art target, but cannot demonstrate
that a runtime texture transfer succeeded.

## Author the art master and target

1. Choose a vehicle from [the queue](vehicle-status.md) within its authorization.
   Record source references, dimensions, wheel centers/radii, forward/up axes,
   ground pivot, camera and source scale in a recipe. A bus must not inherit a
   sports coupe's length, camera fitting or wheel assumptions.
2. Give source components explicit material/semantic ownership: body, glass,
   wheels, hubs, front/rear lamps, intakes and panels. Keep roof, windshield,
   rear glass and side windows distinguishable within those classes.
3. Build coherent shapes and genuine wheel openings. Export native-scale views
   and visible semantic masks from the same actual scene and camera. Retain
   evaluated anchors for intentionally simplified details such as deck slats.
   Give the upper tire envelope real body/fender coverage. Thin arch trim alone
   leaves the far tire crown visible above the hood/deck in elevated views.
4. Produce a limited-palette target using consistent outlines and deliberate
   clusters. Review all facings, additional angles and scenery context. Preserve
   the unprocessed render and mask inputs separately from the authored finish.

## Build and paint the runtime mesh

For this coupe, component-budgeted reduction plus owned projection is the closest
transfer so far. Purpose-built topology and true high-to-low semantic surface
baking are retained alternative experiments. Consult each route's `result.md`
and exact recipe, not an old draft or a material's display name.

1. Allocate a total budget across body, cabin, fenders, mirrors and all wheels.
   Compare a budget ladder with the same paint rules. Triangle count includes
   hidden surfaces, tire/hub meshes and every triangulated GLB primitive.
2. Reduce components separately, retaining semantic ownership. Consolidate static
   body parts and each wheel only after transfer. Small source details can become
   paint; body profile, open arches and tire silhouette need real geometry.
3. Recheck geometry **after reduction**. QEM can expand a tire's radial envelope
   or bridge a wheel opening even when the silhouette looks convincing. Restore
   measured tire centers/radii and recut wheel-local pockets where necessary.
   Never use a full-width axle cutter that also removes the central hood/deck.
4. Transfer only visible, correctly owned source samples into UV islands. Reject
   samples from the source's outside outline, another component or an occluded
   surface. Keep raw paint, confidence/unknown/conflict masks and fallback roles.
5. Clean paint in surface/UV space: continuous dark glass frames, broad blue bands,
   solid dark intakes, restrained panel seams and source-anchored simple slats.
   Choose one coherent surface interpretation when source view finishes disagree.
   Explicitly author unseen faces; nearest source colour is not observation.
6. Use a compact atlas with sufficient island padding, nearest sampling and no
   adaptive per-view palette. Atlas dimensions do not define screen pixel size;
   verify actual native samples. Separate wheel islands must never sample body
   or painted fender pixels as they rotate.

The red source's masks, ownership rules, component names and glass patch parameters
are family-specific. A rounded compact, bus or pickup needs its own explicit
geometry/ownership configuration. Shared palette, transfer diagnostics, GLB audit,
wheel proof, renderer and comparison stages should be reused.

For directly authored rounded bodies, a continuous cabin UV chart can own glass,
frames and panel seams on the actual skin triangles. Separate curved glass
overlays with different subdivisions can enter the coarse body facets and create
broken blue/ink marks. Paint the aperture on the skin, or construct matching real
aperture topology. Preserve broad glass clusters and continuous frames in every
view. This route authors unseen paint deliberately; it is not observed source
projection or evidence that high-to-low texture transfer succeeded.

## Export and verify the actual asset

- Export one opaque unlit atlas, preferably one shared material, one consolidated
  fixed body and four independent wheel meshes. Count draw primitives and exported
  UV-split vertices as well as triangles and compressed GLB bytes.
- Inspect the actual glTF JSON for `KHR_materials_unlit`. Naming a Blender material
  "unlit" does not guarantee that extension or correct base-colour texture export.
- Keep `Wheel_FL/FR/RL/RR_Steer > *_Roll > mesh` and the shared rig metadata contract.
  Radii are **exported world units**, including any root scale. Forward remains
  Blender -X, up +Z; glTF conversion and runtime normalization are separate steps.
- Import the GLB through `CarMeshAsset` with nearest unlit paint, batching and
  `CarPixelOutline`. Use the target's fixed authoring camera for fidelity, and
  separately inspect the unchanged shared game projection. Do not hide shape
  differences with heading-dependent cameras or body registration.
- Check at least 16 headings, including intermediate diagonals, and forward/reverse
  wheel phases. Verify each wheel independently, fixed body preservation and
  absolute phase reset on the actual exported hierarchy.
- Inspect upper tire coverage separately from collision clearance. Far-side tire
  crowns must sit beneath the fenders in elevated and game views; near-side
  wheels must remain seated in visible open arches. Compare opposite headings,
  top views and wheel phases. A nonintersecting tire can still be visibly exposed
  above the body. Correct the geometry; visibility/draw-order tricks and
  heading-dependent wheel hiding do not qualify it.
- Prove every neutral roll angle against actual fixed body triangles using the
  measured wheel cylinder envelopes. Include a deliberately colliding-body
  negative control and restored baseline. Steering/suspension/equipment motion
  remain separate qualifications; a passing roll proof does not approve them.

## Shared inspection commands

Builders, paint-transfer recipes and their own replay commands are under
`scripts/vehicle-bake/{a-reduced-projection,b-authored-semantic,c-surface-bake}/`.
Use a **new revision/output directory** for a replay or changed candidate.
No new family is authorized merely because its source recipe can be constructed.

After a route has completed its own inspection:

```powershell
python scripts/vehicle-bake/catalog.py --recommended a-reduced-projection--mid-fenders-v3
node scripts/vehicle-bake/build-viewer.mjs
node scripts/vehicle-bake/capture.mjs
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/clearance.py -- public/demos/vehicle-bake/manifest.json public/demos/vehicle-bake/clearance.json
python scripts/vehicle-bake/compare.py
python scripts/vehicle-bake/package.py
python scripts/vehicle-bake/freeze.py
python scripts/vehicle-bake/package.py
node scripts/vehicle-bake/verify.mjs
node scripts/vehicle-bake/status.mjs
npm run art:catalog
npm run workshop:manifest
```

`catalog.py --only ID,ID --recommended ID` makes an explicit review slice.
`capture.mjs --only=ID` captures a new revision while preserving previous captures.
`--draft` includes unfinished experiments for diagnosis; draft evidence is not
a completed review delivery. Check the clearance JSON statuses: the runner records
failures for comparison rather than aborting at the first bad candidate.
Catalog creation replaces the selection manifest. After the actual proofs and
captures, `freeze.py` verifies hashes and pins the selected assets and evidence;
the second package pass embeds that final manifest. Rebuilding the catalog requires
repeating that finalization before registering review identities. Builds never
regenerate the candidate models.

`coverage.py` runs in background Blender on an actual GLB with an explicit family
sample region. It records upper-envelope rays, broad-panel support, missing samples
and negative controls. Its declared coupe region is not a universal vehicle metric;
even unattractive raised caps can score fully covered. Use it beside clearance
and the native visual checks, never as a substitute for either.

The generated `data/vehicle-bake/review.html` embeds the compiled Three.js/shared
engine viewer, all selected low-poly GLBs and target PNGs for server-free viewing.
It loads no high-poly geometry. The browser capture runner uses bundled full
Chromium and reaps it after inspecting. Never use the owner's installed browser
with a temporary automated profile.

## Retain, review and advance

For another original family, use the independent
[`family-*` review harness](../scripts/vehicle-bake/family-README.md) with its own
config and revision directory. It preserves the coupe's frozen viewer/manifest,
uses the same shared rendering components and camera math, and creates an exact
standalone preview plus a separately registered original-family review. Its
prepare → capture → inspect → freeze contract refuses source drift and requires
actual-export wheel proofs and offline/mobile checks. Geometry, UV ownership and
coverage regions remain family-specific.

Retain the exact GLB, packed low-poly Blender scene, atlas, family/config/replay
inputs, original targets, transfer uncertainty and actual-export proof receipts.
Previous completed revisions stay immutable; normal builds use retained assets
without Blender. Register exact available review candidates; changed pixels or
geometry get a new identity. Never fabricate an approval from an agent's verdict.

Update `art-source/vehicle-bake/roster.json` first, then run
`node scripts/vehicle-bake/status.mjs`. Record style, budget, clearance and runtime
activation separately. A promising original-car prototype does not change the
existing 45-set sprite-port inventory. After the owner agrees to the red-car
result, the next transferability tests are Beetle, school bus and pickup.

For an accepted original's gameplay delivery, explicitly run
`python scripts/vehicle-bake/export-runtime.py`. Retain the exact reviewed GLB
under the runtime asset directory, a cardinal game-camera sprite sheet with the
shared frame/origin contract, measured collision bounds and handling, and their
provenance. Register it in the additive original catalog rather than changing
the immutable source sprite bank. Verify editor placement, normal automatic road
selection, driving/reload, live GPU use and failed/disabled-mesh fallback through
the shared game/lab paths. Builds consume retained outputs without regenerating.

That original command retains the coupe's historical replay. New original
families use the config-driven runtime exporter, for example:

```powershell
python scripts/vehicle-bake/runtime-export.py --config scripts/vehicle-bake/runtime-beetle-v1.json --blender 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
```

The config pins the exact frozen review manifest, model, atlas, camera captures
and source-only replay dependencies. Blender imports the actual GLB to measure
its world bounds; runtime geometry is copied without re-export. Conservative
collision dimensions round those measurements up, while existing shared rules
derive road admission and turning radius. Set handling explicitly per family.
Use `--output-root` and `--work-dir` under ignored `data/` for a replay and verify
identical model, sprite, provenance and preserved existing catalog entries.

Larger vehicles may need a larger transparent review viewport at the same pixel
density. Record its centered ground origin and mesh radius. The runtime exporter
packs occupied native pixels around (96,144) in each 192×224 fallback frame,
cropping transparent padding only. It rejects any clipped occupied pixel instead
of resizing the car. `runtime-test.py` exercises 128/224/256px inputs, row isolation,
ground registration and clipping rejection.

The school-bus experiment adds `nativeSize` to the family review config. Its
224px viewport uses radius 112 in the unchanged game projection. The study view
expands proportionally, preserving its fixed elevation, pixel density and 28px
registration. This gives a long/tall vehicle more transparent margin without
shrinking it. `family-regression.mjs` verifies the old Beetle pixels exactly and
centered crops between viewport sizes. The Workshop collection opens all frozen
families; `check-gallery.mjs` checks native sizing and navigation on desktop/phone.

For fresh-clone offline review, run `family-package.py CONFIG offline` and then
`family-verify.py CONFIG`. This verifies the frozen public files before writing
only the ignored standalone page; it needs no Blender, source regeneration or
local baseline. Do not assemble/refreeze an existing revision.

The first Beetle provenance pins `runtime-export.py` itself, so that historical
entry point remains unchanged. New families can use `runtime-export-v2.py`, which
accepts explicit retained `inputHashes` maps as well as legacy role receipts.
It verifies every declared dependency and requires the configured builder/family
pins. School-bus export and native 224px fallback packing are tested in ignored
output only; the ordinary game catalog stays unchanged until appearance approval.

## Open cargo beds and the pickup example

The pickup in [151](tactical/151-pickup-pipeline-review.md) adds a regular cab and
real open cargo tub with independent semantic owners for the floor, inner walls,
wheelhouses, cab rear and tailgate. Its constructor/configuration is under
`scripts/vehicle-bake/pickup/`; the retained source is
`art-source/vehicle-bake/pickup/v1/`. This economical component master uses direct
surface paint; it is not a high-to-low transfer demonstration.

Keep the cargo floor below the rails and keep upper deck geometry out of the open
bed. Wheelhouses may project into the tub, but the lower chassis/floor must retain
real wheel-local pockets. Inspect both rear obliques at native pixels so dark paint
does not disguise a solid deck. The actual-GLB bed probe casts declared vertical
rays onto real triangles and records floor/rail depth; it complements visual
inspection and does not replace wheel clearance or coverage checks.

The pickup uses the same native 224px viewport and fixed pixel density as the bus.
Its four wheels have a world-space radius of 8px. Its own coverage region and
whole-body roll proof are qualified independently. Reuse the frozen-only offline command with
`scripts/vehicle-bake/family-pickup.json`; its exact reviewed revision is now
active under the explicit autonomous authorization in tactical 153. The bus now has its own accepted runtime
config, `runtime-school-bus-v1.json`, consumed by the existing versioned exporter.

## Bounded production orchestration

`production.py CONFIG capture --blender BLENDER --deadline UTC_ISO` runs the
established prepare/build/capture/clearance/assembly/browser stages into a new
review directory. It stops before freezing so a coordinator can inspect the
actual native camera sheets, phases and wireframes. Record that independent
inspection in the configured QA directory, including `humanApproval: false`.
Run `production.py CONFIG inspect --deadline UTC_ISO` to compose actual native
study/engine sheets, fixed-union signed phase crops and wireframes under QA.
Inspect those images directly; generating a contact sheet is not visual approval.
Then run `production.py CONFIG freeze --baseline BASELINE --deadline UTC_ISO` to
freeze, regenerate the standalone from frozen files and verify prior bytes.
Existing frozen review directories are rejected by the capture/freeze actions;
`verify` is read-only. The helper preserves the established render/proof tools.

An optional absolute UTC deadline bounds each owned subprocess. Per-stage logs
and receipts remain under the configured ignored QA directory. The autonomous
run in [153](tactical/153-autonomous-vehicle-production.md) uses this orchestration;
its owner explicitly waived per-vehicle appearance pauses without changing
formal human review records or the required visual/gameplay checks.


New runtime receipts use `runtime-export-v3.py`: centered conservative bounds
must enclose both sides about the unchanged ground origin. Use
`ceil(2*max(abs(min),abs(max)))` for horizontal axes and `ceil(maxZ)` for height.
Explicit expected bounds reject mismatches before writing runtime assets. New
assets use zero origin tolerance; never transfer the historical coupe exception.
Preserve v1/v2 and v3 once their receipt hashes are retained. Intentional exposed
wheels (for example hot-rod fronts) retain raw unsupported crown samples plus an
explicit N/A explanation; actual whole-body roll clearance still covers every
wheel. Different axle radii must be measured and exercised independently.
