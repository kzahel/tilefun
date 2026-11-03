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
