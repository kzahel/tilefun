# Shared pattern brushes and direct room drawing

## Goal

Draw semantic intent on real tiles, using the same rules in Workshop, game editing,
and eventually generation. A tree strip is an east/west pattern with its fence on
the south edge; its canopy size does not define its connectivity. Rooms should be
drawn on the rendered art rather than requiring a separate emoji grid.

Preserve the existing terrain adjacency/bridge solver, road neighbor composer and
apartment architecture compiler. Share editing mechanics, not a new universal
constraint solver. All committed art must be sufficient for a fresh clone.

## Contracts

- `src/patterns/`: versioned family definitions, integer grid strokes (including
  interpolation and horizontal snapping), semantic documents, validated atomic
  edits, bounded undo/redo and compiler adapters. No DOM or React in rule code.
- A family declares its grid size, allowed connections, dirty halo, source art,
  and compiler. State contains semantic cells; sprites are derived output.
- A pointer gesture has a fixed starting tool/value/erase mode. Preview from the
  original document, commit once on release; cancel leaves history unchanged.
  Validate the complete proposed edit before accepting it. Undo restores intent.
- Rooms use 32px plan cells and the existing apartment compiler; render cells are
  16px. Rectangle creates perimeter walls and room floor; wall/floor/door/erase
  edit the plan directly. Invalid door topology is explained before commit. Disconnected draft rooms are
  allowed with a visible warning; gameplay promotion must pass strict reachability.
- Tree strips use 16px ground anchors, east/west connections only and a south
  fence. A gesture snaps to its starting row. Separate rows may coexist. Source
  left/right pieces and repeating middle pieces must be inspected, with minimum
  supported lengths explicit. Removing a middle cell re-resolves both new ends.
- Collision is a separate explicit candidate footprint, never the canopy bounds.
  Candidate rules cannot silently alter frozen generation revisions.
- Terrain/road adapters call `TerrainEditor` and `TileRenderer`; do not duplicate
  their neighborhood rules. Semantic document snapshots are portable JSON.

## Delivery phases

### 1. Editing foundation and source-backed tree kit

Shared strokes/history, family metadata and bounded document parsing. Inspect the
marked `me-complete` region (1568,0,432,96); define a versioned candidate kit with
ends, repeats, minimum length, anchor and fence collision. Register actual source
uses in the existing art inventory. Tests cover gaps, reverse drags, snapping,
negative coordinates, erase splitting, invalid edits and stable recompile.

### 2. Native Workshop pattern studio (first review checkpoint)

One sidebar entry with room, fenced-tree, terrain and city-surface examples.
Direct rendered-art editing, preview/validation, erase, undo/redo, reset, grid and
geometry overlays, predictable center zoom, Shift/middle drag pan and arrow keys.
Browser-local drafts clearly identified, with JSON export/import. Source links
show the rule's actual art. Fixed tree-kit cases enter the global review inbox
with exact source/rule/pixel identities and the established approve/comment/next
workflow. Drafts do not count as human approval.

### 3. Game reuse (included in first checkpoint)

Use the shared interpolated grid stroke in existing terrain/road input. Expose
city asphalt/pavement through the existing road backend. Add a fenced-tree row
brush using the same compiler as Workshop. Host validates a whole snapped stroke
and updates affected runs atomically; persistent versioned run identity recreates
sprites/collision through normal prop save/load and multiplayer snapshots.
Existing game terrain/road queues remain incremental; whole-gesture undo for
those backends requires a later protocol extension. Workshop histories and tree
transactions operate on complete gestures now. Allow erase/split and explicit
undo/redo for tree strokes, isolated per editor
session and cleared on realm changes. No changes to generated city banks.

### 4. Follow-on room/worldgen integration (after brush review)

Promote the reviewed tree kit under a new asset version before adding it to a new
worldgen revision. Editable gameplay room plans need authoritative plan storage,
network synchronization, derived floor rendering/wall collision and validated
furniture reconciliation; do not approximate a room as one Y-sorted prop. Extend
the existing indoor editor to the shared operations, then introduce gameplay room
transactions. Promote approved room documents as prefabs through the existing
review workflow, with explicit doors and occupancy.

### 5. More pattern families

Playground tube straight/end/bend/T/cross ports; overlapping-tree strips and
planter variants; fences, curbs, road markings and park paths. Add per-family
constraints/examples before broad painting. Neighborhood brushes can later place
approved patterns using reservations/paths from the district planner. Pattern
registry/source-use links should be visible from atlas selections.

## Validation and review

Workshop drafts use a bounded complete replay through the existing backend;
terrain/road runtime edits retain their existing neighborhood invalidation. The
first checkpoint does not introduce a new incremental room compiler.

Run all three typechecks, unit tests, Biome, regenerated source catalog and
Workshop manifest, production build and full Playwright suite. New browser tests
exercise drawing against real art, invalid edits, history, draft reload/import,
zoom/pan, review navigation and game placement/save/load. Use isolated bundled
Chromium and ignored test data. Never write synthetic human approvals.

First human review: source caps/repeat joins, fence collision overlays, row
snapping/erase splitting, room rectangles/door validation, and terrain/road parity.
The next phase begins after feedback is addressed and candidate art is approved.

## Delivered checkpoint — 2026-10-02

Phases 1–3 are implemented. Foundation commit: `35e108e`; native Workshop/game
integration: `4a3e6bf`, followed by viewport/navigation verification polish.

- [Draw patterns](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/patterns)
  has all four backend adapters, direct room rectangles/partitions/doors, atomic
  preview/history, portable drafts and phone fitting.
- [Review the tree kit](https://tilefun.graehlarts.com/tilefun/workshop.html#/review/pattern%3Afenced-trees-v1-short)
  starts five globally indexed cases. The broadleaf source caps/repeat are mapped;
  the other marked fenced-tree variants remain follow-on kits.
- The game Patterns tab uses the same row resolver, compiler and source pieces.
  Terrain/road input shares integer interpolation; city surface brushes use the
  existing persistent road IDs and neighborhood rendering.
- All 322 earlier candidate records are unchanged. The five additions remain
  unchecked; generated worlds/banks and human approvals were not altered.

Validation: all three TypeScript configurations, 1,162 unit tests, Biome (existing
warnings only), source catalog/manifest checks and production build passed. The
full browser run passed 227 cases and found one stale assertion expecting 15 tools
instead of 16. After correcting it and adding a phone-fit case, all eight targeted
pattern/navigation cases passed (229 distinct browser cases covered). The live
checkout on port 5174 rendered the studio and exact review with no browser errors;
its public deployment serves that same checkout. Filesystem and browser reloads
restore tree art/collision, and undo rejects conflicting row edits.

Next: human review of these brushes/cap seams/footprints, then phase 4's editable
gameplay room plans and reviewed-kit promotion. Playground tubes and the remaining
fenced/overlapping-tree variants follow through the same registry and review loop.


## Delivered gameplay-room checkpoint — 2026-10-03

The gameplay-room portion of phase 4 is implemented. Enter any supported building
and open the game editor: Rooms draws directly on the actual interior, while Props
uses the supported indoor furniture palette. The same semantic room document and
brush operations drive Workshop and gameplay; no second architecture solver was
introduced. The existing legacy Indoor Workbench remains available for tile-level
experiments; Pattern studio is the shared semantic drawing surface.

- Each interior realm owns `GameplayRoomState` (`version: 1`, monotonic revision,
  `rooms-v1` document), saved as optional `SavedMeta.roomPlan`. Old saves need no
  migration and retain their original shell/boundary until edited. Editable canvases
  start at 24×16 semantic cells; the shared schema remains bounded at 48×32.
- Whole gestures commit atomically. Commands include the interior ID and expected
  revision. Host validation, per-editor undo/redo (50 strokes), stale/conflict checks
  and session cleanup prevent delayed or conflicting edits overwriting a room.
- The apartment compiler's floor strips and jambs derive usable ground; its void
  complement becomes compact, chunk-indexed collision rectangles. Interior boundary
  snapshots carry the actual rectangles for prediction. The room plan replicates
  initially and on revision changes, not every frame. All needed interior chunks
  load for expanded plans.
- The original street door/arrival landing is reserved. Draft rooms may be isolated
  while being built, matching Workshop; current residents must remain on usable ground
  with a footprint-sized route out. Furniture footprints, access and doorway exclusion
  use the existing furniture validator through a compiled-floor predicate. Invalid
  edits/undo reject atomically; no furniture is silently removed. Supported furniture
  spawn/move also uses these constraints. Walkable furniture tops remain traversable.
- Static floor/wall bands cache per changed plan. Edited partitions participate in
  ground-depth ordering with live furniture/actors. Host ground geometry also caches
  per plan; furniture moves do not rebuild the shell. The legacy rendering path and
  all 327 Workshop review candidates retain their existing identities/pixels.
- Editor controls include preview, erase, room rectangle, floor/material, wall and
  constrained doors, buttons/keyboard undo, Escape/blur/pinch cancellation and
  Shift/middle pan. Outdoor terrain/road/elevation controls stay outside interiors.

Validation passed all three TypeScript configurations, 1,171 unit tests (112 files),
all 230 Playwright cases, Biome (existing warnings only), and production
inventory/manifest/build checks. The new browser flow draws
an adjoining room and side passage, tests history and invalid edits, walks through
the real collision, and reloads the saved plan/geometry. Server integration covers
multiple editors, binary-compatible snapshots, conflict rejection and persistent
reopening. Browser drafts and gameplay worlds remain distinct stores.

`npm run gameplay:bench -- --headed --edited-room` measures the original and edited
room alongside outdoor gameplay in isolated bundled Chromium. On this checkout,
both indoor paths held an 8.3ms median frame interval and about 0.3ms median render
cost (edited render p95 1.0–1.4ms across two runs), with responsive movement and no
browser errors.
These are local measurements, not a claim about every device.

Next: review room editing/door constraints and partitions in gameplay, then provide
explicit Workshop-to-game prefab promotion/import with reviewed doorway/occupancy
contracts. Tree-kit approval/promotion, new worldgen revisions and additional
pattern families remain separate milestones; this checkpoint does not promote art.
