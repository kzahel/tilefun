# World explorer checkpoint

The first regional slice of [Tactical 004](tactical/004-world-explorer-and-regional-generation-plan.md)
is available at `/tilefun/world-explorer.html`. The game menu also links to it.
Tactical 005 A–C adds shared versioned generators, configurable real-tile
preview, and game type/seed/settings selection with pinned persistence. No saved
world is changed by opening the explorer.

## Run and review

```sh
npm run dev
```

Open `http://localhost:5173/tilefun/world-explorer.html`. For a standalone preview
without the development game server, use `npm run build && npm run preview` and
open the same path at port 4173.

Start with seed **2026**, centered on Ferngrove. The three review buttons show
the city/countryside view, a planning-cell boundary, and the wider landscape.
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
placement, and continuity while panning across a cell boundary. Real terrain/major roads are now available through tile zoom; apartment art and
local street layouts are subsequent checkpoints.

## Shared contracts

- `RegionalWorld` is immutable seed + `regional-v1` + `temperate-v1`. The profile
  currently fixes all generation settings. Future settings that affect output
  must become part of that descriptor. Unsupported links fail explicitly.
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

## Next slice gates

The agreed next sequence is recorded in
[Tactical 005: generator profiles and shared tile preview](tactical/005-generator-profiles-and-shared-tile-preview-plan.md).
First freeze Classic and establish shared generator selection/realization; then
add configurable zoom into real tiles; then support generator type/seed/settings
in actual game creation and persistence. The current checkpoint implements A–D. Explorer and gameplay will consume one implementation
per selected generator, with the existing terrain/scene pipeline reused.

After those slices, Tactical 004's slice 2 refines Ferngrove into a connected
district with streets, varied blocks, lots, a park, and apartment/shop footprints.
Inspect the minimum apartment and shop recipes before accepting lot widths and
facings.

Tactical 005's A–C slices establish descriptor compatibility, generator-owned
roads/structures, and both world registries/protocol paths. Before the later
building/arrival slice, define stable procedural object provenance and
deletion/move overlays so regeneration preserves saved changes. **Play here**
requires authoritative safe-spawn resolution; inspecting a saved world carries
its explicit world ID and obtains saved overlays from that authority. Those paths are now enabled; see the district checkpoint below.

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
streets, vegetation, and buildings are the later D–E slices.

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

New Regional worlds default to **regional-v2**: connected streets and alleys,
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
The next milestone adds persistent interior realms and broadens countryside
realization; physical phone measurements remain outstanding.
