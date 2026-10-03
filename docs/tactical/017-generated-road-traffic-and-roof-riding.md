# Generated-road traffic and roof riding

Status: implemented, 2026-10-03, following the user’s explicit implementation request.
The agreed scope below is preserved; the delivery record follows it. [Vehicles](../topics/vehicles.md) owns continuing status
and approval checkpoints; the [source audit](../research/road-vehicles.md) owns
sprite provenance.

## Agreed experience and scope

Gentle autonomous vehicles drive on procedurally generated roads. Most traffic
circulates within cities, with occasional trips between cities. Cars yield to
players and animals, keep space behind other vehicles, and cause no collision
damage. Begin with right-hand travel and simple intersection yielding.

The central playable interaction is:

1. Stand in the road ahead of a car; it brakes and waits.
2. Jump onto the roof.
3. Once the player is safely above its path and other obstacles are clear, the
   car resumes driving.
4. The player travels with it and can walk around on the roof or jump off.

Standing on a roof does not give the player control of the vehicle. Roof
passengers do not themselves make the vehicle stop, but obstacles ahead still do.
An airborne player in front of the bumper is not automatically safe to ignore.

Out of scope for this delivery: painted-road connectivity, player driving,
parking maneuvers, shop visits, people entering/exiting vehicles, bus boarding,
service jobs and emergency behavior. These can build on the same vehicle system
later. Existing parked props remain unchanged. The raised fire-truck ladder is
stationary equipment, not an ordinary traffic pose.

## Approved assets and additional moving geometry

The user approved all 180 directional vehicle views and explicitly confirmed
that their geometry is approved too. Do not request another per-view approval
round for those same snapshots. Promote the exact saved sprite/geometry records
into a new versioned gameplay bank when implementation is requested; preserve
source provenance, edited bounds, physical height, anchors and depth sorting.
Do not silently substitute the original proposals for edited approvals.

Use native north/east/south/west sprites, with smooth path movement and deliberate
facing switches through turns. Maintain a stable ground reference when the crop,
anchor or collision shape changes. Test the four-view look before deciding that
diagonal artwork is needed; never mirror asymmetric bus art.

Ground bounds and physical height are approved. A conservative usable roof area
and the space occupied throughout a turn are additional implementation geometry;
the sprite rectangle is neither of these. Validate these in motion, including
support continuity through facing changes and clearance for long vehicles.
The next human review is a small set of behavior scenes, not 180 repeated clicks.
Changed artwork or changed approved geometry still needs its normal review.

## Runtime design

### Roads, lanes and routes

Derive a directed lane graph from semantic generated street/highway plans and
their actual connections. Do not infer legal lanes solely from rendered asphalt.
Record lane direction, centerline, usable width, legal turn connections,
crossings, stop positions and clearance restrictions. Respect sidewalks, islands
and parking reservations. Confirm which generation revisions expose sufficient
facts for both city streets and intercity connections; unsupported roads carry
no traffic until represented correctly.

Track distance along straight and curved path segments so movement speed stays
consistent. Use local circulating routes with varied valid turns and a smaller
population assigned intercity routes. Large vehicles use only routes and turns
with enough clearance; never shrink their approved geometry to fit.

### Authority and traffic behavior

Vehicles are replicated entities with a dedicated server-owned traffic
controller: lane/path identity, distance, speed, next movement and waiting
reason. The shared Realm simulation owns this in the single-player Worker and
multiplayer; clients interpolate remote movement. Reuse entity, collision and
replication infrastructure, but not the pedestrian route controller's blocked
pause/reverse policy.

Accelerate and brake gradually. Account for the leading vehicle's rear footprint
and enough stopping distance for players, animals and other obstacles. Reserve
conflicting intersection movements before entering and require free exit space.
Wait when obstructed; do not reverse into another lane or teleport to recover.
Use a conservative swept footprint through motion and turns to prevent clipping
or tunneling, particularly for buses and trucks. Signals and more elaborate
traffic priority can follow the initial yielding system.

### Roof support and player movement

Treat the roof as a moving support surface, distinct from mount/driver control.
Carry a supported player by the vehicle's displacement while allowing movement
relative to the roof. Preserve support through acceleration, braking and turns;
reconcile this consistently on the server and predicting client, without applying
the vehicle's movement twice or accidentally entering the existing mount mode.

Obstacle checks consider height and support state: a person on the roadway
blocks the car, a supported roof passenger does not. Resume only when the swept
driving path is clear; beginning a jump in front of a car is not sufficient.
Check roof reachability at the gentle starting speeds and normal jump settings.

On jumping off, inherit a tunable portion of vehicle velocity so the interaction
feels natural. Determine the exact amount through playtesting. Walking off an
edge releases support and uses ordinary falling/landing behavior. Correct depth
sorting should show the player standing on the roof, not behind the body.

### Residency, edits and compatibility

Bound active traffic around all players, with route/chunk lookahead long enough
to brake before unavailable road. A vehicle carrying a player stays active and
requests the road ahead, including across city boundaries. It must not disappear
or unload beneath its passenger. Define stable identities and a bounded offscreen
retirement/repopulation policy; do not continuously simulate every distant car
or spawn/despawn visibly. Detail save/reload and disconnect handling before the
world-integration slice ships.

Road or prop edits invalidate affected routes. Vehicles stop safely and replan;
support for user-painted road networks remains deferred. Do not mutate frozen
generation output, promoted banks or existing parked props. Introduce explicit
new identities/revisions for new generated traffic/output, and keep old saves
compatible. Approval of this plan does not change the default generator.

## Delivery sequence when implementation is requested

1. **Asset and lane foundation.** Promote the exact approved snapshots; define
   directional rendering, roof support and lane/turn geometry for a bounded
   generated neighborhood. Establish authoritative state and replication.
2. **First playable demonstration.** A few cars circulate through that generated
   neighborhood, including an intersection and crossing. Deliver following,
   braking, blocked-exit yielding and the complete stop → jump onto roof →
   resume → ride → jump off interaction. Include a bus on a suitable wide route
   to expose long-vehicle turning issues. Provide a Workshop driving scene using
   the gameplay systems to tune speed, spacing, turning and roof behavior.
3. **Generated-world integration.** Add bounded city traffic populations and
   occasional intercity trips, route/chunk lookahead, edits, lifecycle and
   save/reload behavior. Confirm a roof passenger can travel between cities
   without losing support or encountering unloaded road.
4. **Broader vehicle variety.** Admit approved families as their route clearance
   and support behavior pass the same checks. Player driving, parking, passengers
   and destination activities remain separate later work.

## Acceptance and validation

- Four-view anchor/depth continuity; no sidewalk, island or turn clipping.
- Smooth following/braking; safe conflicting turns and occupied crossings;
  blocked exits do not trap cars across an intersection.
- A stationary player causes a stop; jumping in front does not trigger an unsafe
  restart; a supported roof passenger alone never causes a stop.
- Roof walking, acceleration, braking, turning, jumping and falling off work
  without jitter, accidental driving control or loss of support at a pose switch.
- Two clients agree on traffic and roof passengers; local supported movement
  remains responsive through prediction/reconciliation.
- Road edits, chunk boundaries, intercity riding, unload/reload, save/reload and
  passenger disconnect/removal preserve safe, bounded simulation.
- No fabricated approvals or changes to frozen banks/old generation output.

Use focused unit/parity tests, isolated bundled Playwright Chromium gameplay
scenarios and full Chromium visual checks. Run typechecks, unit tests, lint,
production build and browser suite; regenerate art catalog/Workshop manifest
when their render inputs change. Run `npm run streaming:bench -- --assert-ready`
for the execution/residency work and measure traffic with and without passengers.
Record results here when delivered.


## Delivery record (2026-10-03)

Delivered `regional-v11`, the immutable `vehicles-v1` sprite/geometry bank,
server-owned traffic and the Workshop Traffic playground. All 44 driving poses
are prepared; spawning admits only models with a usable onward route. The folded
ladder truck cannot traverse the narrower onward streets in the tested city
network, so it stays out of that traffic population. Raised ladder equipment is excluded.
The [vehicles topic](../topics/vehicles.md#runtime-contract) owns runtime limits,
controls, persistence and tuning. Existing generation output/defaults are intact.

Implementation findings:

- Native side-frame labels on compact cars/sedans/police were reversed relative
  to visible headlights. Mapping travel facing to the exact opposite approved
  side fixes this without pixel or geometry changes.
- Normal jump apex was below the approved 24px compact roof. A local vehicle hop
  assist solves reachability without lowering human-approved physical heights.
- Corridor/city plan seams created tiny fake junctions. Merging collinear
  degree-two seams preserves continuous intercity routes. Turns retain node
  reservations until the entire vehicle clears them.
- Conservative shared roof bounds maintain support when a four-view sprite and
  ground footprint change direction. Full support velocity is inherited on jump;
  these feel/geometry choices are ready for human motion review.

Focused evidence covers stopping before a child, low airborne obstruction,
normal jumping onto a stopped car, acceleration/turning on a roof, jumping off,
competing cars/buses at junctions without overlapping, edited/unloaded roads,
replica snapshot/delta geometry, matching two-client prediction and saved route
restoration. A real Realm test carries a rider, flushes/reloads the world,
restores the same vehicle/support offset and disconnects the passenger safely.
A generated neighborhood sweep confirms circulation and roof continuity for all
43 road-compatible models, including buses and garbage/fire trucks.
A generated-terrain journey advances 50,000 fixed steps across a highway and
back into city streets (11 turns, 18,625px displacement), keeping roof height
24 throughout and loaded chunks below 150. An additional ten-minute generated
city traversal completed 25 turns with stable support.

Browser checks exercise the actual stop → jump → land → drive → jump interaction,
phone controls/layout and v11 world creation/reload through the single-player
Worker. Desktop and phone playground screenshots were inspected. No test wrote
human approvals. The bank verifier confirms all 180 approved native crops and
metadata hashes.

Streaming readiness passed for regional-v4, v10 and v11 using isolated bundled
Chromium. Walking, sprinting and reversal had no missing terrain or incomplete
visible cache frames. Detailed [local streaming report](/tmp/tilefun-traffic-streaming/report.json).
This is desktop evidence, not a phone performance claim. A separate two-minute
simulation measurement (generation/rendering excluded) recorded p95 physics and
traffic steps of 0.033ms roadside with 3 cars and 0.123ms riding with 12 cars;
peak loaded chunk counts were 81 and 130. These are different populations, not
an isolated estimate of passenger overhead.

Final validation used an export of the staged traffic changes, keeping concurrent
Character Lab work outside the commit. All three typechecks, 1,261 unit tests,
lint (existing warnings only) and production build pass. The full browser run
passed 270 checks with one existing skip; its standalone check reached an orphan
server from an earlier run and passed on an isolated rerun after that server was
removed (271 passing browser checks total). The final v11 streaming rerun after
route-width admission changes again passed readiness with no missing/incomplete
visible frames during walking, sprinting or reversal. Art inventory and Workshop
manifest were rebuilt; all 507 prior candidate records/fingerprints are identical.

Next human check:
play the Traffic playground and a v11 world, particularly bus turns, roof walking
and jump feel. The default world revision remains v4.
