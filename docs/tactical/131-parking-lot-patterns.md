# Parking lot pattern lab

Status: delivered for human review; parking checks pass, one broader train check remains failing, 2026-10-18.
Owner: [city generation](../topics/city-generation.md).

The owner requested big parking lots in some towns, shopping-center context,
cars arriving/parking, and first a lab to compare parking tile patterns.

This first slice delivers three new static compositions in Workshop → Parking
lot lab: a 64-space shopping center, a 16-space town lot and 16 long side-facing
bays. Native Modern Exteriors paint, pavement, curbs, storefronts, carts, planted
islands and six compact-car colors establish scale. Cars and the tile grid can
be toggled; the shared preview camera provides fit, native size, zoom and pan.
Three exact candidates register in the global inbox under `parking-patterns`.
The review view verifies native pixels and source/recipe identity; draft car/grid
toggles do not change the registered arrangement.

These are static layout studies, with native artwork assembled at source size.
They add no simulation loop, traffic behavior, generator selection or asset-bank
promotion. The old v7 parking archive and promoted banks remain immutable.

Next: owner layout feedback, followed by shared production lot/space planning,
traffic entry/space reservation/parking/departure and durable parked state. A
playable lab must consume normal ScenarioSession/Realm authority and presentation.

## Owner follow-up

On 2026-10-18 the owner liked the preview and requested committing it. They want
the next behavior slice to show a complete shopping visit: a car arrives and
parks, its occupants get out and walk into a shop, then return to the car, get in
and leave. Keep only one or two cars actively parking/departing at once to reduce
congestion. Reserve the destination bay before entry and coordinate conflicting
maneuvers; other parked cars can remain still while people visit shops. This is
requested follow-up behavior, not functionality delivered by the static lab.
The chat feedback does not write Workshop candidate approval events or promote
the study into town generation.

## Validation

- Typechecks pass; 2,637 unit tests pass, including lot clearance against other
  spaces, reserved walks and driving aisles. Lint passes with existing warnings.
- Production build passes. Source-use inventory includes every study crop;
  all 814 manifest candidates match normal Chromium at retina scale. The 811
  pre-existing candidate records remain byte-for-byte unchanged.
- Both dedicated browser tests pass, including in the full run: pattern/car/grid toggles, all layouts,
  phone width, deep-link/reload, review navigation and exact native-pixel review
  parity in full Chromium. No human review events were submitted by tests.
- Live origin serves the exact generated manifest. Bundled Playwright Chromium
  opens the public lab, reaches ready and renders the shopping-center preview
  without browser errors. The temporary dev preview was stopped; refreshing the
  live Vite server cleared stale optimized bundles from that shared cache.
- Full browser suite: 634 passed, two failed (636 total, 25.4 minutes). The tools
  index expected the old count of 27; its updated 28-tool assertion and explicit
  Parking lot lab visibility check pass on rerun. The remaining existing
  `authored-train.spec.ts` main-game test fails on an empty transient carriage
  list: once at initial inspection, then during backend switching on rerun.
  Train models load and the other train/driving checks pass. No train/runtime
  implementation changed in this slice. Stabilizing/investigating that broader
  snapshot assertion remains separate work; this is not a clean full-suite pass.
- Final lint passes with the same existing warnings. Automated inspection uses
  isolated data/auth and bundled Playwright Chromium; temporary servers and
  browser instances were closed.
