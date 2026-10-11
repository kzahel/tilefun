# Vehicle model porting checklist

Topic: vehicle-model-porting
Status: 45 sprite sets inventoried; 3 exact model bundles retained, 1 integrated
in the optional game/lab mesh mode. Ambulance is the next new model.
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

Current progress: **3/45 retained models, 42/45 not yet authored; 1/45 own-model
engine integrations in optional mesh mode.** All source sets have four views;
source extraction support alone does not count as an authored model.

- **Model:** Queued → Authoring → Checking → Retained. Retained means the exact
  GLB, editable Blender/texture bundle and required dependencies are committed
  and verified, per the [delivery checklist](../../art-source/vehicle-models/README.md#next-vehicle-what-to-commit-and-why).
  Use Rework or Paused with a concrete reason when necessary.
- **Engine:** Pending → Integrating → Optional integrated → Production. Each row
  must load that vehicle's own asset and preserve the complete sprite fallback.
  The `allcars3d` test override reuses the blue model for other types and does not
  advance their status.
- **Art review:** No retained 3D revision is promoted to production art at this
  checkpoint. The approved source-sprite bank and chat feedback do not approve
  new model pixels. Record exact-revision review evidence before marking Production;
  [art review](art-review.md) owns that process.

Evidence for existing models: [bundle catalog](../../art-source/vehicle-models/catalog.json)
and [106](../tactical/106-retained-vehicle-model-bundles.md). Blue's optional
integration is recorded in [108](../tactical/108-authored-blue-car-gameplay.md)
and [112](../tactical/112-coherent-car-presentation-and-test-override.md).

## Work order

- [ ] Author the **ambulance** next, with its own body, wheel positions, cab/box
  windows and source-owned graphics. Retain and inspect its exact final bundle.
- [ ] Connect the retained **green and red compacts** to their own engine assets;
  qualify per-asset registration instead of assuming the blue adapter fits all.
- [ ] Complete **compact-3, compact-5 and compact-6** using the checked compact
  replay only when four-view shape/metadata and palette correspondence pass.
- [ ] Inspect and group the **large cars, seven sedans and police car** into real
  shape families. Fit a first template per family before transferring variants.
- [ ] Fit a **bus** template, then its variants; preserve asymmetric door art.
- [ ] Fit **garbage trucks**, then **fire trucks**, including separate equipment
  components and raised-ladder clearance. Inspect sources before choosing reuse.
- [ ] Complete cross-vehicle engine qualification and exact-revision art review
  before considering the full bank ported for production.

This is a queue, not a claim that numbered cars share geometry or that all listed
models have been started. The later family order can change with owner priorities.

## Running inventory

### Compacts — 6 sets

| Vehicle ID | Model | Engine | Next action |
| --- | --- | --- | --- |
| `compact-1` (blue) | [Retained v7](../../art-source/vehicle-models/compact-1/v7/) | Optional integrated | Qualify steering clearance and exact-revision art review. |
| `compact-2` (green) | [Retained v7](../../art-source/vehicle-models/compact-2/v7/) | Pending | Load its own GLB; verify game/lab registration, ink and wheel motion. |
| `compact-3` | Queued | Pending | Run compact eligibility checks; author and inspect its own paint. |
| `compact-4` (red) | [Retained v1](../../art-source/vehicle-models/compact-4/v1/) | Pending | Load its own GLB; verify game/lab registration, ink and wheel motion. |
| `compact-5` | Queued | Pending | Run compact eligibility checks; author and inspect its own paint. |
| `compact-6` | Queued | Pending | Run compact eligibility checks; author and inspect its own paint. |

### Emergency and service vehicles — 6 sets

| Vehicle ID | Model | Engine | Next action |
| --- | --- | --- | --- |
| `ambulance` | Queued — next new model | Pending | Author a new family template from all four complete views. |
| `police-car` | Queued | Pending | Inspect body family; preserve livery, windows and separate light-bar geometry. |
| `garbage-truck-green` | Queued | Pending | Fit cab/container geometry and wheel rig from the original views. |
| `garbage-truck-orange` | Queued | Pending | Check geometry correspondence before reusing the green truck template. |
| `fire-truck-ladder-1` (stowed) | Queued | Pending | Fit truck geometry with separate ladder/equipment components. |
| `fire-truck-ladder-2` (raised) | Queued | Pending | Fit raised equipment pose; qualify clearance before driving use. |

### Large car bank — 20 sets

The source numbering spans 7–26; number 12 is named `sedan-12`. Family membership
is still to be established from silhouettes and landmarks.

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
| `unindexed-sedan-beige` | Queued | Pending | Fit a sedan template; check all four silhouettes and windows. |
| `unindexed-sedan-cyan` | Queued | Pending | Verify shape and palette correspondence before template reuse. |
| `unindexed-sedan-dark` | Queued | Pending | Verify shape and palette correspondence before template reuse. |
| `unindexed-sedan-olive` | Queued | Pending | Verify shape and palette correspondence before template reuse. |
| `unindexed-sedan-orange` | Queued | Pending | Verify shape and palette correspondence before template reuse. |
| `unindexed-sedan-red` | Queued | Pending | Verify shape and palette correspondence before template reuse. |
| `unindexed-sedan-silver` | Queued | Pending | Verify shape and palette correspondence before template reuse. |

### Buses — 6 sets

| Vehicle ID | Model | Engine | Next action |
| --- | --- | --- | --- |
| `bus-1` | Queued | Pending | Fit a bus template, including asymmetric doors and long-body wheel spacing. |
| `bus-2` | Queued | Pending | Compare geometry and graphics before reusing the bus template. |
| `bus-3` | Queued | Pending | Compare geometry and graphics before reusing the bus template. |
| `bus-4` | Queued | Pending | Compare geometry and graphics before reusing the bus template. |
| `bus-5` | Queued | Pending | Compare geometry and graphics before reusing the bus template. |
| `bus-6` | Queued | Pending | Compare geometry and graphics before reusing the bus template. |

## Checklist for each vehicle

Use this checklist in the active vehicle's tactical record; advance its row only
with evidence for that exact revision.

- [ ] Freeze four source crops/metadata and choose or fit an eligible template.
- [ ] Fit native silhouettes, fenders, wheel contacts and source cameras.
- [ ] Clean UV ownership and paint; inspect every window border and retain uncertainty.
- [ ] Inspect matched sprite/render 4×2, contour differences and novel angles.
- [ ] Verify exported wheel components, independent roll, axes and ground contacts;
  qualify steering clearance for any supported steering pose.
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
