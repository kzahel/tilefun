# Vehicle model porting checklist

Topic: vehicle-model-porting
Status: 45 sprite sets inventoried; 23 models retained, 21 integrated
in game/lab mesh mode. All six compacts, seven additional sedans, six buses, ambulance v2 and stowed firetruck v2 use their own assets in main-game GPU mesh mode.
Exact model art review remains open.
Updated: 2026-10-11.

Owns the running vehicle-by-vehicle queue, progress and next action for porting
the sprite bank to editable Blender models and engine assets. Update this list
at each authoring, retention, integration or review checkpoint.
[3D assets](3d-assets.md) owns reconstruction methods;
[vehicles](vehicles.md) owns traffic, driving and physical geometry;
[rendering architecture](rendering-architecture.md) owns engine interfaces.

## Scope and status

The inventory is the 45 unique `vehicleId` values in
[`vehicles-v1.json`](../../src/traffic/vehicles-v1.json): 180 directional views.
Keep those IDs, including `sedan-12` and the `unindexed-sedan-*` names. Both
fire-truck ladder states have their own row; they may share a future articulated
model. Trains and other asset classes have separate workflows.

Current progress: **23/45 retained models, 22/45 queued; 21/45 own-model
engine integrations.** All source sets have four views;
source extraction support alone does not count as an authored model.

- **Model:** Queued → Authoring → Checking → Retained. Retained means the exact
  GLB, editable Blender/texture bundle and required dependencies are committed
  and verified, per the [delivery checklist](../../art-source/vehicle-models/README.md#next-vehicle-what-to-commit-and-why).
  Use Rework or Paused with a concrete reason when necessary.
- **Engine:** Pending → Integrating → Integrated (optional/default) → Production. Each row
  must load that vehicle's own asset and preserve the complete sprite fallback.
  The `allcars3d` test override reuses the blue model for other types and does not
  advance their status.
- **Art review:** No retained 3D revision is promoted to production art at this
  checkpoint. The approved source-sprite bank and chat feedback do not approve
  new model pixels. Record exact-revision review evidence before marking Production;
  [art review](art-review.md) owns that process.

Evidence for existing models: [bundle catalog](../../art-source/vehicle-models/catalog.json)
and [106](../tactical/106-retained-vehicle-model-bundles.md). Blue's
integration is recorded in [108](../tactical/108-authored-blue-car-gameplay.md)
and [112](../tactical/112-coherent-car-presentation-and-test-override.md).
The main game defaults to GPU with all six compact colors ([122](../tactical/122-complete-vehicle-port.md)), ambulance v2 ([117](../tactical/117-ambulance-driving-controls.md))
and firetruck v2 ([120](../tactical/120-firetruck-gameplay.md)); other vehicle types retain
sprite fallbacks, per [rendering architecture](rendering-architecture.md).
Ambulance v1's authoring, exact 4×2 and verification are recorded in
[115](../tactical/115-authored-ambulance.md).
Its beacon refinement and emergency-light contract are in
[116](../tactical/116-ambulance-beacons-and-light-tags.md); v1 remains retained.
Police and stowed fire truck are retained in
[117](../tactical/117-police-and-fire-truck-models.md), with tagged light lenses,
own wheel rigs and a separate fire ladder hinge. The bank's siren-capable types
are ambulance, police and fire truck (two ladder sprite states). Green/orange
garbage trucks carry amber warning beacons; green is now retained and orange
remains queued.

Stowed fire v2 corrects owner-reported axle placement, floor/tire intersections
and wheel UV ownership in [118](../tactical/118-fire-truck-wheel-alignment.md).
V1 remains retained; the new exact comparison awaits owner inspection.

Green garbage truck v1 adds six wheels, a separate recessed rear-loader hinge
and one tagged warning beacon in [119](../tactical/119-six-wheel-garbage-truck.md).
Its own geometry/UV sources and 4×2 are retained; clearance and integration remain pending.

The complete-bank pass in [122](../tactical/122-complete-vehicle-port.md) retains compact 3/5/6 and integrates all six colors through a shared own-asset registry. Every compact passes actual GPU draw/reset/disposal checks; the failed-load browser probe preserves gameplay with sprites. The inherited compact body still needs steering/floor qualification and exact art review.

Seven additional sedans now have an independent family body, own UV paint,
four radius-six wheel assemblies and open wheel floors. Dark-source registration
is explicit; every view samples that color's own reference, preserving localized
paint exceptions. The fitted roof cannot reproduce both opposing highlights
exactly. [122](../tactical/122-complete-vehicle-port.md) records actual GLB wheel,
GPU and tracked-only checks; exact production art review remains open.

Six buses have a connected long body, asymmetric doors/windows, separate roof and
end glazing, four radius-eight wheels and source-owned paint. A/B use their own
four-view shape gate and mirror configurations. The main level floor has wheel
cutouts; both sloped ends are separately declared and qualified against actual
exported tire/hub bounds. [122](../tactical/122-complete-vehicle-port.md) records
the exact 4×2, real GLB and engine checks. Opposing roof vents and mirror drawings
remain projection limitations; only neutral steering is used in gameplay.

## Source families for batching

The [four-view family audit](../tactical/121-vehicle-source-families.md) compares
all 45 sets / 990 pairs. There are **13 exact silhouette families**, unchanged
when ignoring translucent shadows. This is source shape evidence, not proof of
identical hidden geometry or template eligibility.

| Shape group | Members | Paint reuse |
| --- | --- | --- |
| Compacts | compact 1–6 | All six are exact reversible recolors, including physical metadata. |
| Buses A | buses 1–4 | Bus 1→2 and 3→4 are exact one-way recolors; 1→3/4 needs one paint pixel each. |
| Buses B | buses 5–6 | Same silhouette after trimming; registration differs and paint needs edits. |
| Large cars A | sedan 12, cars 7–11 and 13 | Same silhouette; car 8→9 exact one-way recolor, other paint differs. |
| Large cars B | cars 14–20 | Same silhouette; distinct paint recipes needed. |
| Large cars C | cars 21–26 | Same silhouette; distinct paint recipes needed. |
| Additional sedans | all seven colors | Red/beige/orange/olive exact recolors; cyan/silver/dark need two source paint exceptions from red. Dark also has registration differences. |
| Six singleton groups | police, ambulance, each garbage truck, each fire ladder pose | Equipment and cab-edge differences need explicit handling. |

The two bus groups differ only at ten north-view mirror pixels; a common body
with mirror variation is a fitting candidate. Garbage trucks differ at 34 west
silhouette pixels after translation, with exact shapes in the other three views.
Neither near-match bypasses the strict reuse checks.

Suggested larger batch: one new additional sedan template and six siblings,
plus the three queued compacts (ten models). A six-bus batch is the next useful
new family, with mirror/paint/registration exceptions preserved. Each vehicle
still requires its own source paint, exact retained bundle and 4×2 inspection.
The audit does not advance any model/engine/review status.

## Work order

- [x] Author the **ambulance**, with its own body, wheel positions, cab/box
  windows and source-owned graphics. Retain and inspect its exact final bundle.
- [x] Connect the retained **green and red compacts** to their own engine assets;
  qualify per-asset registration instead of assuming the blue adapter fits all.
- [x] Complete **compact-3, compact-5 and compact-6** using the checked compact
  replay only when four-view shape/metadata and palette correspondence pass.
- [x] Audit the full bank for exact four-view silhouettes and palette correspondence;
  retain [family findings](../tactical/121-vehicle-source-families.md).
- [ ] Fit the **three large-car shape families and additional sedan family**;
  qualify internal geometry before transferring source-owned paint.
- [ ] Fit a **bus** template, then its variants; preserve asymmetric door art.
- [x] Author **police car** and **stowed fire truck** with their own geometry,
  source paint, wheel rigs and tagged lights; retain exact bundles and reviews.
- [ ] Fit the **raised fire ladder** pose and qualify hinge/steering clearance.
- [ ] Fit **garbage trucks**, including separate amber beacon lenses.
  Green is retained; check orange family/paint eligibility before transferring it.
- [ ] Complete cross-vehicle engine qualification and exact-revision art review
  before considering the full bank ported for production.

This is a queue, not a claim that numbered cars share geometry or that all listed
models have been started. The later family order can change with owner priorities.

## Running inventory

### Compacts — 6 sets

| Vehicle ID | Model | Engine | Next action |
| --- | --- | --- | --- |
| `compact-1` (blue) | [Retained v7](../../art-source/vehicle-models/compact-1/v7/) | Default GPU integrated | Qualify steering clearance and exact-revision art review. |
| `compact-2` (green) | [Retained v7](../../art-source/vehicle-models/compact-2/v7/) | Default GPU integrated | Qualify steering clearance and exact-revision art review. |
| `compact-3` (cyan) | [Retained v1](../../art-source/vehicle-models/compact-3/v1/) | Default GPU integrated | Qualify steering clearance and exact-revision art review. |
| `compact-4` (red) | [Retained v1](../../art-source/vehicle-models/compact-4/v1/) | Default GPU integrated | Qualify steering clearance and exact-revision art review. |
| `compact-5` (orange) | [Retained v1](../../art-source/vehicle-models/compact-5/v1/) | Default GPU integrated | Qualify steering clearance and exact-revision art review. |
| `compact-6` (silver) | [Retained v1](../../art-source/vehicle-models/compact-6/v1/) | Default GPU integrated | Qualify steering clearance and exact-revision art review. |

### Emergency and service vehicles — 6 sets

| Vehicle ID | Model | Engine | Next action |
| --- | --- | --- | --- |
| `ambulance` | [Retained v2](../../art-source/vehicle-models/ambulance/v2/) — owner inspection pending; v1 retained | Integrated in default GPU mesh mode | Review [beacons](../../public/assets/models/vehicles/review/ambulance-v2/comparison.png) and flashing; playtest [117](../tactical/117-ambulance-driving-controls.md) and qualify steering. |
| `police-car` | [Retained v1](../../art-source/vehicle-models/police-car/v1/) — owner inspection pending | Pending | Review [4×2](../../public/assets/models/vehicles/review/police-car-v1/comparison.png), physical lamp-order contradiction and wheel fit; integrate its own GLB and light state. |
| `garbage-truck-green` | [Retained v1](../../art-source/vehicle-models/garbage-truck-green/v1/) — owner inspection pending in [119](../tactical/119-six-wheel-garbage-truck.md) | Pending | Review [4×2](../../public/assets/models/vehicles/review/garbage-truck-green-v1/comparison.png), wheel scale and roof projection; qualify loader/steering clearance and integrate its own GLB. |
| `garbage-truck-orange` | Queued | Pending | Check green-template eligibility; preserve its own paint and amber beacon lens. |
| `fire-truck-ladder-1` (stowed) | [Retained v2](../../art-source/vehicle-models/fire-truck-ladder-1/v2/) — wheel correction in [118](../tactical/118-fire-truck-wheel-alignment.md); v1 retained | Integrated in default GPU mesh mode | Review corrected [4×2](../../public/assets/models/vehicles/review/fire-truck-ladder-1-v2/comparison.png); playtest [120](../tactical/120-firetruck-gameplay.md); qualify ladder/steering clearance and remaining roof paint. |
| `fire-truck-ladder-2` (raised) | Queued | Pending | Fit raised equipment pose; qualify clearance before driving use. |

### Large car bank — 20 sets

The source numbering spans 7–26; number 12 is named `sedan-12`. The source audit
establishes three exact silhouette groups above; internal geometry and fitted
Blender templates still need qualification.

| Vehicle ID | Model | Engine | Next action |
| --- | --- | --- | --- |
| `car-7` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-8` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-9` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-10` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-11` | Queued | Pending | Inspect four views; identify body family and template route. |
| `sedan-12` (beige) | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-13` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-14` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-15` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-16` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-17` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-18` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-19` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-20` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-21` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-22` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-23` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-24` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-25` | Queued | Pending | Inspect four views; identify body family and template route. |
| `car-26` | Queued | Pending | Inspect four views; identify body family and template route. |

### Additional sedans — 7 sets

| Vehicle ID | Model | Engine | Next action |
| --- | --- | --- | --- |
| `unindexed-sedan-beige` | [Retained v1](../../art-source/vehicle-models/unindexed-sedan-beige/v1/) | Default GPU integrated | Review own 4×2 and roof-paint projection limits; steering remains neutral. |
| `unindexed-sedan-cyan` | [Retained v1](../../art-source/vehicle-models/unindexed-sedan-cyan/v1/) | Default GPU integrated | Review own 4×2 and roof-paint projection limits; steering remains neutral. |
| `unindexed-sedan-dark` | [Retained v1](../../art-source/vehicle-models/unindexed-sedan-dark/v1/) | Default GPU integrated | Review own 4×2 and roof-paint projection limits; steering remains neutral. |
| `unindexed-sedan-olive` | [Retained v1](../../art-source/vehicle-models/unindexed-sedan-olive/v1/) | Default GPU integrated | Review own 4×2 and roof-paint projection limits; steering remains neutral. |
| `unindexed-sedan-orange` | [Retained v1](../../art-source/vehicle-models/unindexed-sedan-orange/v1/) | Default GPU integrated | Review own 4×2 and roof-paint projection limits; steering remains neutral. |
| `unindexed-sedan-red` | [Retained v1](../../art-source/vehicle-models/unindexed-sedan-red/v1/) | Default GPU integrated | Review own 4×2 and roof-paint projection limits; steering remains neutral. |
| `unindexed-sedan-silver` | [Retained v1](../../art-source/vehicle-models/unindexed-sedan-silver/v1/) | Default GPU integrated | Review own 4×2 and roof-paint projection limits; steering remains neutral. |

### Buses — 6 sets

| Vehicle ID | Model | Engine | Next action |
| --- | --- | --- | --- |
| `bus-1` | [Retained v1](../../art-source/vehicle-models/bus-1/v1/) | Default GPU integrated | Review own 4×2, roof vent projection and mirror limits; neutral steering. |
| `bus-2` | [Retained v1](../../art-source/vehicle-models/bus-2/v1/) | Default GPU integrated | Review own 4×2, roof vent projection and mirror limits; neutral steering. |
| `bus-3` | [Retained v1](../../art-source/vehicle-models/bus-3/v1/) | Default GPU integrated | Review own 4×2, roof vent projection and mirror limits; neutral steering. |
| `bus-4` | [Retained v1](../../art-source/vehicle-models/bus-4/v1/) | Default GPU integrated | Review own 4×2, roof vent projection and mirror limits; neutral steering. |
| `bus-5` | [Retained v1](../../art-source/vehicle-models/bus-5/v1/) | Default GPU integrated | Review own 4×2, roof vent projection and mirror limits; neutral steering. |
| `bus-6` | [Retained v1](../../art-source/vehicle-models/bus-6/v1/) | Default GPU integrated | Review own 4×2, roof vent projection and mirror limits; neutral steering. |

## Checklist for each vehicle

Use this checklist in the active vehicle's tactical record; advance its row only
with evidence for that exact revision.

- [ ] Freeze four source crops/metadata and choose or fit an eligible template.
- [ ] Fit native silhouettes, fenders, wheel contacts and source cameras.
- [ ] Clean UV ownership and paint; inspect every window border and retain uncertainty.
- [ ] Inspect matched sprite/render 4×2, contour differences and novel angles.
- [ ] Verify exported wheel components, independent roll, axes and ground contacts;
  qualify steering clearance for any supported steering pose.
- [ ] Measure actual exported wheel centers against source wells in both side
  views; check floor/body intersections and cap/tread UV ownership separately.
- [ ] Commit the exact final GLB, packed Blender/texture source and dependencies;
  verify the delivery from tracked files alone and link its catalog entry.
- [ ] Integrate its own asset in the shared game/lab path; verify registration,
  native ink, motion, resource lifecycle and sprite fallback.
- [ ] Record exact-revision human review and production promotion when obtained.

When a checkpoint changes, update the row, next action, summary counts and date
in this document. Link the new tactical/catalog evidence or explain a blocker.
Keep immutable source banks and earlier final revisions intact. Inventory additions
must appear here as new rows; obsolete rows need an explicit scope decision.

Source-family references and crop caveats: [road vehicle audit](../research/road-vehicles.md).
Authoring commands: [workflow](../../scripts/authored-assets/README.md).
