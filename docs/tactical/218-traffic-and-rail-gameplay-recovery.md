# Traffic performance, rail service and contextual jump recovery

Status: delivered fixes and ready for owner review; affected-phone performance confirmation remains open. Authorized 2026-11-03.
Owners: [performance](../topics/performance.md), [vehicles](../topics/vehicles.md),
[trains](../topics/trains.md), [physics](../topics/physics-engine.md).

## Report and scope

The owner reports large phone frame drops around traffic, possible authority lag,
traffic jams, missing station train calling and missing nearby-vehicle high jumps.
Train services/calling were deliberately deferred by reset 205; the retained tracks,
stations and approved banks remain. At the start of this work the shared jump had one fixed impulse.

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
Pixel/depth checks pass. The final eight-second capture creates only two textures
and one framebuffer over 482 frames, compared with 12,930 textures and 6,465
framebuffers over 481 frames before the pool. Scratch creates stay at three pairs
throughout the final window, with no evictions and a 1,474,560-byte scratch working
set. Finished-pose images remain separately bounded. Both runs retain 16.8ms frame
p99 and roughly 60Hz authority, so no desktop FPS gain or affected-phone FPS gain
is claimed.


## Final evidence and limits

- 189 selected kernel, protocol, prediction, traffic, service and host tests pass
  across 14 files, with one worker for the wall-clock-budgeted replay cases.
  Another 54 rendering resource checks pass across four files, including exact-size
  pair reuse, byte/entry LRU bounds, expiry and disposal. All three TypeScript
  projects pass. Focused lint has no errors; existing non-null assertion warnings
  in the legacy codec/test files remain.
- 33 distinct production full-Chromium cases pass across the affected runs:
  24 GPU raster/depth/cache/recovery checks, four vehicle geometry/traffic/effects
  checks, two train game/lab checks, two co-op physics checks and ordinary P2P Worker
  hosting. The pool's final 28-case render/vehicle selection passes. The train
  boarding fixture uses the initial eight-second recall dwell; it no longer asks
  for a redundant second recall after walking away from the bench.
- Normal builds and the regenerated inventories pass, including 2,121 candidate
  identities in normal Chromium at retina scale. Approved art and geometry source
  assets are unchanged. Final GPU/meshes CPU-rate-4 streaming readiness passes all
  six stages with zero final missing, incomplete or stale terrain.

[Traffic progress and native attribution](../benchmarks/218-traffic-progress-comparison.json)
retains the four-minute before/after join reproduction and the current canonical
run. Every one of 16 cars progresses during the final minute; route completions
rise from 154 to 297 in the diagnostic comparison. The separate attribution lane
records one initial 38.85ms tick adding 17 bodies and 37 sections. Geometry compile
accounts for 5.33ms; remaining setup is not split further. No recorded GC overlaps
that initial tick; GC capture is bounded, not a complete whole-run trace.

[GPU allocation receipt](../benchmarks/218-traffic-gpu-allocations.json) records
before/after WebGL allocation counters on the same crowded fixture, with 12 visible
cars, two nearby predicted bodies, five-second warmup and eight-second measurement.
It records the large allocation reduction and the scratch-memory budget, with
ordinary depth/color preserved by the independent geometry oracle. This establishes
resource reuse; it does not establish physical-phone frame-time improvement.

[Final streaming receipt](../benchmarks/218-traffic-rail-streaming.json) owns the
six ready stages, frame/render tails and hardware/run metadata. The Android targets
were disconnected, so the owner's actual phone slowdown remains unconfirmed.
Desktop CPU throttling does not replace that device capture.

## Review and next work

- [Ordinary game](https://tilefun.graehlarts.com/tilefun/): **Save and reload**;
  co-op host and guests must all load the new frame format.
- [Station](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=train&renderer=gpu&meshes#/tool/world-geometry):
  call beside the bench using touch / E / Interact, then jump onto the waiting train.
  The bench preset and paused save/reload stay in the generated fixture.
- [Crowded traffic](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=traffic-crowd&renderer=gpu&meshes#/tool/world-geometry):
  inspect the sustained grid with the same motor, physics and planner as the game.

Next: owner retests the affected phone scene after reload. If frame drops remain,
capture actual phone main/Worker timing during traffic arrival/streaming, including
cold setup and GPU allocation counters. This slice does not restore inside train
driving/manual whistles or claim to solve every possible traffic gridlock.
