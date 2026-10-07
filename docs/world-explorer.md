# World explorer checkpoint

Current city review/promotion status: [city generation](topics/city-generation.md).
Current performance direction: [performance](topics/performance.md).

The completed regional checkpoint from [Tactical 004](tactical/004-world-explorer-and-regional-generation-plan.md)
is available at `/tilefun/world-explorer.html`. The game menu also links to it.
The explorer and game share the current generator, configurable real-tile previews,
seed/settings selection, districts and persistent interiors. Historical milestone
records live in Tactical 005; they no longer imply playable old revisions. No saved
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

Generated railway routes appear as **purple dashed lines**, including the actual
broad curves. Diamond markers label each **city station**. The **Train stops**
buttons center on either stop, including a destination outside the current view;
centering does not travel. The standalone explorer also has a **Railways & stops**
layer toggle. Very broad overview scales omit planned routes/stops with the other
bounded regional features; zoom in to see them.

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
regional context, boundaries and district streets/art; older countryside case labels
are historical viewpoints, not a separate retained world generator.
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

## Natural landscape preview

For Current regional, **Landscape preview** compares sparse, balanced, lush and extra-dense
compositions with the ordinary generator. The regional map shows woodland cover
and admitted local ponds; Tiles shows their actual trees and shores. Copy location
preserves this selection. **Walk this landscape in lab** opens the same seed,
profile and location in a temporary shared-engine scene. The lab also supplies
nine pinned cases, including three forest pattern kits and a real train journey,
with exact Workshop review notes. Extra dense includes solid thicket interiors;
the darkest map cover distinguishes them from ordinary walkable woodland.
Start from the [natural landscape review links](tactical/068-natural-landscape-preview.md#review-links).

This is an optional composition review. Ordinary world creation still uses the
current default. Saved worlds, archived city snapshots and nonregional presets
disable this overlay. Broad maps can omit small ponds and infrastructure detail;
use Tiles or the lab to assess a particular forest edge or bank. See
[Natural landscapes](topics/natural-landscapes.md) for rollout and future relief.

## Shared contracts

- `GenerationDescriptor` is the authoritative immutable type/version/seed/preset
  identity. Regional generation uses a geographic spine represented by the internal
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
  settlement/road/rail enumeration; they do not truncate a changing subset of places.
  Railway queries reuse the production planner, yield after each owner and count
  routes plus stops against the shared feature cap before district details.
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

## Current creation, saved worlds and archived review

The game offers one Current regional generator plus Classic, Island and Flat presets.
Blank seeds are resolved once by the authority; numeric/text seeds use the same
convention in both tools. Classic/Island road settings are stored in the descriptor.
`CURRENT_REGIONAL_VERSION` is bumped for output changes. Old regional descriptors
can be read as metadata but cannot create or join historical worlds.

**Create this world** opens normal creation controls. **Play here** also supplies
the current location in tile coordinates. The authority validates identity and finds
walkable ground within 32 tiles. Saved-world links include an explicit world ID;
a failed arrival never moves the player out of the current realm.

Incompatible saves remain listed with **Recreate with same seed**. Recreation makes
a new world using the current generator; the original is kept, and no old edits,
interiors, actors or player positions are copied. Delete the original explicitly
when no longer wanted. Automatic startup/resume selects only compatible worlds.

Exact saved views overlay terrain edits and procedural deletion/move records.
Local inspection says **saved snapshot**, excluding unflushed changes; remote
read-only inspection reports **live authority** for active realms. Broad views
remain procedural. **Refresh saved view** invalidates bounded caches. Incompatible
worlds cannot be inspected as if their terrain matched the current generator.

City review links retain old descriptors as provenance for twenty finite archived
scenes. Their exact terrain/props/poses come from committed snapshots, independent
of the evolving generator. The explorer labels them **Archived review** and limits
exact terrain to the captured neighborhood. **Create current world with this seed**
uses the current descriptor and omits the old arrival; it does not promise the same
layout. Choose Current regional to explore beyond the archive. Coarse background
geography is current. See [city generation](topics/city-generation.md).

## Exact preview and interiors

Zoom to 12 CSS pixels per tile for automatic exact terrain (15% hysteresis), up to
64. Map releases detailed chunks; Tiles forces bounded detail; Coverage shows
complete caches in green and pending caches in amber. The visible footprint is at
most 7×7 chunks with a one-chunk neighbor halo (81 resident chunks). Detail radius
is configurable from one to three chunks; map sample budget is 1,024–24,576.
Sprites and terrain sheets load lazily through the shared renderer. Explorer actors
are static poses; gameplay simulates routes through the shared server authority.

Approach a marked apartment or shop door to **Enter · E**; **Return to street · E**
returns through the selected connection. Rooms are stable child instances shared
by players, with persistent furniture edits. Child rooms do not clutter the world
list; deleting a parent removes its rooms. Current building layouts and exact
review fixtures are separate contracts from retired world generation.

`npm run generation:bench` measures current terrain, placements and actors without
images. `npm run streaming:bench -- --assert-ready` measures real-game traversal.
Historical timings remain in `docs/benchmarks/` and numbered tacticals; they do not
require retaining the corresponding historical generator implementation.
