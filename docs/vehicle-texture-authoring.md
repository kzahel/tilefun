# Vehicle texture authoring

Reusable textures need physical surface ownership and family-specific geometry,
UVs and native-pixel inspection. There is no validated automatic bake for arbitrary
vehicles.

For curated colors, two-tone schemes and stripes on existing originals, use
[paint variants](vehicle-paint-variants.md). Its first fourteen schemes preserve
the exact mesh/UV/rig and protected palette, with separate appearance review.

## Choose the route honestly

The red coupe records two different transfers. Accepted route A reduced the
71,390-triangle source by component, then projected owned samples from authored
targets with high-mesh visibility checks and explicit UV cleanup. Its corrected
runtime export has 2,299 triangles. The separate
[C surface-bake experiment](../scripts/vehicle-bake/c-surface-bake/result.md)
really rasterizes low UVs, casts into painted high-source triangles and samples
barycentrically: 356,414 painted high triangles transfer to a 2,597-triangle low.
Its hit, ambiguity, fallback and cleanup records are part of the result. Neither
route automatically invents the source style or another family's ownership.

Beetle and later semantic families use direct UV paint. Their
`master.blend` retains editable named components at economical runtime topology;
`car.blend` consolidates the static body and independent wheels. Calling that
master “high detail” would misdescribe the process. The seven cycle styles also
use authored surface roles/charts; their source completion does not imply normal
motorcycle availability.

## Assign surfaces before painting

Choose a small palette: ink, discrete coachwork ramps, cool blue glass, rubber,
metal and lamps. Keep broad clusters readable at native size. Give each part an
explicit `surface_owner` and paint role. Use padded constant-colour islands for
uniform parts; give patterned surfaces continuous charts in their own physical
coordinates. Wheels need isolated paint ownership through every rolling phase.

Side glass and its frames should share coherent cabin skin charts. Roof,
windshield, rear glass and opposite sides need explicit owners. Paint windows on
the actual skin, or build matching aperture topology. Independently subdivided
glass overlays can intersect coarse body facets and produce broken blue marks.
Stripes, seams and emblems belong in surface/UV space, including barycentric UV
rasterization where appropriate; never stamp a camera's exterior silhouette onto
the atlas. Deliberately author hidden faces and label projection uncertainty.

Three retained examples show the practical differences:

- [Rounded Beetle constructor](../art-source/vehicle-bake/beetle/v1/build.py):
  continuous coachwork UVs replace intersecting glass overlays.
- [Recessed pickup constructor](../art-source/vehicle-bake/pickup/v1/build.py):
  floor, inner walls, wheelhouses and tailgate own separate geometry and paint.
- [Angular sport-bike geometry](../art-source/vehicle-bake/sport-motorcycle/v1/geometry.py):
  fairing, nose, framed screen, tank and tail own actual surface charts.

Use one opaque 512×512 nearest-sampled unlit vehicle atlas. Explorer retains its
own 256×256 atlas: respectively 1 MiB and 256 KiB decoded RGBA. Confirm actual
`KHR_materials_unlit` and sampler settings in the GLB; a Blender material named
“unlit” is insufficient. Current exports encode nearest magnification and nearest
mipmap minification; the game/review loader explicitly forces nearest filtering
and disables mipmaps to preserve the reviewed pixel clusters.

The shared shader adds a one-native-pixel **inward** silhouette stroke from alpha,
using RGB **58/58/80**. Window borders, door seams and internal ink must already
exist in the atlas or purposeful geometry. The silhouette pass cannot supply them.

## Budget the exported result

The run153 measured 33-model ordinary fleet spans 2,299–4,030 triangles and
6.69 MiB of GLBs total, with one opaque 512 atlas each. Exports normally have
five source primitives, or seven for six-wheel trucks. Engine outline and shadow
passes add rendering work beyond those source counts.

| Actual export | Triangles | UV-split vertices | Primitives | Atlases |
| --- | ---: | ---: | ---: | ---: |
| Beetle | 2,554 | 5,462 | 5 | 1 |
| Pickup | 2,984 | 5,722 | 5 | 1 |
| Sport bike alone | 2,256 | 4,244 | 3 | 1 |
| Explorer alone | 1,956 | 4,315 | 1 | 1 |

UV and flat-normal splits increase exported vertices. Count every tire, hub,
hidden triangle and primitive. Sport plus static Explorer costs 4,212 triangles,
four source primitives and **two** atlases; composition does not merge those costs.

## Stage a new family

1. Record dimensions, unchanged `80/4.6` scale/ground origin, axles, actual individual
   radii, part owners and palette. Choose direct painting or a genuinely retained
   high-to-low route before promising a bake.
2. Build silhouette and negative spaces first. Fenders, open arches, cargo depth
   and rider clearance require geometry; dark paint cannot repair them.
3. Paint owned UV charts, export, then inspect the actual GLB at all 16 study and
   16 game headings, signed phases, wires and independent forward/reverse/reset.
   Preserve density; add transparent viewport padding rather than angle fitting.
4. Prove whole-fixed-body neutral-roll clearance with collision negative/reset
   controls. Separately test declared upper-crown coverage with removal, positive
   and offset controls, then inspect far crowns. Document intentional exposure as
   N/A; never manufacture caps or passed metrics.
5. Check desktop/mobile/offline presentation and exact opaque-pixel placement within the 192×224 cardinal
   frame. Rider pilots additionally need measured contacts, actual combined
   depth/intersections and rider-hidden pixel parity.

Useful diagnostics: broken glass suggests mismatched skin ownership; crawling
stripes suggest screen projection; blurry clusters suggest filtering or scale;
body colours on rotating tires suggest shared UV contamination. Exposed far
crowns require fender geometry. A dark “bed” needs actual floor/wall depth probes.

Check native landmark visibility as well as palette membership. A small eye or
lamp painted in the atlas may occupy less than one projected pixel or sit behind
another surface. A bounded feature-removal/reset comparison proves the intended
mark actually appears. Classic rider v1 exposed this failure: a short face and
dominant roof left tiny eye dots and hid its collar despite passing contact and
palette checks. Fix geometry/skin charts and inspect both cameras before retention.

## Replay and retain

From the repository root, these existing commands replay a declared-input source
or regenerate/verify an already frozen review's ignored offline page:

```sh
python scripts/vehicle-bake/source-replay.py art-source/vehicle-bake/sport-motorcycle/v1/source-replay.json --qa data/vehicle-bake/texture-guide-replay --blender BLENDER --deadline UTC_ISO
python scripts/vehicle-bake/family-package.py scripts/vehicle-bake/family-beetle.json offline
python scripts/vehicle-bake/family-verify.py scripts/vehicle-bake/family-beetle.json
```

Replace `BLENDER` with its executable path and `UTC_ISO` with the assigned deadline.
Keep exploratory renders/backups under ignored `data/`. Retain packed master/low,
atlas, palette planning image, ownership, constructor/config, exact GLB/recipe,
proofs and every declared helper hash. Fresh replay must reproduce model, atlas
and recipe bytes without ignored dependencies. Format before pinning; completed
bytes stay immutable. Respect the current owner/deadline/review gate: source
complete, shared review, human approval and normal activation are separate states.
Run153 stops 2026-10-20 05:19UTC; coordinator holds remain binding.
