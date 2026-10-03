# Generated-road traffic and roof riding

Status: agreed plan, 2026-10-03; implementation has not started.
This is a parent sequencing plan. Recording it does not authorize starting
gameplay implementation. [Vehicles](../topics/vehicles.md) owns continuing status
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
Record results here when delivered; no gameplay acceptance evidence exists yet.
