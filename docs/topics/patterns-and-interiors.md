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
