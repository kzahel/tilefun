# Physics and movement architecture

Checked against code on 2026-10-03. The
[original phased proposal](archive/3d-physics-design.md) is archived. Its
“Current State” predates shared movement, absolute height and prop platforms.

## Current owners

- [PlayerMovement](../src/physics/PlayerMovement.ts) provides `stepPlayerFromInput`,
  `stepMountFromInput`, jump/gravity, friction, acceleration and collision steps
  to both Realm and PlayerPredictor. Do not fork client/server physics logic.
- [SimulationEnvironment](../src/physics/SimulationEnvironment.ts) builds common
  movement contexts and surface samplers. Callers supply spatial-hash or replica
  queries and blocking policy; shared stepping alone does not prove query parity.
- [surfaceHeight](../src/physics/surfaceHeight.ts) resolves terrain, entity and
  finite walkable prop surfaces. [AABB3D](../src/physics/AABB3D.ts) handles height
  overlap. Entity `wz` is absolute height; `jumpZ` remains available to presentation.
- [PropCollider](../src/entities/Prop.ts) already has `zBase`, `zHeight` and
  `walkableTop`. Missing height is a full-height wall; a walkable top requires
  finite height. Existing furniture/platform support is not pending Phase 3.
- [BallPhysics](../src/physics/BallPhysics.ts) handles projectile gravity/bounces.
  [propDepth](../src/rendering/propDepth.ts) handles standing-on-prop draw order.
- [ThreeDebugRenderer](../src/rendering/ThreeDebugRenderer.ts) supplies the current
  `r_show3d` split-screen view, rather than the proposed 2D wireframe extension.
- Opt-in [SurfacePatch](../src/physics/SurfacePatch.ts) colliders provide planar
  slab support and undersides for the first [world geometry proof](topics/world-geometry.md).
  Shared player movement checks slope support, landing and overhead clearance.
  Bounded `excavation` floors now lower the terrain collision base through shared
  `terrainBaseZ` queries; optional ceiling references retain a usable upper slab.
  Ordinary terrain grids are unchanged. This does not update ball/NPC navigation.

## Prediction, presentation and persistence

The predictor reconciles authoritative state and replays unacknowledged inputs.
Previous/current player and mount state supports render interpolation. This is
not evidence that the proposal's generic `renderPosition` tween layer shipped.
Keep rendering corrections separate from authoritative movement.

Entity wire snapshots include height and parenting state; save records are a
separate contract in [SaveManager](../src/persistence/SaveManager.ts). Do not infer
save fidelity or old-client compatibility from the original plan's statements.
Current saves include room plans and procedural edit/tombstone metadata as well
as ordinary world/player state.
Player records now optionally include `wz`, `groundZ` and `jumpVZ` so reload
preserves vertical location/motion. Explicit realm arrivals reset airborne state.

## Verification and remaining ideas

The [world geometry topic](topics/world-geometry.md) records the 2026-10-04
use cases for tile-based slopes, garage ramps, stacked floors, bridges and
tunnels. The agreed direction is constrained terrain surfaces and connected
stacked spaces; the schema remains open. This does not replace the current
physics contract or select a solid-volume architecture.

Start with [physics parity](../src/physics/physicsParity.test.ts),
[environment tests](../src/physics/SimulationEnvironment.test.ts),
[surface tests](../src/physics/surfaceHeight.test.ts),
[predictor tests](../src/client/PlayerPredictor.test.ts) and
[netcode parity](../src/server/NetcodeParityBaseline.test.ts).
Use [riding diagnostics](RIDING-DEBUG.md) for mount issues and
[performance](topics/performance.md) for gameplay runners.

Enterable playground tubes and broader authored 3D structures remain content
ideas; the collider foundation alone does not establish their behavior.
New movement or collision work needs a concrete failure/feature and parity
coverage, not a restart of the historical phase checklist.
