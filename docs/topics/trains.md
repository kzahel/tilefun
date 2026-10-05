# Generated railways, stations and trains

Topic: trains
Status: generated two-city trains, broad curves, cached pixel tracks and saved roof riding delivered; loops remain authored lab fixtures.
Updated: 2026-10-05.

Owns generated railway networks, town stations, train services, railway structures
and art suitability. [Vehicles](vehicles.md) owns delivered road traffic;
[city generation](city-generation.md) owns regional revisions and promotion.

## Requested direction

The user clarified that railways should be generated infrastructure like roads:
connect town stations, carry trains in both directions, and eventually include
long predominantly horizontal routes and separate high-speed lines. Forks,
station operations, bridges and tunnels belong in the plan from the beginning.
Player-built railways are not the requested feature; the initial editor/shuttle
proposal has been replaced. The preview review was accepted in chat, followed by explicit authorization to
integrate and commit the first two-town service on 2026-10-04. This does not
authorize unreviewed new art/geometry.

## Earlier review gate (superseded for the 2026-10-05 integration)

The user explicitly requires reviewing tile patterns, plans and actual moving
trains before railway integration into the overworld. Build isolated Workshop
previews first; do not advance from a source inventory or agent inspection to
overworld implementation. The review must show each proposed train travelling
east, west, north and south, with the correct native composition, rail alignment,
scale, carriage joins and stop/reversal behavior. Static pictures alone do not
satisfy the movement review.

Also present repeated track patterns, paired tracks, junction/crossover motion,
station layouts and town/network plans, plus bridge/tunnel scenes for structures
intended for the first integration. Missing or visually unsuitable directions
remain explicit gaps. The user can approve a narrower scope; do not silently
substitute an unreviewed train, orientation, pattern or structure.

Register the proposed review batches/candidates in Workshop, including zero-event
items, and provide live review links. Record exact user decisions against source,
recipe, geometry and relevant motion-scenario revisions. Changed review content
returns to review; tests and agent replies never count as approval. Overworld
integration waits for explicit acceptance of its layouts and all art/motion it
will use. Existing art-review pause rules still apply.

## Proposed network

- Paired directional tracks for local town-to-town service; through stations
  stop trains without reversing them.
- Separate express corridors serving selected hubs, with passenger interchange
  to local platforms. Do not initially mix fast and stopping services on one pair.
- Real termini use a double-ended train and a reserved crossover/turnback throat
  to reach the outbound track. Avoid lane teleportation or mandatory turning loops.
- Branches have explicit turnouts and conflicting movements. Two parallel tracks
  do not require a bridge; terrain, roads/pedestrians and crossing rail movements
  determine where separated heights or reserved at-grade junctions are needed.
- Town streets, station entrances, platforms, structures and approaches are
  planned together before buildings occupy their space.
- Long corridors continue deterministically across region owners; bounded services
  and residency avoid keeping an entire world-spanning route active.

These are design recommendations awaiting layout/geometry evidence. Passenger
boarding at a stopped station is the proposed first interaction; roof riding is
optional and does not replace usable station access.

## Evidence and open constraints

Horizontal/vertical straight rails and four rounded 90-degree corner sprites
exist in the inspected Modern Exteriors pack. Trains have horizontal and vertical
end/body pieces; no intermediate turning poses were found. Tight rail corners
versus long carriage crops require a visual bend/crossover experiment. The named
index lists tunnel pieces, but a complete assembled railway bridge/tunnel/station
kit has not been audited.

Current regional roads reject water crossings; finite-height prop surfaces alone
do not establish stacked railway/road/tunnel support. Shared terrain/physics,
render ordering, portal occlusion and rider behavior need explicit prototypes.
High speeds also require longer braking and ready-terrain lookahead, bounded
replication and measured mobile traversal, not just faster movement.

[Tactical 023](../tactical/023-generated-railways.md) owns the parent sequence,
source coordinates, station/structure choices, generation and service contracts,
acceptance cases and remaining decisions. Major gates are layout study; art and
geometry feasibility; generated two-town local service; structures and branching;
then long trunks and express service. [Preview slice 025](../tactical/025-railway-workshop-previews.md) supplies the isolated review cases; [first integration 036](../tactical/036-first-generated-railway.md) records the delivered narrow slice.

## Boundaries and next work

Use shared server authority, replicated rendering and the current shared
persistence/residency contract. Existing vehicle approvals do not cover train
or structure geometry. New exact candidates follow [art review](art-review.md);
promoted banks and exact review snapshots remain immutable. Railway integration
composes the current generator. The active greenfield policy permits changes
without version bumps and treats development saves as disposable; see
[city generation](city-generation.md).

## Review entry points

Open [Railway previews](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/railways):
32 candidates across track patterns (4), directional trains (20), plans/motion
studies (6), and bridge/tunnel studies (2). Pause, slow, scrub or restart moving
scenes; direction links open independent train reviews. Geometry and cutaway
controls are view aids, not changes to the registered candidate.

Five families retain native source pixels. Orange uses two end cars in each axis
because no vertical middle piece was found; the other proposals use three source
sections. Turns and crossovers expose cardinal-pose gaps/popping rather than
claiming solved articulation. Station/network/bridge/access shapes are explicitly
schematic where a complete art/physics kit has not been verified. Tunnel cornice
art is native; surrounding terrain/collision remains a proposal.

Workshop verdict records remain unchecked: chat acceptance is recorded separately,
and no agent has manufactured review events. New structures, directions and changed
pixels still require review.


## Delivered first service (regional-v13)

Canonical east/west owner pairs can receive a straight single-track line, two
north-side platforms and paved paths to the towns' southern center streets.
Admission rejects wet approaches and unsupported road conflicts; the current
greenfield slice allows one isolated straight road bridge per line. No town buildings
are moved. Some seeds have no eligible line in the bounded starting search;
those retain the normal town start. Seed 2026 starts at tile **2543,-2662**,
beside a line to the second station at **3422,-2658**.

One native blue double-ended three-section train serves each admitted line. It
accelerates to 192 px/s, brakes at the ends, dwells eight seconds and reverses
without mirroring the horizontal artwork. The whole 456px body is represented
in collisions; players/props, edited-away rails and missing ready terrain stop it.
Stations have native platform edges and benches, a lamp and bin. They are basic
outdoor platforms. Roof boarding is delivered below; station buildings remain later work.

Shared Realm authority owns motion in Worker, P2P and dedicated-server hosts.
Each service saves its location, destination and dwell in one `railServices`
record. An explicit deletion persists. At most four nearby services are active;
only the train footprint and braking halo request extra ready chunks. Leaving a
line freezes and saves its service before removal; returning at either station
restores the same train with no wall-clock catch-up. Train state is not duplicated
in ordinary entity records. Existing saves require explicit same-seed recreation.

The 2026-10-05 slice below adds boarding/alighting and curved city links. Station
names/destination information, paired tracks and shared junctions remain next work;
high-speed/world-spanning trunks remain later work.

## World geometry prerequisite for expanded routes

In the 2026-10-04 follow-up, the user proposed a town loop with several stops and
grade-separated outgoing roads, then asked for broader terrain/structure design
before implementing tunnels. [World geometry](world-geometry.md) owns the use
cases, including mountain slopes and parking-garage ramps, and the open choice
of constrained surface/sector representation. General solid-volume authoring is
not a settled requirement. Resolve that shared model before selecting the next
bridge/tunnel implementation; railway-specific structure hacks are not the next
step. Station information and boarding remain independent railway follow-ons.

The subsequent [road-over-rail engine proof](../tactical/058-road-rail-crossing-proof.md)
uses the actual horizontal service below a walkable road deck. It validates
clearance and stacked actor ordering without changing regional generation or
claiming train grades, curved-carriage art or an approved bridge kit.


## Per-carriage grade proof

[Train grade lab](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=train-grades#/tool/world-geometry)
and [tactical 061](../tactical/061-train-grade-proof.md) add opt-in authored
horizontal routes with three replicated native sections, separate footprint
support/clearance and a single service record retaining all heights and speed.
The shared Realm/renderer handles each body; dependency terrain is readied before
restoration publishes the group. At this checkpoint generated services remained flat and single-body; the later
city integration uses three native sections on eligible curved routes. Older records remain readable. The user accepted this lab in chat;
carriages stay horizontal, so slope joins expose the remaining articulation/art
gap. Review before selecting one small generated structure crossing.


## Generated road-over-rail crossing

The user accepted the train grade proof and authorized a first generated crossing,
without a generator-version bump. [Tactical 062](../tactical/062-generated-road-rail-crossing.md)
owns admission, streaming/persistence evidence and review links. One eligible
north/south road originally received a 64px deck with two ramps above the flat railway.
The roof-riding integration raises generated decks to 96px with 384px ramps,
leaving 88px beneath the slab for a 44px train and its passenger.
Generated cars use the shared surface-following path; players can walk above
or underneath. The bridge retains schematic lab presentation; no new bridge
art bank is promoted. The user accepted these crossings in chat on 2026-10-04.


## Curved routes and town loops

The user next prioritized train corners and curved inter-town routes. [Tactical
063](../tactical/063-curved-train-routes.md) delivers an opt-in shared-engine path
model with straight sections and tangent circular arcs, separate bogie-following
carriages, closed loops, intermediate stops and persistent distance-based service
state. Both directions, complete loop circulation and mid-bend reload are covered.
This advances the machinery beyond the earlier cardinal-pose art studies.

Review [Town loop](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=train-loop#/tool/world-geometry)
and [Winding inter-town route](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=train-winding#/tool/world-geometry).
Both run real Realm/Worker services with the actual native blue train end and
middle sprites. Each carriage switches horizontal/vertical pose at cardinal
boundaries, like the existing cars. The user explicitly accepts abrupt sprite
turns as the available-art constraint and rejected replacing the sprites with
procedural boxes. Keep source pixels at their native scale; do not substitute
geometric rolling stock to hide missing diagonal poses. Tracks now use the shared cached pixel renderer; platform/town markers in the
authored loop/winding fixtures remain labelled schematic geometry. Straight-section spacing matches
the different native horizontal/vertical lengths; bends can expose gaps/overlap
as individual carriages switch pose.

This was initially a lab-only slice. The user subsequently authorized the
city integration below. Generated loops, curves plus grades, switches and shared
track traffic remain outside the delivered scope.

## City-to-city roof riding integration

On 2026-10-05 the user authorized autonomous end-to-end implementation and
incremental commits, explicitly superseding the earlier pre-integration review
gate for this scope. This is implementation authorization, not manufactured
Workshop verdicts or permission to rewrite frozen asset banks. Native train
sprites remain unchanged. [Tactical 065](../tactical/065-rideable-city-trains.md)
owns this delivery.

Train roofs now use shared moving-roof support, jump assistance, momentum and
support-aware drawing. Authority carries by each committed carriage pose; native
cardinal changes retain the passenger's relative roof position. Both curved and
straight services check passenger clearance before moving. Player records retain
the carriage identity and roof offset; restoration prepares the saved service
before reattaching. The World geometry train labs expose **Ride train roof**.

Eligible dry, road-free two-city services now use broad tangent arcs (512px
radius), straight station approaches and three native carriages. Terrain reserves
the same alignment used by authority. Analytic pixel rails, sleepers and ballast
are baked into the ordinary terrain cache on Canvas/GPU and replicated as bounded
chunk geometry. Saved terrain edits keep their road mask; geometry is derived from
the current generator. Rejected curves retain admitted straight services; accepted
road crossings stay straight. No new art pixels or asset banks are promoted.

Fresh regional seed **2026** starts on the platform at **Willowhaven**. Leave edit
mode with **Tab** if needed, then hold **Down + Space** to board the stopped train.
Ride through the bends to **Willowbridge**, then jump north onto its platform.
Each station dwell lasts eight seconds; the service reverses at the terminus.
Players can walk or jump off the roof, and exact automatic game resume preserves
saved support. Explicit travel still resets support to destination ground.
Use a fresh world or same-seed recreation to see this generation revision.

[Generated city train lab](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=city-trains#/tool/world-geometry)
uses production terrain, stations, train authority and rendering, with extra road
traffic disabled only in the temporary lab. It provides **Ride train roof** and
**Save / reload scene**. The game browser regression boards with ordinary keyboard
input, reopens mid-bend, reaches the second city and alights on both backends.

Next: playtest station boarding and native pose switches, then add visible city
names/destinations before expanding the network. The current service is an
exclusive two-city shuttle; generated loops and shared-track dispatch are later work.

## Finding trains on the map

The in-game map (**G** / **Map · G**) and standalone explorer now display the
production planner's straight and curved routes as purple dashed lines, with
named diamond station markers. In-game **Train stops** buttons center on a
station without travelling. The explorer's **Railways & stops** layer is enabled
by default. Map planning stays in the existing Worker, with bounded owner/feature
budgets and cancellation between owners; broad overview scales omit routes with
other detailed features. This is generated infrastructure, not live train dots
or a timetable, and follows the map's existing generator-overview policy for edits.

Validation on 2026-10-05: typecheck, 1,571 unit tests, lint, asset inventories,
build and streaming readiness passed. All 12 focused map/explorer browser checks
passed, including desktop and phone rail discovery. The full browser run passed
372 of 375 tests; the unrelated door test-clock failure passed on isolated retry.
The remaining two failures are the previously missing frozen fox review archive
files. Desktop and phone captures also confirmed route curves, named stops and
station-centering controls. Next: playtest finding and boarding trains from the
map before expanding the network.

## Deferred service lifetime and active markers

On 2026-10-05 the user requested a written plan, with implementation deferred.
[Tactical 066](../tactical/066-train-lifetime-and-map-markers.md) proposes retaining
a travelling train's own dependency ticket until its next station after player
interest disappears, then parking and unloading. A small world-scoped summary
would show active trains to remote map viewers without replicating their bodies
or loading remote terrain. Bounded admission, blocked trains and save/renewal
races are part of that plan. Current trains still freeze at their exact saved
position on retirement. The immediate task is investigating roof-rider jitter
reported even on straight track at constant speed.

## Roof prediction investigation

The 2026-10-05 investigation reproduced straight, constant-speed jitter in the
real Worker game on Canvas and GPU. Authoritative roof offsets stay constant;
post-replay corrections reach roughly 3.2px because train ticks and player command
ticks carry the rider on different clocks. Uneven input timing reproduces the
same error deterministically; ground walking/idle controls remain near exact.
[Evidence, repeatable probes and proposed support-relative prediction fix](../research/train-roof-prediction-jitter.md)
own the detailed results. No runtime fix has been implemented. The user's
subsequent reproduction-first request broadens this to NPC contact and car roofs;
[player prediction](player-prediction.md) now owns that investigation and its
repeatable baseline. Review a shared timeline design against all cases before
implementing a moving-support fix.
