# Cream and forest-green motorhome v1

This original owns its long cab/living-body stations, cream/forest palette, four
actual glass/side/end UV charts, broad lower stripe, real solid cantilevered
sleeping pod and roof step, camper door/low step, roof vent and closed awning tube.
Front is -X, up +Z, ground Z=0. Export world scale is 80/4.6; each road wheel has
source radius 0.49 and actual metadata world radius 8.521739130434783.

The constructor began with copied delivery-van mesh/cube/tube/disk, wheel and
fender utilities. Definitions are retained locally in this family's `build.py`;
there is no external base geometry read/import/fallback. Immutable utility
reference: `scripts/vehicle-bake/delivery-van/build.py`, SHA-256
`e0923c6dc4d730ab34b9b726bfa6162b2b732966c8d13ef889225036cab0678f`.
All shape and semantic UV parameters are motorhome-owned. Ice cream van source
was used read-only for QA wrapper patterns and remains byte-identical.

`master.blend` retains 41 named semantic components including the separate solid
sleeping pod. `car.blend` retains Body_static and four Steer > Roll > wheel
assemblies. Both scenes pack the actual atlas and an explicitly unused palette
planning image. This economical component master uses runtime topology; no
separate high-poly transfer is claimed.

The pod is closed real volume attached into the living box. Six actual exported
top/underside ray pairs prove at least 0.674547 source thickness and front rays
prove 0.285671 source projection beyond the cab. Flattening its real vertices
fails; exact coordinate restoration passes. All fixed equipment participates in
whole-body wheel-clearance proof. Coverage uses this family's r0.49 / width0.30
tread region with 25 samples per wheel and positive/negative controls.

The final 224px/radius112 attempt clipped engine heading 11. Qualified review
uses 256px/radius128: transparent viewport padding grows 16px on each side while
world pixels, vehicle scale and origin remain unchanged. Study/game anchors are
(128,156)/(128,128), the same registration relative to the expanded viewport.
Shared centered128 game crop proof is exact at every heading. All four cardinals
fit the normal 192×224 fallback at origin (96,144) using integer translation
(-32,+16), with every occupied RGBA pixel exact. No geometry was scaled to fit.

Nominal 6.9×2.5×3.0 proportions describe the body family. Actual full dimensions
include pod projection, fixed entry step, mirrors, arch lips and roof vent. The
recorded exported bounds include them all. Nonzero steering/suspension, visible
driver/interior, opening doors or animated equipment remain unqualified.

Fresh isolated replay needs only six retained constructor/config inputs and
shared `catalog.py`; `evidence/replay-verification.json` pins exact bytes and QA
helpers. Data paths are output locations only. Packed scene byte determinism is
not claimed. Parent owns independent QA/freeze/registration/runtime/docs/global
checks. Agent QA claims no formal human approval. Completed v1 bytes are immutable.
