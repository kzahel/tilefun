# Vehicle model porting checklist

Topic: vehicle-model-porting
Status: all 45 source sets have retained own Blender/UV models and shared
engine integrations (49 exact retained revisions). Production model art review
remains open; runtime keeps steering neutral and equipment at its authored rest pose.
Updated: 2026-10-12.

Owns the running vehicle-by-vehicle queue, progress and next action for porting
the sprite bank to editable Blender models and engine assets. Update this list
at each authoring, retention, integration or review checkpoint.
[3D assets](3d-assets.md) owns reconstruction methods;
[vehicles](vehicles.md) owns traffic, driving and physical geometry;
[rendering architecture](rendering-architecture.md) owns engine interfaces.

## Scope and status

Original vehicles beyond the source bank have their own
[topic and queue](original-vehicles.md). [141](../tactical/141-sports-car-style-experiments.md)
compares initial art routes; [142](../tactical/142-red-car-low-poly-pipeline.md)
now refines the preferred guide-finished red coupe into low-poly GLBs and reusable
instructions. [145](../tactical/145-original-coupe-gameplay.md) then integrates
the owner-authorized original coupe with its own additive catalog, matching sprite
fallback and normal spawning/traffic. The 45-set counts below still describe the
existing sprite ports; the combined gameplay roster now has 46 own-model types.
The owner accepted the [Beetle v1 review](../tactical/146-beetle-pipeline-review.md).
[148](../tactical/148-beetle-gameplay.md) integrates its exact 2,554-triangle model
and matching fallback, bringing combined gameplay to 47 types. The port table
still describes the immutable 45-type source bank.

The inventory is the 45 unique `vehicleId` values in
[`vehicles-v1.json`](../../src/traffic/vehicles-v1.json): 180 directional views.
Keep those IDs, including `sedan-12` and the `unindexed-sedan-*` names. Both
fire-truck ladder states have their own row; they may share a future articulated
model. Trains and other asset classes have separate workflows.

Current progress: **45/45 retained models; 45/45 own-model engine integrations.** All source sets have four views;
source extraction support alone does not count as an authored model.

- **Model:** Queued → Authoring → Checking → Retained. Retained means the exact
  GLB, editable Blender/texture bundle and required dependencies are committed
  and verified, per the [delivery checklist](../../art-source/vehicle-models/README.md#next-vehicle-what-to-commit-and-why).
  Use Rework or Paused with a concrete reason when necessary.
- **Engine:** Pending → Integrating → Integrated (optional/default) → Production. Each row
  must load that vehicle's own asset and preserve the complete sprite fallback.
  The `allcars3d` test override only supplies a blue fallback to unregistered types;
  all 45 registered source types take precedence and use their own model.
- **Art review:** No retained 3D revision is promoted to production art at this
  checkpoint. The approved source-sprite bank and chat feedback do not approve
  new model pixels. Record exact-revision review evidence before marking Production;
  [art review](art-review.md) owns that process.

Evidence for existing models: [bundle catalog](../../art-source/vehicle-models/catalog.json)
and [106](../tactical/106-retained-vehicle-model-bundles.md). Blue's
integration is recorded in [108](../tactical/108-authored-blue-car-gameplay.md)
and [112](../tactical/112-coherent-car-presentation-and-test-override.md).
The main game defaults to GPU with all 45 own vehicle assets through the shared
registry ([122](../tactical/122-complete-vehicle-port.md)); every type preserves
sprite fallback while loading, disabled or failed. Ambulance v3 and police v2
correct underfloor clearance without changing visible paint or wheel registration.
Ambulance v1's authoring, exact 4×2 and verification are recorded in
[115](../tactical/115-authored-ambulance.md).
Its beacon refinement and emergency-light contract are in
[116](../tactical/116-ambulance-beacons-and-light-tags.md); v1 remains retained.
Police and stowed fire truck are retained in
[117](../tactical/117-police-and-fire-truck-models.md), with tagged light lenses,
own wheel rigs and a separate fire ladder hinge. The bank's siren-capable types
are ambulance, police and fire truck (two ladder sprite states). Green/orange
garbage trucks carry amber warning beacons; both are retained and integrated with silent beacon controls.

Stowed fire v2 corrects owner-reported axle placement, floor/tire intersections
and wheel UV ownership in [118](../tactical/118-fire-truck-wheel-alignment.md).
V1 remains retained; the new exact comparison awaits owner inspection.

Green garbage truck v1 adds six wheels, a separate recessed rear-loader hinge
and one tagged warning beacon in [119](../tactical/119-six-wheel-garbage-truck.md).
Its own geometry/UV sources and 4×2 are retained; all six wheels roll by their
individual radii in the engine and whole-body neutral-roll clearance is verified.

The complete-bank pass in [122](../tactical/122-complete-vehicle-port.md) retains compact 3/5/6 and integrates all six colors through a shared own-asset registry. Every compact passes actual GPU draw/reset/disposal checks; the failed-load browser probe preserves gameplay with sprites. The compact body passes whole-body neutral-roll qualification; nonzero steering
and exact production art review remain open.

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

## Game-camera qualification

[130](../tactical/130-vehicle-game-camera-fit.md) keeps all 45 retained source rows
and 45 own-model integrations intact while adding fixed runtime vertical registrations.
All source side silhouettes now match in-world height within one native pixel;
actual tire contacts stay at Z=0 through eight yaws/four roll phases. End-view camera
contradictions remain recorded. A separate frozen game-fit candidate covers this
presentation change; it does not promote any source model art or update old approvals.
Next checkpoint: owner inspection of live proportions, diagonals and roof attachment.

## Source families for batching

[129](../tactical/129-vehicle-geometry-batching.md) adds runtime GPU road-model
batching separately from source-family authoring. Registry batchPreserveParts
declares qualified raster-sensitive surfaces; updated exports must keep those
names or requalify them with the native body/outline comparator. The source part
count and immutable retained GLBs remain unchanged. Compiled draw counts and
performance evidence belong to the rendering/performance topics.

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

The compact, additional sedan, six-bus and twenty-large-car batches are retained
and integrated. Orange garbage, raised fire and all prior service types are also
retained and integrated; whole-bank engine/clearance/tracked-only checks pass.
Every vehicle has its own source paint, exact retained bundle and 4×2 inspection.
Exact production art review follows.
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
- [x] Fit the **three large-car shape families and additional sedan family**;
  qualify internal geometry before transferring source-owned paint.
- [x] Fit a **bus** template, then its variants; preserve asymmetric door art.
- [x] Author **police car** and **stowed fire truck** with their own geometry,
  source paint, wheel rigs and tagged lights; retain exact bundles and reviews.
- [x] Fit the **raised fire ladder** rest pose and neutral-wheel clearance;
  arbitrary hinge/steering animation remains outside the supported runtime pose.
- [x] Fit both **garbage trucks**, with own paint and separate amber lenses.
  Six-wheel roll and rest-loader clearance pass.
- [x] Complete cross-vehicle engine qualification and tracked-only delivery.
- [ ] Obtain exact-revision human art review before production-art promotion.

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
| `ambulance` | [Retained v3](../../art-source/vehicle-models/ambulance/v3/) | Default GPU integrated | Review exact [4×2](../../public/assets/models/vehicles/review/ambulance-v3/comparison.png) and light preview; whole-body neutral roll verified, steering/equipment motion unqualified. |
| `police-car` | [Retained v2](../../art-source/vehicle-models/police-car/v2/) | Default GPU integrated | Review exact [4×2](../../public/assets/models/vehicles/review/police-car-v2/comparison.png) and light preview; whole-body neutral roll verified, steering/equipment motion unqualified. |
| `garbage-truck-green` | [Retained v1](../../art-source/vehicle-models/garbage-truck-green/v1/) | Default GPU integrated | Review exact [4×2](../../public/assets/models/vehicles/review/garbage-truck-green-v1/comparison.png) and light preview; whole-body neutral roll verified, steering/equipment motion unqualified. |
| `garbage-truck-orange` | [Retained v1](../../art-source/vehicle-models/garbage-truck-orange/v1/) | Default GPU integrated | Review exact [4×2](../../public/assets/models/vehicles/review/garbage-truck-orange-v1/comparison.png) and light preview; whole-body neutral roll verified, steering/equipment motion unqualified. |
| `fire-truck-ladder-1` (stowed) | [Retained v2](../../art-source/vehicle-models/fire-truck-ladder-1/v2/) — wheel correction in [118](../tactical/118-fire-truck-wheel-alignment.md); v1 retained | Integrated in default GPU mesh mode | Review corrected [4×2](../../public/assets/models/vehicles/review/fire-truck-ladder-1-v2/comparison.png); playtest [120](../tactical/120-firetruck-gameplay.md); qualify ladder/steering clearance and remaining roof paint. |
| `fire-truck-ladder-2` (raised) | [Retained v1](../../art-source/vehicle-models/fire-truck-ladder-2/v1/) | Default GPU integrated | Review exact [4×2](../../public/assets/models/vehicles/review/fire-truck-ladder-2-v1/comparison.png) and light preview; whole-body neutral roll verified, steering/equipment motion unqualified. |

### Large car bank — 20 sets

The source numbering spans 7–26; number 12 is named `sedan-12`. The source audit
establishes three exact silhouette groups above; internal geometry and fitted
Blender templates now have actual GLB whole-body neutral-roll qualification.

| Vehicle ID | Model | Engine | Next action |
| --- | --- | --- | --- |
| `car-7` | [Retained v1](../../art-source/vehicle-models/car-7/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-8` | [Retained v1](../../art-source/vehicle-models/car-8/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-9` | [Retained v1](../../art-source/vehicle-models/car-9/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-10` | [Retained v1](../../art-source/vehicle-models/car-10/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-11` | [Retained v1](../../art-source/vehicle-models/car-11/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `sedan-12` (beige) | [Retained v1](../../art-source/vehicle-models/sedan-12/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-13` | [Retained v1](../../art-source/vehicle-models/car-13/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-14` | [Retained v1](../../art-source/vehicle-models/car-14/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-15` | [Retained v1](../../art-source/vehicle-models/car-15/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-16` | [Retained v1](../../art-source/vehicle-models/car-16/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-17` | [Retained v1](../../art-source/vehicle-models/car-17/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-18` | [Retained v1](../../art-source/vehicle-models/car-18/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-19` | [Retained v1](../../art-source/vehicle-models/car-19/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-20` | [Retained v1](../../art-source/vehicle-models/car-20/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-21` | [Retained v1](../../art-source/vehicle-models/car-21/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-22` | [Retained v1](../../art-source/vehicle-models/car-22/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-23` | [Retained v1](../../art-source/vehicle-models/car-23/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-24` | [Retained v1](../../art-source/vehicle-models/car-24/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-25` | [Retained v1](../../art-source/vehicle-models/car-25/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |
| `car-26` | [Retained v1](../../art-source/vehicle-models/car-26/v1/) | Default GPU integrated | Review exact 4×2 and opposing roof/camera limitations; neutral-roll whole-body clearance verified, steering unqualified. |

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


Twenty large cars now use three independent fitted bodies and their own paint,
with four radius-six wheels, sloped glazing and separate frames. All native 4×2
and novel angles were inspected. Actual GLB cylinder proofs cover hood, cabin,
fenders and floors through every neutral wheel-roll angle; lowered-hood,
displaced-axle and solid-floor negative probes reject collisions. Inner decks
and cabin bases were corrected before retention after an initial floor-only
check missed hood/window intersections. Nonzero steering is unqualified.
Own end/roof UV paint preserves localized exceptions, while incompatible source
camera depths and opposing roof highlights remain exact-revision review limits.

The final service checkpoint completes orange garbage and the raised fire ladder,
with own source paint and static qualified rest equipment. Orange side registration
uses east +4 / west −4 pixels; the west source has an explicit 34-pixel silhouette
exception. Ambulance v3/police v2 only open original floor triangles at wheel
bounds, preserving original perimeter and barycentric UV paint. Every latest GLB
passes whole-body neutral-roll cylinder clearance and actual engine roll checks
(184 wheels); older archived revisions remain unchanged. All six light-bearing
models have isolated named lens phases. Four siren vehicles retain lights-only,
EU and US styles; two garbage beacons toggle silently. Next: exact production art
review through retained 4×2 comparisons, then any requested fidelity revisions.
