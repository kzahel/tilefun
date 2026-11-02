# Character support and jump contacts

Status: delivered and validated for owner inspection, 2026-11-02.
Owner: [physics engine](../topics/physics-engine.md).

## Reproductions and contract

The owner reported that walking on another character steers the supporting body,
and walking into someone while jumping can arrest the jump. These affect our
controlled-contact adapter rather than establish an underlying engine defect.

Native reproduction: in the opt-in game, a player pressed against a peer pinned
by a wall peaks at only 0.11px versus 21.26px without contact, with either hull.
The pair response's final guard shortened vertical movement along with horizontal
movement; the jump motor interpreted that lost upward displacement as a ceiling.
A settled laboratory capsule supporting an offset rider moves 0.0185m over twenty
ticks as the rider walks across its shoulder. Its steep cap normal entered the
sideways-push policy.

Preserve positive sideways player pushing, bounded speed/release and obstacle
clearance. Support must not turn the rider's walking into the lower body's intent.
Side constraints must preserve vertical intent; actual underside/ceiling contacts
must still stop an upward jump. Authority and prediction share these rules.

## Implementation

- Shared contact helpers require overlapping vertical side extents, excluding
  rounded capsule caps. A side response shares only horizontal proposals; its
  final relative guard shortens horizontal travel without scaling jump/fall.
- The game retains support/ceiling peers in its normal Rapier query. If a push
  endpoint fails terrain validation, retry the native obstacle query instead of
  cancelling the entire displacement. Only ceiling collision normals cancel
  upward velocity.
- The cooperative lab uses native KCC queries for support/ceiling contacts.
  Temporarily zero and restore the queried peer's solved velocity so it cannot
  become friction/carry intent in the other motor. Above-peer ascent uses bounded
  collider sweeps that restrict closing horizontal motion while retaining upward
  travel; the descending lower motor ignores its overhead rider.
  Ascending characters cannot become grounded from an anticipatory KCC flag.
- Final game endpoints are checked against both terrain and the peer. The lab
  finalizes every pair path, including separated cores: it sweeps both complete
  proposals relatively, consumes only approaching vertical intent at actual cap
  contacts, and checks terrain/pair endpoints. Invalid endpoints retry vertical
  travel through the engine, reapply the relative constraint and validate again;
  unresolved invalid initial-overlap transactions keep their pre-step poses.
- **Walk across player shoulders** and **Jump against pinned player** are shared
  visual/native scripts. They use the same Worker Realm, replay and presentation
  as the existing cooperative lab. General moving-player carry remains a later
  qualification gate.

## Validation

Native checks cover both box/capsule game hulls, free/native/pushing/pinned jump
comparisons, walking off a player's head, two-motor processing order, true player
undersides, laboratory shoulder contacts in either seat, pinned jumping, prior
positive push/release/wall tests, exact snapshot replay and delayed Realm replicas.
Validation: 118 focused native tests in nine files pass, including exact replay,
delayed replicas and per-step shape separation. All three TypeScript projects and
changed-file Biome checks pass with no new diagnostics. Catalog/manifest are current;
2119 candidate identities were checked in full Chromium at retina scale, and the
production build passes.

All five selected full-Chromium cases pass: normal opt-in game startup/settings/
movement and legacy return; shared geometry hull comparison; cooperative scripts,
input and teardown; bridge/scale input/culling; delayed prediction and stall recovery.
The co-op case selects and captures both new scripts and checks the idle support's
position. The normal game setup now opens the menu explicitly and uses Edit/Play
instead of relying on a Tab event that can be consumed by DOM menu focus. That
corrected case passed its focused rerun. The isolated default streaming benchmark
completed six phases with zero errors/failures and no final missing/incomplete/stale
terrain; this is default-path regression evidence, not Chromebook qualification.

The requested Sol 6.1 high review identified two additional lab paths bypassing
final clearance. Both were reproduced before correction: an ascent constrained
horizontally beneath a sloped roof penetrated it by 0.03354m; simultaneous rising/
falling caps with a 0.18m gap overlapped by 0.015m. Unconditional finalization and
the relative cap constraint fix both; their native tests remain alongside the
original report regressions. This does not qualify arbitrary initial-overlap
recovery, crowds or general moving-player carry.

The final read-only Sol 6.1 high follow-up through Yep Anywhere reports no remaining
blocking or actionable findings. The reviewer did not run the validation itself.
Next: owner compare box/capsule contact feel in the normal game and the two scripts;
retain actual Chromebook profiling and independent-clock qualification as later gates.
