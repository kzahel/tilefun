# Vehicles: traffic, driving and roof riding

Topic: vehicles
Status: Approved vehicle bank promoted; generated-road traffic, inside driving and passive roof riding delivered in the current regional generator (regional-v13).
Updated: 2026-10-19.

The [vehicle model porting checklist](vehicle-model-porting.md) tracks conversion
of all 45 sprite sets to Blender/GLB assets and their individual engine status.
This is separate from the approved sprite bank and vehicle gameplay behavior.

## Original red sports coupe

[145](../tactical/145-original-coupe-gameplay.md) adds **Red sports coupe** to
Edit → Vehicles and ordinary generated-road traffic, plus the shared Traffic
playground selector. It is `vehicle-v1:rosso-coupe`: an owner-authorized original
alongside the immutable 45-type sprite bank, bringing gameplay to 46 vehicle types.
The exact 2,299-triangle mesh and its matching cardinal fallback share the game
camera; Canvas, disabled/failed/loading meshes preserve the same car. Conservative
82×36×19px bounds and ordinary 84px road admission use existing authority paths;
sporty driving is 156px/s with existing Fast and Reverse controls. Traffic remains
bounded and selected normally, so a coupe need not appear at every road arrival.

## Original Beetle-style compact

[148](../tactical/148-beetle-gameplay.md) adds the owner-accepted Beetle through
the same shared catalog as `vehicle-v1:beetle`, labelled **Beetle-style compact**.
Its exact 2,554-triangle model and matching game-camera cardinal sprites preserve
the reviewed proportions. Measured conservative bounds are 81×38×35px, ordinary
road admission is 88px and its turning radius is 56.7px. It uses gentler compact
handling (105px/s, 180px/s² acceleration) and existing drive/reverse/Fast controls.
The combined roster is 47 vehicle types, 46 eligible for automatic road traffic.
Editor placement also works in existing outdoor worlds without generated roads.
The immutable source bank remains 45 types/180 views.

## Game-camera proportions and contact

[130](../tactical/130-vehicle-game-camera-fit.md) fits all 45 model side heights to
the native sprites under the actual fixed world projection. A static Z=0 registration
keeps tire contacts grounded at diagonals and adds one mesh-only contact shadow.
Travel heading follows displayed forward motion without backwards correction flips;
rest retains diagonal orientation. Roof riders adjust their display attachment only
while the fitted support mesh is ready. Physical bounds, authority and sprite fallback
remain unchanged. Exact [fit inspection](https://tilefun.graehlarts.com/tilefun/assets/models/vehicles/review/game-fit-v2/)
is registered separately from the immutable Blender/model comparisons.

## Editor placement

[128](../tactical/128-editor-vehicle-placement.md) adds **Edit → Vehicles** with all
45 labelled thumbnails. Click/tap clear dry ground to place a parked vehicle in
any outdoor world, including existing flat worlds without generated roads. Its
sprite and ground footprint preview follow the cursor. **Play → Drive car / E**
uses normal driving, speed and lights controls. Vehicles remain parked when the
driver leaves, save their facing/position/lights and occupied seat, and rehydrate
through normal streaming. **Vehicles → Delete** removes the visible vehicle body
and its durable record. No generated-road route is needed for a placed vehicle.

Realm/TrafficSystem owns placement admission and rejects unavailable terrain,
water and whole-body overlap. Placed vehicles use the existing traffic persistence
codec with a parked-placement flag; they do not consume automatic traffic quotas.
The 1,024 resident vehicle budget remains enforced. Indoor editors still accept
furniture only. Native asset bytes and approved physical bounds remain unchanged.

## Grass occlusion

Grass blades that overlap a displayed vehicle now sort below its sprite. The
shared scene collector uses interpolated sprite bounds and visual height, covering
all native views, stationary or driven cars, parked prop cars and trains. Blade
rotation and projection rounding are included; grass outside the vehicle keeps
normal depth ordering. This applies to game and embedded labs on Canvas/GPU,
without changing approved vehicle pixels, body geometry or roof support.
`VehicleGrassDepth.test.ts` covers every model/direction, interpolation and parked cars.
All 180 vehicle review identities remain unchanged. The full browser run passes
531/533; its two car tap-to-drive failures both pass on the isolated staged build
without the pre-existing touch-control edits. Vehicle views, grades and roof
support checks pass; no unrelated touch changes are included in this grass fix.

## Emergency vehicles and driving actions

[117](../tactical/117-ambulance-driving-controls.md) integrates the retained ambulance v2
in the shared game/lab GPU mesh path. Driving keeps action buttons visible on desktop
and touch: hold **Fast / Shift** for 1.6× car speed (1.5× train speed). Ambulances, police cars and both firetruck variants also
have **Siren / L / D-pad Up** to toggle lights and sound, and **Style / K / D-pad Right** to cycle EU-style
two-tone, US-style wail and lights-only. Style selection survives switching off.
These are stylized synthesized sounds; the local Kenney Impact Sounds pack has no siren.
Nearby listeners hear distance-attenuated, panned loops; menus/focus loss stop playback.

Only the inside driver may switch emergency state. Authority replicates and saves
it with traffic; exiting leaves the chosen lights/sound state on the vehicle.
Tagged GLB lenses receive absolute enabled/time state on every draw; Canvas/GPU
sprite fallback adds blue/red emergency or amber warning flashes without changing
approved sprite bytes. No geometry, damage or traffic priority rule changes.
[120](../tactical/120-firetruck-gameplay.md) connects corrected firetruck v2 through
its own GPU resource, bounds, wheel rig and tagged blue lenses. Traffic playground
offers all 45 models and driver action controls through the shared registry in
[122](../tactical/122-complete-vehicle-port.md). Both garbage trucks have silent
**Beacon / L / D-pad Up** controls. Raised firetrucks use their own model with the authored
rest pose and remain excluded from automatic traffic; the other 44 types retain
normal road-width admission. All types preserve complete sprite fallback.
Exact model-art review and nonzero steering/equipment-motion qualification remain open.

## Rolling steering

[144](../tactical/144-rolling-car-steering.md) makes driven cars turn with signed
rolling distance. Directional input still aims the car; forward travel curves
toward that bearing, while backing reverses the steering effect. Release brakes
along the nose. There is no stationary pivot or sideways velocity. Turning radius
uses the approved body's length, with a 40px minimum; long vehicles turn wider.
Cars keep their nose through zero speed and while parked, including reload.

One optional float32 `vehicleHeading` belongs to shared authority/prediction.
It is replicated through baselines/deltas, restored before replay and persisted
in traffic records; older records fall back to saved cardinal facing. GPU meshes
use this bearing, with shortest-arc local/remote presentation interpolation and
signed wheel travel. Sprite fallback and collision still use approved cardinal
views/footprints. This is rolling motion, not rotated collision geometry or
animated front-wheel steering. Automatic route traffic and trains retain their
existing motion owners. Game, web, Deck and embedded labs share the same rules.

## Shared reverse driving

[140](../tactical/140-shared-input-ux-and-reverse.md) adds held Reverse (paddle,
R key or LT) through the existing binary command, shared authority and prediction.
It backs along the nose without steering input; directional input now follows
the rolling-steering contract above. Speed is half base speed, without boost. Release brakes normally.
The ordinary collision, gentle push, roof-rider and terrain-readiness gates remain
shared by game and embedded labs. Replicated facing keeps sprite/GPU noses forward
and GPU wheels roll with signed backward travel. Gear state is not saved.

Jump and Throw no longer toggle emergency actions while driving. The shared named
paddles and Y/E interaction hints are the same on web and Deck; only input-source
hints change. Traffic inspection uses R, L and K too.

## Horns, driving personality and gentle contact

[135](../tactical/135-vehicle-horns-speeds-and-pushing.md) adds **Horn / H** on
screen while driving, including desktop mouse and touch. Trains label it **Whistle**.
Hold H or the screen button to sound the horn continuously; release to stop.
The horn remains separate from emergency Siren/Style/Beacon controls. Authority
verifies the driver and relays transient start/refresh/stop events, vehicle identity,
position and car/heavy/train voice to nearby co-op clients. Held input refreshes
at 200ms intervals; audio keeps one uninterrupted voice per vehicle. Releasing,
leaving the seat, menus and focus loss stop playback. Authority expires abandoned
holds after 600ms; browser voices also expire without refresh, including on a lost
connection. Horn state is not saved. Traffic lab uses the same command, Worker
event and browser audio; other scenario hosts can consume the shared event.

Shared gameplay profiles set ordinary driving speed and acceleration independently
of approved art/collision banks. All retain held Fast (1.6×):

| Source model family | Base speed (world px/s) | Acceleration (world px/s²) |
| --- | ---: | ---: |
| Compact | 112 | 224 |
| Sedans and cars 7–13 | 120 | 224 |
| Cars 14–20 | 128 | 250 |
| Lower sporty cars 21–26 | 156 | 300 |
| Police | 144 | 280 |
| Ambulance | 112 | 180 |
| Buses | 88 | 120 |
| Firetrucks | 88 | 104 |
| Garbage trucks | 80 | 104 |

Driven cars gently push players and movable actors/balls; automatic road traffic
continues yielding. All trains share the contact planner on straight and curved
services. Gentle push speed is capped at 40–44 for light cars, 64–72 for heavy vehicles
and 80 for trains. Heavier vehicles can move heavier actors. Vehicle speed slows
at contact rather than adding a launch impulse; voluntary walking/jumping velocity
remains intact. Props, parked cars and other fixed bodies stay fixed. These pushes
introduce no damage, chain pushing, unsafe ground drops or wall squeezing. All body,
push and roof-passenger plans must pass before committing any position. A blocked
person/object stops the vehicle. Roof riders remain moving-support passengers.

Prediction uses the same car planner and private contact-body copies during
unacknowledged movement/replay, replacing them at authority reconciliation. It
never writes pushed positions into the replica. Autonomous parking maneuvers keep
their commanded speeds and pedestrian-blocking policy. Train service speeds and
rail/body/roof geometries retain their existing contracts.

## Small-animal roadkill

[143](../tactical/143-small-animal-roadkill.md) adds the owner's authorized exception
to gentle contact: driven cars and all trains run over eligible small wildlife on
moving body contact, at any speed and in reverse. The [wildlife topic](wildlife.md#small-animal-roadkill)
owns the species/protection and saved-remains policy. Terrain, other bodies and
passengers must all pass before a planned death commits. Automatic road traffic
and parking retain yielding. Private prediction removes only collision copies;
game and embedded labs share authority and flattened/fading Canvas/GPU rendering.
Full unit/browser and streaming readiness checks pass; 143 records the evidence.

## Player driving

[Inside-car prediction evidence](../research/car-driving-prediction-jitter.md)
reproduces the owner's slight-snapping report and records the shared-authority
fix. Cars now integrate consumed input commands only; short delivery gaps hold
the authority pose, preventing delayed commands from adding a second interval
of travel. Explicit release commands still brake, and the genuine 250ms
stale-command deadline stops without extra displacement. Disconnect parks
immediately. Eighteen native simulation regressions cover game/lab shared owners;
the pure 30/60Hz authority / 120Hz presentation gate passes. Train missing-input
braking remains service-timed. Collision, roofs and approved art are unchanged.

[Tactical 087](../tactical/087-player-driven-cars-and-trains.md) delivers the
owner's 2026-10-10 choice: explicit **Drive car · E** beside a stopped car,
with the player hidden inside after authority grants the seat. One driver owns
the car; other players can still walk/jump onto the roof and ride visibly.
WASD/arrows or the movement stick steer rolling turns, including normalized diagonals.
Native cardinal views follow the heading with a small facing switch margin.
In **Tap to move**, tap a destination to steer there without pathfinding;
arrival, obstacles and menu/focus changes stop the car.
In **Hold to move**, steer toward the held finger and lift to brake;
[touch movement](touch-movement.md) owns contact priority and cancellation. Cars keep whole-body,
terrain readiness, dry ground, grade and roof-passenger clearance checks.

**Get out · E** stops first and searches clear supported ground beside the body.
If no exit fits, the driver stays inside with an explanation. Cars released on a
usable generated lane resume traffic through a short validated road connector,
without teleporting. Off-road cars remain parked at their actual position and
are saved across unloading/reopening. There is no abandoned-car deletion policy.
Saved driver seats restore by vehicle identity. Editing, explicit travel,
deletion and disconnect release ownership; stale input brakes.

Game and traffic/world geometry labs use the same Realm authority, predictor,
vehicle prompt and scenario controls. No art bank or geometry approval changed.
[132](../tactical/132-parking-shopping-visits.md) adds bounded shopping visits
through the shared Realm ParkingSystem: reserved bays, up to two car maneuvers,
shoppers walking to storefronts and returning before departure, native collision
and saved trip phases. Generated cities and the playable lab now share normal city
planning and road traffic diversion, with one visitor per center. [134](../tactical/134-parking-as-city-terrain.md)
unifies the lab and terrain rendering. General parking allocation and player
passenger seats remain later work. [Trains](trains.md) owns whole-service track control.

[Vehicles in Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/vehicles)
is the review entry point, linked from the sidebar, All tools and the global
Vehicle geometry batch. It registers all 180 directions across 45 sets (including
two fire-truck ladder states), even with no feedback. The original
[source audit](../research/road-vehicles.md) owns provenance. The agreed
[traffic and roof-riding plan](../tactical/017-generated-road-traffic-and-roof-riding.md)
owns implementation sequencing and acceptance.

## Intersection queues

The 2026-10-18 traffic-jam investigation reproduced permanent four-approach
queues and a turning car trapped by a waiting approach after save/reload.
TrafficSystem now checks the actual directional vehicle footprints over a full
vehicle length of exit instead of a padded rectangle that can include opposing
traffic. Queued approaches retain the configured safety gap outside the junction,
leaving room for the collider's direction change during left turns. Flat-road
queues saved inside that gap can ease backward at up to 8px/s to yield to the
junction owner, with live body/road/prop checks and the normal passenger plan;
a blocked rear stays stopped. Exclusive
junction ownership and road, prop, pedestrian and vehicle checks remain enforced.

Exit failures retain their actual reason: a missing road or prop obstruction can
use the existing three-second alternate-turn search instead of waiting forever
under the generic junction label. Occupied exits continue yielding until clear.
This is shared authority behavior for the normal game and embedded traffic labs;
no generated worlds, saved route format, vehicle geometry or approved art changes.

`TrafficJunction.test.ts` checks four simultaneous approaches on 4-, 6- and 8-tile
roads, with left, straight and right turns, continuous non-overlap, occupied-exit
release, rerouting around a missing exit road, recovery of old close-stopped
queues and rear-pedestrian safety. `ScenarioTraffic.test.ts` also
checks four competing queues through production Realm persistence/reload.

Validation: typechecks, all 2,735 unit tests, lint and the production build pass.
The full bundled-Chromium run passes 658/659; the lone train renderer-switch
assertion passes on an isolated rerun against the same build. All traffic,
driving, parking, grade and roof-riding browser checks pass. Inventory regeneration
changes seven explicitly excluded interactive scenario fingerprints and the input
digest; approved art identities remain unchanged.

## Agreed gameplay direction

Gentle autonomous traffic uses procedurally generated roads only: mostly city
circulation, with occasional intercity trips. Cars keep spacing, yield at
intersections and stop for players/animals without collision damage. Painted
roads and ordinary passenger seats are deferred. NPC shopping visits are available
in generated city centers and the Parking lot lab, using existing road cars.
Player driving in 087 can leave generated roads for clear dry ground.

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
  the larger current cities now provide a connected 8-tile outer boulevard
  and central avenues, so it can circulate there. Compact villages still limit
  admission by their actual onward street widths.
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


The larger-city checkpoint in [083](../tactical/083-farms-town-pets-and-larger-cities.md)
requires at least three completed junction choices for every admitted family,
with a bounded 300-second simulation window. Forty-four families now complete
this production-road roof-riding test; raised-ladder traffic remains excluded.
The outer boulevard fixes a wide-vehicle dead end exposed by the larger grid,
without changing traffic AI, vehicle bounds or promoted art.

## Complete authored vehicle bank

[122](../tactical/122-complete-vehicle-port.md) completes all 45 own-model
registrations without changing the approved physical source bank. Shared game/lab
presentation rolls every declared wheel by `-distance/radius`, including the two
garbage middle axles; steering is neutral and ladder/loader equipment stays at its
authored rest pose. Every latest visual body clears actual tire/hub rotation
cylinders at neutral steering. These visual proofs do not change collision proxies.

Ambulance, police and both fire trucks accept driver-only persistent siren state
0–5: enable bit plus lights-only/EU/US style. Green and orange garbage accept only
0/1 silent amber beacon state; style commands have no effect. L / D-pad Up / touch toggles the
lights; K / D-pad Right selects a siren style only on siren vehicles. The traffic lab uses
the same shortcuts, suppressing repeated keydown toggles. Both Canvas and GPU
sprite fallback keep colored flashing, and loaded GLBs pulse named lens materials.
Audio never creates a siren for warning trucks. Wrong drivers/editor mode cannot
change state; saved invalid state is rejected before publishing any vehicle.
Explicit raised-ladder vehicles can save/restore and drive in the lab; automatic
traffic still selects the existing 44 admitted source families.

Next: exact production model art review and gameplay playtesting; any animated
steering or equipment motion requires its own clearance qualification.


## Racetrack traffic

[138](../tactical/138-city-outskirts-racetracks.md) gives eligible generated cities
eight durable sports cars on two closed oval lanes. Their ordinary TrafficSystem
routes carry lane-specific race speeds while retaining body collision/braking,
roof support, player driving, streaming and saved identities. Ordinary traffic
has no graph connection into the circuit. The shared natural-landscape playground
exposes the same generated track and real population, with Canvas/GPU inspection.

## Shopping visits

[133](../tactical/133-generated-shopping-centers.md) connects native road compacts
to generated city shopping centers. Each center admits one visitor, keeps the same
car and durable traffic identity throughout the shopper cycle, then uses the
checked actual-pose road connector to resume traffic. Shopper/car phases survive
save and streaming reload. Occupied shopping seats cannot be taken over.
Eighteen native parked compacts per center use durable placement/edit semantics.
Playable parking labs use the shared GPU/mesh default and native parked bodies;
explicit sprite renderer choices retain their fallback.
