# 3D assets and sprite reconstruction

Topic: 3d-assets
Status: car projection and orthographic inspection delivered; top-view appearance
unresolved. Optional fixed-view GPU gameplay integration is delivered;
Local SDXL/MV-Adapter/U2Net/TRELLIS.2 workflow and ten current-asset stage sheets
are delivered. Volume is feasible; conditioning, masks, fidelity and registration
remain unresolved. Game clipping is unchanged.
Updated: 2026-10-08.

Owns reconstructing coherent visual assets from sprite artwork, their relationship
to physical proxies, and cross-view quality. [Rendering architecture](rendering-architecture.md)
owns engine interfaces and GPU integration; [performance](performance.md) owns
measurements. [Research and investigations](../research/sprite-to-3d-and-renderer-options.md)
records the experiments, external options and their limits.

## Investigation evidence storage

The evidence directories for investigations 070–075 under `docs/tactical/` are
local, Git-ignored outputs. They contain source crops, generated renders,
comparison sheets, JSON records, arrays and HTML reports; links into those
directories require the local evidence and are unavailable in a fresh clone.
Written findings and the recipes in `scripts/spatial-assets/` remain in Git.
Ignoring the evidence does not delete it or promote any generated artwork.

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

## Current experiment and findings

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
| A2 | Open | Assemble original directional crops, actual facing labels, source-camera assumptions, wheel/roof/hood landmarks and physical bounds; identify inconsistent sprite views |
| A3 | Proposed | Compare authored geometry/rectified UVs, image-generated geometry, and authored geometry with generated textures on the same car |
| A4 | Proposed | Evaluate fixed source/front/back/side/top and oblique views; inspect wheel volume, roof/hood layout, seams, ground contact and unknown surfaces; record human judgment alongside metrics |
| A5 | Proposed | Export/import the chosen candidate as a portable asset with provenance and explicit axis/scale conversion; establish bounded triangle/texture budgets from device evidence |
| A6 | Diagnostic implementation delivered in 039–045 | Render the asset as an optional mesh body under the unchanged game projection, with continuous visual heading and a sprite fallback; engine work is tracked in the rendering topic |
| A7 | Later | Test a second asset class before generalizing authoring, animation or batch generation; first-person coverage remains a later scope |

The active investigation is [070 — Model-assisted spatial assets and sprite
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


The optional `?renderer=gpu&meshes` path and renderer comparison tool now share
`CarMeshAsset`, asset registration and isolated body depth. Continuous yaw plus
diagnostic pitch/roll work under the unchanged game projection. This does not
resolve A2–A5: the proxy still has flat wheels, incomplete hidden surfaces and
unacceptable top-view artwork. No candidate has been promoted by this integration.

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
