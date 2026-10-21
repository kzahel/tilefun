# City generation and promotion

Topic: city-generation
Status: one evolving regional generator; same-seed recreation for retired saves.
Updated: 2026-10-20.

## Current generation policy

Behavior batch [155](../tactical/155-fetch-nests-and-caches.md) adds finite loose
twigs/nuts/fruit at existing crow/squirrel homes and ordinary oak nest trees at
crow clearings. Resource/tree identities derive from existing animal feature IDs;
ownership pools, animal RNG and existing animal placements retain their ordering.
Consumed procedural resources use ordinary deletion tombstones. Tree canopies
are included across chunk boundaries and remain ordinary editable props. Existing
saved regions can retain their old realization; inspect a fresh world for these
new natural supplies. No migration or regeneration of promoted art is involved.

[157](../tactical/159-foraging-and-lookouts.md) adds finite rabbit plants and
meerkat fruit, plus one shared seed patch per occupied robin chunk. Existing
animal identities, positions, ordering and ownership pools remain unchanged.
Sharing seeds keeps the two dense forest inspection regressions below the
existing 128-actor query cap; actor, persistence and planning caps are unchanged.
Manually placed animals create no food. Ordinary resource tombstones preserve
consumption, including shared seed patches, through reloads.

[161](../tactical/161-climbing-raids-and-play.md) evolves rabbit/robin food into
bounded growing plants, adds ordinary trees and supported crops at capuchin and
squirrel homes, and one actual cache-building squirrel per natural raccoon group.
All additions derive stable feature IDs from existing owners and preserve original
roster slots, animal identities/positions, RNG ordering and query-order independence.
The bounded neighbour and associated forage belong to their actual destination
cells, including boundary crossings; overlapping tree crowns are included on both
sides. New crops begin inside their owning cell, then bind to their actual tree
only when the full support scope is ready; edge and negative-cell cases are tested.
Manually placing an animal creates no automatic food or neighbours. Existing
saved regions keep their realization; new sources are also ordinary editor items.
The [behavior topic](wildlife-behaviors.md) owns saved stock and renewal timing.

[163](../tactical/163-browsing-rooting-and-trunks.md) adds bounded shrub/root
supplies at existing goat/pig homes and farm residents, low rock supports for goats,
and ordinary oaks/fruit crops beside elephant homes. Source/support points derive
from existing owner IDs and stay on the owning side of cell boundaries. Animal
positions, IDs, RNG and roster ownership remain unchanged. Older saved regions
retain their realization; ordinary editor items expose the same behaviors.

[166](../tactical/166-scratching-and-pollination.md) adds shared soil patches at
natural chicken homes and at most two flowers/one growing plant per occupied
bee/hummingbird species and cell. Viable sites are dry, clear and cell-owned.
Additions preserve original animals, RNG and ownership pools. Manual animals
create no supplies; existing regions retain their realization and can use editor
resources. The behavior topic owns finite stock and pollen timing.

The user approved dropping historical playable generator compatibility during active
development. `CURRENT_REGIONAL_VERSION` in `GenerationDescriptor.ts` is the single
regional creation/runtime version, currently **regional-v13**. It composes connected dense neighborhoods, gentle road
traffic and [rideable two-city railways](trains.md): eligible broad curves, shared
pixel tracks, platforms and straight road crossings. Natural cover now adds
spatially varied trees, solid patterned forests and ponds on eligible land.
It does not automatically promote the v7–v10 review candidates. Classic, Island and
Flat remain distinct simple presets, not historical regional revisions.

Build new features by composing the current planners, terrain, placements and actors.
During the current greenfield phase, the user explicitly allows output changes
without version bumps (2026-10-04); development worlds are disposable. Keep the
current behavior tests, deterministic replay, query-order independence, seam/geometry
checks and stable IDs for the current implementation. Old same-version terrain/edits
are not migrated: use a fresh world or explicit recreation to inspect new output.
The exhaustive district/city-place route tests check terrain once per sampled
actor pose and batch prop collision assertions per pose. This removes repeated
work that exceeded CI's five-second timeout while retaining all route samples,
prop obstruction checks and the default timeout (2026-10-18).
This change does not automatically erase any saved worlds. Do not retain runtime
branches or old world-output hashes to reproduce retired versions. The version
in a save detects retired descriptors, not output drift within the active
greenfield version; it is not a promise that the old algorithm remains available.

Old worlds remain listed with a compatibility reason. **Recreate with same seed**
creates a new save ID using the current generator; it copies no edits, characters,
interiors or player positions. The original stays available for explicit deletion.
The server rejects entering incompatible worlds and skips them during automatic
resume. Both browser and dedicated-server paths use the shared compatibility policy.
The same seed identifies the input, not an identical landscape across revisions.

See [Tactical 035](../tactical/035-current-world-generation.md) for implementation
and validation; [world explorer](../world-explorer.md) for navigation and handoff.

Shopping-center stores retain their original generated scenery identities while
participating in the ordinary building/interior lookup. Player enter/exit behavior
and persistence are owned by [patterns and interiors](patterns-and-interiors.md).
No terrain regeneration or parking-specific renderer is required for this door fix.

[Wildlife completion 140](../tactical/140-autonomous-wildlife-completion.md) and
[continuation 147](../tactical/147-wildlife-continuation.md) keep fixed natural
ownership pools: 17 original species, 169 land expansion slots and 42 aquatic
expansion slots. Activating a profile never resizes or reorders these pools.
Original dry owners reserve upstream of pond admission; expansion and companion
homes fit around already admitted water, so new land profiles never veto an
existing pond or lagoon. All caches remain bounded and query-order independent.
Profile-activation regressions preserve prior refuges and actor records.

Aquatic expansion checks complete water footprints and occupies downstream
arcs of existing refuges. Original fish schools and other water actors retain
their identities, positions and RNG. Shore species now have compatible southern
arc admission; sea lions and walruses require lagoons. New natural hunters fill
reserved expansion slots. Their local prey use the
profile's explicit prey species, or the existing rabbit default, plus legal
grazers selected through the food web. These additional natural owners retain
procedural lineage and natural-only delayed distant meal replacement.

The upright elephant and giraffe use an independent two-species companion bank.
Rare existing open sites exclude original/expansion homes, rabbit/deer glades,
water, infrastructure, thickets and nearby placed scenery. They never remove
trees or their robin owners. Their ownership and RNG salts are separate;
they never participate in upstream water reservations. They use ordinary shared
Fauna authority and persistence, and the food web protects them as friendly
companions. Existing quadruped banks and all three fixed pools remain unchanged.

Racetrack lab diagnostics select sports cars inside the shared planner's oval,
excluding nearby road traffic that uses the same model. Motion checks follow
runtime actor IDs so two racers with the same appearance cannot stand in for
each other; paused reload checks retain model and position matching.

## Exact review scenes and asset banks

[Large wildlife lakes](boats.md) add an independent 512-tile ownership bank to
the current natural generator. Admission preserves infrastructure and existing
ponds/lagoons; realization, map sampling, wildlife and shore boats use the same
coordinate-addressable plan. Lakes include broad deep interiors, shallow shores,
a clear boarding beach, varied aquatic actors and a durable natural mooring.
The fixed 17/169/42 animal ownership arrays remain unchanged. New terrain can
relocate land clearings; the zebra lab inspection now selects another valid
natural owner. This follows the existing fresh/same-seed recreation policy.

Review approval remains tied to exact candidate identities. The twenty existing city
views (3 dense, 4 commercial, 3 parking, 4 parks, 3 architecture, 3 pedestrians) are
finite snapshots in `src/art/city-review-snapshots-v1.json`: plans, props, initial actor
poses and bounded terrain with a neighbor halo. `CityReviewArchive.ts` reads them
without invoking historical generators. The old descriptors are provenance labels.
The lab uses the normal renderer; the explorer can inspect the archived area, but
its handoff explicitly creates a **current world with this seed**, without carrying
an archived arrival. Outside the finite area, it asks for Current regional.
The coarse geographic background uses current geography, not a historical emulator.

Never regenerate these snapshots during builds or silently replace their pixels.
New review output needs a new candidate identity and human review. Commercial and
city-place composition experiments live in `src/art/studies/`; their geometry tests
support future authoring, without preserving historical saved-world output.

The promoted `dense-city-assets-v1.json` and `commercial-city-assets-v1.json` banks
remain immutable, with bank hash checks. The architecture bank is a candidate bank,
not an approval promotion. Builds consume committed assets. Candidate approval,
asset promotion and inclusion in the current generator are separate decisions.

## Recorded review checkpoints

- Street starter: six furniture scenes, `run=streets`; road foundations: nine approved
  source-backed scenes, `run=surfaces`. The divider is reviewed art for future use.
- Road geometry: four approved scenes, `run=road-geometry`; their commercial surface
  bank pins source cells and road IDs. Commercial streets: four approved scenes,
  `run=commercial`, originally regional-v6 seed 2026 near tile 300,519.
- Dense neighborhood: three approved views, `run=districts`, originally regional-v5
  seed 2026 near tile 300,519. Door thresholds, including secondary entrances, connect
  to the sidewalk. [Tactical 007](../tactical/007-dense-city-districts-and-street-life-plan.md)
  records the checkpoint.
- Thirteen city-place views await recorded human review: parking (v7), parks (v8),
  varied architecture (v9), people and destinations (v10). Preview people are initial
  poses; historical prompts about live movement are provenance, not a promise of
  playable old revisions. [Tactical 009](../tactical/009-city-places-and-indoor-performance.md)
  preserves their delivery history. Consult the live Workshop inbox for later decisions.

## Connected countryside and larger settlements

On 2026-10-09 the owner requested farmhouses and smaller dirt roads branching
from inter-town roads, larger denser cities, and cats/dogs in towns and cities,
then authorized proceeding. [083](../tactical/083-farms-town-pets-and-larger-cities.md)
tracks delivery and whole-world validation. Current composition now includes
connected farmsteads and durable settlement pets. Cities use a seeded 4×4 or 6×4
grid (184×168 or 272×168 tiles), connected outer boulevards, shopping bands, taller central homes, lower
residential edges and two greens; villages retain compact 2×2 grids. Additional
city rows grow northward, retaining the established +44-tile southern street
edge and keeping native southern stations and rail approaches clear. Native
promoted facades retain their threshold-to-sidewalk connections. Each block has
a pedestrian route and each green has one cat and one dog with a saved safe home
boundary. Frozen authoring layouts, promoted asset banks and archived review
records remain unchanged. Existing development worlds are disposable; inspect
new generation in a fresh world or an in-memory lab.

The [city center](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-city-center&landscape=thicket#/tool/world-geometry),
[village pets](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-village-pets&landscape=thicket#/tool/world-geometry)
and [farmstead](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-farmstead&landscape=thicket#/tool/world-geometry)
use the same production generator, shared Worker authority and persistence.
Their local traffic is suppressed to focus inspection; ordinary game traffic
remains enabled. Use the regional planning link for settlement-scale geometry.

## City outskirts speedways

[138](../tactical/138-city-outskirts-racetracks.md) adds large oval racetracks beside
eligible cities, with a paved approach, checkered start line, red/white kerbs,
eight circulating sports cars, 48 durable spectators around all four sides and
furnished seating/picnic areas. East/west placement avoids trunk roads and railways; the venue and access
reserve dry ground before rural/natural scenery. Existing outer-boulevard driving
width remains intact. Villages retain their compact footprint. The current
regional-v13 descriptor remains unchanged; inspect fresh terrain.

The World Geometry **City outskirts · oval speedway** scene uses production
generation, traffic and shared Worker presentation/save semantics. Its four
landscape-profile compositions are registered for review; existing promoted banks
and human decisions remain unchanged. Seed 2026 has its first track at 462,455,
with a safe spectator arrival at 462,492. The shared world map/explorer draws the
production oval and approach with a checkered flag and speedway name; the world
map offers a button to center it. Queries remain bounded and cancellable without
loading chunks or returning crowd/prop payloads. Previously visited chunks can
receive missing track spectators; durable origin records preserve moved/deleted
people and other generated populations still seed once. See 138 for validation
and next work.

## Next work

[Parking lot patterns](../tactical/131-parking-lot-patterns.md) adds a new
[Parking lot lab](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/parking-lab)
for the owner's shopping-center request (2026-10-18): 64-space shopping center,
16-space town lot and long side-facing bays, with native source tiles and parked
car scale references. Three new exact candidates await review under
`parking-patterns`. These are static compositions, separate from the old v7
archive. [132](../tactical/132-parking-shopping-visits.md) adds a separate
[playable shopping-trip view](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/parking-lab?play=1):
occupants walking into shops and back, with bounded car maneuvers. Shared Realm
authority owns routes, collision, crossing admission and saved phases. [133](../tactical/133-generated-shopping-centers.md) integrates one road-connected
center in every current city, or two in larger cities, along the northern boulevard.
Centers extend the reserved area 60 tiles north of the street grid (184×228 or
272×228 tiles overall). Native parked cars use durable traffic ownership; one existing compact road car
visits each center at a time, then merges back from its actual exit pose.
The [generated city preview](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/parking-lab?play=1&city=1)
uses the real generator and offers a main-game new-world handoff. Inspect fresh
generation; existing saved terrain is not migrated. Nature/farm reservations now
protect the new center footprints without altering distant habitat reservations.

[134](../tactical/134-parking-as-city-terrain.md) makes pavement, bay markings,
crossings and islands ordinary saved road-grid cells (79–162), rendered through
native terrain chunks. Production regional planning owns the layout; only buildings,
trees, carts and pay stations are props. Both playable lab URLs now use this same
city generator and native parked population. Three static pattern reviews keep
identical pixels. Retired saved pavement prop IDs become inert; existing saved
terrain is not rewritten, so inspect the new pavement in a fresh city/world.

[Natural landscapes](natural-landscapes.md) now supplies the default regional
composition, including patterned forests, scattered trees and ponds. The owner
explicitly requested default integration on 2026-10-07. The explorer/lab retains
profile comparisons; [Tactical 068](../tactical/068-natural-landscape-preview.md)
records the initial preview delivery. Next: ordinary-world composition feedback.

[Generated railways](trains.md) now admit one isolated road bridge per eligible
line. [Tactical 062](../tactical/062-generated-road-rail-crossing.md) records the
current greenfield integration and three seeded previews. Regional-v13 remains
the descriptor by explicit user direction. No promoted art bank changed.

Continue reviewing the thirteen city-place views before promotion. Later city work
includes farmers markets, connected parks, frontage variety and richer schedules.
Performance evidence lives under [performance](performance.md); feedback rules live
under [art review](art-review.md).


The [083 completion](../tactical/083-farms-town-pets-and-larger-cities.md#completion)
records 2,048 passing units and 485/487 browser checks; the remaining two are
recorded immutable wildlife-preview failures. Native farms/pets/cities, exact
actor tombstones, both complete train journeys and streaming readiness pass.
Next: playtest farm spacing, lane approaches and city density in a fresh world.


[168](../tactical/168-grazing-browsing-and-building.md) enriches existing horse,
giraffe and beaver homes with bounded cell-owned resources. One shared set per
occupied species/cell serves original owners; farm and natural resources use one
combined placement pass. Giraffe leaves bind to a real ordinary palm. Stable IDs,
original animal placements, pools and random ordering remain unchanged. Source
birth points stay in their owning cells at negative and positive seams; manual
animal placement creates no resources. Beaver shelters do not edit water/terrain.
