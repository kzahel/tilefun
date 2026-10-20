# Static vehicle component assemblies

Use this workflow to compose an unchanged rider and vehicle into one GLB and
depth target. The complete
[Explorer/classic assembly](../art-source/vehicle-bake/rider-explorer-classic-motorcycle/v1/assembly.json)
is the concrete example: 4,390 triangles, four source primitives and two opaque
atlases, with separate 512px bike and 256px rider textures. Extra engine outline
and shadow passes remain additional rendering work. This isolated static fit
does not establish all-27 identity coverage, AI occupants, occupied fallback or
normal motorcycle availability. Read the current [rider gates](topics/vehicle-riders.md).
The [frozen inspection record](../public/demos/original-vehicles/rider-explorer-classic-motorcycle-v1/visual-inspection.json)
documents agent QA of that exact revision, with `humanApproval: false`.

## Retain child evidence before composing

Keep each child's original constructor receipt and a separate independent parent
replay proof. The example retains the
[bike source receipt](../art-source/vehicle-bake/classic-motorcycle/v1/source-replay.json),
[rider source receipt](../art-source/vehicle-riders/explorer-upright/v1/evidence/replay-verification.json),
[independent bike replay](../art-source/vehicle-bake/rider-explorer-classic-motorcycle/v1/evidence/base-independent-replay.json)
and [independent rider replay](../art-source/vehicle-bake/rider-explorer-classic-motorcycle/v1/evidence/rider-independent-replay.json).
Fresh replay must construct exact outputs from declared retained inputs; copying
an existing GLB or normalizing receipt fields performs no construction.

The packager consumes small compatibility aliases:
[base-normalized-replay.json](../art-source/vehicle-bake/rider-explorer-classic-motorcycle/v1/evidence/base-normalized-replay.json)
and [rider-normalized-replay.json](../art-source/vehicle-bake/rider-explorer-classic-motorcycle/v1/evidence/rider-normalized-replay.json).
Its mechanical child checks use `byteIdentical: true`, `glbSha256`, `atlasSha256`
and `scratchInputDependencies: []`. These retained aliases additionally record
`status`, `independent`, `recipeSha256`, and path/SHA256 pairs named
`originalSourceReceipt` and `independentReplayReceipt`. Preserve that provenance;
an alias is a declaration pointing to evidence, never a replacement replay.
The assembly's `additionalInputs` pins the original receipts and independent
proofs alongside both aliases. Do not rewrite immutable child receipts to match
the packager's vocabulary.

## Measure placement and preserve identity

Author forward along Blender -X, up +Z, with ground at zero. Physical source units
become world logical pixels at `80/4.6`. The example's
`mountBlenderWorldPixels: [0, 0, 19.1304347826087]` therefore corresponds to a
1.10-source-unit mount height. This field already contains scaled world pixels;
do not multiply it again. Blender `[x, y, z]` maps to glTF `[x, z, -y]`.

Measure five contacts against the unchanged
[Explorer profile](../art-source/vehicle-riders/profiles/upright-v1.json): hip bottom,
two grip centerlines and two sole tangents. Retain actual triangle intersection,
wheel-cylinder, displaced-rider negative/reset and depth-mask evidence, as in the
[classic fit proof](../art-source/vehicle-bake/classic-motorcycle/v1/evidence/fit-proof.json).
Contact exceptions must be narrow and intentional. Different proportions require
mechanically fitted bars, pegs or saddle and a separately measured mount; preserve
the rider child's anatomy, geometry, UVs and palette.

The [cycle composer](../scripts/vehicle-bake/compose-component-cycle.py) appends a
namespaced mount inside the existing `Motorcycle_Root`, compensating its uniform
rigid transform. It rejects singular, sheared or nonuniform roots. Existing base
buffers and arrays remain exact; only the root's child list changes. Keep numeric
`tilefun_motorcycle: 1`, real `wheel_ids: ["F", "R"]` or `["F", "R", "SC"]`,
and each actual Steer > Roll wheel with its own radius/axis. Never add fake corners.
Editable sources remain **two child packed masters plus the placement recipe**;
there is no additional combined Blender master or implied high-to-low bake.

## Build, replay and finalize a new source revision

Run from the repository root with the
[review dependencies](../scripts/vehicle-bake/requirements-review.txt).
The retained example is immutable: use new assigned paths and a fresh review
output. In the commands below, replace `ASSEMBLY` with that new assembly JSON,
`RECEIPT` with its retained `evidence/replay-verification.json`, `QA` with the
assembly's ignored `qa` directory, and `UTC_ISO` with the assigned deadline.

```sh
python scripts/vehicle-bake/component-package-cycle.py ASSEMBLY
python scripts/vehicle-bake/source-replay.py RECEIPT --qa QA --deadline UTC_ISO
python scripts/vehicle-bake/component-package-cycle.py ASSEMBLY --finalize
```

The [packager](../scripts/vehicle-bake/component-package-cycle.py) first writes
draft outputs and expected hashes. The assembly receipt declares `runner: "python"`,
the pinned builder, arguments `[ASSEMBLY, "--scratch"]`, and all four outputs:
model, primary atlas, companion atlas and recipe. The
[example receipt](../art-source/vehicle-bake/rider-explorer-classic-motorcycle/v1/evidence/replay-verification.json)
has 17 inputs. `source-replay.py` copies declared inputs into a fresh ignored
workspace and verifies newly generated exact bytes. It writes
`QA/parent-source-replay.json`, which finalization requires. Finalization checks
the proof, inputs and output hashes, then marks source complete/immutable and
pins retained files. This source step performs no shared-loader pixel review.

## Capture through the actual shared loader

Prepare a new family config using the
[retained family config](../scripts/vehicle-bake/family-rider-explorer-classic-motorcycle.json)
as the schema example. Keep `toolchain: "motorcycle-v1"` and matching `wheelIds`.
Its `composition` declares the standalone component, matching prefix/mount,
`baseCaptures`, `baseCapturePrefix` and `combinedCaptures`. Here the prefix is
`bike-alone-`; the independent reference directory also contains
`combined-study-N.png` and `combined-engine-N.png`. Compare the composed result
against independently captured two-asset references, rather than itself.

After independent qualification of the current shared loader, replace `FAMILY`
and `BLENDER` with the new config and executable path:

```sh
python scripts/vehicle-bake/production.py FAMILY capture --blender BLENDER --loader-qualified --deadline UTC_ISO
python scripts/vehicle-bake/production.py FAMILY inspect
node scripts/vehicle-bake/component-parity.mjs FAMILY
```

`--loader-qualified` asserts prior qualification; it neither performs that test
nor authorizes activation. Raw GLTF diagnostics cannot substitute. Capture runs
the shared renderer, wheel controls, desktop/mobile and offline checks.
Inspect all 32 native headings, signed phases and wires at unchanged density;
padding may grow, physical scale and ground origin may not. Component parity
checks decoded rider attributes/mount, 32 rider-hidden bare-bike RGBA views and,
when configured, 32 combined RGBA views. It does not replace contact or native
appearance inspection.

Only after agent inspection records honest `humanApproval: false`, resolves
blockers and satisfies the current owner gate should the coordinator separately
freeze and verify with `production.py FAMILY freeze --deadline UTC_ISO` and
`production.py FAMILY verify --deadline UTC_ISO`. Freeze appends the exact candidate
to the original-vehicle root manifest; do not register it twice. Then regenerate
the shared inventories with `npm run art:catalog` followed by
`npm run workshop:manifest`, and run the owning workflow's validation. Source
finalization does not freeze/register a review or confer human approval.

Preserve old pinned helpers and receipts. Historical b0 renderer pins resolve
only through the registered path/hash snapshots described in
[replay compatibility evidence](../art-source/vehicle-bake/replay-inputs/evidence/README.md);
never substitute today's loader or edit old pins. Historical reproduction,
current shared-loader compatibility and normal occupancy remain separate gates.
