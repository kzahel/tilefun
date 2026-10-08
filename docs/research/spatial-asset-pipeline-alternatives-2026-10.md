# Spatial asset pipeline alternatives

Researched: 2026-10-08. Owner: [3D assets](../topics/3d-assets.md).
Scope: a reproducible offline sprite-to-3D workflow on the owner's RTX 4090,
with geometry, artwork identity and usable clipping evaluated separately.

This is a primary-source survey and proposed experiment order, not a benchmark.
None of the new models below was installed or run during this research. The
observed baseline remains [070](../tactical/070-model-assisted-spatial-assets-investigation.md),
[071](../tactical/071-current-sprite-spatial-workflow.md) and
[072](../tactical/072-conditioning-fidelity-investigation.md).

Subsequent execution on 2026-10-08 is recorded in
[073](../tactical/073-spatial-pipeline-alternatives.md), with actual pinned local
runs and [inspectable comparisons](../tactical/073-spatial-alternatives/index.html).
The survey below preserves the original research-time estimates and proposals;
073 owns measured results, failures and revised next work.

## Recommendation

Compare three routes first: reference editing with FLUX.2 klein 4B and
Qwen-Image-2.1; direct shape generation with TripoSG; and a parameterized mesh
fitted to the car's genuine directional sprites. Keep TRELLIS.2 as the common
downstream control for the reference-editing comparison. Use explicit geometry
for the roof, wheels, support poles and foliage when unconstrained generation
keeps misinterpreting them. Improve masking independently.

The earlier SDXL setting established an oak volume workaround. It did not
establish that repainting every sprite is necessary. At strength 0.65, shed/car
retain more source identity and still produce volume; tent/table masks and roof
interpretation remain independent failure points. A newer model must beat these
specific failures, not just produce a smoother object.

## Reference-image alternatives

| Candidate | Verified capability | Proposed role and limitation | Local feasibility |
| --- | --- | --- | --- |
| [FLUX.2 klein 4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B) | Image editing, including multiple references; Apache 2.0 weights | Edit the sprite into a clearly shaded solid object while explicitly retaining its silhouette, camera, colors and landmarks. Preservation remains a hypothesis. | Model card estimates about 13 GB VRAM; official repo currently says about 8 GB. Both suggest a 4090 trial is practical, but our actual peak is unmeasured. |
| [Qwen-Image-2.1](https://huggingface.co/Qwen/Qwen-Image-2.1) | Reference editing and native RGBA; up to ten reference images | Test a single transparent conditioning output instead of SDXL RGB followed by U2Net. Generated alpha still needs inspection. | CPU offload is officially supported; exact 4090 memory/time remains unmeasured. |
| [Qwen-Image-Edit-2511](https://huggingface.co/Qwen/Qwen-Image-Edit-2511) | Instruction editing; Apache 2.0 weights | Older alternative if the 2.1 research license prevents adopting the newer model. It does not supply the same verified native-RGBA route. | Plan quantization/offload and measure; do not assume the model-card CUDA example fits 24 GB. |
| [ControlNet](https://huggingface.co/docs/diffusers/main/en/using-diffusers/controlnet) plus [IP-Adapter](https://huggingface.co/docs/diffusers/main/en/using-diffusers/ip_adapter) | Structural edge/depth conditioning and image-reference conditioning can be combined | Keep silhouette and major roof/door/wheel edges while allowing new shading. Use coarse meaningful contours, not every pixel-art texture edge. | Reuses installed SDXL base; additional weights and peak memory must be measured. |

Qwen-Image-2.1 was released on September 20, 2026. Its architecture uses a 7B
generation transformer **and** a Qwen3-VL 8B encoder; calling it simply a 7B
model understates total memory. Use a fresh environment, CPU offload and a bounded
resolution trial rather than changing the pinned TRELLIS/MV environments. These
details and memory offload are in the [official implementation guide](https://github.com/QwenLM/Qwen-Image-2.1).
Its [license](https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE)
allows research/evaluation use and requires a separate license for commercial use.
It is an experiment candidate, not an unrestricted production dependency.

FLUX klein's [official repository](https://github.com/black-forest-labs/flux2)
distinguishes the distilled four-step model from the undistilled 4B Base. Start
with the smaller distilled model; try Base only if editing quality warrants it.
The 9B and 32B variants add resource and licensing complications without evidence
that they solve our sprite ambiguity. Do not interpret advertised sub-second
speed as a measured full pipeline time on this workstation.

The controlled-reference test should request the same projection and exact
feature placement. A shed prompt must identify the upper blue region as tiled
roofing, not blue wall cladding. Compare two separate intents: modest material/
shading cleanup, and a stronger conversion to a solid-object reference. Save
prompts, original pixels, actual output RGB/alpha and model revisions for both.
Upscaling alone is a separate control; it supplies no additional observations.

## Direct and controllable 3D alternatives

| Candidate | Actual input/output and differentiator | Published resource guidance | Priority |
| --- | --- | --- | --- |
| [TripoSG](https://github.com/VAST-AI-Research/TripoSG) | Direct image-to-shape; an independent geometry prior. Its project includes cartoon/sketch examples and a separate scribble-plus-prompt model. Shape fidelity on tiny sprites is untested. | At least 8 GB VRAM | First independent local shape baseline; test original RGBA without SDXL, then the same cleaned references. Texture separately. |
| [Hunyuan3D-2mv](https://huggingface.co/tencent/Hunyuan3D-2mv) | Native multiview shape generation; documented front/left/back image inputs are jointly supplied | Hunyuan3D-2 family reports 6 GB for shape, 16 GB for shape plus paint; this is not a measured 2mv peak | Valuable for actual car directional sprites; camera and facing normalization required. Regional license limits apply. |
| [Hunyuan3D-2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) | Separate shape and existing-mesh painting paths | 10 GB shape, 21 GB paint, 29 GB combined | Shape-only comparison fits the stated budget; sequential/offloaded paint needs measurement. Do not assume the combined pipeline fits 24 GB. |
| [Hunyuan3D-Omni](https://github.com/Tencent-Hunyuan/Hunyuan3D-Omni) | Image-conditioned shape with explicit point-cloud, voxel, skeleton or bounding-box controls | About 10 GB | Relevant when a fitted coarse visual proxy supplies stronger shape constraints. A collider alone is too weak and may have the wrong visual dimensions. |
| [SPAR3D](https://github.com/Stability-AI/stable-point-aware-3d) | Image plus generated/editable point cloud produces textured mesh; the intermediate cloud can guide hidden shape | README gives 10.5 GB default and about 7 GB low-memory; another CLI paragraph says about 6 GB | Useful controllability baseline. Preserve the intermediate cloud. Gated weights and Stability Community License. |
| [PartCrafter](https://github.com/wgsxm/PartCrafter) | Jointly generates separate part meshes from an image with a supplied part count | At least 8 GB; grows with parts/tokens | Later trial on table/frame/car. Separate parts do not guarantee correctly connected supports, wheel placement or semantic part labels. Disable optional style transfer for a fidelity comparison. |
| [SAM 3D Objects](https://github.com/facebookresearch/sam-3d-objects) | Object reconstruction with image/mask conditioning | [Official setup](https://github.com/facebookresearch/sam-3d-objects/blob/main/doc/setup.md) specifies at least 32 GB | Larger-GPU comparison, not a documented 24 GB drop-in. Existing DINO approval does not grant these gated weights. |

The 2mv family resources come from the [official Hunyuan3D-2 guide](https://github.com/Tencent-Hunyuan/Hunyuan3D-2).
Its [2mv license](https://huggingface.co/tencent/Hunyuan3D-2mv/blob/main/LICENSE)
excludes EU/UK/South Korea from its territory and restricts use/display of outputs
outside that territory. US citizenship or a US GPU alone does not establish that
an intended workflow and output use satisfy those terms. Record the applicable
model license before choosing a Hunyuan route; US execution availability is not
automatic permission to use its results everywhere.

TripoSG's published generalization claims justify testing it; they do not prove
that it will recover our pixel art. Its [actual preprocessing](https://github.com/VAST-AI-Research/TripoSG/blob/main/scripts/image_process.py)
uses supplied alpha when it passes an opacity/background histogram check, takes
bounds over all foreground, and composites onto white. It falls back to learned
RMBG segmentation otherwise. The [CLI](https://github.com/VAST-AI-Research/TripoSG/blob/main/scripts/inference_triposg.py)
loads RMBG even when supplied alpha bypasses it. An adapter can preserve validated
source alpha and avoid that unused download; record the actual preprocessing,
input and adapter changes. Never silently add another segmentation step. TripoSG's
[weights](https://huggingface.co/VAST-AI/TripoSG) are MIT-licensed; bundled models
have their own terms.

## Different workflows

**Use genuine views.** The existing 070 preparation already freezes all four
compact-car directions from `src/traffic/vehicles-v1.json`. Legacy direction names
do not equal observed facing. Normalize crop, scale, ground contact, camera and
hood/roof/wheel landmarks before a native multiview model or mesh fit. These
hand-drawn images may disagree geometrically; fit approximate cameras rather than
pretending they are calibrated photographs. Our current MV-Adapter path supplies
only one generated view to TRELLIS.2, so it does not exploit this extra evidence.

**Fit explicit geometry, then texture.** Build a small parameterized car with
separate body/roof/hood/wheels, or a shed with separate roof and walls. Fit its
silhouettes and landmarks to actual sprites, constrain ground contact, and keep
unknown geometry explicit. [nvdiffrast](https://nvlabs.github.io/nvdiffrast/)
provides differentiable rasterization for this kind of fitting. Then use rectified
observed per-face artwork and experiment with inferred hidden-face textures.
TRELLIS.2 already exposes a separate [mesh-plus-reference texturing example](https://github.com/microsoft/TRELLIS.2/blob/main/example_texturing.py).
This avoids asking a texture generator to decide where wheels or roof planes go.
It requires engineering and camera fitting; it is not an automatic universal
solution. The rejected 037/038 car is a negative baseline: simply projecting one
sprite onto a box can preserve source pixels while stretching novel views badly.

**Use asset-class procedural construction.** For trees, infer trunk/canopy extent
and generate actual branches plus canopy volumes or leaf clusters. For tables,
swings and climbing frames, generate beams, poles, seats and explicit openings.
Fit parameters to the original silhouette and available physical/contact data;
use original artwork for color references. This is our proposed scripted approach,
not a claimed capability of an upstream model. It trades per-class engineering
for predictable topology and easy edits; unseen branch/beam layouts remain
assumptions. It can produce a real 3D tree without making a learned model infer
all depth from painted leaves.

**Change the representation.** [TripoSplat](https://github.com/VAST-AI-Research/TripoSplat)
generates 3D Gaussians directly from an image, with controllable count up to
262,144 and MIT-licensed code/weights. This could be an appearance experiment for
foliage. Its outputs are `.ply`/`.splat`, not our current mesh GLB. We would need
a splat inspector/rendering path and separate collision/occlusion semantics;
alpha/foliage depth is not a single reliable surface. Peak VRAM is not specified
in the checked README. Test offline before considering engine integration.

**Use a reconstruction pipeline that actually consumes generated views.**
[InstantMesh](https://github.com/TencentARC/InstantMesh) uses Zero123++ views with
a sparse-view reconstructor; [Wonder3D](https://github.com/xxlong0/Wonder3D)
generates joint normal/color views and reconstructs from them. Both are useful
architecture alternatives to our current one-view TRELLIS path, but generated
views still hallucinate and can disagree. They are lower priority than genuine
directional views or stronger source constraints. Do not confuse
[TripoSF](https://github.com/VAST-AI-Research/TripoSF)'s mesh/point-cloud VAE and
open-surface reconstruction with a standalone sprite-to-mesh generator.

**Derive depth for fixed-view clipping.** [Depth Anything 3](https://github.com/ByteDance-Seed/Depth-Anything-3)
supports single/multiview depth and camera estimation. A separate trial could
attach a depth/height field to unchanged sprite colors and constrain it with
contact/ground semantics. This may serve the 2D clipping goal without requiring
a convincing all-angle mesh. Tiny painted sprites and their baked lighting are
outside the evidence established by its photography benchmarks; depth remains
a proposal to evaluate against overlap cases. A single depth field does not
recover hidden surfaces or replace an orbitable model.

## Masking is an independent experiment

Compare [SAM 2.1](https://github.com/facebookresearch/sam2) box/point prompting
against U2Net on the *same saved RGB*. Include whole-object prompts and negative
points in visible openings; inspect table legs, tent fabric and frame holes.
Prompts can be generated from saved source alpha/landmarks where registration is
reliable, and their coordinates must be saved. Do not force an original alpha
onto a shifted/redesigned RGB image and call the result aligned.

[SAM 3](https://github.com/facebookresearch/sam3) adds text/concept prompting
but needs a separate modern environment and gated weights. The current SAM 3.1
Object Multiplex release focuses on multi-object tracking; that release alone is
not evidence of better static sprite cutouts. Qwen's native RGBA route is another
mask candidate, not a guarantee of intact poles or transparent holes. Keep
pre-mask RGB, raw alpha and cutout in every stage sheet.

## Hosted comparisons

For an external quality ceiling, the official [Tripo SDK](https://github.com/VAST-AI-Research/tripo-js-sdk)
documents image/multiview reconstruction, existing-model texturing, current
`v3.1-20260211`, and low-poly `P2-20260801` preview. These hosted models are not
the locally available TripoSG. P2's quad option returns FBX rather than GLB.
Tencent's [global API](https://intl.cloud.tencent.com/document/product/1284/75540)
documents Hunyuan 3.1 and additional top/bottom/45-degree reference views; its
LowPoly/Sketch options are unavailable with 3.1. Neither source establishes
downloadable 3.x weights. No hosted jobs, signups or paid submissions were made.

## Proposed next experiment

Use five assets: oak, shed, compact car, picnic table and blue tent. Freeze source
pixels and retain existing 072 references as controls. Avoid another ten-asset
expansion until a new branch clears the conditioning failures.

1. Generate FLUX klein and Qwen 2.1 preservation-oriented references, two seeds
   per asset. Save RGB/alpha before TRELLIS. Compare to source and SDXL 0.65.
2. On identical selected RGB, compare U2Net/SAM 2.1; evaluate native Qwen alpha
   separately. Inspect feature retention and openings before mesh inference.
3. Send the qualifying references through fixed-seed TRELLIS.2, and test TripoSG
   on original RGBA plus the same selected references. Keep image-conditioning
   and geometry-provider effects distinguishable.
4. In a separate car-only route, compare a fitted parameterized mesh using all
   genuine directions with native multiview generation when model terms permit.
   Inspect untextured geometry before comparing texturing routes.
5. Capture original/reference/mask/provider input/raw six views/unlit texture/
   textured orbit/source-fit overlap. Score observed silhouettes and landmarks,
   retain per-class failures, and label unobserved surfaces as assumptions.

Record versions, prompts, seeds, actual input bytes, preprocessing, inference time,
peak VRAM, estimated storage and all postprocessing. Classify failures as design
drift, camera drift, missing foreground, filled openings, flat geometry, wrong
parts or poor texture. Alpha recall, CLIP similarity and attractive lighting are
not acceptance measures. No winning pipeline is claimed before these trials.

At research time the workstation reports 24 GB GPU memory, about 46 GiB WSL RAM
available and 121.9 GiB free on D. Keep fresh environments, weights, caches and
bundles there; download one provider at a time. Resource figures above are
upstream estimates, except these machine measurements. Retain the working pinned
TRELLIS environment and original/promoted assets.

Documentation validation: typecheck and lint passed (118 existing warnings,
34 infos). Unit tests again returned 1,728 passed, ten skipped and five failures
across four files from the previously recorded Windows symlink/SIGKILL limits.
Logs are under `D:/spatial-assets/research/2026-10-08`. No runtime code, provider
environment, weights, credentials or generated asset pixels changed.
