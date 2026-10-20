# 154 — Car controls and contact

Date: 2026-10-19.
Status: Complete; final validation 2026-10-20.
Owner: [Vehicles](../topics/vehicles.md).

The owner requested configurable directional versus relative car steering, automatic
reverse for rearward targets, independent tap-to-move, and diagnosis/correction of
apparent car interpenetration. Reverse already freed the reported stuck cars; the
separate button was confusing.

## Delivery

Options remembers the manual car style per browser profile. Direction aiming
selects reverse beyond 120° and retains it until 90° while backing. Input magnitude
still controls reverse speed near a destination. Relative mode uses vertical
throttle and horizontal steering, transmitted in the existing command flag byte.
Both paths use the same rolling integrator and delayed replay; tap/hold world
intent stays independent. The extra Reverse paddle is removed.

Actual registered mesh bounds expose a second problem besides control clarity:
the compact's native side collider was 56×20 while its centered registered mesh
needs 59×31; the ambulance was 112×36 while its mesh needs 118×43. Diagonal model
rotation formerly retained one of four cardinal footprints. Conservative mesh
metadata is now retained separately, combined with native dimensions and rotated
into a continuous axis-aligned ground envelope. Explicit tooling verifies model
registrations, including lateral scaling, without changing any model/sprite bytes
or regenerating assets during builds.

All vehicle poses, replicas and saved bearings use the same derived bodies. Traffic
lookahead and reservation bodies no longer read smaller raw sprite metadata; queue
clearance includes the full turn body, with safe recovery from old queue gaps.
Straight terminal roads retain half-body end clearance.
Existing overlaps may move only toward a nearer exit face; new/deeper contacts
block. A blocked widening turn may roll straight if every ordinary terrain,
body, push and roof-passenger gate passes. No teleport, fixed-body push or polygon
contact solver is introduced; conservative diagonal corners can stop early.

The original Chromebook map request is fixed in the same delivery: observed
native touch events replace provisional pointer contacts, preventing one finger
from becoming a pinch on hybrid touch stacks. See
[Steam Deck and menus](../topics/steam-deck-and-menus.md).

## Validation

All 5,744 unit tests pass. Native regressions cover all-model rotated coverage,
diagonal contacts, blocked new/deeper overlap, car/building/tile recovery,
diagonal escape, reverse throttle and relative controls. Binary delayed replay
covers both control interpretations at 30/60Hz. Main-game Canvas/GPU browser
checks cover saved Options, keyboard throttle, rearward taps with relative manual
controls, solid parked-car contact and reverse escape. Existing narrow-junction
checks exercise four competing approaches, safe retreat and resumed travel.

All 87 distinct focused browser checks pass across the main game and shared
Traffic/World geometry labs, using bundled full Chromium on Canvas/GPU. This
includes grade/reload/roof support, every live vehicle model and failed-fetch
fallback, placement, touch movement, controller menus and hybrid Chromebook map
gestures. The school-bus turn fixture now turns toward clear street space;
its calibrated body correctly blocks the former path into a roadside lamp.
Portrait/landscape Options and parked-car contact captures were inspected.
Typechecks, lint (existing warnings), inventories, production build, all 48
retained mesh-bound checks and the immutable 180-view bank check pass.

`npm run streaming:bench -- --assert-ready` passes, including cold entry,
traversal and zoom cache readiness. This is desktop readiness evidence, with
other browser regressions running concurrently; it is not a physical Chromebook
or isolated frame-pacing measurement.

The final full `npx playwright test --max-failures=1` run passes all 1,477 cases
using bundled Chromium and isolated data (1.7 hours). This includes both mobile
and hybrid Chromebook hold-to-travel/cancellation regressions, both manual car
styles, rotated body contact/recovery, traffic, vehicle grades and shared labs.
The earlier map-only aquatic-hunter failure also passes in this run.

Next: hands-on Chromebook long-press/pinch and child driving trials, especially
the 120° automatic reverse threshold and the two manual control styles.

## Rebase integration — 2026-10-20

Rebased onto `d37ef472`, retaining the expanded original fleet and explorer boat.
The tactical is now 154 because the remote already used 152 for boats. Retained
mesh envelopes cover all 79 registrations; the boat still uses its fixed 80px
square hull, water-only motion, gentler braking and strict contact without car
overlap recovery or pushing. The roster steering fixture turns toward clear
street space so long bodies do not hit the roadside lamp.

Typechecks, lint, production build, regenerated inventories and 220 focused unit
checks pass, including the boat contact regression caught during integration.

All 83 distinct focused browser checks pass on the rebased build, including all
33 originals on Canvas/GPU, main-game car controls, boats and hybrid map gestures.
The final full unit run reports 6,036 passes and one intermittent failure in
`ScenarioTraffic.test.ts` (junction queues after Realm save/reload, a car still
turning with `choices=0`). That test passed in the preceding full run, and all
seven tests in its isolated file pass. Keep this full-run intermittency visible
for follow-up; the corrected boat/contact files pass all 220 focused checks.
