# World explorer and regional generation

Status: proposed implementation plan, September 29, 2026. This document describes
future work; the explorer and regional planner are not implemented yet.

## Outcome

Build an explorable world with recognizable places: apartment and shopping
districts, quieter neighborhoods, parks and playgrounds, villages, farms, and
wild areas. Streets, buildings, and landscape should belong to a coherent plan
that continues across chunks. The normal world remains open-ended.

A world explorer makes that plan visible before expensive tile generation. Pan
across regional land use, zoom into streets and blocks, inspect a small area in
actual game art, then choose **Play here**. Each view refines the same world.
This is also the main way to review generation quickly.

The first playable milestone is a bounded city district within a larger regional
plan: several connected apartment/shop blocks, a park or playground, sidewalks,
crosswalks, and a visible transition toward rural or wooded land. It should feel
like part of a city, rather than another collection of scattered houses.

## Starting point

- `TerrainStrategy.generate` currently produces individual chunks.
  `OnionStrategy` provides seeded terrain, the existing water/beach/grass chain,
  and optional roads. Normal generation has no fixed map boundary; island mode
  is a separate choice.
- `RoadGenerator` supplies deterministic grid-based road segments.
  `StructureGenerator` places templates around qualifying intersections. These
  are useful foundations, but neither represents a complete district or city.
- `ChunkManager` and the server realm already load nearby chunks and integrate
  saved world data. The explorer should not need to start a gameplay realm just
  to inspect unmodified procedural plans.
- Modern Exteriors includes modular apartment floors, storefronts, building
  faces, roofs, sidewalk/curb pieces, crossings, and other street markings.
  The inspected source sheets are `5_Floor_Modular_Buildings_16x16.png`,
  `4_Generic_Buildings_16x16.png`, and `2_City_Terrains_16x16.png` in the theme
  sorter. Asset existence does not yet establish a reliable assembly recipe.
- The wall solver and curated furniture placement provide an interior baseline.
  Preserve them and reopen their review only for concrete integration failures.

Borrow mclone's explorer principles: direct coarse queries, stable feature
identity across scales, bounded detail, and generation outside the UI thread.
Relevant references in the sibling repository are tactical plans 247 and 262
and `docs/topics/multiscale-terrain-representation.md`. Tilefun does not need
mclone's 3D rendering stack or a dependency on that project.

## One shared world plan

Separate natural geography from human land use. A coastal city and a wooded
village should be possible; “city” is not a replacement for terrain type.

| Planning level | Owns | Consumed by |
| --- | --- | --- |
| Region | Water, broad vegetation, settlement locations/extents, rural and wild land, major connections | Regional map and settlement planning |
| Settlement | Districts, road hierarchy, major parks, reserved public space | City map and block planning |
| Block and lot | Local streets, sidewalks, crossings, parcels, building footprints and entrances | Detailed map and chunk realization |
| Scene | Building art, ground tiles, props, collision, door links | Street preview and live game |
| Interior | Rooms and precise furniture placement | Enterable buildings |

The implementation should expose bounded queries for regional facts, settlement
plans, and detailed realization. Exact TypeScript interfaces can follow a small
prototype, but every query must have explicit seed/version, world coordinates,
requested detail, and work limits. Overview queries must stop before generating
hidden fine detail or allocating full chunks.

Features need stable IDs, parent IDs where relevant, world-space bounds,
ownership, and connection information. A city silhouette at regional scale is
the same city whose blocks appear at the next scale. A building footprint and
entrance in the plan are the ones used by the game. Labels and rendering may
simplify at a distance; geometry and identity must not randomly change on zoom.

### Determinism and boundaries

- The same seed and generator version must produce the same features regardless
  of chunk load order, camera path, worker scheduling, or query size.
- Give features deterministic owners and stable IDs. A road or building spanning
  several chunks is planned once logically and clipped/realized by each chunk;
  visiting another chunk must not spawn a duplicate object.
- Use world coordinates with tested negative-coordinate division. Region and
  chunk borders are implementation boundaries, not visible landscape seams.
- Neighboring planning cells agree on connections through shared parent facts
  or deterministic boundary contracts. Queries may use a bounded neighbor halo;
  they must not recursively solve an unbounded chain of neighboring cities.
- Reserve water crossings and settlement connections at the appropriate parent
  level. Initially reject or reroute unsupported crossings instead of drawing
  roads through water and hoping later tile choices fix them.
- Persist the generator version with a world. Introduce the planner in new or
  explicitly opted-in worlds; do not silently regenerate existing saved worlds.
- Saved player changes remain authoritative overlays. The explorer should label
  procedural previews clearly and incorporate saved changes when inspecting an
  actual saved world, rather than presenting the original plan as current truth.

This is hierarchical planning with local constraints. Do not start with a global
tile solver: reserve roads, lots, and access first, then choose compatible art.

## Streets and city composition

“Natural streets” initially means a connected hierarchy, varied block lengths,
offset junctions, side streets, and routes that respect parks and water. Use
orthogonal geometry supported by the artwork first. Arbitrary curves, diagonal
facades, and free rotation are not prerequisites.

Street plans must include their whole cross-section: carriageway, curb,
sidewalk, crossings, and reserved clearance. Intersections own compatible curb
and crossing arrangements. Sidewalks must connect to entrances and park paths;
a plausible map is insufficient if the player cannot walk through it.

Lots consume explicit frontage and access constraints. Building recipes declare
supported facing, width, floor-count range, base/roof pieces, entrance anchor,
collision footprint, and projected sprite extent. Tall facades can extend well
beyond their ground footprint; placement and depth ordering must account for
that. Do not rotate or mirror perspective art unless the asset supports it.

Start with a small inspected recipe set: an apartment building, a shopfront
variant, street/sidewalk junctions, and park furniture. Review assembled scenes,
not every color permutation. Add more recipes when they create a distinct kind
of place. Audit farm/crop and wilderness assets before promising their coverage.

## Explorer and performance

| View | Display | Work permitted |
| --- | --- | --- |
| Region | Water, woods, rural land, cities/villages, major roads | Bounded coarse queries and simple map shapes |
| City | Districts, streets, blocks, parks, building footprints | Plans for visible settlements/blocks |
| Street | Real tiles, buildings, curbs, props | A capped visible neighborhood of detailed chunks |
| Play | Walking, jumping, doors, inhabitants | Existing nearby gameplay loading and authority |

Pan and zoom should update immediately using the available view while new work
arrives progressively. Use workers for expensive planning and realization,
request IDs, cancellation checks, and stale-result rejection. Bound queued work,
active jobs, coarse samples, visible feature counts, detailed chunks, and memory.
At very broad zoom, simplify or aggregate the query rather than scanning every
settlement in the visible area. Avoid huge geometry transfers back to the UI.

Do not rely on persistent generated maps, generated sprite images, or a prebaked
world atlas for speed. Reuse source sprite sheets and efficient source rectangles.
Transient visible results, worker buffers, and normal bounded scene state are
working memory and should be released as views are replaced. Saved edits and
review verdicts are durable user data, separate from generated-content caching.

Measure before choosing limits. Initial performance targets, subject to the
first desktop and phone measurements:

- Input responds on the next frame; explorer-owned main-thread work aims to stay
  below 8 ms per frame, with no generation-induced tasks over 50 ms.
- A first useful regional view appears within 1 second on the development
  desktop and 2 seconds on a representative phone after app assets are available.
- Continuous pan/zoom does not grow memory or pending work without bound.
- Navigating away from a detailed view promptly stops its obsolete work.

Record cold asset load separately from planning, tile realization, transfer, and
draw time. Show lightweight timing/queue counters in a diagnostic overlay. These
targets are acceptance goals, not claims about current performance.

### Initial controls

Pan/zoom with mouse and touch; seed selection; toggles for geography, land use,
roads, lots, entrances, and boundaries; click/tap to inspect a feature; and a
shareable seed/version/position/zoom link. **Play here** resolves a safe walkable
spawn through the game/server and enters the matching world location. Preview
coordinates must not bypass server authority or create a second simulation.

## Fast review loop

Keep the successful approve/report workflow. Each round should contain a small
set of new structural cases and targeted counterexamples. Approval automatically
advances to the next unchecked case; category labels show remaining counts.
Reporting a problem needs one action, with an optional explanation.

A report records the seed, generator version, feature/case ID, camera bounds,
detail level, and active overlays so the exact scene is reproducible. Let the
user stop after one or two useful failures; fix those before asking for a large
batch of reviews. Invalidate verdicts only for affected cases when feasible,
and make changed or reopened cases obvious.

Use semantic map views to judge layout and rendered views to judge art and
walkability. Small stress cases should include narrow lots, short blocks,
T-junctions, offset junctions, dead ends, tiny parks, nearby water, tall/short
neighbors, and features crossing chunk/region boundaries. Broad views should
also show sparse outskirts and settlement transitions. Avoid rounds that differ
only in theme colors or equivalent floor tiles.

The explorer should lead into real play early. It must not become another
isolated catalog workstream with no connection to the game.

## Implementation sequence

### 1. Shared regional queries and the first explorer

Introduce seed/version and bounded regional query contracts. Build a pan/zoom
map showing geography, land use, settlement extents, and major connections.
Keep generation independent of game startup. Add timing, cancellation, and
shareable locations from the start.

Acceptance: a fixed seed can be explored across positive and negative
coordinates; repeated queries agree; broad views generate no detailed chunks;
input stays responsive under rapid navigation. Review a few region layouts,
including a city/rural/forest transition and a planning-cell boundary.

### 2. A planned city district

Refine one settlement into a connected street graph, several varied blocks,
lots, a park/playground reservation, and apartment/shop footprints. Establish
boundary contracts before expanding to many settlements. Inspect the minimal
asset recipes needed for the next slice alongside this work.

Acceptance: the district fits its regional reservation, every occupied lot has
access, crossings and sidewalks connect, and plans agree across independently
queried boundaries. Review both the whole district and small stress cases.

### 3. Real art and walking in the same district

Realize those plans through the existing chunk pipeline. Assemble modular
buildings, roads, sidewalks, crossings, park paths, and a small useful prop set.
Add bounded detailed explorer rendering and **Play here** using the same plans.

Acceptance: plan footprints, entrances, and connections agree with gameplay;
walk through several blocks and the park without seam, collision, duplicate
spawn, or depth failures. Verify repeated unload/reload and multiplayer clients
observe the same placement. This completes the first playable milestone.

### 4. Enterable places

Connect a few representative buildings to interiors using stable exterior door
IDs and return locations. Reuse the wall/furniture system and existing realm and
persistence facilities; settle the interior-instance contract before multiplying
buildings. Start with an apartment entrance, a shop, and a small home.

Acceptance: entry/exit returns to the right street, interior state persists as
intended, and multiple players agree on the destination. Furnished rooms are
walkable and use the existing jump/height behavior.

### 5. Broaden the world and add inhabitants

Extend the proven hierarchy to villages, farms, forest paths, wildlife areas,
and more urban district types. Add simple inhabitants with meaningful spawn
locations and nearby destinations after navigable places exist. Deep schedules,
traffic simulation, economies, and a fixed game genre remain separate decisions.

Acceptance: distinct places connect plausibly, transitions hold across regions,
and exploration remains responsive. Continue compact review rounds organized by
new behavior, rather than generating a giant all-assets checklist.

## Verification and unresolved choices

Automate deterministic query equality, load-order independence, negative
coordinates, ownership uniqueness, border agreement, road/access connectivity,
and plan-to-realization correspondence. Add representative performance fixtures
for broad zoom and rapid navigation. Use visual review for asset seams, readable
streets, building composition, and whether a place feels convincing; structural
tests cannot establish those judgments.

Choose planning-cell size, settlement spacing, and detailed-view caps from the
first measurements. Decide the first supported building facings from inspected
art, and the interior storage/realm mapping from existing game constraints.
Keep those choices explicit rather than embedding assumptions in many layers.

The next implementation step is **slice 1**: a shared regional query module and
a lightweight explorer showing one reproducible city/rural/wild layout, with
measured generation cost and no full-chunk work at regional zoom.
