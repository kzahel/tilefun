# Generated railways, stations and trains

Topic: trains
Status: first generated horizontal two-town service implemented; boarding and expanded networks next.
Updated: 2026-10-04.

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

## Required user review before overworld integration

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
updates the current generator and bumps its version; retired saves use explicit
same-seed recreation, as described in [city generation](city-generation.md).

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
Admission rejects wet approaches and existing road crossings. No town buildings
are moved. Some seeds have no eligible line in the bounded starting search;
those retain the normal town start. Seed 2026 starts at tile **2543,-2662**,
beside a line to the second station at **3422,-2658**.

One native blue double-ended three-section train serves each admitted line. It
accelerates to 192 px/s, brakes at the ends, dwells eight seconds and reverses
without mirroring the horizontal artwork. The whole 456px body is represented
in collisions; players/props, edited-away rails and missing ready terrain stop it.
Stations have native platform edges and benches, a lamp and bin. They are basic
outdoor platforms, without a station building or passenger boarding yet.

Shared Realm authority owns motion in Worker, P2P and dedicated-server hosts.
Each service saves its location, destination and dwell in one `railServices`
record. An explicit deletion persists. At most four nearby services are active;
only the train footprint and braking halo request extra ready chunks. Leaving a
line freezes and saves its service before removal; returning at either station
restores the same train with no wall-clock catch-up. Train state is not duplicated
in ordinary entity records. Existing saves require explicit same-seed recreation.

Next: station names/destination information and safe boarding/alighting at stopped
trains. Then review paired tracks, vertical service, turnouts and structures before
expanding generation; high-speed/world-spanning trunks remain later work.

## World geometry prerequisite for expanded routes

In the 2026-10-04 follow-up, the user proposed a town loop with several stops and
grade-separated outgoing roads, then asked for broader terrain/structure design
before implementing tunnels. [World geometry](world-geometry.md) owns the use
cases, including mountain slopes and parking-garage ramps, and the open choice
of constrained surface/sector representation. General solid-volume authoring is
not a settled requirement. Resolve that shared model before selecting the next
bridge/tunnel implementation; railway-specific structure hacks are not the next
step. Station information and boarding remain independent railway follow-ons.
