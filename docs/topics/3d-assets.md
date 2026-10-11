# 3D assets and sprite reconstruction

Topic: 3d-assets
Status: car projection and orthographic inspection delivered; top-view appearance
unresolved. Authored Blender/UV compact-car pilot delivered for inspection.
Reusable offline fitting/projection/inspection tools delivered. All 45 vehicles
have retained own Blender/UV source bundles and engine integrations (49 revisions);
exact production art review and source-projection fidelity remain open.
Fixed-view GPU gameplay integration is delivered and is the main-game default;
Local SDXL/MV-Adapter/U2Net/TRELLIS.2 workflow and ten current-asset stage sheets
are delivered. Volume is feasible; conditioning, masks, fidelity and registration
remain unresolved. Game clipping is unchanged.
Updated: 2026-10-12.

Owns reconstructing coherent visual assets from sprite artwork, their relationship
to physical proxies, and cross-view quality. [Rendering architecture](rendering-architecture.md)
owns engine interfaces and GPU integration; [performance](performance.md) owns
measurements. [Research and investigations](../research/sprite-to-3d-and-renderer-options.md)
records the experiments, external options and their limits.

[Vehicle model porting](vehicle-model-porting.md) owns the running list of all
45 vehicle sets, model/engine status and next actions. Update it at each vehicle
checkpoint; ambulance v1's authoring is recorded in
[115](../tactical/115-authored-ambulance.md). V2 now awaits owner inspection;
its light refinement and actual GLB flash proof are recorded in
[116](../tactical/116-ambulance-beacons-and-light-tags.md).
Police and stowed fire truck v1 now await inspection in
[117](../tactical/117-police-and-fire-truck-models.md); the raised ladder is completed in the final [122](../tactical/122-complete-vehicle-port.md) checkpoint. Fire v2 fixes wheel placement, floor intersections and tire UVs in
[118](../tactical/118-fire-truck-wheel-alignment.md). Six source sets now have
retained models across eight exact revisions at that checkpoint. Green garbage
truck v1 now adds a seventh source set/ninth exact revision in
[119](../tactical/119-six-wheel-garbage-truck.md).

The complete-bank pass in [122](../tactical/122-complete-vehicle-port.md) adds cyan,
orange and silver compacts from the strict four-view palette replay. Ten source
sets now have retained models across twelve exact revisions. All six compact
colors, ambulance v2 and stowed fire v2 use their own game/lab GPU assets; every
other source retains its sprite fallback. New compact recipes use their retained
packed scene and own atlas/draft; normal builds do not run Blender. The source
family fit and existing clearance/review limits remain explicit.

[122](../tactical/122-complete-vehicle-port.md) also fits the seven additional
sedans independently. Seventeen source sets now have retained models across
nineteen exact revisions, with fifteen own-asset game/lab integrations. Cabin
sides slope inward so side glass remains visible in front/back views. Source
shape gates record each crop's origin delta, including dark's registration;
each UV owner samples its own color rather than assuming a global palette map.
Four radius-six wheels fit measured source wells and pass actual floor/roll
checks and displaced-axle/solid-floor negative probes. A north-owned roof retains
opposing paint/projection differences. Exact art review remains separate.

Six own-source buses in [122](../tactical/122-complete-vehicle-port.md) bring the
queue to 23 retained sets / 25 revisions and 21 own-asset game/lab integrations.
The connected long body has asymmetric paint, separate end glazing, four
radius-eight wheel rigs and A/B mirror geometry. Actual wheel/well/open-floor
checks and additional sloped-floor rotation-sphere probes pass. Roof vent and
opposing mirror projection differences remain explicit; whole-body nonzero
steering is unqualified. All exact source/GLB/comparison dependencies are tracked.

Twenty own-source large cars in [122](../tactical/122-complete-vehicle-port.md)
bring the queue to 43 retained sets / 45 revisions and 41 own-asset integrations.
Three separately fitted silhouette families preserve their own source paint,
sloped glazing, geometric borders and four independent wheel assemblies.
Actual exported tire/hub cylinder envelopes prove whole-body clearance through
all neutral roll angles, including hood/cabin/fenders; deliberate collisions
are rejected before retention. Nonzero steering and exact production art review
remain open. Opposing roof highlights and camera-depth differences are explicit
fitting limits. Orange garbage and raised fire remain the final two new models.


The final service checkpoint in [122](../tactical/122-complete-vehicle-port.md)
brings the queue to **45 retained sets / 49 immutable revisions / 45 own-model
integrations**. Orange garbage has source-owned paint, explicit opposite crop
registration and six independent wheels. The raised fire model preserves its own
18-degree ladder rest pose; arbitrary hinge motion stays unqualified. Ambulance
v3/police v2 open only their level floor at wheel bounds while retaining original
floor perimeter/UVs, atlas, visible geometry and source cameras. Whole-body actual
GLB cylinder proofs pass every latest vehicle through all neutral roll angles;
actual shared engine probes roll all 184 wheels by their exported radii.
Siren controls cover ambulance, police and both fire trucks; both garbage warning
beacons toggle silently. Packed editable scenes, own unused UV drafts, clean
atlases, exact GLBs and 4×2/novel/contour/light reviews are tracked; normal builds
consume committed assets. Earlier snapshots remain unchanged.

## Investigation evidence storage

The evidence directories for investigations 070–075 under `docs/tactical/` are
local, Git-ignored outputs. They contain source crops, generated renders,
comparison sheets, JSON records, arrays and HTML reports; links into those
directories require the local evidence and are unavailable in a fresh clone.
Written findings and the recipes in `scripts/spatial-assets/` remain in Git.
Ignoring the evidence does not delete it or promote any generated artwork.

The initial source-only commit kept all Blender vehicle outputs ignored. The
owner subsequently required the exact finished models and replay dependencies
in Git. [106](../tactical/106-retained-vehicle-model-bundles.md) retains blue/green
v7 and red v1 as byte-exact GLBs in `public/assets/models/vehicles/`, with their
packed Blender scenes, atlases, frozen crops, portable recipes and rig/window
records in [`art-source/vehicle-models/`](../../art-source/vehicle-models/README.md).
The catalog pins original capture hashes; the default compact replay now uses
only tracked dependencies. A fresh clone does not need the ignored template or
to reconstruct the final geometry from the initial pilot.

This is the default delivery contract for subsequent finished vehicles: commit
their exact final export, editable source bundle and required dependencies.
The [next-vehicle checklist](../../art-source/vehicle-models/README.md#next-vehicle-what-to-commit-and-why)
owns the file list, reasons and tracked-file-only verification; scripts alone do
not deliver a finished model.

Ambulance v1 adds a new family-specific cab/box mesh with its own side graphics,
roof equipment and rigid wheels: 54 meshes/1,024 triangles, world-pixel units,
four radius-8 tire/hub assemblies. Its packed scene, exact GLB/atlas and all recipe
dependencies are retained alongside the compacts. The tracked 4×2, contour sheet
and novel-angle strip form an exact excluded Workshop inspection. Native contour
IoU is 0.918 east/west, 0.930 rear and 0.914 front (shadows included, not a human
fidelity score). Roof paint contradictions, rear-facing cab/nose, rear trim and
steering clearance remain open; engine integration and production promotion are
pending. The generic raw renderer now overscans long/tall meshes before camera
registration instead of clipping them; the blue compact's eight recorded render
hashes remain unchanged. See [115](../tactical/115-authored-ambulance.md).

Ambulance v2 refines tapered beacons and thinner light bars without changing body,
window or wheel geometry/UVs. Six lens meshes carry versioned GLB extras; their
six fixed bases remain untagged. The shared emergency-light helper pulses imported
emissive/unlit paint from an explicit enabled/time input, with material isolation
and exact off reset verified on the GLB. Gameplay control and per-asset integration
remain pending. V1 and its original capture identity remain intact.

Police v1 and stowed fire truck v1 add two independently fitted families, retained
with packed Blender/atlas/draft sources, self-contained GLBs and exact 4×2,
contour, novel-angle and actual GLB flashing reviews. Each has two tagged light
lenses and four steer/roll wheel assemblies. Fire's rails/rungs parent to a
separate `Ladder_Hinge`; independent motion is verified, while raised-pose and
clearance qualification remain queued. Police source art repeats red/blue ordering
in opposing views, so the physical bar reverses in south/west. Cab roof paint,
wheel footprints and body proportions remain review limitations. See
[117](../tactical/117-police-and-fire-truck-models.md) and the
[running queue](vehicle-model-porting.md). Game control/audio and per-model
integration remain pending.

Stowed fire v2 preserves cameras and fixed body/roof/ladder/light component
records while refitting axles and openings, clearing the floor from tires and
rectifying cap/tread paint. Actual GLB wheel centers are within 1.38 native
pixels of observed wells. The verifier rejects a displaced axle and the old
solid floor; roll is clear, steering/raised equipment remain unqualified.
The earlier v1 and its review remain immutable.

Green garbage truck v1 exercises tandem rear axles, partly hidden wheels, source
side ownership, tapered/open loader geometry and a single amber warning beacon.
It has 52 meshes/1,476 triangles and six independently rotating tire/hub assemblies
with per-axle radii/tracks. The actual GLB passes measured wheel centers and floor
clearance, all-wheel forward/reverse/independent motion, front-only steering and
independent loader hinge motion. Probes read declared wheel/lens sets, including
single-beacon dim phases; fixed paint and exact off reset are preserved.
Roof-depth contradictions, rear-wheel physical scale and animated clearance remain
inspection limits. Warning metadata does not add game controls or audio.

Older `art-source/vehicles/`, `public/demos/authored-car/` and `data/` artifacts
remain ignored local evidence. Historical gallery links below require those
bundles. Scratch-only Workshop registrations remain removed; retaining final
models does not promote them to gameplay or establish a human review approval.
The reusable skill, constructors, fitted configurations and outline/wheel helpers
remain tracked. New exploratory work belongs in fresh ignored workspaces.

Rebuild report previews from the retained external experiment bundles when
needed. Preserve those bundles for exact historical evidence: rerunning model
generation is not guaranteed to reproduce the same bytes across environments,
and the hosted reference has no pinned model revision or seed. These outputs
are not required by normal game builds. Promoted assets and human review
snapshots retain their existing immutable-storage contracts.

## Desired outcome

An asset can have a coherent visual mesh, explicit texture coverage and a separate
physical proxy, all aligned to the same world origin and scale. The normal game
can retain its sprite presentation while an experimental view shows the same
world from orthographic or perspective cameras. Later, sufficiently complete
assets could support a fully 3D presentation, including first person.

The immediate integration target keeps the current fixed game projection and
allows individual entities to use meshes with continuous orientation. Sprites
remain the fallback. The [sprite/mesh invariants](rendering-architecture.md#fixed-view-spritemesh-invariants)
own identity, transform, composition and lifecycle rules for that shared path;
asset tools must consume its common implementation rather than fork it.

This is a direction, not a claim that all sprites have recoverable hidden surfaces
or that changing the renderer alone makes the world ready for first person.

The latest authored compact already exports a self-contained, Three.js-tested
GLB with textured meshes and independent wheel pivots. No Blender runtime is
required. [108](../tactical/108-authored-blue-car-gameplay.md) connects the retained
blue `compact-1` v7 GLB to the shared optional game/lab mesh path, with explicit
axis normalization, authored ground-center/world-pixel registration, nearest unlit
paint, inward native-pixel silhouette ink and cosmetic distance-driven wheel roll.
[112](../tactical/112-coherent-car-presentation-and-test-override.md) supersedes
109's directional body lens with the fixed world `x, y-z` projection. A static
1.3× lateral registration widens the authored narrow front view before rotation;
forward length, roof height and circular tire geometry stay unchanged. Heading
follows displayed motion immediately and holds at rest. Missing/loading/failed
models retain the complete sprite. GPU + 3D car is the
owner-selected main-game default as of 2026-10-11. The game selector is
**Debug → Renderer → GPU + 3D car**, or `?renderer=gpu&meshes`.

All six compact colors now use their own assets with this adapter. For testing, append `&allcars3d`
to `?renderer=gpu&meshes` in the game or Traffic lab: all `vehicle-v1:` road
vehicles, including buses/vans, use the blue appearance. Their original types,
sprites, colliders and persistence remain unchanged; trains are excluded. Canvas
and GPU sprites still draw their original sprites. The override is view-local and
survives renderer switches, scene resets and refresh via the URL.
Simulation, prediction, input, cardinal colliders, roof support and persistence
are unchanged. Wheel steering stays neutral; authored clearance is
still unqualified. Selecting this renderer by default does not promote the model art.
Continuous physical yaw/rotated collision and actual desktop/phone GPU timing
remain separate next work.

## Current experiment and findings

The owner authorized an authored Blender/UV comparison on 2026-10-10.
[097](../tactical/097-authored-car-blender-uv.md) delivers one editable compact car
with volumetric wheels/arches, named UV islands, retained sprite-projection draft
and deliberately cleaned palette-matched paint. It has 438 triangles, a 512-square
atlas, a self-contained GLB, actual six-view/stage/game-scale sheets and a 24-frame
turntable. Workshop initially registered it as a separate excluded diagnostic;
the original scratch gallery remains local; final deliverables are retained above.
The original art and collision/support metadata are unchanged. Top/side/oblique
views are coherent by agent inspection; the native-scale candidate remains
plainer/softer than the sprites. Final paint is authored interpretation, not exact
pixel recovery, and source-camera matching and human art judgment remain open.
The owner subsequently requested reusable authoring for all vehicles and potentially
other asset classes. [098](../tactical/098-reusable-sprite-authoring.md) supplies the
shared offline process: exact source extraction, landmark-based camera fitting,
visibility-tested original-pixel UV drafts with unknown/conflict masks, unlit
native-pixel comparison and portable export. The same commands process two
compact palette variants; all 45 vehicles have verified source extraction.
This is shared tooling, not 45 reconstructed vehicles or an automatic mesh fitter.
Use [the workflow](../../scripts/authored-assets/README.md) to fit the first family
template closely before broad model production. Other geometry families remain open.

The owner's subsequent side-window/fender feedback is addressed by
[099](../tactical/099-compact-windows-and-fenders.md): four continuous window/frame
panels with independent source-owned UV islands and four curved raised fender
lips. The same 55-mesh / 834-triangle template and variant-palette cleanup work
on both compact colors. A separate excluded diagnostic revision retains the
original 097 bytes. Windshield/hood/roof distortion and family acceptance remain
open; use the refined setup for the next fitting pass rather than broad production.

The owner then identified missing dark ink and oversized fenders.
[100](../tactical/100-pixel-outline-and-silhouette.md) reduces arch radius/flare
and adds a one-logical-pixel inward silhouette pass with a working GPU prototype.
The pass preserves alpha; internal lines remain UV paint. Explicit contour
overlays show fewer longitudinal overshoots but persistent side-profile errors.
GLB needs a separate runtime outline pass, which is not integrated into gameplay.
Use the latest outline setup for body/hood/roof and wheel fitting; family acceptance
and production remain open.

The owner then requested a closer side silhouette and animation-ready wheels.
[101](../tactical/101-fitted-body-and-rigid-wheels.md) fits the compact body with
unchanged cameras/outline, improving side occupancy from about 83% to 92% while
retaining cross-view tradeoffs. Four centered rigid steer/roll parents make each
tire/hub assembly independently rotatable. Both GLBs preserve that hierarchy
and axis/radius metadata; signed path distance drives the separate spin helper.
Actual fixed-body motion and exported-axis tests pass on both colors. Steering
clearance and gameplay integration remain open; no skeleton or collider change
is introduced. Use the latest rigged setup for further fitting.

Latest owner feedback is addressed in [102](../tactical/102-windshield-boundary.md):
front windshield glass is confined to an explicit aperture/frame, and body paint
replaces duplicated front-glass projection on the cabin corners. Both compact
palettes retain v4's silhouette and independent wheel transforms. The
[comparison](../../public/demos/authored-car/windshield.html) includes matched
front-corner crops and both 4×2 sheets. Pillar width/texture fitting still need
human judgment; no engine or promotion changes. Use the windshield setup for
the latest family template.

[103](../tactical/103-dark-windshield-frame.md) adds the requested continuous dark
windshield border using the original window ink. It paints only the frame;
glass pixels, geometry, silhouettes and wheel transforms remain identical to
102 on both colours. The [close-ups and 4×2 sheets](../../public/demos/authored-car/windshield-ink.html)
retain the new diagnostic. Interior ink is included in the exported atlas;
outer silhouette ink remains a render pass. Review border weight before further
pillar/shape and steering-clearance fitting.

[104](../tactical/104-visible-top-windshield-ink.md) corrects a remaining top-edge
gap: 103's frame paint was present in the atlas but too thin for the side camera's
native sampling. The top stroke now extends slightly into glass. Full native
edge segments pass in all four matched cameras on both colours, with unchanged
geometry/silhouettes/wheels. Inspect the [close-ups](../../public/demos/authored-car/windshield-top.html);
border weight remains a human art judgment. Validate native edge visibility
alongside atlas coverage on future ink revisions.

The owner accepted the compact checkpoint in chat and requested the little red
car plus a repeatable skill. [105](../tactical/105-red-car-and-authoring-skill.md)
reconstructs `compact-4` using v7 only after verifying identical four-view source
alpha/physical metadata and consistent palette correspondence. A one-command
offline replay reproduces the cleaned atlas and native/novel rendered images.
The [skill](../../.agents/skills/tilefun-vehicle-authoring/SKILL.md) routes template
selection and records the silhouette, window ownership, native border visibility
and independent-wheel checks. The [red comparison](../../public/demos/authored-car/red.html)
retains editable source and its own uncertain projection; existing side/hood/pillar
tradeoffs remain. Chat acceptance is not Workshop promotion. The ambulance is
next: author a new cab/box family and fit its axles, windows and directional
landmarks; it cannot use the compact geometry.

[Car projection lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/car-projection)
maps one approved compact-car image onto authored low-poly geometry using Three.js
WebGL. Orbit, source, side/top orthographic and perspective views expose the shape;
wireframe, collision bounds and checker faces expose assumptions. This already
uses GPU-rendered textured geometry. It is separate from the gameplay backend.

- [037](../tactical/037-car-projection-experiment.md), commit `1ce41f7`, delivered
  the fixed source projection, visual shell and inspection tool.
- [038](../tactical/038-car-proxy-orthographic-checks.md), commit `cc6b362`, added
  exact orthographic presets, grounded the tire artwork, made upper faces edge-on
  in side view and filled transparent top-edge gaps with a derived texture.
- GPU checks match all 1,809 painted source pixels within one color level, with
  182 additional edge pixels; top occupancy is 1,152/1,152, side has zero visible
  top-face fragments, both tires contact the ground and no pixels extend below it.
- **The user subsequently found the top view unacceptable.** Coverage, contact and
  source registration checks passed, but stretched outlines and oblique texture
  distortion remain. These checks are necessary diagnostics, not a reconstruction
  quality gate. No acceptable all-angle car has been established.
- In the authored shell, wheels are painted onto the side and hidden faces remain
  checker surfaces. Only one directional image constrains that fit. The separate
  TRELLIS.2 candidate evaluated in 070 does not resolve this quality gate.

The visual roof is 21 world pixels high; the approved collision proxy remains
56 × 20 × 24. Their disagreement is visible and intentional pending a separate
geometry decision. The experiment is registered but excluded from approval;
arbitrary orbit output is not an immutable review snapshot.

## Contracts and decisions

- Keep original sprites, promoted banks and physical metadata immutable. New
  mesh/texture outputs are candidates with provenance, not automatic replacements.
- Use world-pixel X/ground-Y/height-Z coordinates internally. Convert axes/units
  explicitly at import/export; record ground origin, forward direction and scale.
- Keep render geometry separate from collision/support geometry. Existing bounds
  provide alignment and physical constraints, not a requirement that every visual
  vertex fit inside an approximate collision box.
- Track which faces use observed artwork, rectified artwork or inferred/generated
  artwork. A generated top view is a hypothesis, not another independent source.
- Do generation and mesh preparation offline. Runtime consumption should use
  portable meshes/textures and metadata, without a generation-service dependency.
- A proposed asset record should identify source hashes/crops, mesh/material
  resources, transforms, visual bounds and separate physical/contact metadata.
  Start with the car; defer a general schema until two consumers exercise it.
- Preserve Canvas gameplay and source-art reference rendering while experimenting.
  Human acceptance of changed artwork remains governed by [art review](art-review.md).

## Tracking and next checkpoints

These are proposed checkpoints, not an authorized unattended implementation plan.
Plan each implementation slice in a new tactical when it is taken up.

| ID | State | Checkpoint and evidence needed |
| --- | --- | --- |
| A1 | Done | Single-view projection and orthographic inspection; evidence in 037/038 |
| A2 | Inputs/tooling delivered; registration open | 098 freezes all vehicle directional crops/metadata and supplies landmark camera fitting; annotate real correspondences and resolve inconsistent sprite views |
| A3 | Bounded trials delivered; choice open | 073 compares fitted/generated geometry and AI paint; 097 adds authored Blender geometry and cleaned named UVs. No production route selected |
| A4 | Inspection evidence delivered; human judgment open | 097 retains source/front/back/side/top, oblique and turntable views, wheel contact and texture stages; no accepted all-angle car yet |
| A5 | Blue import delivered; device budgets open | 106 retains exact compact bundles; 108 imports blue with provenance and explicit axes/scale/ground. Establish triangle, draw-call and texture budgets from real device evidence |
| A6 | Shared blue integration delivered in 108 | Optional authored GLB body under the unchanged game projection, with continuous cosmetic heading, wheel roll and sprite fallback; physical rotation remains separate |
| A7 | Later | Test a second asset class before generalizing authoring, animation or batch generation; first-person coverage remains a later scope |

The model-assisted investigation began with [070 — Model-assisted spatial assets and sprite
clipping](../tactical/070-model-assisted-spatial-assets-investigation.md) on the
owner's Windows RTX 4090 workstation. It combines
A2 input/camera registration with a bounded A3 comparison on oak and compact car,
then picnic table and umbrella. The primary outcome is improved ordinary 2D
clipping derived from spatial proxies; optional 3D appearance is evaluated
separately. The owner selected the latest TRELLIS.2. Its isolated WSL environment,
compiled CUDA extensions, public 512 checkpoints, pinned eight-input corpus and
authored oak/car spatial controls are ready. Authorized local authentication and
checksum verification completed the DINOv3 ViT-L download. Five 512-pipeline runs
succeeded on the RTX 4090: the provider example, car and three oak variants. The
example has volume; all three original-sprite oaks are almost flat. The generated car has volume
but poor wheel geometry. A recorded silhouette-only transform covers 1,550 of
1,809 opaque source pixels and changes overlap decisions in problematic ways.
These are unreviewed diagnostics, not accepted reconstruction or clipping quality.
No renderer change has occurred. Subsequent conditioning experiments produced
volumetric oaks from a hosted solid-tree reference and from local SDXL img2img.
Local img2img strength 0.55 remains flat; strength 0.8 produces volume at two
TRELLIS seeds but blotchy textures. Adding local MV-Adapter before TRELLIS improves
the generated appearance. Direct MV-Adapter from the original sprite fails as
cards/boxes. The hosted reference's 64-pixel ablation makes a tiny tree on a large
plane, despite deceptively high silhouette coverage. Conditioning interpretation
and resolution both matter; pure resolution causality is not established.
The local Windows launcher now coordinates reference generation, learned U2Net
alpha, single-view TRELLIS.2, raw novel views, source fitting, depth/overlap data,
textured GLB and an inspectable artifact report. The six generated views are
hypotheses; only the preselected angle-0 view enters TRELLIS. Coarse numerical
geometry screens do not establish shape or clipping quality. The next step is
camera/contact/ground-role registration and actor coverage on a useful volumetric
candidate. The owner subsequently requested ten current assets and per-stage inspection
sheets. [071](../tactical/071-current-sprite-spatial-workflow.md) owns that bounded
offline expansion; camera/contact/ground-role work remains necessary for useful
clipping.
[CLI and recipe](../../scripts/spatial-assets/README.md)
and 070's execution record own reproducibility, coverage and environmental test
limits. Custom training is not the starting assumption.

[071](../tactical/071-current-sprite-spatial-workflow.md) completed the owner's
broader local trial on ten current runtime assets, each with sixteen auditable
stages, source depth/XYZ, actor comparisons, a textured GLB and an orbit viewer.
Palm/fountain/tent/car are recognizable volume sketches with design drift;
table/shed lose important parts during conditioning/masking, the swing gains a
backing panel in the second mask, the climbing frame is disconnected, the
umbrella is damaged and the castle's raw mesh is perforated. Shed alpha coverage
is 98.7% despite the wrong design. Two identical-RGB table mask ablations show
simple border-color subtraction also retains enclosed background or erases
foreground. Prioritize whole-object/hole-preserving masks, a matched direct-vs-MV
trial and controlled reconstruction sampling on the castle. These conclusions
are agent diagnostics; no assets or physics were promoted. The artifact audit
checks ten immutable sources, 160 stage images, 678 links and eleven responsive
pages. Portable [stage evidence](../tactical/071-spatial-assets/index.html) and
[measurements](../tactical/071-spatial-assets/results.json) route the full record.

[072](../tactical/072-conditioning-fidelity-investigation.md) investigates the
owner's observed SDXL information loss with matched strengths 0.35/0.55/0.65/0.8
on shed/tent/car. Lower strengths retain source design much better; masks can
still remove tent fabric independently. Strength 0.65 produces volumetric shed
and car meshes without MV-Adapter, with closer landmark/profile preservation,
but noisy surfaces and roof-versus-wall interpretation errors remain. The oak
0.8 workaround is not a general asset recommendation. Inspect RGB fidelity and
mask completeness before reconstruction; compare a structural/image-editing
conditioner next, then test MV as an optional matched branch. No universal
replacement strength, candidate acceptance or clipping improvement is established.
Portable [fidelity evidence](../tactical/072-conditioning-fidelity/index.html)
includes RGB/mask and matched 3D comparisons; full artifacts remain on the
secondary drive.

The [2026-10-08 alternatives survey](../research/spatial-asset-pipeline-alternatives-2026-10.md)
ranks reference editing (FLUX.2 klein 4B/Qwen-Image-2.1), direct TripoSG shape
generation and explicit geometry fitted to genuine car directions as the next
comparisons. It also records native multiview/control/part-aware models,
procedural foliage/frame construction, splats and independent SAM masking.
At survey time, Qwen 2.1 native alpha was untested; hardware estimates and
model-specific licenses were recorded separately from quality claims. The survey
itself installed no models; the subsequent 073 trial below records execution.

During the access wait, 070's static compositor compared scalar sorting,
foot-only actor depth, an upright sprite plane, proposed ground roles and a capsule
body using the original source pixels. Foot-only depth hides front-facing actor
pixels that the plane keeps visible. A cheap unreviewed oak ground proposal
separates some shadow-region overlap, but capsule coverage leaves 32 of 172 opaque
actor pixels unknown and can create fallback strips. These are diagnostic
disagreements, not human-labelled quality scores or production game/lab parity.
Next independent work is actor-proxy coverage and shadow/root segmentation; use
the same comparison path now includes fitted generated car geometry. Large local
environment/model storage and experiment bundles have moved off the system drive.

Proposed asset direction: derive an occlusion proxy and projected depth/semantic
masks from a fitted reconstruction while retaining original 2D color artwork.
Visual geometry, occlusion geometry and collision/support metadata share an origin
and scale but have distinct responsibilities. Painted ground shadows need explicit
receiver semantics; mesh generation alone does not identify them. A compatible
actor depth representation and cross-object renderer depth path are also required.
The existing isolated mesh-body depth is not that general solution. Plan 070 owns
the experiment protocol, overlap cases, Windows setup checks and evidence record.

## Implementation pointers

- [`CarProxy.ts`](../../src/projection/CarProxy.ts): neutral mesh and pinned source projection.
- [`ProxyTexture.ts`](../../src/projection/ProxyTexture.ts): derived top-edge extension.
- [`CarProxyScene.ts`](../../src/projection/CarProxyScene.ts): Three.js adapter and GPU lifecycle.
- [3D physics](../3D-PHYSICS-DESIGN.md): existing height/support/collision semantics.
- [Research](../research/sprite-to-3d-and-renderer-options.md): model capabilities,
  comparison protocol and renderer decision matrix.


The initial 039–045 integration used the older projected shell with flat painted
wheels and unresolved top-view artwork. [108](../tactical/108-authored-blue-car-gameplay.md)
now uses the retained authored blue GLB in game and renderer comparison, with
actual rigid wheel roll and isolated body depth. Continuous cosmetic yaw and lab
pitch/roll retain the unchanged game projection. This optional integration does
not promote the model art or establish physical rotated collision/device budgets.

The first four alternatives completed on 2026-10-08. [073](../tactical/073-spatial-pipeline-alternatives.md)
records FLUX/Qwen editing on five assets/two seeds, matched TripoSG/TRELLIS
geometry, a fitted four-sprite car and existing-mesh texturing. Qwen generally
preserves design better than FLUX; edited references improve TripoSG volume.
Qwen → TripoSG → TRELLIS texturing is the most promising tree branch. Replacing
Qwen native alpha changes a failed TRELLIS car into a recognizable car, while
the oak remains planar and exposes hidden-RGB color contamination. Native RGBA
is not a validated foreground mask. The fitted car preserves its geometry
through AI texturing but has texture seams/streaking; silhouette scores include
painted shadow and do not establish landmark fidelity. No universal converter
or production candidate is accepted. Portable [comparisons](../tactical/073-spatial-alternatives/index.html)
include original/editor/mask images, actual 3D views and the matched alpha probes.
074 below records the next comparison: native alpha/U2Net/SAM on properly
composited Qwen RGB and geometry models on identical registered cutouts.
Thin supports/cloth and faithful UV/landmark fitting remain separate work;
use asset-specific routes before broadening the model roster.

[074](../tactical/074-alpha-geometry-controlled-experiments.md) completed 23
controlled runs on 2026-10-08 using the same saved Qwen car/oak images. Proper
RGB compositing alone does not fix TRELLIS: native low alpha leaks a faint grid
into the actual provider input. Zeroing alpha<32 while preserving all other
alpha, RGB and the exact TRELLIS crop produces recognizable cars at seeds 42/43;
native-clean fails at both. This is a tested bounded control, not a universal
threshold. TripoSG gives car shapes across all five tested masks. Oak remains
route-specific: cleaner TRELLIS inputs still give layered foliage; TripoSG's
native-clean mask gives the densest canopy, harder masks give sparse leaves.
SAM box-only loses the trunk despite high confidence; automatic canopy/trunk
points restore it, without fixing foliage. Two full tree exports confirm that
decimation worsens thin-leaf density but is not the sole structural problem.
Portable [controlled evidence](../tactical/074-alpha-geometry/index.html) links
the protocol, measurements, seed comparison and complete ledger. Next: test the
low-alpha guard on frozen shed/table/tent, and isolate tree framing/seed variance
before texturing or trying procedural foliage. No runtime art or human acceptance
changed.

[075](../tactical/075-alpha-guard-tree-framing.md) completed those next 23 runs.
The crop-preserving alpha guard is asset-specific: it makes the TRELLIS tent
more coherent, removes shed clutter while losing roof geometry, and leaves table
supports unreliable. TripoSG gives coherent shed volume but thin tent sheets
remain defective even in full provider exports. For trees, a common frame makes
hard/SAM point masks produce denser foliage at seed42; seed43 still changes crown
structure. The identical native-clean repeat reproduces the earlier raw mesh
exactly. Two shape-first texture probes produce colored 3D trunks/crowns with a
less fluorescent palette, while foliage gaps/layering persist. The
[stage/data comparisons](../tactical/075-alpha-guard-framing/index.html) retain
all masks, provider inputs, raw arrays, materials and full/reduced captures.
Next: keep framing independent of alpha; test procedural foliage around the
recovered trunk and explicit frame/cloth/support geometry for table/tent.
No universal threshold, production candidate or human acceptance is established.
