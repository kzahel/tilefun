# Idle player head support

Status: delivered and validated for owner inspection, 2026-11-02.
Owner: [physics engine](../topics/physics-engine.md).

The owner reported that landing on another player shifts the lower player out of
the way. The earlier shoulder-walking tests started with an already supported
rider; they did not exercise a full fall and subsequent rest in the game backend.

The new two-motor reproduction drops an offset rider from 28px, then runs both
idle motors for three seconds in either processing order. Box mode remains still;
capsule mode displaces the lower player by 2.2467px. The lower KCC produces lateral
clearance motion against the overhead capsule despite zero horizontal intent.

The bounded game query now filters a separated overhead player out of an idle,
nonascending lower motor. Horizontal and upward intent retain that obstacle, so
ordinary blocking and actual underside/ceiling contacts remain enabled. Normal
terrain/NPC/vehicle policies are unchanged. Collider heights and side extents are
captured before entering Rapier predicates; callbacks do not reborrow WASM collider
state. Downward support queries and endpoint validation use the same policy with
their appropriate intent.

After the fix, both game hulls and both processing orders retain zero lower-player
XY displacement; the rider remains above 11px with the capsule and at 12.032px
with the box. The cooperative reference also checks centered/offset falls in both
seats. **Land and stand on player** is an input-neutral shared visual/native script,
with exact snapshot replay and delayed Realm convergence coverage.

Retain positive side pushing, jump clearance and the prior relative cap/terrain
regressions. General moving-player carry and initial-overlap recovery remain
outside this slice.

Validation: 123 focused native tests in nine files pass, including both hulls,
both motor orders, centered/offset/moving-approach landings, prior pushing/jumping/
ceiling checks, exact replay and delayed replicas. All three TypeScript projects
and changed-file Biome checks pass. The production build passes with current
catalog/manifest and 2119 candidate identities checked in full Chromium at retina
scale. Three selected full-Chromium cases pass: normal opt-in launch/settings/
movement and legacy return, shared geometry comparison, and co-op Worker/input/
teardown including the new landing script and idle-support position assertion.
The isolated default streaming benchmark completes six phases without errors or
failures; this remains default-path evidence, not Chromebook qualification.

The requested read-only `gpt-6.1-sol` reviewer through localhost:3400 Yep Anywhere
ran at verified `high` effort and found no actionable findings against `3aa0e372`.
The reviewer did not run these checks. Next: owner test a full landing and idle
stand in the ordinary capsule game and the **Land and stand on player** script.
