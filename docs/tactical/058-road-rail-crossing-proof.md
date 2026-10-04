# Road bridge over a railway

Date: 2026-10-04. Owner: [world geometry](../topics/world-geometry.md).
Status: complete; ready for human review.

The user accepted the underground garage proof and authorized the next crossing
slice. This is a third World geometry lab fixture, preserving the deck and garage.

[Open the crossing](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=crossing#/tool/world-geometry).
Walk north from the south approach, over the bridge and down the far ramp.
Bridge and trackside starts make inspection quick. Pause, reload and surface
visibility controls remain available. The native horizontal train initially waits
eight seconds, then shuttles east/west with the production stop/reversal policy.

## Shared engine contract

- The road deck is at 64px, with an 8px slab and 56px clearance. Its two 256px
  approaches join continuously to ground. The 44px train stays at track height 0.
- Scenario recipes supply bounded straight route data and seed ordinary rail
  tiles once. Realm accepts an optional authored route source; its normal
  `RailwaySystem` still owns motion, collision, readiness, residency, replication
  and `railServices` persistence. Reload reads the saved track and service.
  The regional planner and generated railway output are unchanged.
- A bridge pedestrian does not block the train below. Insufficient slab clearance
  and pedestrians at track height do stop it. Entity overlap now checks both ends
  of the vertical interval, so actors wholly below ground do not block a ground train.
- Shared `presentSurfaceScene` orders each actor against overlapping projected
  slabs at that actor's height. Visibility remains observer-local. The production
  outdoor renderer and scenario host use the same policy; an upper observer no
  longer causes a lower train to draw over the bridge.
- Stable painter constraints cover the bounded planar fixtures. They do not
  claim arbitrary intersecting surfaces, meshes or particle depth correctness.
  Ordinary worlds without these patches retain the existing scene submission.

## Review and limits

Road/track decoration and bridge surfaces are schematic; the train uses the
existing native horizontal bank without resizing or mirroring its source.
The new experiment is registered as an excluded engine candidate, not an art
approval. No generator promotion, railway grades, cars driving the bridge,
boarding, turns or finished bridge art are included. Whole-patch cutaway remains.

Review both road approaches while the train passes, the separation of the two
heights, automatic/manual views, and save/reload. Vehicle grades and per-carriage
rail support are subsequent consumers; they need their own route and art review
before a town loop or generated structure is introduced.

## Evidence

- Typechecks, lint (existing warnings only), production build and all 1,498 unit
  tests passed. Inventory generation verified 558 candidate identities in normal
  Chromium, including the new excluded engine experiment.
- The isolated full browser suite passed 331 checks with one intentional skip.
  Its harness used unused ports to avoid concurrent local servers. The unchanged
  deck and garage passed alongside the crossing's Canvas, GPU and phone checks.
- Simulation tests cover continuous travel across both road approaches, east/west
  train reversal beneath an upper pedestrian, one restored service after reload,
  insufficient clearance, a pedestrian on the track and a wholly lower actor.
  Presentation coverage asserts train → bridge → upper pedestrian ordering
  independently of observer height. Canvas/GPU bridge/lower captures and the
  phone layout were inspected.
- `streaming:bench -- --assert-ready` passed: cold, standing, walking, sprinting,
  reversal and zoom-out all ended with zero missing, incomplete or stale chunks.
  This is readiness evidence, not a matched frame-rate comparison.
- After the independent family-navigation commit landed, the combined checkout's
  typechecks, lint, regenerated inventories and build passed again; focused
  crossing/family browser checks verify their final composition.
