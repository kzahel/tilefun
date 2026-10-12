# Editor vehicle placement

Status: Delivered.
Date: 2026-10-12.
Owner: [vehicles](../topics/vehicles.md).

The owner requested the vehicle picker proposed after the complete 45-model bank.

## Behavior

Edit → Vehicles offers all 45 labelled sprite thumbnails, including raised fire.
Choose a vehicle and click/tap clear dry ground to place it facing right, parked.
The editor shows its sprite and ground footprint before placement. Vehicle selection
is separate from animal/entity selection; minimization and ordinary touch scrolling
retain the selected model. Vehicles → Delete picks the visible vehicle body and
preserves other entities/props. Indoors continue offering only room/furniture tools.

Play mode uses the existing Drive car / E, Fast, siren/style or silent-beacon controls.
Placed vehicles stay parked after exit, including on generated roads. They do not
consume automatic traffic's 12-per-player/32-per-realm quota; total resident vehicle
admission remains bounded at 1,024. Automatic raised-ladder traffic remains excluded.
Steering/equipment art remains at the existing supported poses.

## Shared authority and durability

Realm handles the existing edit-spawn command through TrafficSystem placement.
Every outdoor realm has that service; worlds without generated roads use an empty
network. Placement admits known models and finite bounded positions only, requires
loaded full footprints, and reuses drivenCarPose's full-body dry terrain/prop/entity
checks. Unpublished candidates use ID −1 so player ID zero still blocks overlap.
Vehicles can only be placed through an editing session.

The optional placed flag belongs to TrafficState/SavedTraffic, not the replica.
A unique placed-vehicle identity and inert anchor reuse ordinary TrafficRecords,
streaming holders, writeback, driver identity, binary entity replication and prediction.
Restoration validates the parked route contract before publication and does not need
a generated lane. Position, facing, lights and an occupied seat survive reload; scope
eviction/rehydration and durable deletion retain existing transaction ownership.
No native sprite/model asset, physical bank or generator version changes.

## Evidence and next work

Native checks cover all 45 placements, overlap/water/unloaded/invalid rejection,
driving, lights/inside-seat reload, parking, deletion and scope eviction/rehydration.
Browser checks exercise the real Worker, phone picker, overlap rejection, driving,
reload and visible-body deletion on Canvas and GPU. All 2,571 units (260 files),
three typechecks, lint, build and streaming readiness pass. Workshop regeneration
verifies 807 candidates; all 226 vehicle/authored-model candidate records remain
byte-identical. The picker screenshot was visually inspected for native thumbnail
crops, legible names, selection and phone tray bounds.

The broad browser run passes 621/622 checks (24 minutes); standalone Workshop
hits its 60-second deadline during context teardown. The placement tests and all
six existing mobile-editor checks pass. The final vehicle-only touch-start preview
update is validated with a fresh build and focused rerun below; the broad run uses
the initial integration build. All nine final serial checks pass: six mobile-editor
layouts/Atlas flows, both
placement driving/reload/deletion variants with first-touch preview assertions,
and standalone Workshop. The broad timeout clears in isolation; the initial full
run was not wholly green. Final changed-file lint adds no diagnostics.

After rebasing the new retained train work, all 2,574 units (261 files), typechecks,
lint and the combined build pass. Regeneration verifies 809 candidates (61 compiler
exclusions); the same 226 vehicle/model records remain byte-identical. Six train
browser checks, six mobile-editor checks and standalone Workshop pass. The Canvas
placement check initially hits a wandering chicken at its fixed test point, correctly
rejecting overlap. The test now chooses a loaded footprint with at least 100px of
clearance from other bodies; both Canvas and GPU pass three consecutive runs each.
Runtime placement code is unchanged by the rebase and test-fixture refinement.

Next: owner playtest of choosing and placing vehicles; driving-feel refinement is
separate follow-up. Exact retained model art review remains open.


Evidence: [native/unit log](/tmp/tilefun-placement-unit-full.log),
[broad browser log](/tmp/tilefun-placement-browser-full.log),
[final focused log](/tmp/tilefun-placement-browser-final.log),
[post-rebase units](/tmp/tilefun-placement-sync-unit.log),
[post-rebase browser checks](/tmp/tilefun-placement-sync-browser.log),
[repeated clear-ground placement](/tmp/tilefun-placement-clear-ground-browser.log),
[streaming report](/tmp/tilefun-placement-streaming/report.json),
[phone GPU picker](/tmp/tilefun-placement-picker-gpu-meshes.png).
