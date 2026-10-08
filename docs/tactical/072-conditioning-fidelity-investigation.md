# 072 — Conditioning fidelity investigation

Owner: [3D assets](../topics/3d-assets.md). Date: 2026-10-08.

The owner observed that SDXL loses substantial sprite information before the
3D stage. The 071 baseline generalized oak's strength-0.8 volume workaround too
far: shed roof/door semantics, tent fabric/layout and vehicle proportions drift.
Learned masks introduce additional losses and must be evaluated separately.

## Matched image experiment

Reuse the frozen 071 source bundle and registered strength-0.8 references.
Generate shed, blue tent and compact-1-east at strengths 0.35, 0.55 and 0.65:
nine new references and three preserved baselines. Hold prompt, negative prompt,
1024 RGB input bytes, model revisions, nominal steps 50, guidance 5 and seed 42
fixed. Effective denoising steps change with strength (17/27/32/40), as defined
by the installed [Diffusers 0.32.2 image-to-image workflow](https://huggingface.co/docs/diffusers/v0.32.2/en/using-diffusers/img2img).
Do not equate strength 0.8 with lossless enlargement.

`run_fidelity.ps1` preserves a fresh study plan/execution ledger and per-case logs;
`fidelity_report.py` makes a five-column sheet with RGB before masking above each
learned cutout. Frozen source and input hashes are checked; failed cases remain
visible. Color MAE measures pixel change, not structural correctness. Alpha-prior
recall/outside measurements assume unchanged image-space alignment and include
original painted ground. Inspect landmarks and masks; do not automatically pick
the lowest MAE as the best 3D reference.

The baseline ten assets and all previous references remain frozen. All large
outputs stay on the secondary drive. No runtime sprite/render/physics changes,
new art approvals or promoted banks are part of this experiment.

## Follow-through

After RGB/mask inspection, send a bounded number of more faithful references
through direct TRELLIS.2 with seed 42. Record whether fidelity trades away volume;
a single generated view must not silently become a redesigned asset. Mask quality
and camera registration remain independent concerns.

## Execution and image findings

`D:/spatial-assets/071/conditioning-studies/fidelity-001` retains the plan,
execution ledger, nine successful new image generations and three original
strength-0.8 controls. Every case uses identical source/input/prompt bytes and
seed 42. The twelve-case matrix separates RGB and masks; no manual masks were
introduced. The original ten-asset results remain unchanged.

- Shed: 0.35/0.55 retain the pixel design; 0.65 smooths it while keeping the blue
  tiled roof and complete front door. All three lower-strength masks retain the
  full shed. At 0.8 the RGB changes roof/wall semantics and color; its mask drops
  much of the lower front. The 0.65 door window still changes to a circle.
- Tent: lower strengths preserve blue/brown fabric layout much better than 0.8.
  However, 0.35/0.55 learned masks remove brown fabric/supports despite retained
  RGB. At 0.65 the mask keeps more of the complete tent. Strength alone cannot
  fix segmentation, and the tent was not reconstructed in this follow-through.
- Car: 0.35/0.55 stay close to the original pixel design; 0.65 retains its compact
  profile and source camera while smoothing it. The 0.8 reference changes camera,
  proportions and shading substantially. These are visual agent observations,
  not measured semantic fidelity scores.

## Matched 3D protocol

`run_fidelity_meshes.ps1` reuses the saved 0.65 and 0.8 cutouts on shed and car:
four fresh direct TRELLIS runs, fixed mesh seed 42, 512 pipeline and twelve steps.
No MV-Adapter or second learned mask enters these runs. Comparing 0.65 direct
against 071's 0.8-plus-MV result alone would confound strength with MV-Adapter;
the new direct controls avoid that error. U2Net's response still changes with
the generated RGB, so this estimates the combined reference-generation/masking
effect, not a pure TRELLIS response to denoising strength.

The 0.65 shed has genuine volume and retains blue roofing/front-door features,
but TRELLIS misinterprets roof detail as upper vertical-wall texture. The 0.8
direct control makes a smoother red-roof blue-wall shed, a different design.
The 0.65 car has a volumetric body and wheels, with a closer compact profile,
but visible stepped/noisy surfaces and invented red mirrors. The matched 0.8
car is smoother but changes to a rounded purple-blue hatchback and has flawed
hood lines. Coarse volume screening does not make these
faithful reconstructions or good clipping proxies.

## Pipeline decision and next experiment

Stop generalizing the oak strength-0.8 workaround. Use a conditioning comparison
before reconstructing an asset, explicitly inspect landmark/camera preservation
in RGB, then inspect the independent cutout. For shed/car, 0.65 direct is a more
faithful trial than the broad 071 recipe; it is not a universal new default.
Low-strength SDXL preserves more pixel information but does not by itself solve
3D interpretation or surface quality. Existing launcher defaults remain the
historical experimental baseline so oak's observed flatness is not silently
reintroduced.

Next compare an image-editing or edge-conditioned reference generator against
this matched 0.65 baseline, keeping source roof/door/wheel landmarks and camera
fixed. Separately test whole-object/hole-preserving segmentation. Introduce
MV-Adapter only as a matched optional branch after a reference passes inspection.
New model quality must be established by experiments, not inferred from recency.

## Evidence and validation

The bounded investigation is complete. All nine new image references and four
direct mesh runs succeeded. Full report:
`D:/spatial-assets/071/conditioning-studies/fidelity-001/report-with-meshes/index.html`.
It links actual RGB/cutouts/masks, raw meshes, all stages, depth/XYZ arrays,
pipeline records, GLBs and orbit viewers. There is no new tent mesh in this trial.

Portable [inspection report](072-conditioning-fidelity/index.html),
[RGB/mask matrix](072-conditioning-fidelity/sheet.png),
[matched 3D views](072-conditioning-fidelity/mesh-sheet.png) and
[results](072-conditioning-fidelity/results.json) retain 35 verified evidence
files with exact-copy hashes or explicitly recorded LANCZOS preview transforms.
`fidelity_evidence.py` collects these independently of the large external bundle.
No model weights or generated candidate GLBs are added to the repository.

The report verifies all twelve reference input/settings/source identities,
raw-array/export hashes and the four sheets' available-stage image hashes.
Each GLB passed texture loading, six-view capture, wireframe/camera controls and
mobile layout checks in bundled Chromium. `validate_report.mjs --study` checked
six report/stage/portable pages at 1280/390 widths (twelve viewport checks),
216 local links and all displayed images: zero errors; browsers closed afterward.

Typecheck and `npm run check` passed (118 existing warnings and 34 infos).
`npm test`: 1,728 passed, ten skipped, five failed across four files; these repeat
the 071 Windows symlink EPERM and SIGKILL-process limitations, including the
staticFiles suite setup/cleanup errors. No game/renderer code changed.
Python helpers compiled and WSL Git whitespace checks passed.
