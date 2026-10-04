# 060 — Vehicle grade proof

Status: implemented and validated; human review pending.
Owner: [world geometry](../topics/world-geometry.md), [vehicles](../topics/vehicles.md).

## Scope

Two World geometry fixtures run the production TrafficSystem through the existing
Worker/Realm, replication, presentation and durable record path:

- `car-bridge`: north/south road ramps reach height 64 above the existing moving
  train at height zero. The native compact car stops on the far flat approach.
- `car-garage`: a horizontal car descends to −48 beneath usable street ground,
  then stops inside. A separate opposite-direction run starts underground.

Both use explicit authored lanes and road readiness, with ambient traffic disabled.
Reset and opposite direction create fresh scenarios; save/reload retains route,
speed, pose and negative/positive height. Existing generated road traffic stays
on its current level-road path; no generation version or world compatibility change.

## Physical contract

Surface following is opt-in on a lane. The shared terrain/excavation/slab sampler
finds the highest support beneath the complete approved collision footprint.
The car remains a level chassis: no wheel suspension, pitch animation or changed
native art. It may visibly float above the lower part of a slope.

Probes progress by at most two pixels and reject support changes steeper than
one unit up/down per two units of travel. Props and actors are checked against
the full resulting vertical body interval. A missing road or support, low roof,
or same-level pedestrian stops the car. Actors entirely above/below are clear.
Grounded roof riders contribute to overhead clearance and follow roof height.

This slice proves straight terminal routes. Multi-level junction reservations,
turns on grades, per-wheel support and train/carriage grade poses remain future
work. The brief existing slab-edge appearance at a ramp crest remains deferred.

## Review

- [Car over railway bridge](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=car-bridge#/tool/world-geometry)
- [Car in underground garage](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=car-garage#/tool/world-geometry)

Watch each direction, pause on a slope, save/reload and select upper/lower views.
The player can move between observer starts independently. Automatic cutaway
continues to follow the player observer; it does not follow the car.
These are registered engine experiments, not immutable art approval snapshots.
Existing character candidate fingerprints also refresh because they include the
shared ScenarioSession/Realm source; no character pixels or approvals are promoted.

## Evidence

Focused authoritative tests cover both complete routes in both directions,
continuous heights, mid-slope durable restore, low ceilings, missing roads,
same-level versus street-level pedestrians, and a carried roof passenger.
Typechecks, lint and 1,514 unit tests pass in an isolated snapshot. The streaming
readiness benchmark passes with no browser errors or readiness failures.
Browser checks exercise both Canvas and full Chromium GPU rendering, both
travel directions, slope reload and Worker cleanup. The full suite passed 336
tests with one intentional skip; its standalone Workshop startup timed out once
and passed on an isolated-port retry (337 passing tests including that retry).
After the concurrent tree-sheet commit, typechecks, lint, all 1,514 units, build
and 13 combined family-sheet/vehicle browser checks also passed. Existing lint
warnings remain; this change adds no diagnostics.

## Next

Review this bounded car proof before applying the model to per-carriage train
heights or generated infrastructure. Connected indoor floors remain a separate
consumer requiring a design against the existing realm boundaries.
