# 100 — Pixel outline and compact silhouette comparison

Owner: [3D assets](../topics/3d-assets.md). Started: 2026-10-10.
Status: Bounded shader/geometry diagnostic delivered; family fidelity remains open.

The owner identified missing source-style dark ink and oversized 099 fenders,
and requested explicit silhouette comparison. This slice separates geometry,
external silhouette ink and authored internal lines.

## Delivered prototype

The shared compact recipe reduces outer arch radius from 6.4 to 5.4 world pixels
and maximum width from 12.35 to 11.9. The bevel/wheel-well profile tightens around
the existing tires. Both palette variants use the same template, cleanup and
cameras. Wheel-well paint now uses source dark `(58,58,80)` instead of body blue.
All 47 original meshes retain their vertex positions; total geometry remains
55 meshes / 834 triangles, four grounded tires and a 1024-square packed atlas.

Optional `recipe.pixelStyle` selects native-resolution silhouette ink after
camera/pixel alignment. The default inward mode darkens occupied pixels adjacent
to transparency in four-neighbor directions, preserves alpha byte-for-byte and
retains darker existing ink. Interior texture contrast is untouched. Unoutlined
native renders remain available. Novel angles are sampled to the logical canvas,
inked, then enlarged with nearest filtering. Existing recipes without the option
keep their previous behavior; unsupported widths fail.

The working WebGL2 shader implements the same pass. The interactive gallery
toggles off/inward/outward ink over saved native Blender RGBA renders; outward
ink intentionally exposes silhouette growth. Width is one logical sprite pixel.
The effect is absent from the GLB/Blender material and has not been integrated
into gameplay or the shared renderer. Internal windows/doors/wheel-well lines
remain UV paint; arbitrary triangle edges and color gradients are not inked.
Depth/normal or explicit feature lines remain possible future work.

[Three.js OutlinePass](https://threejs.org/docs/pages/OutlinePass.html) supplies
general object outlines; this asset-specific prototype tests crisp native-pixel
sampling and exact alpha preservation. Combining that external ink with authored
internal texture lines is a design judgment, not geometry recovery.

## Silhouette evidence

`silhouette_report.py` checks identical source bytes and compares alpha at
threshold 128: white source contour, gray overlap, red missing and blue excess.
It records IoU and bidirectional mean/max contour distances. Painted source
shadows remain explicitly included. Inward ink cannot change occupancy.

Compact-1 north/south excess falls from 78/82 to 48/52 pixels; missing increases
from 51/49 to 57/53. IoU improves from 0.923/0.921 to 0.936/0.936, and mean boundary
distance from 0.770/0.802 to 0.626/0.641 logical pixels. Side IoU changes only
0.826 → 0.827, with 276 missing pixels remaining. Most arch pixels lie inside
the body contour, so whole-car IoU cannot fit their internal boundaries. The
local approximate geometry parameter probe was not treated as a quality oracle;
actual Blender renders supply the reported evidence.

Whole-image RGB error changes 26/26/21/18 → 28/28/18/16. Dark ink does not uniformly
improve pixel agreement. Roof/hood/cabin shape, wheel appearance and texture
registration remain visible differences. These are diagnostic scores, not approval.

## Retained inspection and review identity

- [Gallery](../../public/demos/authored-car/outlined.html): GPU toggles, both 4×2
  sheets, before/after silhouettes and four novel mesh angles.
- [Packed sources](../../art-source/vehicles/compact-car/blender-v3/README.md).
- [Reusable commands](../../scripts/authored-assets/README.md).
- Local `data/authored-assets/088-outline-fit/`: frozen workspaces, drafts,
  template, parameter probe and final `outlined-001` evaluations.
- Local `data/authored-assets/088-validation/`: scene/browser audits and logs.

Workshop registers excluded diagnostic `projection:authored-compact-car-v3` in
`authored-car-088`, pinning 65 artifact/code files. Both previous candidates'
artifacts and Blender sources stay byte-identical. Gallery navigation changes
separately. Source coverage remains retained; paint and ink never upgrade it.
No approval, runtime sprite change or physical-metadata change is inferred.

## Validation

Eleven Python checks pass, including alpha preservation, no inward growth,
retained dark ink, outward growth, known contour shift and invalid inputs.
Saved-scene audits verify both variants' counts, finite UVs, grounded tires,
packed draft/clean textures and all 47 unchanged original meshes. Bundled full
Chromium verifies real GPU/reference bytes for all three modes including alpha
127/128/180 and equal-brightness ink, desktop/phone layout and both textured GLBs
with expected geometry/bounds. Isolated servers/browsers close afterward.
The documented new-workspace compact-2 projection/cleanup/evaluation replays its
final atlas and full comparison pixel-for-pixel. All three registered revisions'
artifact/source hashes pass, as do v3 replay-code hashes and manifest identity.
Typecheck, lint and production build pass. Art catalog retains 245 sheets / 1,098
uses; Workshop verifies 764 identities in normal Chromium at retina scale.
Three tools-index browser checks pass. The full unit run has 2,102 passes, ten
skips and the same five Windows symlink/process-kill failures in `FsSecurity`,
`SqliteRecordStore` and `privateDataPlugin`, plus the prior `staticFiles`
setup/teardown failure around skipped cases. No new diagnostics are introduced.

## Next fitting work

Fit body/hood/roof and wheels with source landmarks and contour overlays; compare
local arch boundaries as well as whole-car occupancy. Recheck compact-2 and novel
angles before another geometry family. Runtime outline integration follows a
qualified family shape/internal-line treatment, which this slice does not claim.
