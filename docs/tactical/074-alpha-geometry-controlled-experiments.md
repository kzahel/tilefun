# 074 — Controlled alpha and geometry experiments

Owner: [3D assets](../topics/3d-assets.md). Started: 2026-10-08.

The owner authorized further experiments after [073](073-spatial-pipeline-alternatives.md).
This bounded follow-up isolates returned-alpha handling before expanding the
model roster. Diagnostic data stays under `D:/spatial-assets/074`; 073 and runtime
art remain unchanged.

## Protocol

Reuse the exact saved Qwen seed-42 compact car and oak images. Composite returned
RGBA over RGB128 with PIL. All four new references share these exact RGB bytes:

1. Native-clean: returned alpha, cleaned/composited RGB. This isolates hidden RGB
   from the prior raw-native-alpha branch, with a declared extra edge composite.
2. Native-hard: same RGB, returned alpha thresholded at 128.
3. U2Net-clean: U2Net on the composited RGB, soft alpha preserved.
4. SAM2-box: [official SAM2.1 small](https://huggingface.co/facebook/sam2.1-hiera-small)
   on the same RGB, with native alpha>=128 bounds plus 8px. One box prediction,
   no manual points/masks and no best-of-three selection. Preserve logits/score.

Each registered cutout enters both the existing TRELLIS 512/12-step/seed-42
pipeline and TripoSG hierarchical/50-step/seed-42 pipeline: sixteen new geometry
runs. Each provider keeps its established crop/composite/padding, which is saved
for inspection. Shape and color are judged separately because TripoSG is
untextured. Original-alpha agreement and predicted SAM score are diagnostics,
not segmentation truth or fidelity acceptance.

SAM runs in a separate D-backed WSL environment. Provider revision:
`2b90b9f5ceec907a1c18123530e92e794ad901a4`; checkpoint revision:
`ee5bba1d82bb8749febdf90f45e84b687142ba03`. Use the official image predictor;
disable optional CUDA connected-components postprocessing. Save checkpoint hash,
box coordinates, package versions, implementation, masks and every GLB view.
See the [official API](https://github.com/facebookresearch/sam2/blob/2b90b9f5ceec907a1c18123530e92e794ad901a4/sam2/sam2_image_predictor.py).

## Execution — complete bounded trial, 2026-10-08

Eight primary cutouts and two explicit adaptive probes were registered, with
23 successful computations: twenty matched seed-42 geometry runs plus three
car seed-43 controls. No editor images were regenerated. A mask follow-up adds
SAM canopy/trunk foreground
points for oak: maximum native-alpha distance-transform point globally, then
within the bottom 20% of native bounds. Coordinates and prediction are saved;
the original box-only result remains intact. This improves agreement with the
native opaque core from 93.34% to 99.66%, without establishing segmentation truth.
Both geometry providers received this ninth cutout.

The car results distinguish hidden RGB cleanup from alpha handling:
native-clean still makes a shelter-like structure, while native-hard produces
a recognizable car. U2Net-clean and SAM-box also produce cars at seed 42.
Native-clean again fails at mesh seed 43; native-hard again produces a car.
Thresholding changes the provider crop bounds by roughly 1–2 pixels as well as
alpha; crop rounding and soft-edge treatment are not independently isolated.
Amplification of actual provider RGB exposes a purple/grid pattern outside the
car despite proper RGB compositing. Native-clean has 103,174 nonzero RGB pixels
outside alpha>=0.5 (99th percentile maximum channel 3/255); native-hard and
SAM-box have zero. The grid is also present around the tree. This diagnostic
amplification is not an inference input or candidate artwork.

The low-alpha-floor car control sets alpha<32 to zero and retains every other alpha
and the exact same RGB. Assert the alpha>204 pixel set (and thus TRELLIS crop)
is identical to native-clean. It produces recognizable TRELLIS cars at both
seeds 42/43 and a recognizable TripoSG car at 42. Outside-foreground nonzero
provider RGB falls to 1,748 pixels, with 99th percentile zero. This isolates a
consequential low-alpha change from the earlier hard-mask crop movement; 32 is
an experimental value, not a universal threshold.

### Geometry outcomes

| Route / mask | Car | Oak |
| --- | --- | --- |
| TRELLIS / native-clean | Shelter-like surfaces at 42; purple surrounding panels at 43 | Leaf layers plus spurious background/vertical structures |
| TRELLIS / native-hard | Recognizable compact car at both seeds | Removes large background structures; layered flat foliage remains |
| TRELLIS / U2Net-clean | Recognizable car at 42 | Still layered foliage, with white regions |
| TRELLIS / SAM-box | Recognizable car at 42 | Layered foliage and weakened trunk |
| TRELLIS / adaptive probes | Floor32 gives cars at both seeds, same native crop | Positive points restore mask/trunk, but foliage remains layered |
| TripoSG / all five car masks | Recognizable car geometry; no surrounding-sheet failure | Not applicable |
| TripoSG / native-clean | — | Densest coherent canopy in this tranche |
| TripoSG / hard/U2Net | — | Real trunk/branches, but open/sparse foliage |
| TripoSG / SAM-box/points | — | Box-only gives floating fragments; points restore substantial trunk/branches, foliage remains sparse |

TripoSG is shape-only here; no new texture generation was performed. The
promising 073 Qwen → TripoSG → TRELLIS texture trial remains separately frozen.
Provider crop/background/padding policies differ and are saved: the comparison
is of complete routes, not just network architecture. Core/mask agreement and
SAM confidence are not semantic truth; losing a small trunk region can destroy
the usable tree while retaining most canopy pixels.

The full 600,946-triangle TripoSG native-hard tree has more fine leaves than its
46,626-triangle inspection export, but remains open relative to native-clean.
The full SAM-box export also lacks a coherent trunk. Separate full-provider
captures/orbit viewers check these two cases; simplification is not the sole
cause of their structural failures. Other shape rows remain declared inspection
decimations. No new asset is accepted or promoted.

### Evidence and reproducibility

Full report: `D:/spatial-assets/074/report/index.html`. Portable
[comparison report](074-alpha-geometry/index.html),
[matched masks/providers](074-alpha-geometry/overview.png),
[two-seed car control](074-alpha-geometry/seed-sheet.png),
[results and provenance](074-alpha-geometry/results.json),
[observations](074-alpha-geometry/assessment.json) and
[execution ledger](074-alpha-geometry/execution.json).

The report exposes exact frozen Qwen prompts/RGBA, composited RGB, actual masks,
automatic box/point coordinates, logits, declared RGB amplification, raw arrays,
GLBs, source-sized depth, actual UV/PBR textures and thirteen sixteen-stage
TRELLIS sheets. Six 073 controls are linked without recomputation. Exact Python
implementations, immutable revisions, checkpoint hash and the separate SAM
environment lock are retained; all weights/large output stay on D-backed storage.

[The reusable driver](../../scripts/spatial-assets/run_mask_study.ps1) prepares
the ten cutouts, runs both geometry routes and the three seed repeats, then
extracts underlying materials, reports and validates. Setup, primary/extra
drivers and seed probes were exercised separately. The revised full fresh-study
command was syntax checked but not rerun from a completely fresh bundle.
[Usage](../../scripts/spatial-assets/README.md#controlled-alpha-and-geometry)
documents the separate probes and their assumptions.

### Validation and next work

Audit passes: 518 artifact hashes, 1,106 local links and 30 desktop/mobile page
states, zero errors; [validation](074-alpha-geometry/validation.json). Each GLB
inspection independently verifies export identity, six views, wireframe and
mobile controls. Bundled Playwright Chromium closes after each capture/check.
Python compilation, Bash syntax, PowerShell parsing, typecheck, lint and Git
whitespace checks pass. Unit tests retain the same Windows-sensitive failures:
1,728 passed, ten skipped, five failed in four suites (symlink permissions and
process termination). Game/runtime/render contracts are unchanged.

Next: apply the crop-preserving low-alpha control to the remaining frozen Qwen
shed/table/tent references against their native-alpha 073 controls. Check roof,
cloth and thin-support landmarks before recommending a guard broadly. For oak,
decouple object framing from mask choice and repeat TripoSG geometry at a second
seed, then texture the best structurally faithful shape. Procedural branches/
canopy or frame/cloth geometry remains a useful independent comparison for
structures that both generation routes continue to misinterpret.
