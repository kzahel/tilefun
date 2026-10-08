# 075: Alpha guard transfer and tree framing

Owner: [3D assets](../topics/3d-assets.md). Status: completed diagnostics, 2026-10-08.

Run the next bounded experiments on the existing 073 Qwen seed42 images. Keep
all 073/074 artifacts unchanged. Outputs and weights remain on the secondary
drive at `D:/spatial-assets/075` and the D-backed WSL environment.

## Frozen protocol

- Shed, picnic table and blue tent: composite native RGBA over RGB128, attach
  native alpha, then compare with alpha<32 zeroed. All other alpha/RGB and the
  TRELLIS alpha>204 crop are asserted identical. Run seed42 with both TRELLIS.2
  and hierarchical TripoSG: 12 new geometry runs. Earlier 073 raw-native outputs
  are contextual controls, since their RGB treatment differs. TripoSG retains
  its mask-dependent default crop here; those pairs do not isolate framing.
- Oak: reuse 074 native-clean, native-hard and automatically prompted SAM2
  canopy/trunk masks. Compare official mask-dependent framing with one common
  bbox from native-clean alpha>0 and identical white compositing/padding. Run
  TripoSG at seeds42/43: reuse three 074 default seed42 outputs, add nine runs.
  Verify the default preparation matches every saved 074 provider input and
  the common native-clean input matches its default byte for byte.
- Inspect geometry before selecting at most two existing-mesh texture trials.
  Any selections are agent experiment choices, not human approvals.

Pinned models/environments are unchanged from 074. No new editor generations,
manual masks, production sprites, runtime consumers or promoted art banks are
part of this study. Saved provider input images, raw arrays, GLBs, code hashes,
camera captures, stage sheets and failure records make the process inspectable.

## Reproduction

`scripts/spatial-assets/run_guard_study.ps1 -Bundle D:/spatial-assets/075-new`
prepares a fresh bundle, executes both geometry matrices, captures the meshes,
extracts material arrays, archives implementations and writes/audits the report.
`-Phase Props`, `-Phase Trees` and `-Phase Report` permit recorded checkpoints.
Use a fresh bundle: geometry records and source evidence are immutable. Optional
texture selection is an inspection checkpoint and is recorded separately.

## Findings

All **23 new run records succeeded**: twelve prop shapes, nine tree shapes,
two adaptive tree texture probes. Success means artifacts were produced, not
that they are acceptable assets. Four exact Qwen seed42 generations were reused;
no new editor image, segmentation model or weights were downloaded. The existing
RTX4090 and D-backed WSL environments ran the pinned 074 providers/checkpoints.

The car's alpha guard does **not** establish a universal cleanup policy. Shed
TRELLIS loses the stray background structures but also much of its roof. Both
table outputs invent supports/proportions; the guarded tent is visibly more
coherent than native-clean. TripoSG makes recognizable shed volumes and tables
under both masks, but its tent has holes and banded, torn-looking side panels.
Full TripoSG tent exports preserve those visible defects under both masks; the
separate 50k reduction is not their sole cause. Exact full/reduced comparisons
and both full GLBs are retained.

| Prop | Low-alpha pixels zeroed | Nonzero RGB outside alpha<0.5, clean → floor32 | Outside RGB p99, clean → floor32 |
| --- | ---: | ---: | ---: |
| Shed | 374,478 | 95,222 → 2,169 | 7 → 0 |
| Picnic table | 405,250 | 137,011 → 3,520 | 13 → 0 |
| Blue tent | 459,909 | 93,107 → 3,592 | 15 → 15 |

Pixels with alpha32–127 remain, so the floor does not zero every outside
statistic. RGB and alpha>204 pixel sets/crops are identical in all prop pairs;
only alpha<32 changes. These leakage statistics do not establish quality or a
unique reconstruction-failure mechanism.

Tree framing materially affects the harder masks. Common framing gives both
native-hard and SAM2-points a denser canopy at seed42 than their tight default
frames. Native-clean uses the full 1024 square plus 102px padding; harder masks
default to 1215×1214 and 1202×1201 provider canvases rather than 1228×1228.
Seed43 changes crown structure and gaps under every mask. The native-clean
seed42 repeat uses exactly the same provider pixels and reproduces **all raw
vertices and 725,592 faces exactly**, supporting the mask/framing/seed comparison.
Fixed framing is a useful pipeline control, not a universal best crop.

After inspecting the saved front/side/oblique views, two shape-first texture
probes used native-clean/common/seed43 and SAM2-points/common/seed42 geometry.
Both used one new oak floor32 reference with identical RGB/crop and the same
texture seed42. Selection reasons and exact parent hashes are saved separately.
The colored results have 3D trunks and crowns and a less fluorescent palette
than 073, but still have canopy gaps and layered foliage surfaces. They do not
establish a new winner over the earlier tree. Texturing used the separate 47k–50k
inspection meshes, retained normalized vertices to less than 2.2×10⁻⁸ distance,
and exported two fewer triangles each. Raw high-density shapes remain untouched.

## Evidence and validation

The [portable report](075-alpha-guard-framing/index.html) contains six comparison
sheets, findings, exact hashes and a link to the full local report at
`D:/spatial-assets/075/report/index.html`. The local report exposes every run's
sixteen-stage sheet, original pixels, editor/native RGB/alpha, supplied mask,
actual provider input, raw arrays/GLBs, UV/material data, interactive camera and
wireframe views, settings, timing and archived implementations. Inherited SAM
logits and automatic canopy/trunk point records remain inspectable. Earlier
073/074 controls are hashed and checked without altering their bytes.

Typecheck, lint, Python compilation, PowerShell parsing and a fresh preparation
smoke run passed. The actual Props, Trees, Textures and Report phases ran; the
entire fresh one-command workflow was not repeated from scratch. Native Windows
unit tests returned 1727 passed, 10 skipped and 6 failed across 5 suites, including
one transient Workshop timeout. The isolated Workshop rerun passed all 13 tests.
Remaining failures are the previously observed symlink EPERM fixtures and
SIGKILL expectation; no unrelated persistence/server code was changed.

The full/portable report audit passed **908 artifact hashes, 1,386 links and 50
desktop/mobile viewport checks**, with zero errors. All captures/audits used
bundled Playwright Chromium and closed the browser. Large outputs and weights
stayed on D; roughly 83GiB remained on C and 56GiB on D.
No runtime consumer, production sprite, promoted bank or human approval changed.

## Next work

Keep crop selection separate from segmentation in the reusable tree route.
Compare procedural foliage around the recovered trunk against the generated
canopy, and explicit frame/cloth/support geometry for tent/table. Preserve the
original source silhouette and evaluate hidden views before adding more models.
