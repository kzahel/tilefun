# Physics Simulation Drift Reduction Plan

Date: 2026-02-17

## Goal
Reduce future client/server prediction drift by tightening shared physics boundaries and removing duplicated simulation adapters.

## Root Cause Recap
The recent edge-jump bug came from inconsistent ground resolution semantics inside shared physics logic:
1. Ground tracking used max elevation under the full AABB footprint.
2. Landing logic used center-point terrain sampling.
3. This mismatch created temporary low-land prediction that later got clamped up.

This was primarily a policy consistency issue, not a transport/input-queue issue.

## Scope
1. Shared movement/landing/ground resolution for player simulation.
2. Server and predictor adapter organization (`MovementContext`, surface queries).
3. Parity test coverage for elevation-edge and reconciliation scenarios.

## Non-Goals
1. Replacing networking protocol.
2. Rewriting all entity/NPC simulation in one pass.
3. Large-scale rendering or serialization refactors.

## Progress
Last updated: 2026-02-17

1. Phase 1 status: Complete
- Added `resolveGroundZForTracking(...)` and `resolveGroundZForLanding(...)` in `/Users/kgraehl/code/tilefun/src/physics/surfaceHeight.ts`.
- Updated movement/landing call sites to use explicit resolver APIs in `/Users/kgraehl/code/tilefun/src/physics/PlayerMovement.ts` and `/Users/kgraehl/code/tilefun/src/entities/EntityManager.ts`.
- Added/updated resolver coverage in `/Users/kgraehl/code/tilefun/src/physics/surfaceHeight.test.ts` and edge-landing parity coverage in `/Users/kgraehl/code/tilefun/src/physics/physicsParity.test.ts`.

2. Phase 2 status: Complete
- Added shared simulation adapter module `/Users/kgraehl/code/tilefun/src/physics/SimulationEnvironment.ts` (`createMovementContext`, `createSurfaceSampler`).
- Removed duplicated movement-context construction logic from `/Users/kgraehl/code/tilefun/src/client/PlayerPredictor.ts` and `/Users/kgraehl/code/tilefun/src/server/Realm.ts`.
- Added adapter contract tests in `/Users/kgraehl/code/tilefun/src/physics/SimulationEnvironment.test.ts`.

3. Phase 3 status: Complete
- Added structured pure-sim outcomes in `/Users/kgraehl/code/tilefun/src/physics/PlayerMovement.ts`:
  - `JumpGravityOutcome` from `tickJumpGravity(...)`.
  - `PlayerStepResult`/`PlayerStepOutcome` from `stepPlayerFromInput(...)` (`landed`, `groundZ`, `enteredWater`, `endedGrounded`).
  - `MountStepOutcome` from `stepMountFromInput(...)`.
- Moved server-only gameplay handling to realm orchestration in `/Users/kgraehl/code/tilefun/src/server/Realm.ts` via `handlePlayerStepOutcome(...)`:
  - Water landing respawn + invincibility timer.
  - Auto-mount on grounded non-water landing.
- Updated `/Users/kgraehl/code/tilefun/src/client/PlayerPredictor.ts` to consume pure step outputs (`jumpState`) during prediction/replay.
- Added/adjusted parity coverage in:
  - `/Users/kgraehl/code/tilefun/src/physics/physicsParity.test.ts` (structured gravity outcome + water-entry step outcome assertions).
  - `/Users/kgraehl/code/tilefun/src/server/NetcodeParityBaseline.test.ts` (held-jump landing reconcile parity scenario).

4. Phase 4 status: Complete
- Expanded netcode parity coverage in `/Users/kgraehl/code/tilefun/src/server/NetcodeParityBaseline.test.ts`:
  - Edge-elevation + jump + landing parity scenario.
  - Delayed-ack + elevation-edge landing reconcile scenario (with replay backlog diagnostics + settled-state assertions).
- Expanded adapter contract coverage in `/Users/kgraehl/code/tilefun/src/physics/SimulationEnvironment.test.ts`:
  - Blocking parity between server/client movement-context adapters on equivalent fixtures.
  - Mixed-surface ground outcome parity (terrain + walkable prop top + entity-top landing semantics) across server/client query styles.

5. Build/type hygiene status: Complete for current blockers
- Fixed `exactOptionalPropertyTypes` payload construction in `/Users/kgraehl/code/tilefun/src/server/NetcodeParityBaseline.test.ts` and `/Users/kgraehl/code/tilefun/src/server/Realm.ts` by omitting optional fields when undefined.
- `npm run build` is currently green.

6. Next phase: Phase 5
- Add invariants + guardrails docs/comments/assertions for drift-sensitive boundaries.

## Phase 1: Consolidate Ground Resolution APIs
## Objective
Make ground policy explicit and reusable so landing and tracking cannot drift.

## Changes
1. Add dedicated resolvers in `/Users/kgraehl/code/tilefun/src/physics/surfaceHeight.ts`:
- `resolveGroundZForTracking(...)`
- `resolveGroundZForLanding(...)`
2. Move terrain + prop + entity ground policy decisions into these resolvers.
3. Make `/Users/kgraehl/code/tilefun/src/physics/PlayerMovement.ts` call resolvers instead of composing rules ad hoc.

## Acceptance Criteria
1. No direct custom terrain-ground composition inside `tickJumpGravity`.
2. Tracking and landing differences are documented and intentional.
3. Existing physics tests remain green.

## Phase 2: Unify Simulation Environment Adapters
## Objective
Remove duplicated server/client adapter logic that can evolve independently.

## Changes
1. Introduce a shared adapter factory module (example: `/Users/kgraehl/code/tilefun/src/physics/SimulationEnvironment.ts`).
2. Centralize construction of:
- `MovementContext`
- surface sampling callback (`props`, `entities` near footprint)
3. Use this factory from:
- `/Users/kgraehl/code/tilefun/src/server/Realm.ts`
- `/Users/kgraehl/code/tilefun/src/client/PlayerPredictor.ts`
4. Keep data-source differences injectable (server spatial hash vs client snapshot arrays), but keep policy identical.

## Acceptance Criteria
1. No duplicated `buildMovementContext` policy branches for blocking semantics.
2. Predictor and server both build simulation adapters through the same API.
3. Parity tests show no regression.

## Phase 3: Separate Pure Simulation From Server-Only Gameplay Effects
## Objective
Keep deterministic simulation pure and isolate side effects.

## Changes
1. Return structured step outcomes from core step functions (example fields: `landed`, `groundZ`, `enteredWater`, `mountCandidateId`).
2. Keep side effects (water respawn, auto-mount, invincibility timer) in server orchestration only:
- `/Users/kgraehl/code/tilefun/src/server/Realm.ts`
3. Keep predictor limited to pure simulation outputs and replay.

## Acceptance Criteria
1. Simulation functions are deterministic and free of realm/session side effects.
2. Server-specific behavior remains in realm-level handlers.
3. Reconciliation diagnostics remain meaningful and stable.

## Phase 4: Strengthen Parity Test Matrix
## Objective
Catch environment/policy drift before runtime.

## Changes
1. Add edge-elevation + jump + landing parity tests to:
- `/Users/kgraehl/code/tilefun/src/server/NetcodeParityBaseline.test.ts`
2. Add adapter-contract tests to verify server and client adapters resolve the same blocking/ground outcomes for fixed fixtures.
3. Add scenario tests for mixed surfaces (terrain + walkable props + entity tops).
4. Add at least one replay/reconcile test that covers delayed ack with elevation-edge landing.

## Acceptance Criteria
1. A failing policy mismatch reproduces in tests without manual playtesting.
2. Netcode parity tests include non-flat terrain coverage.
3. CI test runtime stays acceptable.

## Phase 5: Invariants and Developer Guardrails
## Objective
Make drift-sensitive assumptions visible and hard to violate.

## Changes
1. Add a short invariant section to `/Users/kgraehl/code/tilefun/docs/hard-won-knowledge.md`:
- landing/ground semantics contract
- adapter parity contract
2. Add inline comments at key boundaries:
- `stepPlayerFromInput`
- `tickJumpGravity`
- adapter factory entry points
3. Add lightweight debug assertions (dev-only) where feasible to detect impossible state transitions.

## Acceptance Criteria
1. Key simulation invariants are documented in one place.
2. New contributors can identify parity-sensitive paths quickly.
3. No production behavior changes from debug-only assertions.

## Rollout Strategy
1. Land Phase 1 first with minimal API changes.
2. Land Phase 2 in a separate PR to simplify review.
3. Land Phase 3 after adapter consolidation to avoid cross-cutting churn.
4. Land Phase 4 and Phase 5 in parallel once architecture settles.

## Suggested PR Breakdown
1. PR 1: Ground resolver consolidation + tests.
2. PR 2: Shared simulation environment factory adoption.
3. PR 3: Pure step result plumbing + server-side effect handling updates.
4. PR 4: Expanded parity suite + docs/invariants.

## Risks
1. Adapter consolidation may initially increase complexity if abstractions are too generic.
2. Test fixtures for terrain/props/entities can become brittle if over-specified.
3. Step-result plumbing may touch many signatures.

## Mitigations
1. Keep shared adapter APIs narrow and physics-focused.
2. Build fixture helpers for common terrain/prop/entity setups.
3. Prefer additive API changes first, then remove old paths after tests pass.
