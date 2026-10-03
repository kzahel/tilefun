# SpriteDef split — implemented

The original Phase 2 proposal is preserved in
[the archive](archive/spritedef-split-plan.md). Its field lists, entity counts,
JSON bandwidth estimates and suggested next phase describe that point in time.

Current behavior is owned by [networking](topics/multiplayer-networking.md):
[EntityDefs](../src/entities/EntityDefs.ts) contains static definitions and
[serialization](../src/shared/serialization.ts) merges them with dynamic wire
state. The renderer still consumes complete runtime entities. Animation
frame/timer and AI timer are omitted from current snapshots, unlike the proposal.
Entity deltas, binary encoding and dedicated channel routing also exist now.

Use [protocol.ts](../src/shared/protocol.ts) for snapshot types and
[serialization tests](../src/shared/serialization.test.ts) for reconstruction
coverage. Do not implement this archived split again.
