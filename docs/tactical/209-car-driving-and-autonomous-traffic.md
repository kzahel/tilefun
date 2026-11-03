# Car driving and autonomous traffic

Status: authorized, implementation in progress.
Updated: 2026-11-03.

Owner approved the investigation proposal: restore car locomotion and ordinary
autonomous road traffic through one shared vehicle controller. Reset 205's direct
world-axis car velocity and independent yaw caused sideways travel and stationary
pivoting; VehicleRegistry retained parked/saved bodies but no autonomous driver.

## Delivery slices

1. Shared grounded vehicle motor: signed target speed, acceleration/braking through
   zero, heading-relative propulsion/grip, signed rolling steering/turn radius and
   preserved airborne momentum. Existing directional and relative controls feed
   the same kernel. Numerical snapshots retain motor intent for prediction.
   Check perpendicular turns, reverse, stationary steering, walls, ramps and replay.
2. Bounded traffic intent planning using retained LaneGraph paths: lane acquisition,
   following, junction priority, deterministic population and lifecycle ownership.
   Planner supplies the same motor; physics remains the only pose owner. Persist
   traffic/parked mode and route choice; restore old road cars near usable lanes,
   preserve placed/depot parking, player takeover and safe road reattachment.
3. Integrate normal Realm/Worker and shared visual fixture, qualify native road
   interactions, save/reload/streaming and prediction, then focused browser/P2P,
   build/inventories and streaming readiness. Commit working checkpoints, finish
   clean and mark development readiness last.

No old collision solver, extra physics step, model option matrix, suspension/
tumbling, parking visitors or articulated equipment is part of this slice.
