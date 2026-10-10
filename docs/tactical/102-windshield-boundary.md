# 102 — Windshield aperture and cabin corner paint

Status: delivered diagnostic correction; human fidelity review remains open.
Owner: [3D assets](../topics/3d-assets.md). Date: 2026-10-10.

The owner reports that the front windshield paint extends into the sides, with
the front upper body corners crossing the glass texture. This slice corrects
that boundary on both compact palettes while retaining 101's body fit and rigid
wheel hierarchy. No engine, physical metadata or gameplay promotion changes.

## Cause and correction

The old windshield quad and cabin side faces shared their outer seam correctly.
The cabin's side-owned projection nevertheless included front-glass pixels in
the forward wedge; the windshield's multi-view projection also mixed artwork
around its corners. The independently added side-window panels did not eliminate
that underlying paint. Whole-car alpha comparisons do not detect this defect.

`refine_windshield.py` loads a COPY of v4 and tessellates its windshield into four
connected perimeter faces and one interior glass face. The original four outer
vertices stay fixed; the frame and glass share vertices and do not overlap.
Windshield UVs remain in the original 96×88 island. Other 54 mesh vertices,
parents/transforms and all ten rig nodes stay fixed. Count: 55 meshes, 842
triangles (eight more than v4). All four native alpha masks remain byte-identical
on both palette variants.

`compact-windshield.json` defines transverse/top/bottom aperture margins, the
front-view glass landmark crop, the side-window leading boundary and source
palette landmarks. `compact-windshield-setup.json` retains v4 cameras/outline
and uses south as the windshield's draft source owner. Fresh projection drafts
and uncertainty masks are retained separately for both variants.

After existing window/fender/hub cleanup, `paint_windshield.py` maps the original
south glass crop into the aperture, authors source-palette frame bands and paints
only the cabin wedge forward of the side-window boundary. It uses triangle/UV
interpolation in mesh coordinates, not a camera-facing decal. Raw coverage is
never upgraded by this authored cleanup. The original sprites remain unchanged.

The corrected painted pillar is wider than the stylized original in some views.
Blue RGB MAE changes from approximately 24/24/18/13 to 25/25/19/18 for E/W/N/S;
this fixes a cross-surface semantic boundary rather than improving every pixel
score. Source crop/aperture parameters are compact-family assumptions, not
automatic segmentation of arbitrary vehicles. Hidden surfaces and other fitting
tradeoffs remain unresolved.

## Retained deliverables

[Gallery](../../public/demos/authored-car/windshield.html) contains same-camera
source/previous/corrected front-corner crops, both 4×2 sheets, extra mesh angles,
GLBs, frame geometry, paint records and raw coverage. Editable packed sources
and captured configuration are in
[blender-v5](../../art-source/vehicles/compact-car/blender-v5/README.md).
Workshop registers excluded diagnostic `projection:authored-compact-car-v5` in
`authored-car-090`, pinning 35 artifacts. Normal builds consume retained bytes.
All v1–v4 registered artifact/source Blend hashes remain unchanged; navigation
updates live outside their immutable artifact folders. Chat feedback is not a
production approval.

Local evidence: `data/authored-assets/090-windshield/` includes the original mesh
inspection, exploratory and final templates, fresh blue/green workspaces,
projection/evaluation logs, immutable/Blender audits and browser/repository checks.
The constructor used the pre-format config bytes recorded in `windshield.json`;
the captured formatted JSON has identical parameters. Replaying cleanup with the
retained geometry and formatted config reproduces the green atlas pixel-for-pixel.

## Validation

Blender audits verify the fixed outer seam, unchanged other 54 meshes and all rig
transforms, finite UVs/vertices, 55/842 counts and packed 1024-square draft/clean
textures. Eight source-camera alpha masks are byte-identical to v4. Bundled full
Chromium loads both actual new GLBs and verifies independent wheel motion,
forward/reverse radius and axis, fixed body/axle centers and front-only steering.
The new gallery loads all images without overflow at 1440 and 390 pixels.
The browser runner closes its servers/browsers. Eleven Python checks pass and
both new helpers compile. V5 artifact/source/current replay hashes and its
Workshop fingerprint match after generation.

Typecheck, lint and production build pass. Catalog generation reports 245 sheets
and 1,098 source uses. Workshop manifest verification checks 766 identities in
normal Chromium at retina scale, with 18 diagnostic/compiler exclusions. WSL
Git whitespace validation passes. The complete unit run reports 2,084 passed,
10 skipped and 11 failures: the five existing Windows symlink/SIGKILL failures
from 101 plus six timeouts while manifest validation competed for CPU. Retrying
all four timeout-bearing files sequentially passes all 59 tests without changing
tests or increasing deadlines. Static-file suite setup/teardown also fails after
Windows denies its symlink setup. The existing environment failures remain open.
All three tools-index Playwright checks pass against the production preview,
using isolated auth/data and the bundled browser. No engine rendering path changed.

## Next work

Review the corrected corner from the matched views and diagonal cameras. Tune
pillar/frame width and windshield shape using landmark boundaries, then resume
wheel appearance and steering-clearance fitting from 089. Keep the explicit
aperture/source ownership when authoring another vehicle family.
