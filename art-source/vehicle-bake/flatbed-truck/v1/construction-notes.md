# Orange work cab and empty gray flatbed v1

This original owns a short closed orange cab loft, coherent blue framed skin
glass, long genuinely empty gray flat platform, thin edge/underside, three broad
longitudinal panel seams, dark underframe, gray bumpers/small rear hazard paint
blocks and integrated front-orange/rear-gray guards. No cargo, towing equipment
or recessed bed is present. Front -X, up +Z, ground0, export world scale80/4.6.
Four tires use r0.50 source and r8.695652173913045 world metadata.

The constructor began with copied delivery-van mesh/cube/tube/disk, wheel/fender
utilities. All definitions are retained inside own `build.py`; no delivery-van,
motorhome, ice-cream-van or tow-truck geometry is read/imported at replay time.
Immutable utility reference: `scripts/vehicle-bake/delivery-van/build.py`, SHA-256
`e0923c6dc4d730ab34b9b726bfa6162b2b732966c8d13ef889225036cab0678f`.
Other families provided read-only QA wrapper patterns; their bytes are preserved.

`master.blend` retains43 semantic components, including the real thin platform,
two longitudinal rails, crossmembers/supports, guards and short cab. `car.blend`
retains the joined fixed body plus four Steer > Roll > wheel meshes. Both pack the
actual atlas and an explicitly unused palette planning image. Economical semantic
component master uses runtime topology, not a separate high-poly transfer process.

Platform top is Z1.24 and underside Z1.13 source: actual0.11 thickness. Nine
exported-triangle top/underside ray pairs verify the planar exposed top and thin
solid platform. A raised obstruction and zero-thickness deck both fail; exact
reset restores every original hit. This is flat-platform evidence, not a recessed
interior-depth claim. Thirteen actual triangle/barycentric UV probes independently
verify glass, orange roof, gray panel/seams/edges, dark frame, orange front/gray rear
guards, rear hazards and gray bumper ownership.

All fixed triangles participate in full neutral-roll clearance. Own finite crown
region derives from r0.50 / tire width0.32; 25 samples per wheel pass with controls,
plus near/far visual inspection in both cameras. Per-wheel actual decoded radii
match rig metadata within0.0001 world units; independent forward/reverse/reset
checks keep cab/deck/frame fixed. Nonzero steering/suspension remains unqualified.

Native224/radius112, unchanged pixel density and origins (study112,140;
game112,112) fit every heading. Standard192×224 origin96,144 cardinal fallback
retains exact occupied pixels by integer translation(-16,+32), no resize or
recenter. Shared centered128 game crop proof is exact at all16 headings.

Nominal6.3×2.3×2.4 body proportions exclude small bumper/mirror/guard projections;
actual exported full dimensions are6.315×2.405×2.411. Recorded actual bounds include
all fixed components. No animated equipment, visible driver or open cab is claimed.

Fresh isolated replay uses only six retained constructor/config inputs and shared
`catalog.py`; exact source/QA pins are retained in evidence/replay-verification.json.
Data paths are outputs only. Packed scene byte determinism is not claimed. Parent
owns independent QA/freeze/root registration/runtime/docs/global validation. Agent
QA claims no formal human approval. Completed v1 bytes are immutable.
