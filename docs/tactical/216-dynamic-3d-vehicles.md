# Dynamic 3D vehicles and coherent depth

Status: implemented and qualified for owner feel review, 2026-11-03; owner acceptance pending.
Owners: [vehicles](../topics/vehicles.md), [physics](../topics/physics-engine.md),
[rendering](../topics/rendering-architecture.md), [embedded labs](../topics/embedded-engine-labs.md).

## Outcome and scope

Replace the upright vehicle approximation with freely rotating Rapier chassis,
simple wheel suspension/traction and the existing child-friendly controls. Preserve
one shared world and one fixed 60Hz world step. Game, Worker, prediction and labs
use the same implementation; no permanent legacy/new vehicle selection.

The reported blue-car/truck overlap exposes independent mesh images composed in
whole-object painter order. Correct vehicle visibility must use per-pixel world
depth and account for supporting/overhead geometry and nearby sprite characters.
215's coherent world color composition does not supply shared 3D depth.

## Checkpoints

1. Establish vehicle/vehicle occlusion through shared depth and qualify actual
   production composition, surface interaction and outline/resource behavior.
2. Prove a compact car and a truck using full chassis rotation, wheel suspension,
   propulsion/braking and full numerical replay/replication/presentation/save state.
   Exercise ramps, crests, jumps, edge tipping, rollovers, contacts and delayed
   two-client observation through the existing shared engine lab.
3. Apply shared model defaults, adapt autonomous traffic, preserve parked sleep,
   add accessible overturned-vehicle recovery and qualify game/lab lifecycle and
   Chromebook-oriented performance. Commit checkpoints and mark ready after checks.

The first playable decision point is representative car/truck feel and correctness,
before model-specific polish. Do not require articulated trailers, cargo equipment,
tire deformation or a detailed drivetrain. Characters retain their upright hulls.

## Validation contract

Use focused native simulation/codec/replay/save tests for physics contracts and
full bundled Chromium only for actual GPU visibility, Worker/control and lifecycle
boundaries. Retain the existing planar driving guarantees where meaningful:
longitudinal drive/reverse, rolling steering, no pivot at rest and airborne
momentum. Add representative ramp/roll/recovery cases rather than a model matrix.
Measure simulation and rendering separately; moving tilt may reduce image-cache
reuse. No unmeasured performance guarantee. Record evidence and remaining limits
here and update owning topics before the review handoff.

## Implementation checkpoint

Land vehicles now have freely rotating dynamic chassis, raised underbodies and
suspension/tire impulses at the committed authored axle locations (dimension-based
four-contact defaults for models without a four-or-more-wheel profile). Tire and
suspension preparation is shared by authority and replay; impulses are admitted
together before the one world step. Characters stay upright. Boats retain their
separate upright watercraft motor in this same world.

The initial Rapier vehicle-controller trial exposed its previous-step spatial
query dependency at new geometry/replay boundaries. The delivered small controller
uses direct Rapier collider ray queries with cheap resident bounding-sphere
rejection. It has no second integrator, query warm-up step or serialized WASM world.
Stable fully supported parked vehicles sleep; contacts and driving wake them.
A native corner/braking check caught an explicit tire-damping roll oscillation;
shared damping now lets the body settle instead of perpetually rocking/creeping.

Frame 0x11 adds current/previous game-coordinate quaternions, angular velocity and
sleep state to numerical vehicle bodies (45 bytes per vehicle beyond the existing
109-byte base). Ordinary entity baselines/deltas carry orientation even outside
local prediction range. Remote/local presentation uses quaternion interpolation;
vehicle records retain rotation and angular momentum. Physical bounds and the
collider inspection viewport follow full rotation. Basic braking/turn/exit tests
now allow physical tire slip and stopping distance instead of demanding prescribed
velocity or instant stops; supported-character correction assertions remain.

GPU composition retains per-body native-pixel color images AND their depth.
The outline pass copies local depth on-GPU; cached bodies transform it into one
camera-relative world depth attachment. Upright sprite planes, elevated terrain
and bridge/ramp top/front equations share it. HUD and immutable reference adapters
retain their own composition. The color/depth image cache retains its 16 MiB
budget with eight bytes per pixel; no per-frame CPU image/depth readback is added.
The new production probe compares normal/cache/reversed draw order against actual
vehicle geometry rendered in one common target, preserving source double-sided
faces in its independent object-ID oracle. Three representative poses agree at
all sampled overlap pixels. The completed delivery qualification and device limits are recorded below.

Review surfaces: World geometry's car-dynamics fixture offers bridge ascent/
descent, a lower passage, jump ramp and tipping ledge with ordinary model selection.
The two-client physics lab's vehicle case adds native seats, full body transforms
and shared static geometry. F / controller D-down / Right car request the same
nearby-authorized support/clearance-checked recovery; ordinary exit remains.
Wheel meshes retain the existing travel animation; independent suspension/steering
articulation is polish beyond the first handling decision.

Delivery qualification: 311 focused native checks across 22 files, 31 distinct
production full-Chromium browser cases, all three TypeScript projects, focused
lint, inventories/build and GPU/meshes CPU-rate-4 streaming readiness pass
(2,121 Workshop identities, including normal Chromium retina verification).
Browser cases cover GPU context/resource recovery, the independent depth oracle,
Worker/P2P, bridge/garage traversal, course rotation through save/reload, compact
and truck recovery, and a delayed guest driving the shared car with matching
ordinary replicas and seat persistence. Lab teardown releases its Workers.

The [native comparison](../benchmarks/216-vehicle-physics.json) alternates three
runs against exact pre-feature PhysicsScene source from d2e6eaf4, without retaining
that implementation. At 96 NPC bodies plus 32 driving cars, mean synchronize/step
cost is 0.358 → 0.500ms and p99 0.838 → 0.978ms on this desktop. Parked fleets sleep
all 32 cars and measure 0.213 → 0.196ms mean. This excludes AI/render/network and
is not Chromebook timing. The initial driving implementation measured 1.112ms;
reusing one body query pose per tick removed repeated per-wheel/neighbour WASM
translation reads. Its initial receipt is retained inside the comparison.

## Feel-review handoff and limits

The [car dynamics course](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=car-dynamics&renderer=gpu&meshes#/tool/world-geometry)
provides drive/passage/jump/ledge/recover starts and a model selector. Start with
compact-1, then dump-truck. Drive car / E / Y enters; arrows or normal controls
drive. F / D-pad down / Right car recovers a nearby settled overturned vehicle
with a valid upright clearance. Existing game sessions must Save and reload;
host and guests need the same updated binary frame version.

The [two-client vehicle case](https://tilefun.graehlarts.com/tilefun/workshop.html?scene=vehicle#/tool/physics)
uses ordinary prediction and configurable guest delay, including seat ownership;
its shaded collider view intentionally displays physical shapes, not final art.

[Streaming evidence](../benchmarks/216-vehicle-streaming.json): all six GPU/meshes
CPU-rate-4 stages finish with zero missing, incomplete or stale terrain. Frame p99
is 16.8ms in each stage; sprint retains one 133.2ms frame. Readiness is not a
no-stutter guarantee, and this is not a matched renderer-cost comparison.

[Physical Chromebook course](../benchmarks/216-chromebook-vehicle-course.json):
Chrome 150, eight logical cores, 8GiB, 1600×721 CSS viewport at DPR 2.4. A compact
car climbs the 48px bridge, tilts (minimum up component 0.962), crosses and descends;
its final prediction is ready with zero reported resimulation position error.
The short live-development run records frame p50/p95/p99 of 16.7/33.4/50ms. This
proves functional device delivery, not steady 60fps or a before/after budget.
There is no new phone, thermal or crowded-device qualification.

Next decision: owner reviews ramp transitions, braking/steering, jump landings,
rollovers and the relative feel of the compact and truck. Tune shared defaults
from that feedback before detailed wheel suspension/steering animation or
articulated cargo/equipment. Device frame-cost isolation remains a performance
follow-up; do not describe this checkpoint as an all-device performance signoff.

## Owner feel follow-up: controls and flattened tumbles

Owner feedback requests relative left/right steering by default and reports cars
looking flattened during non-yaw rotation. Manual game controls and both engine
labs now default to Up/W forward, Down/S reverse, Left/Right or A/D steering.
Existing explicit directional preferences and tap/held world destinations retain
their meaning; scripted simulation inputs are unchanged. R/LT still overrides
reverse, including relative mode. UI hints agree with the admitted controls.

A rendered compact comparison reproduces the shape issue: legacy sprite matching
scales model height by 0.631 before rotation (12.75px fitted geometry versus 20.2px
authored height). Roll makes that compressed volume apparent. Physical residents
now bypass this fit, with rigid authored dimensions through pitch/roll/yaw.
The same shared resource restores its legacy fit for nonphysical review draws;
immutable source assets are untouched. Physical roof riders no longer receive the
legacy fitted-height offset. The fixed x,y−z camera still legitimately makes some
orientations edge-on; this change does not silently give cars a separate lens.

Follow-up qualification: 189 distinct native checks across eight files pass,
including a new actual-collider pushing/contact test (transient penetration bounded
by one tick of approach travel; settled penetration below 0.25 world pixel).
Eight selected production full-Chromium cases pass: Canvas/GPU default and saved
controls, taps, dynamic car pushing, both Worker lab boundaries, delayed guest
car driving, ramp rotation/reload/recovery and the independent depth oracle.
All three TypeScript projects, focused lint (one existing non-null warning),
regenerated inventories and production build pass. The older browser contact
expectation was obsolete after dynamic chassis: pushing no longer guarantees zero
speed, and overlapping projected XY envelopes do not prove 3D penetration. That
browser check now owns the input/push/stop flow; native collider queries own the
bounded separation check.

The refreshed streaming receipt passes all six GPU/meshes CPU-rate-4 readiness
stages, with 16.8ms frame p99 and one 283.4ms reverse-stage frame. The physical
Chromebook repeats the bridge drive with ArrowUp under the new default, reaches
48.48px elevation, descends, and reports ready prediction with zero resimulation
position error. Its short frame p50/p95/p99 is 16.7/33.4/33.4ms. Both receipts
retain the initial runs and explicit measurement limits; these unpaired smoke
runs do not demonstrate a device performance improvement. Ready for the next owner
handling/rollover review.

## Owner feel follow-up: fast cars rolling in turns

Owner feedback: faster cars tip over too easily. A flat-ground probe (boosted and
base top speed, then three seconds of full lock or a 0.4s left/right slalom)
reproduced it: race coupe, rally hatchback, beach buggy, monster truck, boosted
go-kart and boosted police car rolled; the rally hatchback, beach buggy and monster
truck rolled even unboosted. Three causes: the centre of mass sat at the collider's
geometric centre (about half the body height); 1.5 tire grip exceeded the
static-rollover threshold for tall, narrow chassis; and full lock was fixed at
every speed, demanding several g at racing speeds.

Shared defaults now:

- Every wheeled chassis (solid or articulated) uses the chassis box inertia with
  its centre of mass 0.3 of body height above the base (`CHASSIS_CENTRE_OF_MASS`).
  This alone removed every rollover in the probe; at 0.35 one model rolled again
  with 1.5 cornering grip, so it is not sufficient margin by itself.
- Tire force uses a friction ellipse: 1.5 drive/brake grip (unchanged acceleration)
  and 1.2 cornering grip (`TIRE_CORNERING_GRIP`). Uniform 1.0 grip would have cut
  rear-drive racer acceleration by a third and widened fast turns further.
- Full lock narrows with speed so bicycle-model lateral demand stays at 0.9 of
  cornering grip (`STEERING_LATERAL_ACCELERATION`). Alone it did not stop rolls
  (the high centre of mass rolled at about 0.7g from the lock transient), but it
  stops front tires scrubbing past their grip, so fast turns are tighter than
  unlimited lock with the same grip.

Result: no rollovers in either probe at base or boosted speed; peak lean is 1–3° at
full lock. Low-speed turning is essentially unchanged (compact 61px versus 58px
radius). Boosted racers turn wider by physics: the open-wheel racer at 540px/s
needs about a 590px radius at roughly 1g. Ramp, ledge-tipping, recovery, dump-bed
and transporter cases still pass; a new native test keeps a boosted rally hatchback
upright at full lock (it ended inverted before). Ramp/jump/ledge feel and the
boosted turning radius need owner review in play.
