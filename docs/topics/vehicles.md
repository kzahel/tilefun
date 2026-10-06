# Vehicles: generated traffic and roof riding

Topic: vehicles
Status: Approved vehicle bank promoted; generated-road traffic and roof riding delivered in the current regional generator (regional-v13).
Updated: 2026-10-04.

[Vehicles in Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/vehicles)
is the review entry point, linked from the sidebar, All tools and the global
Vehicle geometry batch. It registers all 180 directions across 45 sets (including
two fire-truck ladder states), even with no feedback. The original
[source audit](../research/road-vehicles.md) owns provenance. The agreed
[traffic and roof-riding plan](../tactical/017-generated-road-traffic-and-roof-riding.md)
owns implementation sequencing and acceptance.

## Agreed gameplay direction

Gentle autonomous traffic uses procedurally generated roads only: mostly city
circulation, with occasional intercity trips. Cars keep spacing, yield at
intersections and stop for players/animals without collision damage. Painted
roads, player driving, parking, shop visits and passengers entering/exiting cars
are deferred.

A player can stand in front of a car to stop it, jump onto its roof, and ride
away when the road is clear. The roof is a moving support surface, not a driver
seat. A roof passenger does not itself stop the car and can walk or jump off;
an airborne player in front of the bumper still needs safe clearance. Carrying
a player keeps the vehicle active across streaming and intercity boundaries.

The first playable milestone combines neighborhood traffic with this complete
roof-riding interaction. The next review is of behavior scenes and tuning, not
another per-view approval round. The user requested implementation on 2026-10-03.

## Reviewing

Choose a vehicle, then north/east/south/west. Each direction has its own review.
The diagram shows the native sprite crop, ground bounding box, physical height,
anchor and sorting line. One grid cell is 16 world pixels. The ground box has
editable X, Y, width and depth; physical height is a separate value above the
road. Anchor and depth sorting are in the expandable controls. These are
hand-selected family proposals; the saved approved snapshots include any human
edits; the exact approved set is now pinned in the separate vehicles-v1 gameplay bank.

The walker uses a memory-backed Realm in a Worker, the gameplay client predictor
and production prop renderer. See [Gameplay scenarios](gameplay-scenarios.md).
Use arrows/WASD on the focused scene or the on-screen direction buttons to test
walking around, in front of and behind the vehicle. The diagram's raised pink
box visualizes physical height; Space also exercises jumping and the candidate’s physical height.

**Approve view** saves the exact selected sprite and edited geometry and advances.
**Needs changes** requires a reason; two reports pause this vehicle batch.
**Save geometry / reopen** saves a correction without approving it and reopens a
previously approved view. **Reset to proposal** restores the committed candidate
in the local editor. The Show filter controls Previous/Next navigation; the
vehicle selector and direction tabs always allow explicitly opening another view.
Drafts are per direction and candidate revision and survive navigation/reload.
The shared Workshop outbox handles offline retry and pending-save status.

## Identity and ownership

- `src/assets/vehicles/VehicleCatalog.ts` combines the exact source audit with
  proposed family geometry. It does not register runtime factories or change
  existing parked-car props, generators or promotion banks.
- Three new candidate crops remove one stray top row from the police west and
  ambulance side rectangles. Original source pixels and audited rectangles remain
  intact. These crops were included in the completed human vehicle review.
- `VehicleDiagram.ts` is shared by the manifest and UI. Each candidate fingerprint
  pins the verified source PNG, directional definition, geometry and diagram pixels.
  The UI checks its render against the manifest before enabling submission.
  Both render with a CPU canvas (`willReadFrequently`) so normal Chromium's GPU
  antialiasing cannot falsely invalidate unchanged art. Browser coverage checks
  all 180 fresh view verifications in full Chromium at retina scale, plus rejection
  of a deliberately mismatched fingerprint.
- Authenticated `asset` events include the vehicle candidate ID and fingerprint.
  The server validates the current candidate, exact source rectangle, direction,
  ground box and finite positive height. Saved annotations contain the complete
  edited geometry and base proposal; replies preserve the human decision time.
- Vehicle decisions are scoped independently of ordinary Outdoor asset metadata.
  Changing a candidate definition/source/render reopens its review; resolving an
  agent request or replying does not approve it. Human geometry stays in ignored
  feedback data until explicitly promoted to new committed gameplay identities.
- The fire-station building and garage truck fragments remain source inventory;
  the vehicle batch does not imply a prepared enterable fire station.

## Validation and next work

Unit coverage checks complete directional inventory, clean candidate crop
provenance, actual finite-height collision, exact edited approvals across service
restart, stale/invalid submissions and review invalidation. Browser coverage checks
inbox discovery, four-direction selection, geometry persistence, real walker
collision, phone layout, offline retry, required reasons and two-report pause.
Existing review identities are compared during delivery to protect approvals.

Delivery checks: all three typechecks, 1,224 unit tests, lint and production build
passed. The 260-test browser run passed 259; the remaining assertion expected the
old 16-tool index. After updating it for Vehicles, all six vehicle/tools-index
checks passed, including oversized numeric input, offline saves and review pause.
All 327 previous candidate identities are unchanged. Desktop/phone previews were
inspected; the live deployment serves the 180-view manifest and the live local
review renders with enabled controls and no page errors. Test feedback used only
isolated data; no human approvals were written.

Approval verification fix: reproduced false appearance changes in full Chromium
(headed and headless) while the headless shell matched the manifest. Explicit CPU
rasterization restores parity without changing any of the 507 existing candidate
fingerprints. Typechecks, 1,229 unit tests, lint, build and all 265 browser tests
pass. The live first compact-car view now enables approval in full Chromium.

Human review checkpoint (2026-10-03): the user reported completing the vehicle
batch, and `npm run workshop:inbox` confirms 180 approved, zero unchecked, zero
changed and zero Needs changes. Exact accepted geometry remains in the shared
feedback records; this checkpoint does not promote the original default proposals.
The user subsequently explicitly confirmed geometry approval as well and agreed
the generated-road traffic/roof-riding scope above. No additional approval clicks
are needed for unchanged snapshots. Roof support areas and turning behavior are
new implementation concerns, not evidence that the approved bounds need re-review.

## Runtime contract

- Choose **Procedural regional** for a new world, or open the
  [Traffic playground](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/traffic).
  The playground uses the gameplay controller, generated terrain, props, renderer
  and shared player physics. Stand ahead, jump toward the stopped car, ride and
  jump off; a bus shares the wide avenue. Preview speed/gap sliders do not save
  world settings. Keyboard and touch controls are provided.
- `vehicles-v1` pins all 180 exact human-approved snapshots, including saved
  geometry, candidate/metadata fingerprints and decision provenance. Its 45 native
  four-view sheets are padded to a common ground-center reference. Builds only
  verify pixels/geometry against the source; they never regenerate this bank.
  Compact/sedan/police east/west source labels face opposite their headlights:
  runtime direction selects the opposite approved side frame, without mirroring.
  The raised ladder pose remains available art but is excluded from traffic.
  The folded ladder truck is admitted only where the onward street widths fit;
  it cannot circulate in the tested city network.
- The current regional generator composes traffic with connected dense-neighborhood
  terrain. Retired regional saves use explicit same-seed recreation; see
  [city generation](city-generation.md).
  Semantic city street and regional corridor plans generate right-hand
  lanes, split junctions and width-limited turns. Painted asphalt creates no lanes.
- Realm owns movement at 36 world pixels/second (24 through turns), gradual
  acceleration/braking, footprint sweeps and exclusive junction reservations with
  clear exits. Cars stop for road-level players, animals, props, edited or unloaded
  road and other cars. Nearby spatial queries bound obstacle work. Blocked turns
  can choose another clear legal exit; otherwise cars wait safely.
- Roof support covers the current approved body footprint, including its front
  and rear. The former small central support let walkers fall into the solid
  hood/trunk and become trapped; shared server/prediction support fixes this. Shared server/prediction physics carries the
  rider, permits relative walking, and inherits full vehicle velocity on a jump.
  [Shared airborne momentum](../research/airborne-support-momentum.md) now preserves
  that departure contribution through flight while platformer steering changes
  voluntary motion; landing converts to new-roof-relative walking, and collisions
  clip blocked passive components. Native car replay controls exercise the same code.
  A nearby-vehicle hop assist makes approved roofs reachable with Space; ordinary
  jumps elsewhere retain their settings. Height checks keep a low airborne player
  blocking the car until their feet clear its body. Roof passengers never mount,
  steer or suppress normal obstacle braking. Rendering sorts riders over bodies.
- Traffic is capped at 12 vehicles per player and 32 per realm. Spawn checks exclude
  every visible camera range and nearby players. Vehicles farther than 2,200px
  from all players retire only offscreen, with a 30-second repopulation cooldown.
  Network caching is bounded. Nearby passengers request a three-chunk halo even
  with the camera elsewhere; this preserves support across corridor boundaries.
- Saves retain bounded vehicle identity, route/path progress and next turn. Reload
  rebuilds reservations and resumes from rest; roof riders restore by vehicle
  identity and relative position. Disconnect removes the passenger without
  removing the car. Invalid saved route records are discarded safely.

The implementation and validation record is in [Tactical 017](../tactical/017-generated-road-traffic-and-roof-riding.md).
Next: playtest the Traffic playground and a current regional world for density, turning poses,
roof size and jump feel. Parking, destinations, boarding and player driving remain
separate work; no new art/behavior approval has been inferred from implementation.

The Traffic playground now runs `TrafficRecipe` through `ScenarioSession` in a
Worker, with binary replicas and normal player prediction. All four walk-off
edges, braking and roof rides are covered by real-Realm integration tests.

## Isolated 3D artwork experiment

[Car projection lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/car-projection)
uses the exact approved `vehicle:compact-1:east` source (visually left-facing),
with an explicit body-only crop, on fitted 3D surfaces. It can orbit in perspective
and overlay the unchanged approved 56 × 20 × 24 collision box. Orthographic side/top
presets now expose the corrected vertical side, grounded tire pixels and closed
top seams. The fitted visual roof is 21 pixels high; approved physics stays 24.
The visual shell
is an unapproved approximation, not new physics or a replacement vehicle bank.
Hidden faces are marked; near wheels remain part of the painted side.
[3D assets](3d-assets.md) owns reconstruction and follow-up direction; the user
subsequently found top-view appearance unacceptable despite passing coverage
checks. [Rendering architecture](rendering-architecture.md) owns the engine boundary;
[037](../tactical/037-car-projection-experiment.md) records initial validation and
[038](../tactical/038-car-proxy-orthographic-checks.md) records the inspection fixes.

## Authored vehicle grades

[Vehicle grade proof](../tactical/064-vehicle-grade-proof.md) adds opt-in surface
following to the production TrafficSystem. World geometry offers car bridge and
underground garage fixtures, both directions and slope save/reload. Full collider
footprints use shared terrain/excavation support; vertical body clearance includes
roof passengers. Height is persisted in traffic records (older records default to
zero). Generated traffic keeps its existing flat-road behavior. This is a level
chassis proof on straight terminal lanes, not pitched car art or multi-level
junction routing. Human review is pending; train grades are the next consumer.

## Shared prediction checkpoint (2026-10-05)

[Player prediction](player-prediction.md) owns the shared timing correction and
[implementation evidence](../research/shared-prediction-fix.md). Cars/trains carry
roof passengers once per committed pose; prediction replays relative walking and
camera/body/lab overlays bind to the same support presentation. Native geometry,
clearance and saved support identities remain authoritative. Collision proxies and
bounded residual display correction share game/lab engine owners.
