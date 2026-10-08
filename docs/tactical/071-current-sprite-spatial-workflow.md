# 071 — Current sprite spatial workflow and inspection sheets

Owner: [3D assets](../topics/3d-assets.md). Date: 2026-10-08.

## Scope and protocol

The owner requested an end-to-end local workflow, inspection sheets showing every
stage, ten different currently used game assets, and evidence-based next trials.
This explicitly broadens 070's deferred shape corpus for offline diagnostics.
It does not promote generated artwork or alter gameplay clipping/physics.

Ten sources are selected from the current production palette: palm tree, picnic
table, beach umbrella, fountain, shed, blue tent, slide, swing, sand castle and
compact-1 car. Prop inputs are exact dedicated PNGs consumed by `GameAssets` and
`PropFactories`; the car is the full east-labelled crop of the current vehicle
bank consumed by `Vehicle`. Legacy car direction labels are preserved with the
actual facing documented. `prepare_batch.ts` freezes crops, alpha/RGBA hashes,
source-file hashes, runtime dimensions, anchors, physical bounds and prompts.
All large outputs live on the secondary drive with the installed local models.

One fixed baseline is used: SDXL img2img strength 0.8, image seed 42, guidance 5,
1024 squared, 50 nominal/40 effective steps; learned U2Net alpha; six MV-Adapter
views, seed 42, 768 squared, 50 steps, guidance 3; learned alpha and predeclared
angle-0 selection; pinned TRELLIS.2 512, mesh seed 42, twelve sampler steps. Models,
revisions and environments are inherited from [070](070-model-assisted-spatial-assets-investigation.md)
and the [workflow README](../../scripts/spatial-assets/README.md).
Only one image enters TRELLIS; the five other views are generated hypotheses.

Every completed run saves raw arrays and six false-depth geometry views, a
silhouette-fitted original-color depth/coverage bake, six static actor comparison
cases, and a separate target-50k-triangle/1024-texture GLB. Manufacture-like box
shapes are allowed; minimum axis thickness still screens cards. Numerical screens
and source coverage do not prove shape fidelity. Painted ground roles are not
automatically inferred for these new props. Static actor probes are diagnostics,
not runtime integration or accepted collision/support behavior.

## Inspection outputs

`stage_sheet.py` produces a 16-panel PNG and responsive HTML with linked original
images and SHA-256 provenance: original sprite, exact SDXL input, generated RGB,
first mask/cutout, all six views/cutouts, selected mask/reference, exact TRELLIS
preprocessing, untouched raw geometry, original-alpha coverage, source-sized
depth, and textured front/side/oblique mesh. Missing stages are explicit.
`batch_report.py` adds a six-column ten-asset sheet, individual stage pages,
mesh viewers and measurements. Checkers represent transparency. Display resizing
never changes preserved inference inputs. Observations are agent assessments.

## Execution record

The palm pilot completed all sixteen stages and produced separate volumetric
fronds/trunk. Its generated silhouette and surface interpretation differ from the
source. The original source RGBA is unchanged.

Inspection found misleading prop names: the picnic-table sprite depicts a table
with plates/jug/containers, while the slide sprite depicts posts, bars and ladder
panels. Corrected prompts describe observed pixels. The first frozen manifest and
prompt files remain unchanged; separate prompt corrections record original/new
hashes and reason. Future preparations use these corrected descriptions.

The first broad launch stopped at a shell parse failure introduced by Windows
line endings before the remaining inference runs began. Its failed-stage sheets
and batch ledger are retained. LF scripts passed `bash -n`; a fresh corrected
batch preserves the completed palm pilot and generates the other nine with fresh
IDs. This is the baseline comparison, not ten selected successes.

All ten baseline cases completed inference, bake/comparison, textured export,
browser capture and all sixteen sheet stages. The corrected nine-case sequence
took 22 minutes 37 seconds; the palm was a separately completed pilot. GLBs range
from 40,360 to 49,757 triangles. Completion means the computations finished, not
that all ten shapes are useful. Four cases (palm/fountain/tent/car) are recognizable
volume sketches with important drift; the other six have stronger mask, support,
geometry or appearance failures. None is accepted or production-ready.


## Saved-image mask ablation

Two CPU-only mask probes reuse identical table SDXL RGB bytes. Automatic
4-neighbor border-connected color distance at thresholds 8/16/24 preserves the
whole table but retains enclosed background under its frame. Thresholds 64/96/128
start erasing similar-colored dish interiors without resolving all enclosed
background. Both probes save masks, RGBA cutouts, comparison PNG, implementation
and hashes. This establishes an early-stage segmentation problem and rules out
blindly replacing U2Net with a simple global border threshold. No alternative
mask has been sent through TRELLIS in this baseline batch.


## Follow-up mechanism research (not executed)

Official documentation checked on 2026-10-08 supports a controlled whole-object
mask comparison using text/box-prompted [SAM 3](https://github.com/facebookresearch/sam3)
or [SAM 2 image box/mask prompts](https://github.com/facebookresearch/sam2/blob/main/sam2/sam2_image_predictor.py).
SAM 3's image workflow provides masks and boxes from text or visual prompts;
its separate environment requires Python 3.12+, PyTorch 2.7+ and CUDA 12.6+.
These are candidate mechanisms for recovering complete tables/supports, not a
claim of better results on these pixels. Keep original generated RGB bytes and
TRELLIS settings fixed when comparing masks. Checkpoint access is a separate
provider requirement, not automatically granted by DINOv3 access.

[SAM 3D Objects' official setup](https://github.com/facebookresearch/sam-3d-objects/blob/main/doc/setup.md)
lists at least 32 GB GPU VRAM. The current 24 GB 4090 does not meet that documented
default. Do not present it as a verified drop-in local path. A different 3D model
trial is lower priority than fixing the observed conditioning/mask losses.


Dense float32 CUDA triangle interpolation yields subpixel XYZ backprojection
residuals on real generated meshes: the first six cases range up to 0.1194 source
pixels, so these are not exact analytic pixel-center positions. The artifact
validator records maximum/99th-percentile residuals and rejects errors greater
than a quarter source pixel; depth/XYZ ray-distance consistency is checked at
1e-4 world pixels. The initial stricter 1e-4 pixel-center assertion failed and
is retained in the execution transcript; measured residuals are saved separately. Original arrays are not repaired or silently
replaced. This tolerance is a numerical diagnostic, not clipping acceptance.


## Visual findings by retained case

| Asset | Agent observation from full stage sheet |
| --- | --- |
| Palm tree | Volumetric trunk/fronds; canopy shape and darkness drift; substantial projection outside source alpha |
| Picnic table | First mask removes table/legs, keeping dishes; downstream mesh reconstructs vessels on a strip |
| Umbrella | Volume, damaged canopy and stray rods; original round stand is removed; view configurations drift |
| Fountain | Coherent volumetric basin/base sketch; invented finials and tall box-like base |
| Shed | SDXL reads blue roof as walls; first mask removes door/front half; truncated box with invented red roof |
| Blue tent | Volumetric fabric/open entrance; curtain interpretation, lower-material loss and side-frame drift |
| Climbing frame (slide alias) | Volumetric posts/ladders; filled ladder gaps, invented larger side structure and disconnected supports |
| Swing | Recognizable frame/seat volume; first mask preserves opening, second mask fills it, producing a backing panel |
| Sand castle | Clean reference but severely perforated/fragmented raw mesh; export inherits holes |
| Compact car | Coherent body/wheels; altered proportions/camera, malformed grille/front and invented red hood patch |

Shed coverage is 2,517/2,550 opaque pixels (98.7%) despite its semantic failure.
It is a direct counterexample to treating fitted coverage as reconstruction quality.
All camera labels on the GLB are provider-axis inspection cameras; source depth
uses the independently saved game-projection fit. These observations are agent
assessments and do not change any human approval state.

## Next bounded experiments

1. Hold saved generated RGB bytes fixed; compare U2Net with a whole-object
   text/box-prompted segmenter on table/shed, and evaluate transparent-hole
   constraints on the swing at both masking stages. Preserve raw masks and inspect
   complete-object retention before spending another TRELLIS run.
2. Hold source, conditioning RGB/alpha and mesh seed fixed; compare direct
   SDXL-reference-to-TRELLIS against the MV-Adapter branch on palm/tent/car. This
   isolates view synthesis from reconstruction. A lower-strength, explicit source
   camera/roof-color trial can then measure interpretation drift separately.
3. Repeat the clean castle conditioning at another mesh seed and then a declared
   higher sampler budget; raw novel views must show intact surfaces before trying
   export repair. Keep these separate from the mask experiments.

For original-color game clipping, follow 070's unfinished camera/contact/ground
registration and actor-coverage work using the best volumetric proxy. None of
these diagnostic GLBs is a physics/support replacement. Register exact useful
candidates in Workshop before requesting formal human art judgments.


## Delivered evidence and validation

Portable [overview](071-spatial-assets/overview.png),
[all stage previews](071-spatial-assets/index.html),
[results](071-spatial-assets/results.json) and
[frozen source manifest](071-spatial-assets/inputs.json) preserve the selected ten
cases. The 66 copied/preview files total about 9.4 MiB; source crops and prompts
are byte copies, stage PNGs are explicitly marked resized previews. The
[evidence record](071-spatial-assets/evidence.json) hashes both original and
portable bytes. Frozen JSON is exempt from formatter/line-ending rewriting; generated portable HTML is formatter-exempt;
shell launchers are forced to LF and preflight syntax is checked before inference.
The full external bundle retains 16 full-size stages per asset, raw arrays,
original masks, source depth/XYZ, actor comparisons, textured GLBs and orbitable
viewers. Its assessed report is `batches/ten-current-assets-002/report-assessed/index.html`.
The failed launch and both saved-image mask probes remain alongside it.

[Artifact validation](071-spatial-assets/artifact-validation.json) verifies all
ten current source/crop hashes and unchanged runtime pixels, 160 stage images,
678 report links, depth/validity/XYZ consistency and raw/export hashes. Maximum
XYZ projection residual is 0.1194 source pixels, below the declared quarter-pixel
numerical bound. [Browser checks](071-spatial-assets/browser-validation.json)
verify eleven report/stage pages at 1280 and 390 pixels (22 viewport checks, no
errors or broken images). Each GLB separately passed textured loading, camera,
wireframe and mobile inspection in bundled Chromium. All browsers are closed.
Python compilation, reference tamper/duplicate rejection, synthetic geometry,
CUDA depth/projection and compositor checks pass. Typecheck and lint pass (118
existing warnings, 34 infos). Full native Windows tests: 1,728 passes, five
failures and ten skips across 207 files; the same symlink-EPERM and SIGKILL cases
seen in 070 remain, including static-file setup/cleanup errors. Runtime render,
physics, sprite pixels and promoted banks did not change.

The portable report also passes desktop/mobile image and width checks; all 66
collected file hashes remain intact after repository checks. No inference or
export process remains running.
