# 061 — Train grades, bridge and tunnel

Status: implemented and validated; human review pending.
Owner: [world geometry](../topics/world-geometry.md), [trains](../topics/trains.md).

The user accepted the car grade proof in chat and authorized the next bounded
lab slice: a straight railway over a ramp/bridge and into a tunnel, with separate
carriage heights, full-body clearance, stopping/reversal and slope save/reload.

## Review

[Train grade lab](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=train-grades#/tool/world-geometry)

The blue train climbs to 64, descends to ground and then enters a tunnel at −96.
It waits eight seconds at both termini and reverses. Follow train is the default;
Whole route shows the complete schematic. Pause on a slope and save/reload.
Run opposite direction creates a fresh east-to-west run. Observer starts on the
bridge, beneath it, underground and on the street separate observer cutaway from
train motion. Camera/visibility changes do not advance the simulation.

This is a registered engine experiment, not an immutable art approval snapshot.
The original approved 456×62 train bank remains byte-for-byte unchanged. Three
contiguous native crops (136, 160 and 160 pixels wide) are loaded as individual
sprites, with source rectangles recorded in the art catalog. No mirroring,
rotation, rescaling or new train artwork is introduced.

## Shared engine contract

- `RailRoute.surfaceFollowing` opts an authored horizontal route into three
  ordinary replicated carriage entities. One RailwaySystem service controls the
  group, with fixed longitudinal offsets relative to the middle carriage.
- Each carriage uses the shared terrain/excavation/slab support sampler over its
  full collider footprint. The level body sits at the highest supporting point.
  Grade changes are limited to 1:2; substeps travel at most 3.2 pixels.
- Every carriage is checked before any pose is committed. Missing rails, missing
  ready terrain, unsupported drops, slabs and same-height actors stop the group.
  Clearance uses each body's own height interval; actors above/below can pass.
- Realm excludes every carriage from generic entity stepping. The shared
  renderer orders each replicated body against surfaces at its own height.
- One `railServices` record stores route position, destination, dwell, speed and
  three heights. Older flat-service records default missing speed to zero.
  Carriages are excluded from ordinary actor persistence. Retirement removes
  the whole group; deleting any carriage tombstones the service and cleans up
  siblings on the next railway tick, outside the entity-removal callback.
- Restoring a distant train readies its dependency footprint before publishing
  any body; failed publication rolls back the group. This also fixes the
  existing flat-service readiness boundary.
- Scenario reload preserves its requested camera range. Paused camera inspection
  uses a bounded view-range command to refresh streaming and replicas without
  ticking physics. Moving diagnostic cameras supply the same target to streaming
  and drawing. The bounded lab view also includes the controlled player’s small
  prediction neighborhood; widely separated camera/player views can include the
  intervening corridor. The shared host owns this policy for all embedded labs.

Generated lines continue to use their existing single flat train body. No
regional generator output/version, station layout or promoted bank changes.

## Deliberate limits

Carriages remain horizontal boxes and sprites. Height differences expose stepped
or separated joins and some floating above the low end of a slope; this is not
articulated coupler or suspension geometry. Do not use the result as finished
sloped train art. No turns, boarding, train roof riding, signals, branching,
sector-wide cutaway holes or world-generation integration are included.
The tunnel uses the existing whole-patch observer cutaway, not automatic hiding
based on the train. The schematic surface strips stand in for elevated track art.

## Evidence

Authoritative tests traverse both directions and both reversals, preserve spacing
and continuous heights, restore mid-grade speed/height, and cover low ceilings,
actors on bridge/tunnel versus underpass/street levels, edited rails, unready
chunks, retirement and service deletion. A view-range regression preserves
paused state and camera coverage through reload. Serialization retains each
native crop's dimensions and collision body.

Browser tests cover Canvas and full Chromium GPU, follow/overview cameras,
paused slope reload, tunnel cutaway/all-surfaces views, reversal, fresh reverse
start, Worker cleanup and phone control layout/long-press suppression.

Validation on 2026-10-04: typecheck and lint passed with no new diagnostics;
1,526 unit tests passed; production build passed; full Playwright suite passed
342 tests with one skipped. Art catalog and Workshop manifest were regenerated
and verified (562 rendered candidate identities, seven compiler exclusions).
The streaming readiness benchmark reported no readiness failures or browser
errors. Browser validation used an isolated source/data snapshot and bundled
Chromium so concurrent work in the shared tree could continue. Canvas and GPU
tunnel captures were inspected: the roof covers the train in all-surfaces mode
and the underground observer's automatic cutaway reveals it.

## Next checkpoint

Review height transitions and the visible horizontal-art limitation before
selecting one deliberate generated bridge/tunnel crossing. Decide whether that
crossing can use this representation or first needs pitched carriage/coupler
presentation. A town loop, stations and junctions remain subsequent work.
