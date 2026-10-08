# 073 — Spatial pipeline alternatives

Owner: [3D assets](../topics/3d-assets.md). Started: 2026-10-08.

The owner authorized running the first three/four alternatives from the
[research](../research/spatial-asset-pipeline-alternatives-2026-10.md), with an
inspectable, repeatable local workflow. First tranche: FLUX.2 klein 4B reference
editing, Qwen-Image-2.1 reference editing/native alpha, direct TripoSG shape
reconstruction, and a parameterized car fitted to genuine directional sprites.
These are diagnostic experiments; runtime/promoted art remains frozen.

## Protocol

- Freeze oak, shed, compact car, picnic table and blue tent from the existing
  070/071 manifests. Retain hashes and original alpha, including painted shadows.
- Both editors receive identical 1024-square nearest-enlarged RGB inputs, with
  alpha composited over RGB128. Use asset-specific preservation prompts, seeds
  42/43, published step defaults, pinned weights and recorded implementations.
- Preserve raw RGB/alpha before any mask. Qwen native alpha is evaluated as
  returned, never silently substituted. Save U2Net separately for the editor
  comparison. Send inspected references through the existing fixed-seed TRELLIS
  pipeline, without MV-Adapter or a second mask.
- TripoSG receives original RGBA first. Its official alpha-preserving white
  composite/crop/padding is recorded; skip unused RMBG. Preserve untouched mesh
  arrays, untextured GLB and six declared views before any texture/fit trial.
- Fit a reusable parameterized car to all four genuine sprite directions,
  normalizing actual facing. Record camera assumptions and source-fit residuals.
  Inspect shape before inferred texturing; hidden surfaces remain assumptions.
- Retain failures, timings, peak memory, provenance and inspectable stage sheets.
  A smooth or volumetric model is not automatically a faithful reconstruction.

## Storage and execution

Large artifacts: `D:/spatial-assets/073`. Fresh WSL environments and providers
live on the D-backed WSL disk under `/home/sox/spatial-assets`. Established
TRELLIS/SDXL environments remain unchanged. Download only inference components;
record immutable revisions and environment locks before inference.

## Execution — complete bounded trial, 2026-10-08

Ran locally on RTX 4090 (24 GiB), using the secondary-drive-backed WSL disk.
The four routes are implemented and individually exercised. The fresh-study
[launcher](../../scripts/spatial-assets/run_alternatives.ps1) assembles them;
it was syntax checked, but the complete assembled command has not been rerun
as one fresh study. See the [workflow guide](../../scripts/spatial-assets/README.md#four-route-alternatives).

| Route | Executed comparison | Observation |
| --- | --- | --- |
| FLUX.2 klein 4B | Five assets × two image seeds; seed-42 U2Net cutouts to TRELLIS and TripoSG | Fast, solid-looking references, but substantial design/camera drift. Shed/table volumes can be useful; roofs and thin supports remain imperfect. |
| Qwen-Image-2.1 | Same ten images; returned native RGBA and independent U2Net preserved; seed-42 native-alpha cutouts to both geometry models | Generally closer source designs than FLUX. Returned alpha can cause severe TRELLIS interpretation failures; it is not automatically a validated mask. |
| TripoSG | Five original and ten edited inputs with matched hierarchical decoding; original flash controls and official-example smoke retained | Edited references substantially improve volume. Qwen tree has actual canopy/trunk/branch geometry; originals remain poor even with hierarchical decoding. Shape-only output requires separate texturing. |
| Explicit fitted car | Four genuine directional sprites; two starts × 180 Adam steps; observed-color projection and existing-mesh AI texturing | Silhouette IoU 0.879–0.947, including painted shadows. Projection covers 47.33% of atlas texels but stretches. AI texturing preserves all 284 triangles/normalized vertices; seams and invented details remain. |

The bundle contains 20 editor generations, 30 registered cutouts and 38 run
records: 36 successful computations and two retained failed texture adapters.
These counts include controls, probes and intermediate stages, not 36 usable
models. The main matched geometry comparison is ten TRELLIS runs plus fifteen
hierarchical TripoSG runs. Two editor seeds were inspected; geometry uses only
image seed 42 and mesh seed 42. Seed reliability and broader generalization
remain untested.

### Mask probes and shape-first texturing

Changing only the registered alpha branch for the saved Qwen car image changes
TRELLIS from a shelter-like failure into a recognizable compact blue car with
wheels and stripe. The corresponding oak probe still produces stacked leaf
planes and adds purple/blue contamination. U2Net was applied to saved raw RGB
with returned alpha ignored: hidden RGB contains colors that are not visible
artwork. This establishes sensitivity to alpha handling, not that U2Net is a
universal solution. Both controls remain in the
[matched mask sheet](073-spatial-alternatives/mask-probe-sheet.png).

Qwen → TripoSG hierarchical geometry → TRELLIS existing-mesh texturing is the
most promising tree route in this tranche. It gives real canopy/branch/trunk
volume without the black platform, but foliage shape, rough surfaces and color
still drift. No manual masks were drawn. The car fit has authored class topology
and optimized numerical parameters, not a manually sculpted final mesh.

The first fitted-car texturing attempt failed in upstream CuMesh unwrapping.
Keeping supplied UVs then exposed mutation of read-only Trimesh normals. The
final recorded adapter keeps UVs and copies normals before transformation;
upstream source and both failed attempts remain untouched. This yields a
plausible textured car while preserving normalized geometry exactly (maximum
vertex distance zero). It does not fix the source-projection UV layout or
establish landmark fidelity.

TripoSG's default flash decoding produced malformed original-sprite controls
with many unreferenced vertices. The matched trial uses dense depth 7 /
hierarchical depth 8 instead. Raw arrays/GLBs are retained; separate inspection
exports remove unreferenced vertices and decimate to 50,000 triangles without
remeshing. The official example smoke verifies a recognizable bust and declared
Y-up inspection axes. Poor original inputs cannot be attributed solely to the
flash decoder, because the matched hierarchical originals also fail.

### Reproducibility and inspection

- Full local report: `D:/spatial-assets/073/report/index.html`; portable
  [comparison report](073-spatial-alternatives/index.html),
  [overview](073-spatial-alternatives/overview.png) and
  [results/provenance](073-spatial-alternatives/results.json).
- The report links exact prompts/provider inputs, raw RGB/native alpha,
  registered masks, inference and failed-run records, untouched geometry arrays,
  exported GLBs, six-view orbit/wireframe inspections and twelve sixteen-stage
  TRELLIS sheets. Actual UV arrays and extracted base-color/PBR texture PNGs
  expose the underlying data rather than just rendered results.
- Exact historical Python implementations are archived by SHA-256, including
  decoder/adapter revisions. Environment locks and immutable checkpoint/provider
  revisions are recorded. No runtime sources or promoted banks changed.

| Weights | Immutable revision |
| --- | --- |
| `black-forest-labs/FLUX.2-klein-4B` | `e7b7dc27f91deacad38e78976d1f2b499d76a294` |
| `Qwen/Qwen-Image-2.1` | `d26bb61231c349cf6b7896fa83353113880e1ba3` |
| `VAST-AI/TripoSG` | `2c1c516d22d58db486a058d98d31bb6177344e06` |

The new diffusers provider is pinned at
`122b1e11fd497c3eeef14b3b98ca26a60166e48b`; TripoSG at
`fc5c40990181e2a756c4e0b1c2f4d6b5202faf8c`. Established TRELLIS/DINO checkpoints
retain their earlier immutable revisions in every run record. Separate image-edit
and TripoSG environments use torch 2.6/CUDA 12.4. TripoSG uses NumPy 1.26.4
instead of its incompatible historical pin; diso 0.1.4 is compiled for this GPU.

After model load, FLUX takes roughly 9–11 seconds per image (four steps), Qwen
40–53 seconds (40 steps; roughly 17.25 GiB peak allocated), and TripoSG 7–10
seconds per mesh (roughly 5 GiB peak). These are observed local timings, not
cross-model quality scores; cold loads/offloading add substantial latency.
Inference downloads are approximately 16/33/8 GB respectively; no duplicate
root weight files were downloaded. System-drive model storage was avoided.

### Validation and next work

Artifact audit passes: eight frozen crops/enlargements, all registered cutouts,
generation/raw mesh/export hashes, exact historical implementations, actual
material arrays and available stage-panel hashes. Bundled Playwright Chromium
checks 512 artifact hashes, 1,347 links and 28 desktop/mobile page states with
zero errors, then closes. The local report holds `validation.json`.

Python compilation, Bash syntax, PowerShell launcher parsing, typecheck and lint
pass. Unit tests report 1,728 passed, ten skipped and five failures in four
existing Windows-sensitive suites (symlink permissions and process termination).
No game/runtime code changed; full game rendering checks are outside this
offline experiment. Automated integrity/layout checks are not art acceptance.

Next bounded comparison: native alpha, U2Net and SAM2.1 on **properly composited**
Qwen RGB for car/oak, with the same TRELLIS seed/settings. Inspect foreground
loss and hidden-color handling before generating geometry. Then compare TripoSG
and TRELLIS on identical validated cutouts. Refine car wheel/window landmarks
and UV layout separately; test procedural frames/cloth or foliage structure for
thin parts that both geometry routes repeatedly miss. Choose routes by asset
class before expanding to more heavyweight models.
