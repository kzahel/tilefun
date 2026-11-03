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
