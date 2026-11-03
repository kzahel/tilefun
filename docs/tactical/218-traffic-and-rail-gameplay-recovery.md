# Traffic performance, rail service and contextual jump recovery

Status: investigation and implementation in progress; authorized 2026-11-03.
Owners: [performance](../topics/performance.md), [vehicles](../topics/vehicles.md),
[trains](../topics/trains.md), [physics](../topics/physics-engine.md).

## Report and scope

The owner reports large phone frame drops around traffic, possible authority lag,
traffic jams, missing station train calling and missing nearby-vehicle high jumps.
Train services/calling were deliberately deferred by reset 205; the retained tracks,
stations and approved banks remain. The shared jump currently has one fixed impulse.

1. Reproduce crowded road traffic over sustained runs; separate route decisions,
   physics/authority time, prediction and rendering. Keep sparse controls and actual
   progress/blocked outcomes, not just successful short-duration movement.
2. Restore bounded contextual jump assistance inside the shared scene. Normal
   jumping stays unchanged away from rideable vehicles/trains; assistance requires
   a new grounded jump press. No exposed movement parameter matrix or second solver.
3. Restore a bounded autonomous station service and authoritative bench recall
   through ordinary shared-world prescribed bodies, ready terrain, persistence and
   game/lab controls. Preserve approved art; do not revive the old movement/carry
   solver. Qualify roof riding and client replay at the new common boundary.
4. Fix reproduced traffic defects and measured hot paths, record performance
   limits and qualification, commit checkpoints and mark playable work ready.

## Initial evidence

The six retained native road tests pass. A four-minute simulated sparse loop with
three autonomous cars continues to advance routes; this is not a reproduction of
the owner's crowded jam. Physical Android targets are currently disconnected, so
no phone performance claim is possible from that route. Crowded native/Chromium
measurement follows; desktop throttling is not phone timing.


## Contextual jump checkpoint

The common physics jump edge now consults nearby solved rideable body extents.
Only grounded player jump requests qualify; ordinary NPCs and repeated held jumps
retain their current behavior. Gravity remains shared. The initial regression
covers ordinary/distant jumps, nearby car/train assistance, exact snapshot restore
and held-edge suppression; existing shared-scene contact tests pass. The larger
train/traffic delivery and generated inventories are still in progress.


## Train and traffic implementation checkpoint

Generated services now submit prescribed carriage intent to the existing shared
scene. Train bodies use a kinematic descriptor within the existing vehicle
snapshot/replay contract; body dimensions and native cardinal presentation remain
shared. Route services own bounded residency, dwell/reversal and saved/deleted
records. Read-only destination/sweep queries use the same Rapier collision world,
and stop an entire consist at a blocker. Current and next rail centers, on both
sides of the alignment, must retain ready track. Recall rechecks caller, realm,
bench, occupancy and clearance after asynchronous preparation. No legacy movement,
carry solver, extra physics world, runtime backend option or train art returned.

The old station prompt rejected tiny negative grounded Z from the new solver;
its shared range now tolerates the ordinary subpixel resting margin. An actual
game/Worker browser check calls by touch, jumps onto the roof with normal keys and
rides a departing service. Native checks cover shared support/replay, all-car
blocking, rail removal, saved distance, co-op occupancy and deletion persistence.
The two-player lab's hidden initialization tick also moved restored services;
opening/restoring now relies on existing nonintegrating replication instead.

Traffic's wide corner can end beyond the outgoing lane's nominal start. Sampling
its continuation from zero pointed backward into the turn, leading to oncoming
collisions and indefinite motor fighting. Lookahead now projects the actual join
onto the next path. Continuing routes are preferred over dead-end spurs when
available; real blockers and unsupported endpoints still stop traffic safely.
The four-minute closed-grid reproduction changes from 14/16 cars with no route
progress in its final minute to all 16 advancing, with the exact evidence retained
at delivery. No claim that every possible gridlock is solved.

The crowded browser run separates authority from main-thread delivery. Its first
4× desktop CPU-throttled captures show 12 visible cars, 60Hz Worker progress and
16.8ms frame p99 with sprites or meshes; that does not reproduce the phone report.
Moving meshes still require substantial per-car rendering, so no blind renderer
quality reduction was made. Final production captures and qualification follow.


Prediction qualification caught an authority-only grouping dependency. Consists
now carry an explicit optional `physicsGroupId` in entity baselines/deltas; frame
tag advances to `0x12`, and hosts/guests must reload together. Bounded snapshots
include every visible group member when one is nearby, with the existing overflow
fence. Blocked prescribed motors publish their stopped targets. A native full
binary round trip removes private service identities, recreates a client scene
and proves 90 shared steps match authority for the whole consist and roof rider;
group removal also round-trips through a nullable delta.


## Measured moving-car GPU allocation churn

A separate production WebGL allocation capture after warmup records 12 visible
cars creating 12,930 textures and 6,465 framebuffers over 481 frames: about
26.9 textures and 13.4 framebuffers per frame. Different car radii repeatedly
resized the one raw target and one outline target. This is proven resource churn,
not proof of the affected phone's frame-rate bottleneck.

Exact-size scratch color/depth pairs now reuse native resolutions through a
16MiB / 16-entry LRU with unused-frame expiry. Scratch composites still flush
before reuse; completed pose images remain separately bounded. Disabling meshes,
context recovery and disposal clear the pool. No pose quantization, reduced
resolution, wheel-animation change or rendering-quality mode is introduced.
Pixel/depth and allocation checks follow before final readiness.
