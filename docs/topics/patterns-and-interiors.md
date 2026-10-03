# Shared pattern drawing and interiors

Topic: patterns-and-interiors
Status: Workshop/game pattern drawing and persistent gameplay room editing
implemented; tree-kit review/promotion and Workshop-to-game prefab import remain.
Updated: 2026-10-03.

Owns the shared semantic editing contract and current interior direction.
[Tactical 011](../tactical/011-shared-pattern-brushes-and-room-drawing.md) records
implementation details and validation; [Workshop](../tilefun-workshop.md) and
[Indoor Workbench](../interior-workbench.md) document usage.

## Current state and invariants

- `src/patterns/` owns versioned semantic documents, grid strokes, atomic edits,
  undo/redo and compiler adapters. Rule code has no DOM/React dependency.
  Workshop and gameplay share the terrain/road solvers and apartment compiler.
- Pattern studio draws rooms, fenced-tree strips, terrain and city surfaces on
  actual art. The legacy Indoor Workbench remains for tile-level experiments.
- Gameplay room plans persist with the interior realm and replicate on revision
  changes. Host validation and expected revisions reject stale/conflicting edits
  atomically. Old saves retain their original boundaries until edited.
- The street door/arrival landing stays reserved. Existing occupants need usable
  ground and a route out. Furniture footprint/access/doorway validation uses the
  compiled floor; invalid edits reject without silently removing furniture.
- Browser drafts and gameplay worlds are separate stores. Editing a room does
  not promote a kit or change a frozen generated-world revision.

## Player location, reload and building connections

The runtime retains one shared realm per parent world/building/floor (`0` for
existing interiors). Rooms in an edited floor share that realm. Door IDs name
connections into the realm; they do not create separate instances.
`BuildingDoors.ts` defines outdoor endpoints and indoor activation/arrival anchors.
Legacy identities resolve to the existing `street` connection. Explicit saved
connections can share one interior; leaving uses the selected door's endpoint,
not the player's entry history. The original street connection stays required.
Current generated layouts and the outdoor door control still expose their one
primary entrance. Additional authored exterior openings, outdoor discovery of
secondary connections, and floors require a later content/editor slice; this
change does not alter frozen generators, approved art or existing room boundaries.

`PlayerLocationStore` owns one durable current-location record per profile
(falling back to connection ID for legacy callers), separate from each realm's
saved visit history. It includes the realm, parent world, generator identity and
player position/progress. Solo startup and multiplayer auto-resume restore it;
explicit world selection still travels normally. Old saves without a location
record retain the previous startup fallback until the first checkpoint.

Transfers save the destination before committing the location record. A failed
commit restores the original live entity and leaves the prior durable location
intact. Simulation/input and checkpoints exclude provisional transfers. Profile
takeover waits for the previous transfer before saving/detaching its player;
a takeover save failure keeps the original connection usable and rejects the
replacement. Retired connections cannot reconnect and overwrite their replacement.
Reconnect waits for travel to settle before publishing a fresh baseline. Separate
profiles have separate locations. This coordinates clients of one authority;
independent solo tabs are still independent servers sharing browser storage,
not a supported local multiplayer session.

Restore checks actual compiled room ground, including extensions beyond the
original room. Unavailable buildings and invalid saved interior geometry fall
back to the saved parent/doorway when possible. Storage failures abort restoration
rather than silently overwriting the location with an outdoor fallback.

Dev full reload uses Vite's awaited `vite:beforeFullReload` hook to settle and
save the local authority before navigation. HMR replacement also waits for
shutdown. Ordinary navigation/crashes cannot await unload: realm transfers are
committed immediately, movement checkpoints run every five seconds, and hiding/
unloading makes a best-effort save. Camera restoration requires both the same
profile and realm; legacy unscoped coordinates are discarded.

Evidence: `RealmBrowser.test.ts` covers restart/resume, fallback, location-write
failure, takeover during successful/failed commits and explicit exit selection;
`PlayerLocationStore.test.ts` checks filesystem reopening and ordered retries.
`player-dev-reload.spec.ts` sends the real Vite full-reload event; gameplay interior
and room-editing browser tests cover saved furniture and expanded-room restoration.

## Earlier interior work

[001](../tactical/001-modern-interiors-plan.md) is the original broad plan;
[002](../tactical/002-interior-wall-solver-plan.md) records the wall solver and
233 human-approved wall cases. Preserve those exact images and reopen wall work
only for a concrete furnished-scene failure. [003](../tactical/003-interior-furniture-plan.md)
records curated furniture, motion reviews and the shared support-depth fix.
Its final recorded checkpoint reopened bedside/worktable reviews; read current
feedback before assuming they are still pending.

Use [counterexample search](../interior-counterexamples.md) for reproducible
wall failures and [art review](art-review.md) for exact approvals and pause rules.
Rendering evidence and runners are routed through [performance](performance.md).

## Next work

Review room editing, doorway constraints and partitions in gameplay, then add
explicit Workshop-to-game prefab promotion/import with reviewed doorway and
occupancy contracts. The five fenced-tree kit cases were delivered unchecked;
consult the inbox before promotion. Additional tree variants, playground tubes
and new furniture families remain separate candidates, not implicit approvals.
