# Dynamic 3D vehicles and coherent depth

Status: implementation in progress; owner authorized 2026-11-03.
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
all sampled overlap pixels. Browser/device and broader lifecycle qualification
are still in progress; this checkpoint is not marked ready.

Review surfaces: World geometry's car-dynamics fixture offers bridge ascent/
descent, a lower passage, jump ramp and tipping ledge with ordinary model selection.
The two-client physics lab's vehicle case adds native seats, full body transforms
and shared static geometry. F / controller D-down / Right car request the same
nearby-authorized support/clearance-checked recovery; ordinary exit remains.
Wheel meshes retain the existing travel animation; independent suspension/steering
articulation is polish beyond the first handling decision.

Native checkpoint: 154 focused checks across 14 files and all three TypeScript
projects pass; production inventories/build pass (2,121 Workshop identities,
including normal Chromium retina verification). Full selected browser delivery
checks and throttled streaming/per-device evidence remain before readiness.

The [native comparison](../benchmarks/216-vehicle-physics.json) alternates three
runs against exact pre-feature PhysicsScene source from d2e6eaf4, without retaining
that implementation. At 96 NPC bodies plus 32 driving cars, mean synchronize/step
cost is 0.358 → 0.500ms and p99 0.838 → 0.978ms on this desktop. Parked fleets sleep
all 32 cars and measure 0.213 → 0.196ms mean. This excludes AI/render/network and
is not Chromebook timing. The initial driving implementation measured 1.112ms;
reusing one body query pose per tick removed repeated per-wheel/neighbour WASM
translation reads. Its initial receipt is retained inside the comparison.
