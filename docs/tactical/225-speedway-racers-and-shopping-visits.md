# Speedway racers and shopping visits

Status: delivered and qualified locally; ready for owner play review.
Owner request, 2026-11-07: restore all retired special vehicle behaviors.
This slice completes that sequence after 222 (dump bed) and 224 (towing,
transporter, depot lanes). It restores the two ambient traffic behaviors that
205/209 retired: speedway racers (138) and shopping visits (132). Owners:
[vehicles](../topics/vehicles.md).

## Delivered

- **Racers.** `RoadTraffic.populate` places a fixed, durable grid of one racer
  per speedway quarter on both rings. The models and race speeds (126/150px/s)
  come from the existing racetrack lanes. Identity is
  `traffic-v1:<lane>:racer`. A moved racer keeps its identity, and a deleted one
  never refills its slot.
  - `RaceTraffic.planRacer` follows each closed ring by pure pursuit across the
    tangent quarter joins. There are no junctions or reservations, but ordinary
    following distance still stops racers for people, cars and edits.
  - Road cars still have no edge into the circuit.
- **Shopping visits.** `ShoppingVisits` is driven from the ordinary planner. A
  westbound road compact (compact-1–6) passing a generated center's entrance,
  with no other visitor at that center, turns in along the retained
  `shoppingLot` arrival route and parks.
  - Its shopper is an ordinary pedestrian on a route (`routeAI`). The shopper
    walks to the shop door, stays inside for 12s, and walks back.
  - The car then follows the departure route and rejoins the boulevard as
    normal lane traffic, with a 120s cooldown.
  - Cars follow lot routes by pure pursuit along the polyline, so 90° corners
    are cut on the car's own turning circle.
  - The trip phase saves with the vehicle (`visit`). After a reload, a shopper
    who was walking is treated as inside the shop and comes back out of the
    door. Shoppers are transient: `parking-visit` excludes them from records,
    and they are simulated only while their car is.
  - A driver taking over the car ends the trip.
- **Scenario and labs.** Recipes accept `racetracks`, `shoppingCenters` and
  autonomous parked vehicles, built into a vehicle source by
  `ScenarioTraffic.ts`. The world geometry lab gains **racetrack** and
  **shopping** fixtures, which default to the mesh renderer. The
  `geometry:racetrack-traffic-v1` and `geometry:parking-visits-v1` Workshop
  candidates open them. The generated-city shopping capture stays deferred.

Differences from 132/138: one shared lot route per center, as the generated
version already had (the four-bay parking lab layout is not rebuilt), and no
reserved neighbouring bay. The two-maneuver aisle reservation is unnecessary
with one visitor per center.

## Validation

- Native `traffic/RaceTraffic.test.ts`: all 8 racers are placed. Each advances
  to a later quarter of its own ring and stays within 32px of it after 10s,
  and the grid survives a reload.
- Native `traffic/ShoppingVisits.test.ts`: a full trip through every phase,
  with a reload while shopping (the phase is restored and no stale shopper
  remains). The car ends back on the boulevard lane with a route.
- Full native suite: 4,648 of 4,660 pass. The 12 failures are the same stale
  race-tune expectations in `OriginalVehicles.part1–3` from commit `5e705fe6`.
- Production-build Chromium capture of both new lab fixtures: racers lap the
  oval in mesh rendering, and the visitor turns into the lot; no page errors.
  All six `tests/vehicle-geometry.spec.ts` cases pass.
- Typechecks, Biome, knip, inventories and the build pass. The ratchet accepts
  small growth in Realm (+3, admitting shoppers with their car),
  VehicleRegistry (+3, the saved visit), RoadTraffic (+1 complexity) and
  WorldGeometryPage (most of whose growth is `5e705fe6`'s jump park).
  `FootstepSystem` and `WorldGeometryCandidate` still exceed their baselines
  from other recent commits.

Not measured: a crowded speedway on a phone; generated-city lots with shop
scenery in the lab.

## Next

Owner play review of all restored behaviors (222, 224, 225) in the game and the
vehicle dynamics, racetrack and shopping labs.
