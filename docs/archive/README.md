# Archived plans and investigations

Preserved history, not startup guidance or an active backlog. On 2026-10-03 the
older proposals below were checked against current source and separated from
living guidance. Original phase labels, estimates, code sketches and hypotheses
remain in these copies; each points back to its current owner.

| Historical record | Current entry point / reason |
| --- | --- |
| [Client/server extraction](client-server-extraction-plan.md) | [Architecture](../client-server-architecture.md); default single player now uses a Worker replica, and multiplayer is implemented |
| [Slow-field deltas](wire-protocol-delta-plan.md) | [Protocol status](../WIRE-PROTOCOL-DELTA-PLAN.md); implemented and evolved into frame/sync messages |
| [SpriteDef split](spritedef-split-plan.md) | [Split status](../SPRITEDEF-SPLIT-PLAN.md); static definitions and dynamic snapshots implemented |
| [3D physics design](3d-physics-design.md) | [Physics](../3D-PHYSICS-DESIGN.md); shared movement, height, prop platforms and 3D debugging now exist |
| [Spatial optimization](spatial-optimization-plan.md) | [Spatial scheduling](../SPATIAL-OPTIMIZATION.md); tick tiers exist, with remaining full collection passes |
| [Scripting API proposal](scripting-api-design.md) | [Scripting guide](../SCRIPTING-API-DESIGN.md); actual API, synchronous events and mod organization differ |
| [Engine checklist](engine-architecture-checklist.md) | [Capability map](../ENGINE-ARCHITECTURE-CHECKLIST.md); several formerly proposed capabilities have shipped |
| [Riding investigation](riding-debug-investigation.md) | [Riding diagnostics](../RIDING-DEBUG.md); historical snapping theories are not freshly reproduced failures |
| [Physics drift reduction](physics-sim-drift-reduction-plan.md) | Existing archive; current movement owners are in [physics](../3D-PHYSICS-DESIGN.md) |

Completed numbered [tacticals](../tactical/README.md) stay in their original
directory as indexed execution records. New accepted work gets a new tactical;
do not restart one of these old plans based on an unchecked item.
