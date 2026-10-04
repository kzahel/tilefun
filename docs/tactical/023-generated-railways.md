# Generated regional railways, stations and structures

Status: parent plan, updated 2026-10-04; previews delivered in [025](025-railway-workshop-previews.md), first horizontal two-town service delivered in [036](036-first-generated-railway.md).
[Trains](../topics/trains.md) owns current direction. This replaces the initial
straight-shuttle/player-built proposal following the user's clarified request:
railways are generated world infrastructure, like roads, connecting towns and
supporting longer regional and high-speed lines. A tiny shuttle is a test fixture,
not the product scope. Player railway construction is outside this plan.

## Intended experience

A town has a station connected to its streets. Trains arrive from another town,
stop at platforms and continue or turn back at a real terminus. Paired tracks
carry traffic in both directions. Some longer routes cross many regions, with
local trains calling at small-town stations and distinct high-speed services
calling at major hubs. Bridges, tunnels, station approaches and forks are planned
with the corridor, rather than added as decorations after tracks are laid.

Start with predominantly east/west regional trunks. “Across the world” means a
repeatable corridor that continues through independently generated regions, not
one unbounded array or a train that requires the whole world loaded. Services
have bounded operating sections and actual terminal stations even where physical
track continues. Supported-coordinate limits need deliberate terminal treatment.

The following choices are recommendations to validate, not already approved
layouts, art or simulated behavior.

## Network and service design

| Element | Proposed role and rule |
| --- | --- |
| Local corridor | Two tracks, one per direction; town stations along a continuous route, gentle station approaches and regional travel between stops |
| High-speed corridor | Separate paired express tracks between selected hubs, fewer stops and longer braking/streaming lookahead; initially do not mix express and local trains on the same tracks |
| Through station | Stops along a route, not endpoints; both directions have platforms, pedestrian access and enough straight length for the entire train |
| Hub | Town-connected local/express platforms with pedestrian interchange; trains need not switch between local and express tracks for passengers to transfer |
| Terminus | A double-ended train stops and reverses; a reserved crossover/throat connects arrival and departure tracks. No instant lane swap, despawn/reappear or required 180-degree loop |
| Branch junction | Physical turnouts plus explicit legal routes, conflicts and speed limits; a trunk must keep its straight-through path when a branch is omitted |
| Long regional trunk | Stable cross-region alignment and identities; smaller service sections/turnback stations keep operation and residency bounded |

For east/west lines, propose eastbound on the southern track and westbound on the
northern track. Use the equivalent consistent right-hand convention on other
axes. Track spacing comes from reviewed train envelopes, overhang and platforms,
not simply placing the 32px rail art directly side by side.

Two parallel tracks need no bridge merely to pass each other. A switch joins
tracks at the same level; a flat junction can work if conflicting movements are
reserved in turn. Bridges/tunnels separate movements when their paths actually
cross or terrain demands it. Reserve the option for a grade-separated busy branch
or express junction, but do not require a flyover for every fork.

Physical rail topology and scheduled service are separate. A rail branch does
not mean every train takes it; a service lists its station sequence and legal
route. Begin with a small fixed fleet, simple repeatable departures and platform
holds when blocked, not real-world timetabling. A stalled train should delay
followers safely, without rerouting onto the opposite-direction running track.

## Generation before chunk realization

Current evidence: `RegionalPlanner.ts` gives settlements stable region-owner IDs
and owns each east/south road connection once. Settlement centers vary in both
axes. Existing roads use orthogonal bends and reject water crossings in
`corridorIsDry`; there is no demonstrated rail bridge/tunnel facility to reuse.
`TrafficNetwork.ts` derives a bounded local road graph; it is not a regional
rail-service planner.

A new generator revision should plan in this order:

1. Seed geography, a bounded macro rail corridor and candidate settlements.
2. Choose continuous trunk alignment, rail-served towns/hubs and station envelopes
   together. Reserve approaches, future branch throats, structures and pedestrian
   connections before filling town blocks or routing detailed streets.
3. Place local/express track paths and classify every road, water, terrain and rail
   crossing. Resolve structure approach length and height here.
4. Build town streets, station forecourts and pedestrian access around those
   reservations; fill buildings only in remaining valid plots.
5. Realize the same semantic facts into terrain, structures, rails, source-backed
   art and collision. Bind bounded train services to the admitted network.

Do not draw one straight line between arbitrarily offset existing town centers.
For the first horizontal trunk, place station sites in an admissible band along
that trunk, connected into the selected town by a bounded street/footpath. If a
candidate town cannot be served within the configured distance/terrain limits,
select another site/town or leave it unserved; do not secretly introduce a sharp
rail kink or call a remote platform a town station. A later branch can serve
additional towns once its turnout and curve geometry is validated.

Choose corridor-band spacing, town service radius, platform length, branch
separation and structure span/grade limits from the first layout prototypes.
Record actual units (tiles versus world pixels) and admission limits in the child
plan before implementation. Density and achievable journey times must be tuned
together; widely separated existing settlements at car speeds can make trips dull.

Cross-region planning needs a bounded owner query, deterministic IDs and shared
boundary contracts for track position, tangent, height and service class. Derive
adjacent segments from the same canonical owner/input facts; no recursive global
search, viewport-dependent endpoint or generation-order-dependent choice. Test
negative coordinates and different query sizes/orders. Keep route/structure
bounds available without generating every detailed chunk along the corridor.

If an obstacle cannot be crossed with supported spans/approaches, use a bounded
deterministic alternate alignment or a deliberate connected terminal/service
boundary. Never leave a half-bridge or a rail edge pointing into unsupported
terrain. A corridor may be called continuous only after this topology validates.
Generation policy updated 2026-10-03: compose into the single current generator
and bump its version at implementation time. Retired saves require explicit
same-seed recreation; approved banks and exact review snapshots stay immutable.
See [city generation](../topics/city-generation.md).

## Station and crossing layouts

Plan three station templates before choosing a train controller:

- **Small through station:** two running/platform tracks, safe standing areas,
  shelter/signs and a street-facing entrance. Set platform clearance and length
  from the whole train; station art alone does not establish usable geometry.
- **Terminal:** two directional approaches and an exclusive turnback throat.
  A stopped double-ended train changes travel sign and reaches the correct
  outbound track through a physical crossover. Hold arrivals upstream until
  the complete movement and exit are free. Validate this small sideways turnout
  separately from a large 90-degree route turn.
- **Major hub:** local stopping platforms plus separate express tracks/platforms.
  Passing express trains stay clear of occupied local platform edges; start with
  separate corridors rather than an overtaking timetable on shared track.

Recommend paired side platforms for the first through station and a pedestrian
footbridge or underpass linking them to the town-side entrance. Audit ramps/stairs,
headroom, walking collision, camera visibility and child-friendly navigation;
choose the supported access solution from a scene prototype. An island platform
with a single safe access point remains an alternative, not an extra first kit.
Do not force pedestrians to walk over active rails to reach the return train.

Distinguish crossing types explicitly:

| Crossing | Initial proposed treatment |
| --- | --- |
| People reaching platforms | Pedestrian bridge/underpass with verified access and clearance |
| Road crossing local/express track | Grade-separated road or rail span, or reroute the road; level crossings and moving gates are separate future work |
| Rail over river/low terrain | Rail bridge with supported deck, approaches and piers clear of the required passage |
| Rail through raised ground | Validated tunnel and portals, continuous path and rider visibility policy |
| Branch merging/diverging | At-grade reserved turnout at reduced speed; separate conflicting movements |
| Independent rail lines crossing | Different height layers, or a deliberately modelled conflict; a visual overlap never implies connectivity |

## Bridges, tunnels and rendering contracts

Existing finite-height prop colliders and walkable surfaces are foundations, not
proof that stacked transport works. `surfaceHeight.ts` currently samples one
terrain height per tile; buried rails cannot simply be drawn below raised terrain
and expected to be traversable. Prove or extend floor/ceiling and supporting-layer
queries in shared physics before promising underground routes. The same X/Y may
contain a road, rail deck and pedestrian surface with different collision rules.

Every structure owns entry/exit path, height profile, deck/floor, underside/ceiling,
clearance envelope, approach bounds, collision and render/occlusion ordering.
A rail bridge must admit the complete train and riders without treating its
underside as a wall to traffic below. A tunnel must keep trains on the intended
floor, hide the correct train/carriage portions and keep riders understandable.
Suggested first tunnel presentation: shared-realm traversal with a cutaway or
fade around the local rider; inspect its appearance before selecting it. A
portal-only hidden movement or separate interior realm would require a distinct
transfer/visibility design and cannot be silently substituted.

Prefer a short straight structure prototype before ramps/curves on structures.
Constrain generated layouts to verified height/grade transitions. Do not snap
train height at a portal, use stairs as a train ramp, cover a rail path with solid
terrain, or fake tunnel passage by teleporting. Unsupported structure types must
fail corridor admission honestly while their implementation remains pending.

Render bridge decks, train bodies, riders, platform canopies and tunnel portals
with explicit layer/occlusion information, compatible with the ongoing
[renderer architecture](../topics/rendering-architecture.md). Keep these facts
independent of Canvas objects. Every new composition/geometry still needs exact
source review; no existing vehicle or city approval covers railway structures.

## Source evidence and the turning question

Inspected the local Modern Exteriors 16x16 pack, its named singles, and committed
`public/assets/tilesets/me-complete.png` on 2026-10-03. Coordinates below are
native pixels `[x,y,width,height]`, not tile coordinates. The named index is
incomplete; absence from it is not proof that an asset is missing.

| Source | Verified finding |
| --- | --- |
| `Grey_Rail_Modular_Horizontal` | `[0,4672,16,32]`; repeat along X |
| `Grey_Rail_Modular_Vertical` | `[0,4704,32,16]`; repeat along Y |
| `Brown_Rail_Modular_Horizontal` | `[0,4720,16,32]`; repeat along X |
| `Brown_Rail_Modular_Vertical` | `[0,4752,32,16]`; repeat along Y |
| `Grey_Rail_{Left,Right}_{Up,Bottom}_Corner` singles | All four actual rounded 90-degree corners exist, each 48×48; visually inspected |
| `Grey_Rail_Horizontal_Crossed_{Left,Right}` | Diagonal junction assemblies at `[1792,4784,64,96]` and `[1872,4784,64,96]` |
| `Grey_Rail_Vertical_{1,2}` | Angled crossing assemblies at `[1792,4880,96,64]` and `[1792,4960,96,64]`, not ordinary vertical straight pieces |
| Exterior train families | Blue, green, orange, grey and white have horizontal end/body pieces; inspected all five families |
| `Train_*_{Front,Middle,Back}_Down` | Vertical end/body art exists too; inspected the local singles. Names describe composition pieces, not a complete four-facing animation set |

Straight-piece singles were checked against the committed sheet: visible pixels
match exactly (transparent RGB differs). Corner singles are in
`assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Singles_16x16/`
with prefix `ME_Singles_Subway_and_Train_Station_16x16_`. Their full committed
atlas crops still need verification before registering candidates.

Useful source selections:

- [Straight rails and crossing pieces](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=0,4672,128,96).
- [Angled junction assemblies](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=1792,4784,208,240).
- [Grey and white horizontal train exteriors](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=2080,4384,736,64).
- [Vertical train pieces](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/art?sheet=me-complete&rect=2576,4672,240,400).

Turns are possible in principle; the rail art is not the blocker. However, a
48×48 corner is very tight beside 112–160px carriage crops. These are image
dimensions, not measured wheelbases. No intermediate turning train poses were
found in the inspected set. Rotating the side-view bitmap would rotate its
projected roof/walls, while snapping an entire long train between horizontal
and vertical poses would look abrupt and move its footprint substantially.

A curve prototype should use a path long enough for the reviewed wheelbase,
with each carriage following the same path at its own distance offset. Test
couplers, corner overhang, depth sorting and rider support, and decide whether
cardinal pose changes are acceptable or new art is needed. A geometric loop
alone does not establish a visually usable train. Do not promise loops or treat
the diagonal rail assemblies as diagonal train animation.

## Additional art audit still needed

The named index lists single/double tunnel cornices, side walls and shadows near
`[2096,4720,480,304]` in `me-complete`. These are indexed candidates, not a verified
assembled tunnel kit. Its named `Pier_Bridge_*` pieces belong to Camping; their
names do not establish a railway bridge. Inspect the full source sheets/singles
for station platforms, pedestrian access, bridge spans/abutments, both portal
orientations and turnout geometry. Record missing art instead of stretching
unrelated sprites or assuming every orientation is present.

The earlier straight-rail/train/corner inspection above remains valid. The
required visual experiments now include station throats and shallow crossovers,
not only 90-degree bends. Each carriage follows path distance with its own
wheelbase/coupler offsets; a whole train cannot rotate as one rigid long sprite.
Reversing a double-ended train changes travel, not its physical orientation.

## Authority, traffic and high-speed readiness

Keep rail infrastructure, physical tracks, services and live trains distinct:

- Infrastructure facts: owner/feature IDs, station-town links, envelopes, structures
  and generation/art revisions.
- Track graph: directed paths with XYZ/grade, gauge/envelope, permitted train
  classes, speed limits, switches, platform/stop positions and conflict blocks.
- Service: bounded route/section, calling pattern, terminal policy, fleet identity
  and dwell/departure rules. A through station never reverses a service by default.
- Train: durable composition/carriage IDs, path history/progress, direction, speed,
  next stop, phase and occupancy. Retain sufficient path history for its rear cars.

Shared Realm authority handles movement, block occupancy, switch locks, platform
assignment and boarding. Rendering interpolates replicas. Use a distance-based
speed profile that brakes before stations, occupied blocks, turnouts and the end
of ready terrain; integrate without tunnelling on large ticks. Reserve the whole
junction movement and usable exit before entry, release only after the rear
clears, and never change a switch under any part of the train. Prevent deadlock
with bounded all-or-nothing conflict reservations and explicit terminal ordering,
not indefinite chains of partial locks. Unready/unknown occupancy is not clear.

Existing car reservation ideas can inform shared primitives, but car turning,
spawning and retirement are not sufficient for a multi-car rail service. A train
occupies several blocks and its rear may remain across a chunk boundary or switch
after its front leaves. Conflicting approaches and following trains must account
for that full length in both travel directions.

High-speed service is a separate commissioning gate, not a larger velocity
constant. Require longer clear blocks, station deceleration, curve/turnout limits,
visibility/collision readiness, bounded replication and measured mobile traversal.
Demand/prefetch extends over the full train plus braking distance and measured
IO/preparation margin; roughly `v²/(2a)` is the constant-deceleration braking term,
not the complete readiness budget. Cap speed or brake before the ready boundary
when the pipeline falls behind. Separate express infrastructure also keeps a
stopped local service from blocking the express route.

Use non-damaging behavior and protect station walking areas from train envelopes.
Unexpected blockers stop services; do not push through players. Boarding at a
station should be the initial passenger experience. Compare an explicit board/
exit interaction with walk-on support in the prototype; roof riding is optional,
not the station-access design. Boarding is server-authoritative and only permitted
at a stopped aligned train/platform. Safe exits need a verified platform/landing;
shared prediction and stable carriage attachment must survive braking and turns.
High-speed jumps/roof riding need a separate camera/clearance/fall decision.

## Streaming, persistence and service continuity

Use the shared persistence/residency contract current at implementation time;
[entity activation](../topics/entity-activation.md) owns the ongoing cutover.
Deterministic static network facts can regenerate from a frozen generator.
Dynamic service fleet, train progress, station dwell and rider relationships need
stable durable IDs and atomic records. Reconstruct switch/block reservations
conservatively from complete train occupancy before allowing movement after load.
Do not duplicate a train because another segment or station loads first.

A passenger keeps the complete train, nearby structures and braking lookahead
active even with a panned camera. Multiple observers approaching different parts
of the same long service see one authority. Block sections with unloaded trains
remain occupied/unknown until their authoritative state is ready; other trains
cannot run through stale reservations or wake inside them.

Do not simulate the whole continent to make a station useful. For the first
bounded services, demand covers the service's relevant block dependencies and
uses a bounded wake of its scheduled train when a player approaches a station.
Persist and pause wholly inactive service sections without wall-clock catch-up;
never teleport a dormant train to an occupied platform. Validate a bounded wait
for an arriving service in the active two-town fixture. Seamless long-distance
schedules across many independently sleeping sections are an open extension:
settle boundary handoff/occupancy and waiting-time policy before claiming that
milestone complete. Avoid holding an entire world-spanning corridor resident.

Reload starts safely from rest with route/composition validation and correct
rider attachment. Edits/deletions that break active rail or support must pause
the service safely, preserve identity, and never drop riders or recreate removed
infrastructure. Use ordinary edit authorization; railway construction tools are
not part of this request.

## Delivery milestones and decision gates

This is a parent sequence. Create numbered child tacticals only when starting a
bounded slice; each must give concrete dimensions, source identities, validation
and a complete playable/reviewable result. Do not implement the old editor slice.

### Mandatory human review before overworld implementation

Explicit user requirement, 2026-10-03: show the tile patterns, plans and correct
horizontal/vertical moving trains for review **before implementing railways in
the overworld**. Milestones 1–2 produce isolated Workshop fixtures and shared
preview foundations only. They must not enable generated rails, stations or
trains in a playable overworld, including a selectable candidate revision.

Prepare these reviewable batches, with native-scale views and optional geometry
overlays rather than requiring the user to judge atlas filenames:

| Review batch | What the user must be able to inspect |
| --- | --- |
| Track patterns | Repeated horizontal/vertical rails, tile/chunk seams, paired-track spacing, corners, forks and crossovers; distinguish rail appearance from legal movement |
| Train composition and movement | Each proposed local/express train moving east, west, north and south on the matching track, correct ends/roof/body art, couplers, wheel/rail alignment, scale, depth and clearance; stop, dwell and reverse |
| Turning and switching | Each carriage moving through the proposed bend/turnout/crossover, with joins and overhang visible; no whole-train snapping or invented rotated sprites |
| Station and regional plans | Native-scale through/terminal/hub layouts, platforms and pedestrian access, two-way arrivals/departures/terminal turnback, and a map showing town connections, branches and local/express separation |
| Structures | Proposed bridge/tunnel and access recipes in context, with trains/riders moving through or over them; inspect portals, occlusion, supporting layers and passage beneath decks |

Motion fixtures need play/pause, slow playback and direction/scenario selection
so the user can inspect the actual movement, not just a still contact sheet.
Use production rendering/shared movement components where available; any missing
runtime behavior must be labelled as a prototype. The preview should expose
source identities, composition/geometry and scenario revisions in review details.

Register all new batches/candidates in the Workshop manifest/global inbox even
before feedback exists. Read `npm run workshop:inbox` and `npm run art:notes`
before preparing/acting on review feedback. Present live links under
`https://tilefun.graehlarts.com/tilefun/` when the fixtures are actually ready;
the first 32 registered fixtures are delivered by [025](025-railway-workshop-previews.md). Schematic studies do not constitute finished structure or movement implementations.

**Stop at the review gate.** Obtain the user's explicit acceptance of the network/
station plans and the exact patterns, train compositions, motion cases and
structures required by the proposed overworld slice. Unreviewed/rejected items
cannot enter that slice; ask the user to accept a narrowed slice if an orientation
or structure remains unresolved. Approval of a still sprite is not approval of
its turns or station fit. Separate deferred features can be reviewed later, but
must pass the same gate before their own overworld integration.

Preserve exact accepted snapshots and decision provenance. A change to pixels,
recipe, geometry or reviewed motion behavior reopens the affected review; do not
reset unrelated approvals. Agent inspection, passing tests, source discovery and
this planning conversation are not approvals. Follow the existing two-Needs-
changes pause rule and wait for “ready” before implementing that batch's art fixes.

### Milestones

1. **Network/layout study.** Produce a deterministic regional map plus native-scale
   station scenes: two town-connected stops, paired tracks, one terminal throat,
   a branch reservation and a separate express alignment. Show town walking/road
   access, conflict points and structure footprints. Compare placement across
   several seeds; choose sizes, spacing and route eligibility rules. No moving
   train is required to judge whether this map makes sense.
2. **Geometry/art feasibility.** Assemble a local train and express train; test a
   crossover and carriage bend; prototype through/terminal stations, a rail bridge,
   pedestrian access and a short tunnel. Verify supporting layers, underpass
   collision and rider occlusion. Register exact review candidates. Record missing
   assets/physics explicitly; structures stay first-class scope even if delivered
   in separate child slices. Deliver the directional moving previews and collect
   the explicit user reviews above before starting milestone 3.
3. **Generated two-town local service, after human acceptance.** A new selectable
   generator revision owns
   station/town/road integration, paired tracks, explicit terminals/turnback and
   two opposite-direction trains. Include station arrival/boarding/departure,
   safe block control, save/reload and multiplayer. Choose a corridor using only
   structure types proved in milestone 2; this is a production generator fixture,
   not player-drawn track or a showcase disconnected from real world planning.
4. **Structures and branch network.** Admit verified bridges/tunnels in generation,
   a three-town branch with a real fork/merge and crossing separation. Exercise
   contention, blocked platforms, route choice, rider continuity and chunk edges.
   Complete the infrastructure kit rather than treating scenery as operational.
5. **Long trunks and express service.** Repeat corridors over many owner regions,
   bounded service sections/turnbacks, major transfer hubs and a distinct fast
   paired line. Resolve section sleeping/handoff and wait times. Raise speeds only
   after full-train clearance and traversal evidence pass on desktop and mobile.

## Acceptance and validation

- Generation: deterministic station/town connectivity, corridor seams, query-order
  independence, bounded planning, negative coordinates, river/terrain conflicts,
  route rejection/fallback, structure approaches, preserved prior generator hashes.
- Topology: through versus terminal behavior, directional pairs, forks, crossovers,
  express separation, platform length, complete fleet turnback cycles and no
  invented connection at a visual crossing.
- Simulation: full-train block occupancy, tail-clearance release, switch locks,
  terminal deadlock scenarios, stopped leading trains, large ticks and braking
  before unready data. Run sustained two-way trips, not just one successful arrival.
- Structures: train/rider envelope above and below decks, correct tunnel floor and
  ceiling, portal clipping, approaches, platform access, canopy and bridge sorting.
- Persistence/network: one fleet across chunk loads, atomic rider records, save/
  reload in station/tunnel/junction, sleep/wake, multiple observers, late join,
  disconnect and section-boundary handoff. No wall-clock teleport or duplicate train.
- Experience/performance: actual town-to-town ride, clear platform destination,
  tolerable wait/trip duration, touch boarding and camera, fast traversal under
  delayed readiness, bounded memory and no whole-line residency.
- Run `npm run typecheck`, `npm test`, `npm run check`; after render/input/recipe
  changes run `npm run art:catalog` then `npm run workshop:manifest`; runtime
  delivery also needs `npm run build && npx playwright test` and
  `npm run streaming:bench -- --assert-ready`, using isolated data and bundled
  full Chromium for rendering evidence. Tests are evidence, not human art approval.

## Next step

Prepare the isolated Workshop review batches: tile patterns, regional/station
plans, horizontal/vertical moving train compositions and the corresponding
switch/structure scenes. Provide working live review links and collect the user's
explicit decisions. Only then start an overworld slice that uses those accepted
plans and exact assets/behaviors. Exact dimensions, passenger interaction, tunnel
presentation and long-section sleep/handoff remain prototype decisions until
resolved in that review process.
