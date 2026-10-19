# Owner fender correction COMPLETE — mid-fenders-v3

**Current corrected candidate: `mid-fenders-v3`, 2,299 exported triangles,
2,982 exported vertices, five meshes/primitives, one actual unlit material.**
Finished and byte-frozen; registered by the coordinator in the final frozen
manifest. **V3 is the next owner review.** Earlier budget-mid/v5 options are
historical comparison evidence, superseded by this fender correction.

Exact paths:

- GLB: `public/demos/vehicle-bake/a-reduced-projection/mid-fenders-v3/model.glb`
- Atlas: `public/demos/vehicle-bake/a-reduced-projection/mid-fenders-v3/atlas.png`
- Report: `public/demos/vehicle-bake/a-reduced-projection/mid-fenders-v3/report.json`
- Actual GLB views: `public/demos/vehicle-bake/a-reduced-projection/mid-fenders-v3/inspection-study.png`, `inspection-engine.png`, `inspection-roll.png`
- Editable source: `art-source/vehicle-bake/a-reduced-projection/mid-fenders-v3/car.blend`
- Exact recipe: `art-source/vehicle-bake/a-reduced-projection/mid-fenders-v3/input-recipe.json`
- Self-contained scripts/replay: matching source bundle `scripts/` and `replay.md`

GLB SHA-256: `05de49fc16a281db97fb6854d94252e44bb8f1502a5749e8580d95cba908df64`.

Cause: the retained high source and mid both exposed tire crowns (`z=.68`)
through low hood/deck pockets; narrow arch tubes did not cover the tread. V1/v2
physically covered them but created isolated red semicircular humps. Both cap
trials are **rejected drafts**, not recommendations.

V3 replaces the tubes with closed, broad, longitudinally tapered shoulders with
a nearly flat `.72` crown, outer width at most `.95` and inboard blend to actual
coachwork. Each wheel is tucked `.08` inward (pivot Y ±`.87` → ±`.79`); axle X,
radius, ground contact and the actual wheel position/normal/UV buffers remain
unchanged. Rear buttress tips stay inside the tucked tire slab. The exact old
atlas bytes and old UV paint are preserved; new shoulders use existing palette
swatches. No camera, draw-order, view hiding or canvas redraw changes.

Inspected native/4× 0/180 directly, all eight mesh views, all sixteen study and
sixteen game headings, and roll poses. Far crowns are concealed, the body line
is continuous, and near hubs remain seated in open arches. Actual GLB unlit/
embedded atlas/rig checks pass. Full neutral-roll body/floor clearance and shared
collision-negative control pass. Sampled broad upper coverage is 25/25 per wheel
with controls; this diagnostic does not substitute for the visual inspection.
Minimum whole-body cylinder gap is ~`.01495` source units, distinct from nominal
`.04` crown height gap. Steering remains unqualified.

Exact refinement replay starts with this command, **not the original reduction
CLI**; the report and source `replay.md` list every subsequent finish/audit/capture
command:

```powershell
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/a-reduced-projection/refine_fenders.py -- art-source/vehicle-bake/a-reduced-projection/mid-fenders-v3/input-recipe.json NEW_REVISION
```

`npx biome check --write` formatted the live capture script; a fresh narrow check
passes, and the corrected snapshot was packed. Verification passes the new frozen
ledger **and every old completed ledger**. No shared viewer, manifest, proof
script or shared documentation was edited. Coordinator independently confirmed
capture/rig/clearance/negative-control/standalone/mobile checks. Owner review is
the next step; no further style changes were made after the accepted V3 preview.

---

# Historical pre-correction route checkpoint

Three pre-correction candidates remain **complete and byte-frozen as history**;
they are not current review recommendations. No shared files, other vehicles,
commits, branches, agents or broad npm checks were involved.

| Revision | Triangles | Exported vertices | GLB bytes | Use |
| --- | ---: | ---: | ---: | --- |
| `budget-mid` | 1,877 | 2,678 | 137,060 | Archived economy source for V3 |
| `v5` | 2,469 | 3,305 | 161,488 | Archived fidelity comparison |
| `budget-low-v4` | 1,376 | 2,265 | 120,904 | Archived budget comparison |

Exact archived model paths, retained for provenance:

- `public/demos/vehicle-bake/a-reduced-projection/budget-mid/model.glb`
- `public/demos/vehicle-bake/a-reduced-projection/v5/model.glb`
- `public/demos/vehicle-bake/a-reduced-projection/budget-low-v4/model.glb`

Sibling files include atlas, eight actual mesh views, native sheet, comparison,
GIFs, reports, fresh GLB-import renders and actual-engine capture/rig receipts.
Matching `art-source/vehicle-bake/a-reduced-projection/REV/` contains packed
`car.blend`, atlas, recipes, retained scripts, projection/ownership/unknown/conflict
maps and the `frozen.json` byte ledger.

All three have five meshes/primitives, one actual KHR_materials_unlit material,
one opaque 512² atlas with 15 source-palette colours, four named Steer/Roll rigs
and uniform world scale `80/4.6`. Wheel radius extras are `.34 * (80/4.6)`.

## Actual checks and findings

Inspected all eight mesh views at native pixels and 4×, including ends/diagonals;
sixteen actual GLB headings in each study/game projection; and eight roll poses.
GLTFLoader creates MeshBasicMaterial on all five primitives, with the embedded
atlas, no lights and no emissive overlay. Independently turning each wheel leaves
body/other wheels fixed. Actual GLB JSON, texture pixels, triangles, vertices and
rigs were checked. No interior native-canvas patches were used.

Fresh GLB-import cylinder/triangle checks prove complete neutral-roll body/floor
clearance. Coordinator's unchanged `scripts/vehicle-bake/clearance.py` also passes
all three, including collision-negative control and baseline restoration. Receipt:
`art-source/vehicle-bake/a-reduced-projection/ladder-clearance.json` (copied into
each source bundle). No verifier tolerance was widened.

The pre-correction comparison found cleaner side glass, a slightly better nose
and finer wheels in v5. Mid's lower side-glass frame is thicker; low-v4 has
a broad dark glass wedge and simpler hubs. Fine hood/sill speckling and louver
aliasing remain between chosen headings. Roughly half of occupied UV texels lack
an accepted observation and use explicit semantic fallback. Masks retain that
uncertainty. One atlas cannot preserve every direction-specific reflection/ramp.

QEM needs protected budgets and geometric constraints: it inflated tires, bridged
wells and collapsed fender chords. Source-radius clamping, ground-contact alignment,
actual local pocket cuts, buttress-tip correction and component minima resolve
those issues. `budget-low-v3` (1,332 triangles) remains rejected for fender/tire
intersections; low-v4 protects the tubes and passes unchanged verification. V1
is rejected for missing actual unlit; older drafts remain rejected/superseded.
Steering clearance, production approval and cross-family validation remain open.

## Replay and freeze

Retained-script replay into `replay-mid-check` and `replay-high-check` reproduced
**identical GLB bytes, atlas bytes and all eight view PNG bytes**. Those are
validation duplicates, not additional candidates. Read-only verification passes:

```powershell
python scripts/vehicle-bake/a-reduced-projection/verify.py
```

GLB SHA-256:

```text
budget-mid    d33c9fdc300b01d0337b37969bd067d9481ef60014be9226ab0277b08f558bee
v5            8298e37a89f61b314c641db310b295af22d46a3b4bfaaf4cca714bd65abf4d80
budget-low-v4 ccce8117bde3e42eb76b7af58aa55abac1b46c8411897a98474b0634e1409710
```

[README.md](README.md) documents JSON recipe/CLI commands and future-family input
requirements. Use each finished candidate's pinned `input-recipe.json` to replay
its exact geometry allocation. Existing revisions are refused; new runs remain
draft pending inspection. All inputs are retained; ignored scratch is unnecessary.
Family geometry/ownership, glass coordinates, axle/well/dimension constraints and
feature anchors remain explicitly coupe-specific.

Next: owner review of registered **mid-fenders-v3**. Earlier candidates remain
historical evidence; another vehicle family still requires owner authorization.
