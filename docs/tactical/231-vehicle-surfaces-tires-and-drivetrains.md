# Vehicle surfaces, tires and drivetrains

Status: delivered for owner play review, 2026-11-09 (slices 1–4). Try Workshop →
**Basic driving · car-surfaces**, or any world's sand, dirt and grass.
Owner request, 2026-11-08/09: give each surface its own handling (roads grippy,
dirt looser, sand harder going), give vehicles different tire types (off-road
tires lose some tarmac traction) and different drivetrains, and extend the
existing jump-dust effect to wheels. Owner decisions: each wheel reads its own
surface; drivetrain and tire type are felt, not shown in any UI; sand must not
be too punishing; new surface types (mud, ice) are deferred.
Builds on the 216 rollover tuning (lowered centre of mass, 1.2 cornering grip,
speed-limited lock). Owners: [vehicles](../topics/vehicles.md),
[physics engine](../topics/physics-engine.md),
[216 dynamic vehicles](216-dynamic-3d-vehicles.md).

## Contracts

- **Pavement is the ceiling.** No tire/surface pair grips more than today's
  pavement values (1.5 drive/brake, 1.2 cornering), so the 216 rollover margin
  holds everywhere. Roads feel grippy because everything else is lower.
- **One shared lookup, no new state.** Each wheel's ground ray already runs in
  the shared physics step. The surface comes from the same `World` (half-tile
  terrain subgrid, road grid, tile height) that authority and client prediction
  both hold, through one shared function. No save, protocol or replay fields.
- **Grass is a mild penalty, sand slows but never strands.** Drag only on sand
  and shallow water, scaled per vehicle so every model keeps a fixed fraction
  of its own base top speed rather than heavy trucks bogging down.
- **Effects are presentation only**, derived on each client from replicated car
  pose/velocity and the same surface lookup; shared by the game and embedded labs.

## Surface classification

Per wheel ray hit, in world pixels:

| Hit | Material |
| --- | --- |
| Another body (transporter deck, car roof) | paved |
| Above the tile's terrain height (ramp, bridge, slab prop) | paved |
| Below terrain height (excavated floor, e.g. a garage; terrain is clipped there) | paved |
| Road-grid tile (asphalt, pavement, rail, race paint) | paved |
| Terrain subgrid: sand / light sand | sand |
| Terrain subgrid: grass | grass |
| Terrain subgrid: light / warm dirt | dirt |
| Terrain subgrid: shallow / deep water | water |
| Playground, curb, unloaded or unknown | paved |

Props have no authored material yet; motocross jump slabs and excavated pits
therefore drive as pavement. A per-surface material field is a possible follow-up.

## Tires × surfaces

Grip multiplies both drive/brake and cornering grip:

| Tires | Paved | Grass | Dirt | Sand | Water |
| --- | --- | --- | --- | --- | --- |
| Slick | 1.00 | 0.60 | 0.50 | 0.60 | 0.55 |
| Road | 1.00 | 0.80 | 0.70 | 0.75 | 0.65 |
| Off-road | 0.85 | 0.90 | 0.95 | 0.90 | 0.75 |

Sustained speed (fraction of the vehicle's base top speed that drag allows on
that surface; 1 means no drag):

| Tires | Sand | Water |
| --- | --- | --- |
| Slick | 0.55 | 0.60 |
| Road | 0.70 | 0.65 |
| Off-road | 0.90 | 0.80 |

Drag is quadratic in rolling speed, per wheel on that surface (two wheels in sand
give half), rated so full engine force balances at exactly that fraction, and
capped at 3× the vehicle's acceleration rating; each wheel's share follows its
load (a skimming wheel barely drags). It acts outside the friction ellipse:
rolling resistance does not consume tire grip.

## Drivetrains and tires

Engine force splits equally across driven wheels, along the chassis' rolling
direction (not the steered wheel direction). Six-wheel trucks' rear drive uses
the middle and rear axles (as before).

| Drive / tires | Models |
| --- | --- |
| Rear, slick | open-wheel-racer, race-coupe, go-kart |
| All, off-road | offroad-jeep, monster-truck, rally-hatchback, pickup, farm-tractor, snowplow |
| Rear, off-road | beach-buggy |
| Rear, road | rosso-coupe, classic-roadster, hot-rod, stretch-limousine, beetle, golf-cart, police-car, car-21–26, buses, school-bus, ambulance, motorhome and every truck (semi, dump, cement mixer, crane, garbage, fire, tow, flatbed, street sweeper, transporter) |
| Front, road (default) | compacts, sedans, car-7–20, microcar, retro-taxi, woody-wagon, delivery/ice-cream/food vans, camper-van, forklift |

Expected feel: rear drive steps the tail out under power on loose ground;
front drive pushes wide and stays tidy; all-wheel drive pulls hardest out of
dirt and sand.

## Slices

1. **Surface physics.** Shared `groundMaterial` lookup; optional
   `PhysicsGeometry.groundMaterial` implemented by the realm and prediction
   geometry; wheel contacts carry their material; per-wheel grip and drag in
   `VehicleChassis`. Absent lookup means pavement (test geometry unchanged).
2. **Drivetrain and tires per model.** One handling table with category
   defaults; chassis drive split by layout.
3. **Wheel spray.** Extend the shared particle system: dirt/sand kick-up while
   rolling, grass bits only while sliding, water spray; colours per surface;
   rate scales with speed/slip; bounded particle budget. Fed by the game scene
   and the lab view from the same observer.
4. **Review course.** A Workshop driving lab with road, grass, dirt, sand and
   shallow-water strips and a choice of contrasting cars.

Deferred: tire tracks (bounded fading decals respecting cached ground
ownership), per-prop surface materials, mud/ice terrain, tire-screech smoke on
pavement, engine/surface audio.

## Validation

Node tests below the browser: classification (terrain, road, elevated,
excavated, unloaded); per-surface feel on flat test geometry (sand equilibrium
speed fractions, dirt sliding versus pavement, off-road beating road tires on
dirt, all-wheel versus rear-wheel launch on dirt); drivetrain force placement;
the 216 tipping/ramp/ledge/recovery/dump/transporter cases unchanged on
pavement; authority/prediction agreement on a painted surface. Effects: Node
test of the observer's emission rules and budget. Typecheck, focused lint,
`art:catalog`, `workshop:manifest`. An independent implementation review
precedes the commit.

## Delivered

- `GroundMaterial.ts` classifies a contact; `PhysicsGeometry.groundMaterial` is
  implemented by `RealmPhysics` and `predictionGeometry` over their `World`.
  `PhysicsScene` looks it up only for static-ground wheel hits.
- `VehicleHandling.ts` owns the tire/drivetrain table and the tire × surface
  grip and sustained-speed tables. `VehicleChassis` scales the friction ellipse
  by grip (budgeting drive's actual components in a steered wheel's frame), adds
  capped, load-weighted quadratic drag and drives the layout's axles.
- `ParticleSystem.observeVehicles` (called by `PlayScene` and `LabView`) throws
  coloured spray from rear wheels: dirt and sand while rolling, grass only while
  sliding, water spray; rate scales with speed and slip; only vehicles within a
  chunk of a view (every split-screen camera); at most two owed bursts after a
  long frame; at most 400 live particles. It samples a body point above each rear
  wheel with 4px height slack for suspension squat and landings.
- `VehicleSurfacesRecipe` (Workshop `geometry:car-surfaces-v1`): road through
  grass with sand, warm-dirt and light-dirt fields; seven parked cars covering
  front/rear/all-wheel drive and slick/road/off-road tires. No water strip:
  open water is a player-on-foot hazard, and the water spray is covered below
  the browser.

Decisions made during implementation:

- **Drive along the rolling direction.** Pushing along the steered front wheels
  strafed a front-drive car sideways on its first tick from rest (lateral grip
  reacts a tick late), breaking the rolling-steering contract (144/216). Front
  drive is felt through the shared front grip budget instead.
- **Quadratic, capped drag.** Linear drag halved road cars' launch in sand;
  quadratic keeps launches brisk (a compact reaches 89% of its sand speed in
  half a second) while keeping the same top-speed fractions. Uncapped, a
  boosted racer arriving at 540px/s decelerated at about 16× its rating; the
  3× cap slows it in about half a second.

Evidence (Node, below the browser):

- Classification: terrain, roads over terrain, props above, pits below,
  unloaded chunks.
- Handling on flat test geometry: sand speed equals each tire's fraction
  (compact 70%, jeep 90%) with a brisk launch; pavement keeps full speed; a
  slick race coupe corners at under 75% of its pavement lateral acceleration on
  dirt while off-road tires hold at least 1.4× that, all under 1.2g; no grip
  table entry exceeds pavement. Drive impulses land on front, rear, all, and
  six-wheel middle+rear (never front) axles as tabled.
- The painted course reads the same surfaces in the authority world and the
  predicting client's replicated world; an ordinary driven compact settles at
  its sand speed in the sand field and keeps full speed on dirt.
- A rollover sweep (all 79 models × pavement/grass/dirt/sand/water × full
  lock/slalom × base/boost, 1580 runs; sand and water entered at speed from
  pavement) had no rollovers, worst lean about 4°; 216 ramp, ledge, recovery,
  dump and transporter cases pass unchanged.
- Spray: per-material emission, grass only when sliding, none when parked,
  airborne, off-screen or on road, sand still read through a landing squat, and a
  200-car crowd fills but stays inside the budget.
- Split-screen prediction (226): the vehicle case's fixed `TICKS/4` cap on
  unpredicted guest ticks was incidental to how far the compact rolls (front
  drive stops 17px further on that slope: 72 ticks). Measurement showed
  unpredicted ticks equal the frames the guest is absent from the host
  snapshot; the test now asserts that relation plus a loose absolute cap
  (absent frames under a third of the run).

Independent implementation review (Opus 5.5, read-only): no blockers. Fixed
from it: excavated floors (the underground garage) had read as dirt; the
ceiling test could not fail (the steering limit masks grip), now checked on the
table; spray flickered through squat/landings (body-point tolerance); drive's
off-axis component on steered wheels was missing from the grip budget; drag
ignored wheel load; per-wheel lookups now read one chunk; spray is culled to
views with a catch-up cap and a lower budget; the 226 test regained an absolute
cap. Noted, no action: authority and prediction scenes can choose different
float origins, so a wheel exactly on a surface edge may read differently for a
tick; ordinary reconciliation corrects it.

Not yet reviewed in play: feel and tuning values, spray look, and the
Chromebook/Deck particle cost with many cars on loose ground.

Next: owner play review of the course and ordinary worlds; then tire tracks
or per-prop surface materials (motocross slabs drive as pavement today).
