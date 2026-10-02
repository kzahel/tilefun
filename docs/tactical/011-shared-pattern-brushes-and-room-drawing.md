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
