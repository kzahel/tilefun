# 038 — Orthographic car inspection and fitted-surface corrections

Status: complete, 2026-10-04. Owner: [rendering architecture](../topics/rendering-architecture.md).

User feedback on 037 requests exact orthographic side/top presets, visual and
raster checks of apparent geometry, edge-on hood/windshield in side view, grounded
tires, and closure of transparent gaps against the far checker face. Existing
approved sprites and collision bounds remain immutable. This experiment remains
excluded from approval and does not change gameplay.

Add fixed-axis, zoomable inspection cameras. Fit cross-sections without unintended
cross-car slope, bring the visible tire boundary to Z=0, and derive a separate
edge-extended top texture from the pinned source. Preserve the original image and
side alpha; report source-view extensions rather than pretending the silhouette
remains identical. Check actual GPU side/top occupancy, tire contact, source pixel
registration, mouse/touch behavior and lifecycle. Inspect captures, then run
required validation and compare pre-existing candidate records before committing.

Model-assisted reconstruction is a discussion after these corrections, not part
of this implementation. Multi-view fit and explicit unseen-face authoring remain
possible follow-up work.

## Implementation and inspected evidence

- Added **Side · ortho** and **Top · ortho**, with pan, mouse/pinch zoom and preset
  reset. The renderer locks these camera axes after control updates; top view
  cannot inherit the orbit control's small polar-angle offset.
- Refit the bonnet/windscreen seam using the actual source boundaries. Equal
  cross-car heights make upper faces edge-on; the side is vertical rather than
  tapered, preventing door pixels from slanting in side view. The visual proxy
  spans depth -9…9 and its roof reaches Z=21; approved 56 × 20 × 24 collision
  geometry remains untouched. This is a visual fit, not a collision correction.
- Source row 62 is the last tire paint. Its lower boundary at V=63 now lands on
  Z=0; the floor grid is also at Z=0. Both tires meet the displayed ground line.
- The top uses a separately derived edge-extended texture. The original source,
  side transparency and promoted bank stay immutable. Closed mesh edges alone
  had missed alpha holes; the new checks measure actual GPU coverage instead.
- Full Chromium probes report **zero** top-face fragments in exact side view,
  **1,152 / 1,152** filled top-footprint pixels, **6 front / 5 rear** contact pixels
  in the ground-adjacent row, and **zero** pixels below Z=0. Source comparison
  matches **1,809 / 1,809** original painted pixels within one color level; **182**
  additional pixels close top-edge gaps. The lab reports these extensions openly.
- Inspected desktop side, top, orbit and far-side captures, plus the 390px touch
  layout. Top is closed against the checker face and side shows the side windows
  without a visible hood/windscreen surface. Tire bottoms meet the ground line.
  The top's stretched edge outlines and oblique baked texture remain visible:
  this is still one stylized view mapped to fitted geometry, not new top artwork.

Unit coverage checks closed shared edges, edge-on top faces, vertical/grounded
sides, independent hand-picked source-detail assignments and non-mutating color
extension. Browser coverage checks GPU diagnostics, orthographic zoom/reset,
phone pinch zoom, source preservation, graphics recovery and navigation cleanup.

## Final validation

Typechecks, all **1,434 unit tests / 162 files**, lint, catalog generation,
manifest generation and production build passed. The full browser suite passed
**288 tests** in 5.8 minutes, including the extended full-Chromium car checks.
Existing lint/build warnings are unchanged. Manifest generation verified 552
identities at retina scale; the only changed candidate is the excluded car
experiment. All 551 other candidate records are exactly unchanged. No human
review decisions were written.

Next: discuss model-assisted reconstruction using source views, proxy geometry
and the new silhouette/contact checks as constraints. Multi-view fit and dedicated
wheel/hidden-face geometry remain follow-ups; top texture distortion is not solved
by closing transparent seams.
