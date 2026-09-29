# World explorer checkpoint

The first regional slice of [Tactical 004](tactical/004-world-explorer-and-regional-generation-plan.md)
is available at `/tilefun/world-explorer.html`. The game menu also links to it.
This is a procedural regional preview; game terrain still uses the legacy
generator. No saved world is changed by opening the explorer.

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
placement, and continuity while panning across a cell boundary. Apartment art,
local street layout, collision, and walkability are subsequent checkpoints.

## Shared contracts

- `RegionalWorld` is immutable seed + `regional-v1` + `temperate-v1`. The profile
  currently fixes all generation settings. Future settings that affect output
  must become part of that descriptor. Unsupported links fail explicitly.
- Planner positions are **tiles**, distinct from gameplay's world pixels.
  Cell division floors negative coordinates. The prototype supports query bounds
  within ±16,777,216 tiles; navigation is conservatively bounded inside that.
- Geography is a direct regional field. Settlement reservations raise their
  buildable cores to dry land and taper through an 80-tile halo contained within
  their owner. Future tile realization must use these same facts.
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

Slice 2 refines Ferngrove into a connected district with streets, varied blocks,
lots, a park, and apartment/shop footprints. Inspect the minimum apartment and
shop recipes before accepting lot widths and facings.

Before slice 3, wire the complete descriptor into both world registries and the
server protocol, with missing versions selecting the legacy generator. Planned
worlds must replace the old roads/structures where applicable. Define stable
procedural object provenance and deletion/move overlays before regeneration can
affect saved props. A seed preview should create a matching new world when
entering play; inspecting a saved world must carry its explicit world ID and
obtain authoritative saved changes. None of those game/persistence paths are
enabled at this checkpoint.
