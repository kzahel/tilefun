# Dense city districts and street life

Status: the phase-1 neighborhood, nine road foundation scenes, four road geometry
scenes and six street starter scenes are approved, 2026-10-02. The phase-2
commercial streets and curbside parking checkpoint is implemented in
`regional-v6`, with all four views human-approved and an explorer/game visit.
The small parking-lot checkpoint is staged in regional-v7; see [009](009-city-places-and-indoor-performance.md) for current deliveries. Phases 3–7 remain planned. The user accepted the building showcase in chat after
hotel panel removal (`b81d3b4`); the original review history remains intact.

This is the next implementation roadmap after
[Tactical 006](006-art-workbench-and-city-variety-plan.md). That document keeps
the art audit and review history; this one owns the coming city milestones.
[Tactical 005](005-generator-profiles-and-shared-tile-preview-plan.md) supplies
the shared generator, explorer, persistence, and versioning rules.

## Outcome

Build cities that feel like connected places: large residential and commercial
buildings, busy but walkable streets, parking meters and crosswalks, curbside
parking and parking lots, pocket parks, neighborhood parks, large parks, public
squares, and farmers markets. Pedestrians should move between these places,
with quiet residential streets and busier commercial or market areas.

Start with a convincing playable neighborhood using the art we have. Expand
props and building families as each place needs them. Auditing the entire
spritesheet is not a prerequisite for the first city block.

## Baseline before phase 1

- `CityBuildingPrefabs.ts` has 28 reviewed showcase configurations: bay-front
  apartments, hotels with optional signage, and five shop/apartment families.
  They use the same recipes, prop factory, and renderer as gameplay, but the
  current district generator still selects the four frozen Regional recipes.
  Chat acceptance is recorded here; existing exact per-case review records
  remain intact. This plan does not manufacture individual approval events.
- `DistrictPlanner.ts` plans streets, lots, homes/shops/park blocks, and a single
  park. Its current layout primarily puts south-facing buildings along one
  frontage. `DistrictStrategy.ts` already realizes sidewalks, asphalt, road
  lines/crossings, paths, and basic park furniture. It is a starting producer,
  not yet a general city land-use model.
- `SettledStrategy.ts` adds limited street walkers. `ProceduralActors.ts`,
  person entities, and `routeAI.ts` already supply actor identity, residency,
  collision, animation, and simple route following. Connected sidewalk routing,
  destinations, queues, and convincing crowds still need work.
- The atlas index contains candidate art such as `Parking_Meter_1`, traffic
  lights, signs, and directional cars. A named slice establishes where art is,
  not whether its facing, collider, assembly, or placement is correct.
- The explorer already uses `createGenerator`, shared placements, asset loading,
  and the game renderer. Its actor preview currently shows generated actors at
  their initial positions; it does not run gameplay route simulation.
- Exact explorer queries currently cap placements at 512, actors at 128, and
  resident detail chunks at 81. Dense scenes must respect these limits or
  replace them with measured, bounded policies rather than silently truncating.

## Shared architecture and rules

Freeze Classic/Island and Regional v1/v2/v3. Introduce a separate pinned dense
Regional revision, initially proposed as `regional-v4`. Extend descriptor
validation, explicit version dispatch, registry/UI choices, saved worlds,
worker requests, and multiplayer creation together. Never route a new version
through the current fallback to v3. Reuse unchanged regional geography where
possible; own the new city realization separately from the frozen planners.

Each shipped slice that changes generated output needs a new pinned revision
or explicitly versioned recipe/profile contract. Do not keep changing a saved
v4 world underneath its descriptor as later phases land. Pin promoted asset
and place recipes too: mutable review candidates must not silently replace a
saved world's facade, collider or entrance. Promotion establishes immutable
recipe identities used by all consumers, while retaining the shared composer
and renderer. Exact version numbers beyond the first revision are assigned
when slices are ready; the phase numbers are delivery order, not world versions.

The city plan is the source of truth. It records street corridors, junctions,
sidewalks, crossings, curb segments, blocks, lots, public-space boundaries,
entrances, parking/access lanes, furnishing zones, and pedestrian connections.
Assign stable owner/district/block/lot/feature IDs before realizing chunks.
Generating adjacent chunks must not duplicate a lamp, stall, building, or person.
Cross-block parks and streets need one owner and explicit connections.

Keep three decisions distinct:

1. **Asset recipes:** exact art, source revision, supported facings, assembly,
   visual bounds, collision, anchors, and interaction/entrance facts.
2. **Place recipes:** spatial patterns for frontage, intersections, parking,
   parks, squares, and markets, with entrances and reserved clearances.
3. **District planning:** which places belong where, using seed and pinned
   profile settings. It chooses assets and emits shared realization facts.

Extend existing contracts only as the next slice requires. Terrain/road paint
stays in the shared surface pipeline; furniture stays in shared prop recipes;
people stay in actor plans and the ordinary simulation. Crosswalk paint must
not become a solid prop. If the current road enum cannot express a reviewed
pattern, extend shared surface realization rather than drawing it only in the
explorer. No independent city renderer or second list of placement coordinates.

A building's sprite height, wall collider, reserved lot, entrance approach, and
render bounds are different things. Use native art dimensions and reserve
space for all of them. Current reviewed buildings face south; establish useful
frontages with that limitation first. Audit corner, side, and back art before
claiming four-sided blocks. Mirroring cannot invent a missing elevation.

## Phases and review checkpoints

| Phase | Deliverable | Review checkpoint |
| --- | --- | --- |
| 0a. Road foundation | Shared source-backed asphalt, pavement, curb joins, crossings, widths and raised divider recipes | Review the nine road scenes before dense blocks or more props |
| 0b. Starter palette and placement facts | A small curated set of street/park props with source links, facings, anchors, collision and clearance facts | Review one furnished sidewalk strip with a building entrance |
| 1. Playable dense block | New pinned city revision, shared street/block/lot planning, existing building families, connected sidewalks and crossings, a few walkers | Inspect a compact neighborhood in the explorer and play at the same location |
| 2. Streets and parking | Curbs, meters, lamps, signs, parked cars, curb bays and a small parking lot | Walk a busy commercial street and cross an intersection without blocked doors or sidewalks |
| 3. Parks and squares | Pocket park, neighborhood park, plaza, then a connected large park | Compare different public spaces embedded in dense surroundings |
| 4. Larger and more varied buildings | Commercial/office family, larger residential family, audited corners and frontage transitions | Review a commercial center beside a residential neighborhood |
| 5. Farmers market | Shared market-square layout with reviewed stalls, vendors, produce, queues and access | Compare an empty square with a furnished market and walk through both |
| 6. Pedestrian life | Destination routes, crossing behavior, park visitors, market browsers and crowd variation | Watch and traverse a busy neighborhood with no permanently stuck walkers |
| 7. District variety and performance | Multiple seeded neighborhoods, profile controls, reliable residency/persistence and measured mobile budgets | Explore, play, edit, save/reload and revisit several contrasting districts |

Gameplay integration and persistence are required from phase 1 onward; phase 7
is expansion and hardening, not the first time we discover whether a scene works
in the game. Basic walkers arrive early; richer behavior follows the places.

### Phase 0 — only the palette needed next

Reuse existing lamps, benches, trees and playground props. Audit a parking
meter, bin, bollard, planter, and a few parked-car orientations as needed.
Prioritize readable silhouettes and correct ground anchors over sheer count.
Add a prop to the reusable catalogue/editor and source-use inventory when it
is implemented; record candidate, available, and generator-used states clearly.

Each new asset records exact source rectangles/fingerprint, family and role,
supported orientation, native size, ground collider, visual bounds, interaction
anchors where needed, and placement constraints. Constraints include clear
sidewalk width, distance from curb, door clearance, and intersection visibility.
Store geometry once and reuse it for generation, editing and diagnostics.

Use existing atlas annotation and exact appearance feedback. Extend shared
scene review targeting when reviewing a street or park needs more context than
a source slice, preserving existing notes/IDs and the approve/report workflow.
Keep shortcuts in `tools.html`; avoid scattering unindexed new lab pages.

### Phase 1 — the first implementation slice

Build a small deterministic district fixture as ordinary city-plan facts, then
realize it through the new generator. The fixture is a reproducible test case,
not a separate art-only implementation. Add seeded variation after the layout
and clearances work. Do not create a general constraint solver first.

The first demo should contain a compact two-by-two arrangement of blocks around
one complete intersection, a row of current apartment/shop/hotel recipes,
continuous sidewalks, valid crossings, a pocket green or simple square, and a
few people on validated sidewalk routes. Tune dimensions against native art;
the block arrangement is a composition target, not a fixed tile-size promise.
Unaudited rear/side frontage can remain open or landscaped rather than using
incorrect rotated art. Stage parking art and additional commercial buildings
in the following slices instead of blocking this checkpoint.

Provide shared debug overlays for lots, art extents, colliders, entrances,
reserved walking strips, crossings and actor routes. Expose a bookmarked seed,
revision and location in the existing explorer. Create/Play here must produce
the same initial surfaces, placements and feature IDs in the actual game.
The explorer may show initial actors plus route overlays; label this clearly.
If we add animated preview, reuse the game simulation helpers and collision,
with preview state isolated from saved worlds.

**Done:** visible density improves; the player can traverse the sidewalk network
and enter a shop/apartment; door approaches remain clear; tall art is not
clipped at chunk boundaries; walkers do not spawn inside walls; old revisions
retain their generated signatures; edits and deletions survive unload/reload.

### Phase 2 — furnish the street deliberately

Place street furniture by zones: walking strip, curb furnishing strip, entrances,
corner visibility zones and service access. Space meters against actual parking
bays, lamps along streets, and bins near gathering places. Use deterministic
spacing with bounded variation, not independent random scatter at each tile.

Parking is a spatial recipe: curb bays or lot bounds, marked spaces, driving
access, pedestrian access, occupancy and correctly oriented parked cars.
Place parked cars as static props first. Keep pedestrian paths and crossings
clear, and prevent parking on entrance approaches. Crosswalks align with the
junction and sidewalk network, including both travel directions supported by
shared art. Busy streets first mean composition and pedestrian activity;
moving traffic is a separate later milestone.

### Phase 3 — different kinds of public space

Implement reusable place recipes, not one universal park scaled to any size:

- **Pocket park:** one or two frontage lots, seating, planting and a short path.
- **Neighborhood park:** a block with several entrances, loop paths, play area
  and open lawn; benches face useful views rather than random directions.
- **Square/plaza:** paved public space with clear through-routes and optional
  central feature; reserve room for a future market layout.
- **Large park:** a district-owned area spanning several blocks, with connected
  paths, different zones, and planned street-edge crossings. Selective ponds
  or sports areas follow only after their surfaces and access are audited.

Reserve public land before distributing building lots. Prove that paths join
sidewalks and connect entrances across chunks. Keep park furniture away from
through-routes. Large parks require connectivity and spatial ownership; they
are not merely larger grass rectangles. Add visitors using the same actor
contracts and expand their behavior later.

### Phase 4 — broaden architecture where the city needs it

Audit one distinct commercial/office family and one larger residential family
first, then corners, service edges, storefront variations and landmark types.
Record compatible roof/floor/ground pieces and supported height ranges. Avoid
filling catalogues with configurations that lack valid closure or perspective.

Separate district land use from the asset family. Mixed-use streets, office
frontage, hotel blocks and residential rows need different frontage rhythms,
heights, setbacks and prop palettes. Business signs and roof accessories are
optional reviewed variants. Reuse existing interior identities where applicable;
large exterior art does not promise elevators or playable upper floors.

### Phase 5 — a market as a place

Compose stalls, awnings, tables, produce crates, signage and waste/service zones
around reserved aisles. Vendors have stable anchors; visitors have destinations
and queue/wait areas. Emergency/gameplay through-routes remain open. Reuse the
square's ownership and access graph, and make stall placement seed-stable.

Deliver a static market layout before daily scheduling. If offering an empty
versus market-active square, pin the selected state in the demo/configuration.
Later time-dependent activation needs a shared authoritative clock/state and
persistence, not browser-local random stall spawning. Trading/economy mechanics
are an extension after the place and circulation work.

### Phase 6 — people with plausible movement

Build a bounded walk graph from reserved sidewalks, crossings, park paths and
entrance approaches. Reuse actor factories and movement/collision, upgrading
route selection only as needed. Provide home/shop/park/market destinations,
pauses at benches/stalls, and different activity density by place.

Routes cross streets only through admitted crossing edges. Handle edited or
blocked paths with bounded rerouting or a pause/return behavior. Avoid infinite
retries, teleporting through obstacles, and reintroducing deleted actors.
Concentrate activity where it makes sense while retaining room for the player.
Stable actor identities and residency must work across chunk/owner boundaries.

Start with bounded waypoint trips. Schedules, vehicle AI and traffic-signal
synchronization follow after walking is reliable. Moving traffic requires its
own lane graph, crossings/right-of-way policy, vehicle collision, residency
and authoritative simulation; it should not be disguised as animated car props.

### Phase 7 — coherent districts and measured scale

Add reviewed dense-center, mixed-commercial, compact-residential and park-edge
profiles. Profiles vary block rhythm, public-space allocation, parking provision,
height/family mix and activity, not just colors. Seed/profile/revision and all
output-affecting defaults belong in the resolved immutable descriptor. Keep
preview-only controls such as overlays and view scale out of world identity.

Connect local streets to the regional roads and terrain admission rules. Cover
coasts, awkward settlement bounds, small towns and adjacent public spaces.
Queries stay owner-local and bounded; overview derives from the same district
facts without constructing every detailed prop. Do not solve neighboring cities
recursively or generate the entire settlement just to render one chunk.

Measure generation/worker latency, prop counts, draw cost, actor simulation,
route planning and unload/revisit growth. Keep existing caps until a documented
budget change has evidence and regression coverage. Large parks and dense
frontages need overlap-aware placement queries based on actual art bounds,
not the current fixed small-building search margin. Validate desktop, emulated
phone layout and a representative physical phone separately.

## Validation and implementation order

Each slice includes a deterministic fixture, shared-source and geometry tests,
source-linked visual review, a live explorer bookmark and an actual game visit.
Run required typecheck/unit/lint checks; rendering/integration changes also run
the build and browser suite. Commit reviewable slices rather than waiting for
an entire city system. Do not rewrite frozen outputs to repair a new profile.

Core cases include crowded corners, narrow lots, tall buildings behind/alongside
streets, cross-chunk props, entrance clearance, connected paths, parking exits,
market aisles, multi-block parks, actor residency, edited route obstacles,
save/reload tombstones and exact explorer-to-game initial-state parity.
Preview and authoritative runtime positions can differ after simulation starts;
compare identical initial state or controlled simulation time.

**Next checkpoint:** review the playable dense neighborhood and changed divider
recorded below, then handle the ready-batch fixes. After acceptance, phase 2
furnishes the curb and parking before broadening public spaces/building families.


## Phase-0 checkpoint — first review run (2026-10-01)

[Review the street starter](https://tilefun.graehlarts.com/tilefun/building-lab.html?run=streets).
Six street-level scenes review meters, lamps/bollards, bins, seating/planters,
stationary parking, and a combined sidewalk using one existing bakery frontage.
Seven new prop definitions use exact atlas slices and the normal game factory,
editor palette and renderer. Existing lamps and benches are reused. The case
recipes reserve a clear 40px walking strip, shop approach and parking bays.
The surface is a diagnostic stage; real district streets and walking simulation
are not claimed at this checkpoint.

The existing Building Lab UI now supports a separate street run with the same
shared feedback transport, fingerprints, offline submissions, approvals, undo,
next/previous and two-report pause. Notes identify the whole case and its prop
types; direct source links identify each sampled sprite. Review state is scoped
to the run, and existing building approvals remain independent. No approval
events are synthesized. The central tool index links the run.

Validation: typecheck/build and Biome pass; 1,076 unit tests and all 157 browser
tests pass. Tests check exact indexed source rectangles, shared editor/game
factory geometry, clear walking/approach zones, parking containment, independent
scene verdicts, offline pause/reload/undo, real note API round trips and atlas
links. All six street scenes and phone/geometry captures were inspected. The
live deployment loads all six unchecked cases and keeps phone voting in view.
The inventory has 450 source uses, with candidate street references labeled.

The user found the props reasonable but requested road/sidewalk work first.
Keep this palette available; prioritize the following surface checkpoint.


## Phase-0a checkpoint — road foundation (2026-10-01)

[Review the road foundation](https://tilefun.graehlarts.com/tilefun/building-lab.html?run=surfaces).
The user redirected work before further props: prove a convincing base canvas
with narrow and two-lane roads, center dividers, sidewalks, curbs, corners and
intersections. The two source notes are `ce4b4882-0078-451d-b89b-bb4f24ef7acc`
(`[512,16,288,288]`) and `e06455c5-5473-4ba8-8a10-aa0ac3e660f6`
(`[0,1904,384,352]`) on `me-complete` revision
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.

Nine cases cover a narrow street, horizontal/vertical two-lane streets, a
divided boulevard, a turn, T/four-way intersections, neighboring warm pavement,
and the first selected bank for comparison. `src/road/CitySurfaceRecipes.ts`
owns source rectangles, continuous road occupancy and surface composition; the
lab only draws those placements. Asphalt, paint and curb shading are original
PNG pixels. No props obscure the surface review. Street corners currently use
the audited square motif; the raised median uses original rounded end caps.

This is a candidate surface contract, not a change to existing saved worlds.
After human review, the next district revision must consume this composer (or
its promoted version) in the game's chunk renderer and explorer, rather than
recreating it in either UI. Retain the source/recipe/render fingerprint review
contract and add cross-chunk seam and explorer/game parity checks at that step.
Curb ramps, rounded street corners, crossing behavior and pedestrian path
clearances still need dedicated slices; these crossings stop short of curbs.

The existing approve/report/undo/next/previous workflow is reused. Surface
records have their own case IDs, empty building lists and a surface recipe ID;
they never approve a building or prop scene. Run navigation and two-report
pause are independent. Source-use inventory identifies candidate surface tiles.
Next: human road review and ready-batch fixes, then the first shared dense block.

Validation: typecheck, build and Biome pass; 1,081 unit tests and all 160 browser
tests pass. Native source captures cover every case. Tests verify opaque pinned
source pixels, full base coverage, paint containment, both kinds of curb corner,
consistent neighbor queries across chunk boundaries, negative-coordinate fill
parity, exact review renders, phone controls, per-case drafts, independent
queues, offline pause/reload/undo, changed-appearance reopening and real inbox
round trips. The inventory has 497 source uses. The live deployment shows all
nine cases with phone navigation and voting in view; no live test feedback or
approvals were submitted.

## Phase-1 checkpoint — playable dense neighborhood (2026-10-01)

The user reviewed all nine surface cases, approved eight and reported the
boulevard divider as too abrupt. After “Proceed with next,” its raised island
was shortened and given source-backed dashed lead-ins. Only that case reopens;
the other eight recipe and rendered fingerprints are preserved. The divider
remains a review candidate, outside this first district's surface palette.

[Review the dense neighborhood](https://tilefun.graehlarts.com/tilefun/building-lab.html?run=districts).
Three views cover one generated two-by-two neighborhood: the whole place,
apartment/shop frontage and central crossing, and the hotel/pocket green.
The existing queue, drafts, hiding approved cases, next/previous, offline inbox,
undo and two-report pause are reused with independent run state. Follow its
explorer link, then **Play here**, to visit the actual neighborhood. The central
index links both the run and the explicit v4 explorer bookmark.

The pinned descriptor is `{type: regional, version: regional-v4, seed: 2026,
preset: temperate-v1}`, centered at tile **300,519**. There are eight building
lots, six connected street segments, continuous sidewalks/crossings, four block
loops plus a crossing walker, and one pocket green using existing tree, bench
and fountain art. All facades face south. Buildings fit their native art
extents; front approaches connect to sidewalks and use normal shared doors,
colliders and persistent apartment/shop interiors. Only small seeded height
variation is introduced here, not a full district-profile catalogue.

`DenseDistrictPlanner.ts` owns the same plan for overview, real chunks,
placement queries, interiors and actor routes. The actual cached TileRenderer
uses the approved neutral `CitySurfaceRecipes.ts` lookup with cell-contained
paint clips from `DenseCitySurface.ts`. Persistent roadGrid IDs 0–4 retain their
meaning; 5–14 pin these new surfaces. Game and explorer reuse the renderer,
normal prop/actor factories, authoritative movement and procedural residency.
The review lab also renders ordinary generated chunks, rather than drawing its
own street/building implementation. Geometry draws native-art reservations,
doors, factory colliders and shared routes. Preview actors are labeled initial
poses; animation is in the game.

`dense-city-assets-v1.json` promotes eight reviewed building variants under
new immutable `prop-city-dense-v1-*` identities, including optional roof-sign
hotel art. This is a checked-in snapshot, never regenerated during builds.
Mutable candidate edits cannot alter a saved v4 facade/collider/door. The
inventory identifies these promoted building pieces and exact surface clips,
including their generation/render consumers. New realization changes require
a new pinned revision; do not update v4's freeze fixtures to accommodate fixes.

Classic/island and regional v1/v2/v3 remain unchanged; new worlds default to
Procedural regional / Dense districts (v4).
The new choice appears in the existing game/explorer revision pickers and
resolved descriptors work through worker and saved-world boundaries. V4 uses
v1 regional geography outside its compact settlement core; v3 farm/woodland
content, complete regional road joins, fully varied town/city profiles, curb
ramps, general crowd routing and populated parks are still later milestones.
Existing detail, prop and actor caps remain in place; each review window also
loads at most 81 chunks, including the normal renderer halo. No new approvals were
created by the agent.

Validation: typecheck/build and Biome pass (74 existing warnings); 1,091 unit
tests and all 168 browser tests pass. The inventory has 579 source uses. The
live deployment’s emulated phone preview shows three unchecked views and keeps voting in view; the
road queue shows only the changed divider, with eight approvals preserved.
No live test judgments or new feedback threads were submitted. Source captures inspected for all
three neighborhood views and the changed divider. Tests check pinned asset/
surface choices, old/new realization signatures, native lot/door clearances,
actual factory collisions along complete walker routes, negative owners, chunk
seams, tall cross-chunk residency, actual park/street sprite bounds, tombstones, browser phone navigation, review
isolation/offline pause, inbox round trips, actual explorer-worker/game buffers
and placements, moving game pedestrians, shop/apartment entry, and saved edits.
The v3 baseline signature was additionally checked against the prior commit.
Eight approved road scenes pass exact composition/render fingerprint checks.

**Next:** human review of these three views and the changed divider, then the
ready-batch fixes. After acceptance, phase 2 adds intentional furnishing zones
and curb/lot parking before expanding park/square and commercial families.


## Workshop checkpoint — 2026-10-02

[Tilefun Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html) now shows
all review batches and unresolved requests in one workspace, including cases
that have no feedback. All nine road foundation scenes have human approval,
including the revised divider; the three dense-neighborhood views remain
unchecked. The older “Next” paragraph above describes the prior checkpoint.
Use the Workshop inbox for current state. Regional-v4's promoted bank remains
frozen; review approval alone does not alter saved-world generation.

See [Workshop implementation and follow-on plan](008-tilefun-workshop-plan.md)
and [Workshop operations](../tilefun-workshop.md). Next art work is the curved
road/island/intersection batch, followed by intentional furnishing and parking,
then parks/squares and varied commercial families, through the same human review loop.

## Doorway connections — 2026-10-02

The district feedback “the sidewalk doesn't go to the doors” is addressed in
`regional-v5` / `dense-district-v2`. V4's frozen output and promoted asset bank
stay unchanged. V5 reuses its layout and art, with threshold-to-sidewalk paving
for all twelve visible entrances in the checkpoint. Condo bay and arched doors
and both butcher doors have their own connections. Native source-frame doorway
metadata supplies the paving edges and corrects the primary entrance alignment
in the plan; the player approach point no longer determines where paving begins.

The three district views use v5, and their explorer / Play here links carry that
same descriptor. V5 is selectable in the game as Connected entrances (v5, review);
v4 remains the default until human review. Changed district renders return to
review, with previous feedback retained and unrelated approvals preserved.
After this correction is accepted, continue the curved-road/island batch and
intentional furnishing/parking milestones above.

## Street starter surface correction — 2026-10-02

The six furniture review scenes now use the dense neighborhood's pinned neutral
paving, asphalt and curb composition instead of flat diagnostic color bands.
`StreetStarterSurface` queries `denseCitySurfacePieces` across the full stage;
unbounded road occupancy keeps cropped edges from creating curb end caps.
Both labs and Workshop use the shared renderer, and surface pieces are recorded
in the source-use catalog and exact review composition. Furniture positions,
walking clearances and parking guides are retained. All six changed appearances
return to human review; road, building and district approvals remain intact.
Review this palette before promoting intentional street furnishing into city
generation.

## Road geometry review checkpoint — 2026-10-02

The next four-case batch is **Road geometry** in Workshop, also available at
`building-lab.html?run=road-geometry`. It has independent navigation, drafts,
approval/report/pause state and exact source/render identities. The previous
nine road scenes, six street scenes and three district views retain their
approvals. Both road batches appear under Roads & sidewalks and in the global
inbox, with a master-index shortcut to the new batch.

Cases: rounded four-way curb joins; a capped pedestrian island with an open
central refuge landing; two crossings with sidewalk extensions; and three
native curbside parking bays with sidewalk gaps and a separate crossing.
All surfaces reuse `CitySurfaceRecipes` and `CitySurfaceRenderer`. Source art
is pinned to the committed complete sheet: whole 32×32 pavement corners at
x144/x192,y1904/y1952; island caps/middle at x224/x240/x272,y2000; crossing entry at
x64,y1968 and paint at x64,y1984; marked 80×32 parking bay at x16,y2048.
These exact clips have source-use inventory entries and clickable atlas links.
No curb is rotated, mirrored or stretched. Crossing approaches preserve the
authored curb shading; modeled accessible ramps remain a later milestone.

`city-surfaces-v2` records shared crossing, sidewalk-extension, island/refuge
and parking bounds alongside the source pieces. This is a review candidate,
not a change to frozen v4/v5 output or their promoted bank. After human review,
promote accepted geometry and placement reservations into a new generated
commercial-block revision, then add the approved furniture and parked cars.

Validation: typechecks, production build and Biome pass (74 existing warnings);
1,126 unit tests and all 202 browser tests pass. Checks cover opaque source
clips, exact preview pixels, refuge/parking reservations, phone layout, feedback
round trips, independent pause state and all nine approved foundation renders.
All 301 existing Workshop candidate identities remain unchanged.

### Curved curb correction after review — 2026-10-02

The junction and crossing approaches received Needs changes reports because
the curved curbs bent in the wrong direction. The first composition replaced
only a diagonal road cell with a quarter-curb. The corrected composer places
each complete native 32×32 corner across the pavement cell, two adjoining
road-edge cells and diagonal road cell. This keeps the pavement outline,
straight curb joins and south-facing shadow together in their authored orientation.
The parking scene shares this correction and remains available for review; the
approved refuge and all 301 earlier candidates retain their exact identities.

A regression check compares all four complete junction corners against their
audited source pixels. Original human reports remain attached to the prior
render identities; agent replies do not approve the revised candidates. These
three cases remain candidates until the next human review.

Validation: all 1,127 unit tests and 202 browser tests pass, as do typechecks,
production build and Biome (74 existing warnings). Visually inspected all three
revised previews in Playwright Chromium; only their candidate identities changed.

The subsequent human review approved the corrected junction, approaches and
parking renders at 14:17 UTC, completing all four geometry approvals together
with the unchanged refuge. The two original curb reports are resolved against
those exact new render identities. Next: promote this reviewed geometry and its
placement reservations into a new generated commercial-block revision, then
stage the approved furniture and parked cars for the next review batch.

## Commercial streets and parking checkpoint — 2026-10-02

The **Commercial streets & parking** Workshop batch has four independent review
views: whole neighborhood, shop frontage, refuge crossing and parked cars/bays.
Its master-index shortcut and Dense neighborhoods sidebar entry lead to the same
candidates; `building-lab.html?run=commercial` is the legacy entry. Approvals hide
completed views, Next/Previous navigate, and two Needs changes reports pause
this batch until “ready” without pausing any earlier batch.

This is one actual `regional-v6` district (seed 2026, owner 0,0, center 300,519),
not four handcrafted scenes. The generator shares the dense block/frontage
planner, audited doors and paths, ordinary props, chunk renderer and walkers.
The commercial profile widens the central east–west avenue to twelve tiles and
sidewalks to four. It has three north-side 80×32px marked bays, two seeded static
cars with native east/west art, three pay stations, lamps, seating, bin and
planter. A west refuge has a clear central landing; east sidewalk extensions
shorten the crossing. Reserved walking strips remain behind curb furnishings,
and all doorway approaches stay open. Cars are static props, not traffic AI.

The city plan owns crossing, refuge, bay/occupancy/facing, sidewalk extension,
walking/furnishing bounds and stable furniture/actor identities before chunks
are realized. Source clips are cut into persistent cell-sized layers; the shared
renderer draws those exact layers in Workshop, the explorer and the game. The
review and generated curbs/crossings share unbounded corner and crossing helpers.
Native clips retain authored orientation, scale and south-facing shading.

`commercial-city-assets-v1.json` is a manual, immutable promotion of the four
approved geometry renders and six approved street-palette renders, with their
exact composition/pixel identities and human decision references. It also pins
the neutral neighbor lookup, full native corner clips, placement template art
and seven prop/collider recipes under new promoted type IDs. Its 61 cell recipes
occupy persistent roadGrid IDs 15–75, within the existing byte storage and
save/worker/network transfer path. Never regenerate this snapshot in builds.
Saved v6 worlds are frozen; changing their output requires a new revision.
V1–v5, the promoted dense building bank, default v4 and all 305 previous Workshop
candidate identities are retained. New commercial compositions require human
approval; palette promotion does not approve their new combined placement.

Explore/Play here carries the actual v6 descriptor and location. V6 is also a
selectable Regional revision in new-world creation and the explorer. All four
preview windows stay within the 81-chunk budget, with 21 unique props and six
walkers in the whole district. The explorer shows initial actor poses; gameplay
runs the same routes. Geometry mode shows lots/doors, real colliders, clear
walking strips, reserved bays, crossings/refuge and routes.

Next after review: a small parking-lot place recipe with access and pedestrian
clearance, then pocket/neighborhood parks and a paved square. Regional boundary
connections, varied land-use profiles and richer pedestrian behavior remain
later phases; the v6 checkpoint reuses the existing owner-local settlement
admission and geography outside the compact district.

Validation: typechecks, production build and Biome pass (74 existing warnings).
All 1,132 unit tests and 205 browser tests pass. Checks pin the bank and generated
v6 output at positive/negative owners, verify source opacity and exact GPU/retina
preview fingerprints, bay/door/walkway clearances, clear actor routes, unique
feature identities, chunk realization and saved car/meter edits. Phone review,
feedback round trips and independent pause state are exercised. All four views
were visually checked in Playwright Chromium. Debug colliders now use the same
AABB helper as gameplay, rather than the older vertically offset overlay.
