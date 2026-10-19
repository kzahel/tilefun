# Original family review harness

The harness uses one config per retained revision. It does not change the frozen
coupe manifest, viewer, candidate inputs or captures. Geometry remains the author's
responsibility. Copy `family-beetle.json` for another authorized family; change its
name/id, source/output/QA/offline directories, clearance ID and style image path.
`glb`, `atlas` and `report` can name explicit repository-relative files within the
source directory; their defaults are `model.glb`, `atlas.png` and `report.json`.
The accepted-coupe style image is optional (`styleReference`).
The source directory contains `model.glb`, `atlas.png` and a completed `report.json`
accepted by `catalog.audit_glb`. All public source review inputs are copied exactly
under the revision's `inputs/` and pinned alongside the actual compiled viewer,
CSS, screenshots, captures, independent proofs and source-input provenance.
Preparation also rejects non-POSIX source paths and stale source-hash entries.

Run from the repository root, after the author marks the report complete:

```powershell
python scripts/vehicle-bake/family-package.py scripts/vehicle-bake/family-beetle.json prepare
node scripts/vehicle-bake/family-build.mjs public/demos/original-vehicles/beetle-v1
node scripts/vehicle-bake/family-capture.mjs scripts/vehicle-bake/family-beetle.json
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/clearance.py -- data/vehicle-bake/beetle-qa/clearance-input.json data/vehicle-bake/beetle-qa/clearance.json
python scripts/vehicle-bake/family-package.py scripts/vehicle-bake/family-beetle.json assemble
node scripts/vehicle-bake/family-capture.mjs scripts/vehicle-bake/family-beetle.json --qa-only
# Independently inspect both camera sheets, wheel phases, wireframes and UI.
# Record visual findings and limitations before freezing.
# Write QA_DIR/visual-inspection.json with status "no-blocking-issues",
# glbSha256 and the observations actually made; this is not human approval.
python scripts/vehicle-bake/family-package.py scripts/vehicle-bake/family-beetle.json freeze
python scripts/vehicle-bake/family-verify.py scripts/vehicle-bake/family-beetle.json --baseline data/vehicle-bake/beetle-qa/frozen-baseline.json
```

The capture runner launches bundled **full Chromium** through Playwright and reaps
the browser and Vite server in `finally`. It checks 16 headings per camera,
eight signed wheel phases per camera, wireframe, independent wheels, fixed body,
absolute reset, camera clipping and controls at desktop/mobile sizes. The native
card stays at its actual `nativeSize` in CSS pixels (128 by default) beside the selectable native/2x/3x view. The rendering
math is unchanged from `viewer.mjs`: same source scale, fixed 50° study camera and
ground anchor, shared `CarMeshAsset` / batching / `CarPixelOutline` and
`setCarMeshProjection`; no family-specific camera fitting or paint overlays.
Pillow only assembles captured images at integer nearest scales.

`assemble` writes contact sheets and turntables, then embeds exact low GLB bytes,
JS, CSS and linked evidence into the server-free offline HTML. After assembly,
`--qa-only` verifies the offline model SHA-256 and absence of network requests.
`freeze` requires that proof and actual clearance, copies public proof receipts,
pins the immutable revision manifest and adds exactly one finished candidate to
`public/demos/original-vehicles/manifest.json`. It never infers human approval or
enables gameplay. Workshop registration and project-wide validation belong to the
coordinator. Any changed completed revision needs a new directory and review ID.

No collision metric substitutes for visual fender coverage. Inspect far-side
crowns, near-wheel seating and the whole silhouette in both camera sets. Neutral
wheel-roll proof leaves steering/suspension unqualified. Do not freeze a known
visual failure merely because automated checks pass.

## Larger native viewports

`family-school-bus.json` selects `nativeSize: 224`. The candidate and capture
receipt retain native dimensions and both ground origins for future runtime
export. Engine radius is `nativeSize / 2`, so 224/radius 112 keeps the default
128/radius 64 pixel density. The study bounds expand by `nativeSize / 128` while
source scale stays `80 / 4.6`, elevation stays 50 degrees and the registration
stays 28 screen pixels downward: study ground (112,140), game ground (112,112).
There is no model scale change, per-heading fitting or camera adjustment.
The separate STYLE image stays 128px. Enlarged views scroll inside their card;
the native bus remains 224px at mobile width 390.

```powershell
node scripts/vehicle-bake/family-regression.mjs data/vehicle-bake/school-bus-qa
```

This uses ignored output only. It renders the frozen Beetle GLB through the new
viewer and compares every RGBA byte of all 32 default 128 captures with the frozen
study/game images. It also compares all 32 centered 128 crops from a 224 render,
including the shared outline. Frozen pages and assets are never rewritten.

## Fresh-clone standalone review

Once a candidate is frozen, regenerate its ignored offline HTML from committed
public files without Blender, art regeneration, captures, assembly or refreezing:

```powershell
python scripts/vehicle-bake/family-package.py scripts/vehicle-bake/family-school-bus.json offline
python scripts/vehicle-bake/family-verify.py scripts/vehicle-bake/family-school-bus.json
```

No local baseline is required. `offline` first verifies the complete public file
inventory and hashes, exact root/per-revision candidate correspondence, actual
GLB audit, retained/source inputs and source-report hashes. It writes only the
configured Git-ignored `data/vehicle-bake/` HTML. `family-verify` repeats those
checks and compares the entire standalone HTML with the deterministic embedding
of the frozen JS, CSS, manifest and every image/JSON/GLB/GIF asset. A baseline is
optional extra evidence that earlier candidates remained byte-identical during
a new authoring session. Never run `assemble` or `freeze` on a finished revision.
