# Vehicle source families

Status: source classification complete; model production unchanged.
Date: 2026-10-11.
Owner: [vehicle model porting](../topics/vehicle-model-porting.md).

The owner requested a pass over the full bank before choosing a larger batch:
identify identical silhouettes and distinguish true recolors from paint edits.
The audit covers all 45 sets / 180 views and all 990 unordered pairs, using the
current approved crop rectangles in `src/traffic/vehicles-v1.json` and the frozen
`me-complete.png` source (`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`).
The historical source inventory has three wider police/ambulance selections;
the report records those differences and uses the approved bank crops.

## Method and limits

`scripts/authored-assets/audit_vehicle_families.py` compares east, west, north and
south together. It trims only fully transparent margins, preserving scale,
direction and every visible source pixel. It groups exact alpha bytes, binary
occupancy and fully opaque occupancy separately. All three yield the same
13 groups here, so painted translucent shadows do not drive the classification.
Transparent RGB is irrelevant to color correspondence.

A pure palette transfer requires one source RGBA color to map to one target
RGBA color consistently across all four views. Reversible groups also preserve
distinct color regions; one-way transfers can merge colors. The tool checks
raw crop alpha and `anchor`, `footprint`, `colliders`, `depthOffset` independently,
matching the existing compact transfer gate. It reports the minimum number of
source pixels that need exceptions to the best global palette map. These counts
are source-space exceptions, not counts of authored atlas texels to edit.

Near matches allow at most two pixels of whole-image translation per axis, with
no scale or reflection, and retain that translation explicitly. They are not
added to exact families. Silhouettes establish candidate geometry reuse; they
do not prove wheel wells, window boundaries, cabin height, roof details or hidden
surfaces. In particular, a color-map conflict can reflect shading/merged material
colors rather than a geometry change. Geometry and source-owned paint still need
native 4×2 inspection before producing a family.

## Exact four-view silhouettes

| Family | Members | Reuse finding |
| --- | --- | --- |
| A01 | `compact-1` through `compact-6` | All six are exact, reversible recolors; raw alpha and physical metadata also match. The retained blue template is eligible for the three queued variants. |
| A02 | `bus-1` through `bus-4` | Identical silhouette. `bus-1 → bus-2` and `bus-3 → bus-4` are exact one-way recolors. From bus 1, buses 3/4 each need one north-view paint exception out of 21,821 visible pixels. |
| A03 | `bus-5`, `bus-6` | Identical silhouette after trimming; bus 6 has one-pixel horizontal registration differences in west/north/south. Best bus-5-to-6 map needs 57 paint exceptions, 52 in the south view. |
| A04 | `sedan-12`, `car-7` through `car-11`, `car-13` | Seven identical silhouettes. `car-8 → car-9` is an exact one-way recolor; car 8 is the seed minimizing total paint exceptions across this family. Other textures need distinct paint ownership. |
| A05 | `car-14` through `car-20` | Seven identical silhouettes; no pair passes the global palette-only test. Car 15 minimizes total source paint exceptions. |
| A06 | `car-21` through `car-26` | Six identical silhouettes; no pair passes the global palette-only test. Car 24 minimizes total source paint exceptions. |
| A07 | All seven `unindexed-sedan-*` colors | One identical silhouette. Red/beige/orange/olive are exact reversible recolors. Cyan/silver/dark need only two east-view paint exceptions from red. Dark also needs crop/anchor registration handling. |
| A08–A13 | Police, ambulance, green garbage, orange garbage, stowed fire, raised fire | Each is an exact-family singleton; near matches and equipment states need separate treatment below. |

There are 100 pairs sharing exact tight alpha. Reversible palette equivalence
produces 37 classes, with only two multi-member classes (six compacts and four
additional sedans). This does **not** imply 37 separate geometries.

Additional exact one-way color maps are `bus-1 → bus-2`, `bus-3 → bus-4`,
`car-8 → car-9`, `unindexed-sedan-cyan → unindexed-sedan-silver` and
`unindexed-sedan-cyan → unindexed-sedan-dark`. The last needs registration and
fails the existing raw-alpha/metadata gate. The other four pass that source gate;
none already has an eligible retained family scene except the compacts.

## Small shape exceptions

- **All six buses:** the A02/A03 distinction is only ten occupied pixels in the
  north-view side mirrors. After a one-pixel tight-box translation, that view's
  IoU is 0.997618; the other three silhouettes are exact. A common bus body with
  explicit mirror variation is a reasonable fitting candidate. Do not force
  exact equivalence or silently shift the gameplay registration.
- **Green/orange garbage:** east/north/south are exact after trimming. West has
  34 occupied-pixel differences at the front cab edge after the best one-pixel
  tight-box translation (IoU 0.995688). Their raw side crops also have horizontal
  offsets. Reuse the green truck as a fitting candidate, with measured registration
  and cab-edge handling; the strict compact-style recolor gate fails.
- **Fire ladder poses:** keep the same truck-body/articulated-equipment route;
  the overall silhouettes differ because the equipment moves. The audit does
  not qualify the raised pose or clearance.

## Paint seed evidence

These seeds minimize summed exceptions under a single four-view palette map,
not modeling difficulty or final Blender quality:

| Seed | Target → source-pixel exceptions |
| --- | --- |
| `compact-1` | Every other compact → 0 |
| `bus-1` | bus 2 → 0; buses 3/4 → 1 each |
| `bus-5` | bus 6 → 57 |
| `car-8` | sedan 12 → 8; car 7 → 863; car 9 → 0; car 10 → 4; car 11 → 717; car 13 → 382 |
| `car-15` | car 14 → 540; car 16 → 27; car 17 → 44; car 18 → 816; car 19 → 45; car 20 → 151 |
| `car-24` | car 21 → 40; car 22 → 420; car 23 → 16; car 25 → 53; car 26 → 36 |
| `unindexed-sedan-red` | beige/orange/olive → 0; cyan/silver/dark → 2 each |

For a low-variation larger batch, author one additional sedan, then its six
siblings, and finish the three remaining compacts: ten queued assets using one
new shape and one retained shape. Each keeps its own retained texture, model
bundle and native 4×2. A six-bus batch is also well supported, with explicit
mirror/registration and paint exceptions. This is suggested sequencing, not an
authorization to begin all those models.

## Reproduction and validation

```text
python scripts/authored-assets/audit_vehicle_families.py --out data/authored-assets/NEW_FAMILY_AUDIT
python -m unittest discover -s scripts/authored-assets -p test_vehicle_families.py
```

The fresh ignored output contains `report.json` (input hashes, complete pair
checks, source palette maps, registration differences and paint seeds), source
contact sheets and highlighted near-match exceptions. Written findings and the
reusable audit remain tracked; no scratch images, new model pixels, bank changes,
review candidates, gameplay changes or production promotion are introduced.

Validation: all seven audit tests pass, including negative palette/alpha fixtures
and an independent cross-check against the existing transfer gate for all 1,980
ordered source pairs (46 directional passes). Repository typecheck and lint pass
(existing warnings remain). All six report/contact-sheet outputs replay byte
exactly in two fresh workspaces. The actual compact transfer command also passes
for queued compacts 3, 5 and 6, including the pinned retained scene/atlas dependencies
and authored atlas color policies; these scratch transfers are not finished models.
Full repository units: 2,500 pass, 10 skip; the same five Windows symlink/SIGKILL
test failures and static-file symlink fixture setup failure remain. No source
bank, final bundle or runtime code changed.
