# World explorer checkpoint

Current city review/promotion status: [city generation](topics/city-generation.md).
Current performance direction: [performance](topics/performance.md).

The completed regional checkpoint from [Tactical 004](tactical/004-world-explorer-and-regional-generation-plan.md)
is available at `/tilefun/world-explorer.html`. The game menu also links to it.
Tactical 005 A–E adds shared versioned generators, configurable real-tile
preview, game type/seed/settings selection, districts, persistent interiors, and
inhabited countryside. No saved
world is changed by opening the explorer.

The explorer sidebar also links to the [art workbench](art-workbench.md), where
source tiles can be inspected, traced to recorded systems, and annotated for
future building recipes.

## In-game world map

While playing, click **Map · G** in the top right or press **G**. The overlay
stays on the current game connection. Drag (or use arrow keys) to pan, pinch or
scroll to zoom, and use **Find me** to recenter. Player dots and name buttons
update once a second while the map is open, including players outside the camera
range. Click a player's name to center on them. Indoor players appear at their
building entrance; disconnected players disappear from the roster.

Hold a location for 650 ms with a finger or mouse to fast travel in the same
world. Dragging, pinching, cancelling a touch, or closing the map cancels the
hold. The server chooses walkable ground within 32 tiles, rejecting water,
solid buildings, invalid coordinates, and mismatched generation identities.
Failed travel leaves the map open with an error; successful travel returns to
the game. Travel from an interior returns to the exterior world. **Escape**, **G**,
or **Close map** dismisses the overlay without travelling.

The map is a terrain overview from the current world's pinned generator,
with authoritative player positions. Saved terrain edits are inspected through
the standalone explorer's exact tile view.

## Run and review

```sh
npm run dev
```

Open `http://localhost:5173/tilefun/world-explorer.html`. For a standalone preview
without the development game server, use `npm run build && npm run preview` and
open the same path at port 4173.

Start with seed **2026**, centered on Ferngrove. The seven review buttons cover
regional context, boundaries, district streets/art, farms, and woodland trails.
Drag or use arrow keys to pan. Scroll, pinch, or use the zoom buttons to zoom.
Tap a settlement or connection to inspect its stable ID, ownership, and bounds.
Toggle layers to separate geography, vegetation/rural land, settlement
reservations, connections, and planning boundaries. Copy location includes the
seed, generator version, profile, tile coordinates, zoom, and overlays.

**Looks good** and **Report** store a verdict locally and advance to the next
unchecked case. A report can include an optional note. Export review notes
downloads JSON containing the world descriptor, case/feature IDs, exact camera
bounds, detail, overlays, and reproduction link. Verdicts are keyed by generator
version, profile, seed, and case. Generated maps are never stored.

The useful review question at this checkpoint is whether the region makes sense:
settlement scale and spacing, countryside/woods/water transitions, connection
placement, and continuity while panning across a cell boundary. Real terrain, roads, buildings, props, and static inhabitants appear in tile mode.
Play here connects the same location to authoritative gameplay.

## Shared contracts

- `GenerationDescriptor` is the authoritative immutable type/version/seed/preset
  identity. Regional v1/v2/v3 share a geographic spine represented by the internal
  `RegionalWorld` helper. Geography, placements, links, and saves resolve through
  the complete descriptor. Unsupported revisions fail explicitly.
- Planner positions are **tiles**, distinct from gameplay's world pixels.
  Cell division floors negative coordinates. The prototype supports query bounds
  within ±16,777,216 tiles; navigation is conservatively bounded inside that.
- Geography is a direct regional field. Settlement reservations raise their
  buildable cores to dry land and taper through an 80-tile halo contained within
  their owner. Regional tile realization consumes these same facts.
- One 1,024-tile cell owns at most one settlement. Settlement IDs and outlines
  depend on the descriptor and owner, never the camera, sampling resolution,
  query window, budget, or job order. Feature identity is the world descriptor
  together with the feature ID.
- East/south settlement connections each have one deterministic owner. A query
  uses one neighboring-cell halo to discover connections spanning its bounds.
  Alternative orthogonal routes are tested against dry-corridor samples; both
  failing rejects the connection. Accepted 16-tile corridors reserve future
  road/sidewalk space, and realization must enforce those terrain reservations.
  These are regional connections, not a complete city street graph.
- Queries cap geographic samples at 24,576, enumerated owners at 144, and visible
  features at 432. Lower budgets are supported. Sample lattices are globally
  aligned powers of two, so overlapping samples at the same spacing agree.
  Larger queries coarsen their samples and return landscape overview without
  settlement/road enumeration; they do not truncate a changing subset of places.
  Small water/vegetation features can be omitted by the sampled overview. This
  slice does not claim a conservative multiscale geographic envelope.

`RegionalPlanner` imports only the seeded noise module and world descriptor.
It does not depend on `World`, `ChunkManager`, sprites, DOM, networking, or a
realm. It exposes synchronous queries for tests/CLI and cooperative row/owner
steps for a browser worker. Overview never constructs chunks or city children.

The browser client keeps one active job and one replaceable pending job. Input
invalidates old work immediately; new requests are debounced while the prior
visible map is transformed on the next animation frame. The worker yields after
short computation slices to process cancellation messages. Responses use request
IDs; obsolete replies, including errors, are discarded. Leaving the page
terminates the worker and releases visible raster buffers; hiding it cancels
obsolete work. Raster and feature residency contain only the current view.

This borrows mclone's independent explorer, direct coarse queries, stable identity,
and bounded detail principles from tactical plans 247/262. There is no mclone
runtime or rendering dependency.

## Evidence and limits

```sh
npm run explorer:bench
npx tsc --noEmit
npm test
npx biome check --write .
npm run build
npx playwright test
```

The initial desktop CLI measurements for seed 2026 were approximately 6 ms median
for the initial region, 4 ms at a negative-coordinate boundary, and 2.4 ms for a
million-tile overview. Every fixture generated zero detailed chunks. These are
planning measurements, not asset loading, transfer, or drawing measurements.

The browser overlay separates worker CPU/elapsed time, transfer, drawing, first
draw, sample buffers, queued/active work, and cancelled/stale jobs. Initial desktop
captures showed about 130 ms to a useful view and 4 ms drawing. Browser tests also
exercise a 390 × 844 viewport with DevTools 6× CPU throttling and real touch
events. This is a phone-layout/performance proxy, not a measurement on a physical
phone. A representative phone and sustained navigation memory profile remain
follow-up measurements before choosing production limits.

Automated checks cover query partition/order/scheduling equality, matching
overlap samples, positive/negative borders, contained dry settlement cores,
unique connection ownership, work limits, version/input rejection, anchored
zoom, shared links, queue replacement, stale rejection, and disposal. Browser
checks cover feature inspection, no game assets or sockets, broad-query limits,
rapid navigation/seed changes, touch drag/pinch, export/persistence, and recovery
from an unsupported version. Visual captures cover desktop, phone, and overview.

## Original slice gates (completed)

The sequence recorded in
[Tactical 005](tactical/005-generator-profiles-and-shared-tile-preview-plan.md)
is complete through A–E: frozen Classic behavior; shared generator selection,
realization, and tile preview; game settings/persistence; planned districts and
source art; safe Play here and saved inspection; then persistent interiors,
countryside, and inhabitants. Stable provenance and deletion/move overlays keep
saved changes separate from generated residency. Later sections record each
checkpoint and the retained revision contracts.

## Real-tile preview checkpoint (Tactical 005 B)

The explorer now offers Regional, Classic, Island, and Flat through the shared
versioned generator catalog. Zoom to 12 CSS pixels per tile to admit exact terrain
automatically; the zoom range extends to 64. For example, open
`world-explorer.html?seed=2026&x=300&y=519&zoom=32` to inspect Ferngrove's major
connection with real terrain/road sheets. Auto has 15% zoom hysteresis. Map
releases detailed chunks; Tiles forces a bounded footprint even at broad zoom;
Coverage colors complete caches green and pending areas amber.

Detail radius is configurable from one to three chunks. The visible footprint
is at most 7×7 chunks, with one chunk of neighbor data around it (at most 81
resident chunks total). The map sample budget is configurable from 1,024 to
24,576. The worker keeps one active and one replaceable pending query, yields
between detailed chunks, rejects stale results, and transfers renderer-free
buffers. Exact content replaces coarse content only after its render cache is
complete. Navigation shares the existing tile-coordinate view and controls.

Terrain assets load lazily using the same manifest, variants, autotiling, and
`TileRenderer` as gameplay. No gameplay realm or simulation is created. Regional
uses its own geography/material sampler and admitted major corridors; Classic's
captured terrain and placement fixtures remain unchanged. Regional district
streets, vegetation, and buildings were added by D–E, described below.

New share links/reports include the immutable generation descriptor and preview
configuration. Existing regional links still resolve `regional-v1` /
`temperate-v1`. Existing coarse review verdicts remain coarse reviews; exact-mode
reviews include presentation identity. Diagnostic memory figures are estimates
of retained typed buffers and completed caches, rather than whole-browser heap.
Desktop and phone-layout captures and actual worker/game buffer parity checks
are automated. Physical phone measurements remain unperformed.


## Game world creation (Tactical 005 C)

**Create this world** opens the game creation controls with the complete explorer
setup. Creation requires the normal New World action, then enters at a dry
starting place. The game menu lists Classic, Island, Flat, and Regional from the
same catalog and shares the explorer's numeric/text seed convention. Blank seeds
are resolved once by the authority. Classic/Island expose road spacing, density,
and width; their complete resolved road configuration is stored with the world.
The Regional profile currently has fixed generation settings.

New metadata stores only the complete `generation` descriptor. Legacy type/seed/
road fields are read through the compatibility adapter. IndexedDB and filesystem
registries use the same resolver; unsupported versions/settings produce explicit
request errors. Game world lists display the selected generator, seed, and
revision. Joins return authoritative identity, including local, serialized, and
multiplayer paths. Concurrent joins share one realm load.

Normal Regional creation finds a dry settlement/planner location using bounded
queries and places the camera/player there. Exact Play here and saved overlays
remain the next D milestone. Unit tests cover filesystem reloads and edited
terrain for all types, authoritative random-seed resolution, concurrent joins,
invalid versions, and direct local consumers. Browser tests create and reopen all
four types through IndexedDB and verify the explorer handoff.

## District and saved-world checkpoint (Tactical 005 D)

Regional **regional-v2** provides: connected streets and alleys,
sidewalk crossings, apartment/shop lots, entrance paths, and playground parks.
Real building facades assemble audited rectangles from the existing ME atlas.
Map lots/entrances and exact props come from one district plan; the worker and
game consume the same generator and scene renderer. Revision selectors retain
the terrain-only v1 option, and old full descriptors/alias links remain pinned.

**Play here** carries the camera position in tile coordinates and the complete
descriptor into the normal game creation/selection flow. The authority validates
identity, realizes terrain/props in a bounded neighborhood, and finds a position
clear of water/solid terrain and building walls within 32 tiles. Failure is
reported without moving the player out of the current realm. Saved-world links
include an explicit world ID; selecting that world applies the same check.

The game menu has **Inspect saved world** links. The explorer source selector
also lists local worlds, or server worlds when opened with `server=host:port`.
Exact saved views overlay terrain edits and stable procedural deletion/move
records. Local inspection says **saved snapshot** and explicitly excludes live or
unflushed changes. The server's read-only bounded HTTP inspection reports
**live authority** for active realms, including unflushed changes. Broad map
views stay procedural and are labelled accordingly. **Refresh saved view**
releases the bounded footprint and requests current data. Unavailable saved
coverage reports an error rather than pretending to show the authoritative world.

Generated Regional props are disposable residency. Saves store only tombstones,
moved prop records, and manually placed objects, so revisiting an unloaded
chunk does not respawn deleted buildings or duplicate a neighbor's placement.
Earlier Classic worlds retain their legacy structure restoration behavior.
The completed interior/countryside milestone is described below; physical phone
measurements remain outstanding.

### Building interiors

In Regional v2 or v3, approach the marked south door of an apartment, shop, or village
home. **Enter · E** opens a furnished room; **Return to street · E** uses the
same authoritative safe-arrival path to return to that door. The touch button
works without a keyboard. Rooms reuse the existing interior wall/furniture art,
depth ordering, and finite-height furniture collision.

An interior is a versioned, stable child instance of its parent world and lot;
two players use the same instance. Furniture deletion/movement persists separately
from disposable generated furniture. Child rooms do not clutter the world list,
and deleting a parent removes its stored rooms. Reloading the game resumes the
parent world; entering its door again restores the room. Initial rooms have one
floor. Shops, apartments, and country homes use separate audited furniture recipes.


### Settled world checkpoint (Regional v3)

New worlds default to **Procedural regional / the newest registered revision**
in the game and explorer (currently **Gentle traffic & roof rides, v11**). Settled
world v3 is labeled legacy; terrain-only v1 and district v2
are labeled old. Classic, Island, and Flat are labeled legacy. Existing
descriptors, saves, and full links stay pinned.
The frozen v2 terrain/placement fixture protects the older district revision.

For seed **2026**, use these explorer locations (tile coordinates):

| Review | Center | Zoom |
| --- | --- | --- |
| City blocks, apartments, and shops | 300, 519 | 3 map / 16 tiles |
| Brookvale village and farm lane | 677, 1320 | 16 tiles |
| Woodland loop, picnic space, and crow | -985, -985 | 12 tiles |

The compact review round includes these structural cases. **Play here** applies
the same descriptor/location in the game. Farms use seedlings, berries,
sunflowers, a shed, a farmer, a cow, and a chicken. Woodland trails admit only dry
loops and clear road/building reservations. City owners vary between market,
garden, and residential styles using the shared district plan.

Actor placement and short destinations come from the selected generator.
The explorer renders static poses; the authority moves actors using ordinary
entity physics and collision. Obstruction by players/edits causes a pause and
route retry/reversal, without teleporting. Generated actors reload at their
canonical route starts. Deleting an actor creates a durable tombstone, which
saved inspection honors. Daily schedules, traffic, and economies are deferred.
Distant multiplayer clients keep independent streaming neighborhoods; the space
between them is not generated merely because both players are present.

Audited new source recipes use `objects.png`: seedling `(80,16,16,16)`, berries
`(64,48,16,16)`, mushroom `(96,0,16,16)`, and sunflower `(128,32,16,32)`.
Existing oak/picnic/shed and person/cow/chicken/crow manifests supply the other
native art. Legacy object labels/rectangles stay frozen for Classic compatibility.

`npm run generation:bench` measures the production factory (terrain, placements,
and actors) without images or rendering. A September 30 workspace run for v3
reported warm medians **1.28–1.64 ms/chunk**, p95 **1.47–1.76 ms/chunk**,
and first fixture iterations **2.74–4.16 ms**. Each measured chunk used
9,025 data bytes in its subgrid/terrain/detail/road/height/collision/blend arrays.
[The raw benchmark record](benchmarks/005-generation-2026-09-30.json) includes
all retained Regional revisions and fixture counts. These timings are desktop evidence.
The ready farm browser capture measured 49 resident chunks, 25 painted chunks,
6.6 MiB of detail buffers/caches, 113 ms terrain work, 3.8 ms autotiling, 197 ms
cold terrain assets, 0.8 ms draw, and 519 ms first view. The woodland capture
measured 42 resident / 20 painted and 5.3 MiB. Source images are shared/lazy and
excluded from those chunk-cache figures. The explorer publishes stages and a
complete-footprint flag; captures wait for completed caches and sprite assets.

Read-only server inspection uses `/api/world-list` and `/api/world-preview`, with
GET/OPTIONS CORS support for an explorer hosted separately from its authority.
A two-client browser test checks live inspection, shared apartment entry,
cross-client deletion, and furniture restoration after a graceful filesystem
server restart. Local IndexedDB tests cover furniture movement/deletion and
reload both outside and inside a room. Browser phone/touch/throttling and sustained
navigation checks pass; **physical phone profiling remains unmeasured**.

The next review should focus on density, village/farm composition, forest variety,
and room variety. More floors and richer inhabitant behavior can then be scoped
from these proven contracts.
