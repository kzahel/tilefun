# Dense city districts and street life

Status: phase-0 street starter and road foundation reviews implemented,
2026-10-01; road surfaces are now the priority human checkpoint. The user accepted the building showcase in chat after hotel panel
removal (`b81d3b4`). District generation and simulation phases remain planned.

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

## What exists and what needs to change

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

**Recommended next implementation:** approve/fix the road foundation first.
Then carry the accepted surfaces and existing building/prop palette into the
shared playable dense-block slice. Furnish its curb and parking in phase 2
before broadening public spaces and building families.


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
