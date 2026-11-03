# Car driving and autonomous traffic

Status: delivered and locally qualified; ready for owner playtesting.
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

## Delivery qualification

Committed checkpoints: `28667730` delivers the shared motor; `27e8f03d` restores
road traffic, persistence and the shared Worker fixture. The final focused run
passes 116 native checks across 12 files, all three TypeScript projects and
focused lint. Native coverage includes continuous circulation, queued crossings,
occupied-junction reload, following/resume, ground-level spawning beneath a deck,
legacy lane reacquisition, takeover/off-road parking and prediction/codec behavior.

Five production full-Chromium browser cases pass: ordinary Worker NPC/prediction,
delayed P2P convergence, two-session lab lifecycle, driving a ramp with saved seat,
and moving traffic with pause/save/reload/resume and Worker teardown. The Workshop
view was also visually inspected. Art catalog and Workshop inventories were
regenerated; all 2,120 candidate identities verify in Chromium at retina scale.
Changes are runtime fingerprints, source references, traffic descriptions and one
interactive traffic candidate; promoted art pixels remain unchanged.

The production build passes under the project's Node 24 version. An initial run
under the shell's Node 27 alpha failed in pngjs's legacy zlib constructor before
compilation; using Node 24 resolves that toolchain incompatibility without source
changes.

GPU/meshes streaming readiness passes with 4× CPU throttling and traffic enabled.
Walk/sprint/reverse have zero final missing, incomplete or stale terrain, with
17/18/17 visible entities. This desktop Chromium run is a readiness check, not a
phone-performance or legacy-performance comparison. Benchmark command:
`npm run streaming:bench -- --assert-ready --renderer=gpu --meshes --cpu=4`.

Next: owner playtest rolling turns, reversing and road queues in the game and
[Driving and traffic](https://tilefun.graehlarts.com/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic).
Existing sessions need Save and reload; host and guests must use matching frame
versions. Dead-end lanes stop rather than performing three-point turns. Racing,
shopping trips, suspension/full tumbling and articulated equipment remain deferred.

## Owner playtest follow-up: driving audio

Owner reports driving looks good, but footsteps remain audible while seated.
FootstepSystem now excludes attached actors and discards their gait/airborne
history, preserving nearby pedestrians and normal walking after exit. The existing
quiet local-driver engine gains gentle upper harmonics for small speakers; the
rebuilt World Geometry / Driving and traffic host restores the common AudioManager
path with gesture unlock and normal pause/focus/visibility/teardown cleanup.

Eight focused native audio checks, all three typechecks, focused lint and production
build pass. Two real Chromium audio boundaries pass: Worker driving/footsteps/
walking/menu/focus/exit and lab gesture/pause/mute/context disposal. The lab test
counts closed contexts as released: closing Web Audio does not have to deliver a
future scheduled source-ended event. Art catalog is unchanged; Workshop's input
digest refreshes with identical candidate identities/fingerprints. No simulation,
network payload or extra audio files are introduced. Device listening is next.
