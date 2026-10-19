# 143 — Small-animal roadkill

Date: 2026-10-19.
Status: Complete — implemented and validated.
Owners: [Vehicles](../topics/vehicles.md), [wildlife](../topics/wildlife.md).

The owner accepted the roadkill proposal and authorized end-to-end implementation
and a completion commit. This supersedes gentle, damage-free contact only for
eligible small animals hit by driven road vehicles or trains.

## Behavior and ownership

- An explicit gameplay class covers frogs, rabbits, robins, mallards, chickens,
  both pigeon variants, crows, seagulls and ants. Sprite dimensions and pushing
  weight do not determine eligibility. Cats/dogs and their variants, following,
  attached and ridden animals retain protection; other bodies retain pushing.
- Moving body contact kills at any speed, forward or reverse. Stationary overlap
  does not. Six swept body half-spaces check XY and physical Z after broad-phase
  admission, avoiding diagonal-envelope false kills and height-separated contact.
- Shared VehiclePush planning is pure. Driven cars and straight/curved trains
  commit kills only after their complete terrain/body/passenger plan succeeds.
  Natural road traffic and parking continue yielding. Repeated carriage contacts
  produce one death. Private predictor copies suppress killed collision bodies
  over pending input without modifying replica animals or predicting their AI.
- Removing the living actor uses ordinary durable deletion, including its generated
  feature tombstone. A separate `roadkill:<original-type>` inert actor persists the
  remains and countdown through the ordinary actor factory/definition registry and
  binary entity protocol. Roadkill never requests predator-meal replacement.
- Remains have no AI, velocity, collider, support or shadow. Existing first-frame
  sheet pixels are compressed to 30% height at the ground anchor, stay still for
  25 seconds, fade over five seconds, then disappear. The ordinary gameplay timer
  does not flash remains. Source sheets and promoted review snapshots are unchanged.
- Main game and embedded labs share authority, prediction, actor persistence and
  scene collection/raster drawing. Canvas and GPU consume the same scale/alpha;
  full Chromium checks exercise both real game rendering paths.

## Validation

Typechecks, all 2,898 unit tests across 293 files (two workers), lint (existing
warnings only), production build, source-use catalog
and manifest generation pass. All 880 candidate identities verify in bundled full
Chromium at retina scale. The 214 renewed records are the 204 natural-landscape
and ten world-geometry behavior identities; all 180 vehicle review identities and
all source art remain unchanged. Both native game browser checks pass on Canvas
and GPU/meshes, including visible flattened remains, continued driving, inertness
and saved deaths. A fresh serial full browser run passes all 716 cases in bundled
Chromium, including the two roadkill checks; both fresh captures were visually
inspected. Browser captures use each test's ignored Playwright output
directory so they survive machine restarts.

The streaming `--assert-ready` benchmark passes all six scenarios (cold, standing,
walk, sprint, reverse and zoom-out), with zero missing-data or incomplete-cache
frames. These are readiness checks, not a general frame-rate guarantee. Earlier
broad attempts before the battery shutdown were incomplete; the fresh two-worker
unit and serial browser runs pass.

New behavior coverage includes all ten eligible runtime
types; slow/fast and stationary contact; diagonal misses; physical height and
followers; blocked atomic plans; deduplicated carriage contacts; binary/persistence
reconstruction; flattened/fading scene items; forward/reverse driving with frozen
replica prediction; straight/curved services; saved deaths and eventual removal.

The wildlife production-table refresh was attempted after persisting this checkpoint.
It cannot run in this checkout: the required ignored
`data/wildlife-campaign-v2/progress.json` is absent. No campaign state or art
approval was invented; the existing production table remains untouched.

### Upstream integration (2026-10-19)

Rebased onto the newer wildlife and vehicle work; this tactical moved from 141
to 143 to preserve the upstream vehicle plans. Regenerated inventories retain
all 1,391 candidates: 789 records remain identical and 602 geometry identities
renew, with full-Chromium retina verification. Typechecks, lint, build, both
Canvas/GPU roadkill browser cases and all six streaming readiness scenarios pass.
The full unit run passed 4,400 tests and found one stale ten-type assertion:
upstream now includes provisional chicken and pigeon variants, giving twelve
eligible runtime types. The assertion now covers both explicitly; all 24 roadkill
unit/scenario tests pass on the corrected rerun. Runtime behavior needed no changes.

## Next

Playtest body contact and visibility at ordinary gameplay zoom. Larger-animal
injury and autonomous road-traffic roadkill remain outside this slice.
