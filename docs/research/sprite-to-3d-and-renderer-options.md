# Sprite-to-3D investigations and renderer options

Researched: 2026-10-04. Owners: [3D assets](../topics/3d-assets.md) and
[rendering architecture](../topics/rendering-architecture.md).

This records repository evidence, external capabilities and proposed experiments
separately. It is not a model benchmark or a decision to replace the engine.
Recheck linked APIs and requirements before implementing against them.

The 2026-10-07 next investigation is [070 — Model-assisted spatial assets and
sprite clipping](../tactical/070-model-assisted-spatial-assets-investigation.md).
It carries the tree/car experiment to the Windows RTX 4090 workstation and tests
derived 2D occlusion depth separately from novel-view artwork quality. The plan
records freshly checked provider/WSL requirements; the historical renderer survey
below is not a statement of current implementation status. No model runs are
claimed by that handoff.

## Investigations so far

| Investigation | Observed result | What it does not establish |
| --- | --- | --- |
| Renderer separation, [022](../tactical/022-renderer-backend-decoupling.md) through [034](../tactical/034-renderer-completion.md) | Neutral metadata/passes, resource ownership, injectable host, recording backend and desktop/phone validation delivered | Production GPU backend, GPU parity or speedup |
| [037 car projection](../tactical/037-car-projection-experiment.md) | One sprite projected onto an authored shell; actual Three.js/WebGL geometry can be orbited | Unique 3D reconstruction, wheel volume or hidden artwork |
| [038 orthographic corrections](../tactical/038-car-proxy-orthographic-checks.md) | Side/top presets, ground contact, edge-on upper faces and top alpha-gap closure verified with GPU probes | Convincing top appearance; user subsequently rejected that result |
| Model-assisted reconstruction discussion | Identified separate geometry generation and existing-mesh texturing routes | No provider has generated or textured our car; no measured winner |

The pinned source is `public/assets/tilesets/me-complete.png`, SHA-256
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
The initial `vehicle:compact-1:east` selection uses atlas rect [96,1152,64,64]
and body crop [96,1176,64,40]. The selected artwork visually faces left: normalize
actual facing before assigning model-service view labels.

The shell fits points to the fixed oblique source projection. Changing the orbit
camera does not change those UVs. Thus perfect source registration can coexist
with a distorted top: depth is underconstrained, lighting is baked in, and an
edge-extension operation supplies coverage rather than missing roof information.
Closed geometry also did not guarantee closed visible coverage because transparent
texture texels exposed gaps. The corrected GPU tests catch that narrower defect.

The current 1,809/1,809 source match, 182 added pixels and 1,152/1,152 top coverage
must remain separate from visual acceptance. The failed top view is useful
negative evidence against using source pixel parity as the sole fit objective.

The lab renders on demand and has browser checks for touch orbit, context
restoration and cleanup on navigation. Its cold load still decodes the full
source atlas; no performance gain was established by the experiment.

## Reconstruction approaches

| Approach | Role of our geometry/bounds | Benefit | Main uncertainty |
| --- | --- | --- | --- |
| Authored mesh plus rectified per-face artwork | Explicit body/wheel geometry, UV seams and contact anchors | Predictable shape and pixel-art identity; strong baseline | Manual work and invented hidden surfaces |
| Generate mesh from original image(s), then fit and simplify | Bounds/landmarks constrain import alignment and subsequent fitting | Can propose unseen geometry and richer surfaces | May change vehicle identity, wheel count, silhouette or style |
| Authored mesh plus model-generated texture | Geometry is supplied to an existing-mesh texture pipeline | Direct implementation of the proposed hybrid | Painting may misplace details or bake inconsistent lighting; cannot repair a bad mesh |

An engine bounding box helps establish scale, orientation and ground alignment.
Roof/hood breakpoints, wheel centers and multiple silhouettes provide stronger
shape constraints. Do not force the visual shell into an approximate collider or
silently change physical metadata to accommodate a generated model. A provider's
ability to texture an input mesh does not imply that its shape generator accepts
that mesh or enforces our bounds as hard constraints.

### Candidate tools and verified capabilities

- **TRELLIS.2:** image-to-3D generation and a separate shape-conditioned texture
  path. Its official [texturing example](https://github.com/microsoft/TRELLIS.2/blob/main/example_texturing.py)
  passes a mesh and reference image to the pipeline, making the authored-mesh
  hybrid concrete. The [repository](https://github.com/microsoft/TRELLIS.2)
  documents Linux and an NVIDIA GPU with at least 24 GB memory for its setup;
  this is an offline toolchain choice, not a browser runtime requirement.
- **Hunyuan3D-2.1:** separate shape and paint pipelines; the official
  [usage example](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) includes painting
  an existing mesh from a reference image. Candidate for comparing shape-first
  and texture-only workflows, not evidence of fidelity on our sprites.
- **Tripo:** its [multiview API](https://developers.tripo3d.ai/en/docs/generation-multiview-to-model/standard)
  accepts front/left/back/right inputs, requires front plus at least one other
  view, and recommends at least 256 × 256 images. Its separate
  [texture API](https://developers.tripo3d.ai/en/docs/models-texture) accepts an
  existing model and image references. A hosted comparison is possible without
  operating the local inference stack; record model version, settings and cost.

These are general image/mesh workflows. We have not established that any is
specifically trained to reconstruct our tiny stylized sprites. Upscaling a
64 × 40 crop does not add geometric observations. Existing directional sprites
may also disagree in proportion or camera angle; neither relabeling them as
orthographic nor generating extra views makes them independent ground truth.

### Proposed one-car comparison protocol

1. Pin original directional crops and physical metadata. Label actual facing,
   alpha/background handling, projection assumptions and landmark confidence.
2. Establish a simple authored baseline with separate wheels, explicit top/side
   UV regions and honest unknown faces. Capture the current failed proxy too.
3. Produce candidates for generated geometry and authored-mesh texturing. Preserve
   raw output plus any alignment, simplification, UV or texture edits; record
   provider/model version, seed/settings, source hashes, time and cost.
4. Load every candidate into identical fixed cameras, scale and lighting. Compare
   source views, side/top/front/back, obliques and a turntable. Inspect unlit
   texture first so lighting cannot conceal shape/paint errors.
5. Record silhouette/landmark error where genuine references exist, contact,
   holes, triangle/material counts, texture memory and load/upload time. Human
   inspection judges coherent hood/roof/windows, wheel volume and style. Unknown
   views have no reference-pixel score; explicitly label generated assumptions.
6. Choose a workflow only after inspecting those results. Preserve reviewable
   immutable candidate snapshots; acceptance is not inferred from metrics.

Custom training could follow if repeated failures justify it and a suitable
licensed dataset exists. First establish whether fitting, texturing or model
generation is the limiting factor with the existing tools.

## What the engine already has, and what is missing

The default renderer is Canvas2D. `ThreeDebugRenderer` (`r_show3d`) and the car lab
already use Three.js `WebGLRenderer`, so GPU 3D is not a new platform dependency.
Neither is a production `RenderBackend`: the debug renderer reads world objects
directly, while the car tool displays its own isolated asset.

`RenderHost` already separates backend resources from HUD/touch/debug drawing.
The browser has DOM UI and independent Canvas UI/debug surfaces; those can remain
when replacing world rendering. A native Rust application would require a separate
UI hosting decision.

The neutral frame contract is still built for the current 2D presentation:
`RenderView` has x/y/zoom and viewport size, terrain placements use screen pixels,
and scene bodies/shadows have prescribed order. It has no general mesh/material
instances, 3D camera or world-space terrain surface contract. This is sufficient
to start an accelerated terrain/sprite backend, not an automatic orbitable world.

The existing physics is height-aware: shared movement, elevation, jumping,
finite-height prop collision, support surfaces and riding. It is not a general
triangle-mesh rigid-body engine. Visual 3D does not require replacing that working
simulation; arbitrary slopes, rotated bodies or first-person clearance may need
new physical semantics if the gameplay calls for them.

## Renderer choices

These choices occupy different layers: Three.js is a rendering library, WebGPU
is a browser graphics API, wgpu is a Rust graphics library, and Bevy is an engine.
WebAssembly changes CPU execution; it does not itself render on the GPU.

| Option | Fit for Tilefun | Tradeoff / decision trigger |
| --- | --- | --- |
| Three.js with existing WebGLRenderer | Shortest route to portable mesh loading and a shared-world 3D lab; already exercised here | Establish content and scene semantics before optimizing the backend |
| Three.js WebGPURenderer | Keep TypeScript and Three scene concepts while testing WebGPU with WebGL2 fallback | Validate materials, pixel filtering, lifecycle and fallback on actual phones; not assumed to be a drop-in migration |
| Direct WebGPU in TypeScript | Custom batched terrain/sprite path with explicit buffers and uploads | More rendering/resource code to own; consider when measured requirements exceed the library path |
| Rust/wgpu compiled to WASM | Isolated renderer with explicit memory layout; potential native reuse | JS/WASM transfer, build/loading and resource ownership costs; choose for measured CPU needs or a concrete native target |
| Full Rust engine, e.g. Bevy | Broader native/3D engine direction | Substantial integration or migration of scene/ECS/assets/game loop; much larger than swapping rendering |

Official [Three.js WebGPURenderer documentation](https://threejs.org/docs/pages/WebGPURenderer.html)
describes WebGPU selection with WebGL2 fallback and an explicit `forceWebGL` mode.
Thus Three.js and WebGPU are compatible choices. Its
[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) supports glTF 2.0 and
unlit materials, providing a practical portable-asset experiment.
[wgpu](https://wgpu.rs/) targets native graphics APIs and browsers via WASM using
WebGPU/WebGL2; a Rust port does not bypass browser/device capability limits.
[Bevy](https://bevy.org/) supplies a Rust ECS and 2D/3D engine, making it a broader
architectural choice. None of these sources establishes a Tilefun speedup.

**Recommendation:** start with the existing Three.js stack and portable assets;
compare its WebGPU and WebGL2 paths in a bounded experiment. Keep Rust/wgpu as a
measured alternative, with a bulk data boundary if attempted. Do not make asset
reconstruction depend on a language or whole-engine migration.

## Hanging engine threads and proposed order

1. **Accelerated current presentation:** implement the deferred terrain/sprite
   prototype behind `RenderHost`. Reuse semantic frames and Canvas reference
   scenes. This can proceed independently of solving believable 3D car artwork.
2. **Portable assets:** define the minimum import record and load one car with
   explicit axis/scale conversion, unlit textures and separate collision metadata.
3. **Shared-world 3D presentation:** ground patch, car, prop and actor drawn from
   read-only shared scenario state; orbit/orthographic/perspective cameras. Add a
   narrow neutral world-space scene contract instead of deriving geometry from
   screen placements or passing Three.js objects into simulation. The host/UI
   lifecycle can be shared even where 2D and 3D presentation policies differ.
4. **Correctness and residency:** define depth versus sprite ordering, cutout and
   transparent materials, billboards for unmapped assets, elevation, indoors,
   picking, streaming/edit invalidation, resource eviction and loss/recovery.
5. **Measure before expanding:** matched-content Canvas/Three comparisons and
   WebGPU/WebGL2 checks, then decide whether a Rust experiment has a specific job.
   Broader world coverage and first-person controls/content are later checkpoints.

For step 5, record frame pacing and missed frames, main-thread preparation and
allocation/GC, CPU/GPU timing where supported, uploaded/copied bytes, resident
textures/buffers, and repeated load/unload behavior. Measure on the attached phone
and broaden devices/thermal duration before generalizing; existing phone results
are a baseline, not evidence for the proposed renderer.

**Cold start** means first use before assets are downloaded/decoded, pipelines
compiled, textures uploaded and required scene resources ready. Report these
stages separately from warm traversal. **Recovery** means reconstructing graphics
resources after context/device loss from retained asset identities and CPU state,
without resetting the world. Existing lifecycle hooks and lab context tests do
not prove that an unimplemented WebGPU backend can recover.

Current frames are borrowed until synchronous submission returns. GPU encoding
may consume them synchronously; any work retaining those arrays afterward needs
a copy or explicit ownership/acknowledgment. Reusable buffers, bounded residency
and a bulk WASM interface must preserve that lifetime, not merely avoid GC.


## Fixed-view implementation and measured follow-up (2026-10-04)

[039–045](../tactical/039-fixed-view-gpu-parent.md) deliver the optional WebGL2
world backend and shared diagnostic car body/pose path. The same car geometry and
unlit material render through Three WebGPU and forced WebGL2 on full desktop
Chromium and Pixel 7a. See [045 evidence](../benchmarks/045-gpu-comparison.json).
This establishes asset renderability, not identical output or a full WebGPU port:
the sprite ShaderMaterial requires a corresponding node/TSL material adapter.

Matched traversal does not justify replacing Canvas yet. Keep the backend opt-in;
profile GPU uploads/submission and improve the car asset independently. No Rust
requirement emerged. The car still decodes the full source atlas at first use,
which dominates its phone asset-probe load; a compact derived asset is concrete
next work. Current source/top/hidden-face quality limitations remain unresolved.
