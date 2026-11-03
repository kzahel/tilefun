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

## Shared motor checkpoint

The grounded traction motor uses retained acceleration/turning-radius data,
signed rolling speed, lateral grip and progressive braking. Direction aiming
selects reverse behind the nose; relative controls supply steering/throttle.
Airborne cars keep physical momentum. Shared numerical motor intent adds two
float32 fields and frame tag 0x0f; authority and client replay share the motor.
80 focused motor/kernel/prediction/garage/bridge/codec checks pass, including
perpendicular driving without initial strafe, no stationary pivot, braking through
zero into reverse, release and airborne traction. Traffic integration follows.

## Traffic checkpoint

RoadTraffic supplies bounded motor intent from retained LaneGraph data. It tracks
solved pose along lanes, caches tangent-continuous corners sized for the vehicle's
turning radius, follows leaders, waits for clear exits and grants FIFO junction
reservations. Restored occupied junctions retain clearance until the rear passes.
Following decisions distinguish opposing lanes; Rapier owns actual contacts.
The initial planner exposed infeasible old quadratic turns and false opposite-lane
yielding; the continuous corner and lane-aware queue fixes cover those failures.

Deterministic sparse road slots populate at most 32 autonomous cars per loaded
registry, with model/road-width/turning-radius compatibility and normal clearance,
identity/tombstone checks. Existing traffic-v1 records reacquire usable nearby
lanes; explicit parked/traffic mode and route choices persist. Player takeover
suspends planning; release reacquires a nearby compatible lane or parks off-road.
Parked/depot cars remain parked. Decisions run on the common physics tick, have
the existing stale-control deadline, and introduce no motion integration.

The 30-second circulation test and four-approach/occupied-junction reload test
pass, along with stopped-leader/resume, saved routes, takeover and off-road parking.
A real regional-generation probe produced 11 autonomous cars and all 11 moved.
The broader focused run passes 114 native checks across 12 files; all typechecks
pass. The shared Worker fixture is Workshop → Driving and traffic, also available
as the traffic fixture in World Geometry. Production/browser/performance delivery
qualification follows; no suspension, racing or shopping-trip service is restored.

Angular interpolation also retains the previous physical heading through a
zero-replay acknowledgement, matching the previous-position contract from 208.
Final wire tag is 0x10, with 109-byte numerical bodies; the two motor fields and
previous heading add 12 bytes to the 208 payload. This avoids renewed rotation
pacing as rolling steering becomes visible. The existing rendered-car replay
check now covers its intermediate heading as well as XYZ.
