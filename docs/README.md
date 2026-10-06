# Documentation map

Start with the [roadmap](ROADMAP.md) for direction or [ideas](ideas.md) for the
uncommitted backlog. [Setup and local data](setup-and-local-data.md) covers fresh
clones, assets and data transfer. Agent instructions live in [AGENTS.md](../AGENTS.md).

## Where information belongs

| Location | Owns |
| --- | --- |
| [Roadmap](ROADMAP.md) | Short project direction and links to current work |
| [Ideas](ideas.md) | Uncommitted possibilities and links to original feedback |
| [Topics](topics/README.md) | Living status, decisions, contracts, evidence and next work for a focused concern |
| [Tacticals](tactical/README.md) | Numbered, bounded implementation plans and execution records |
| Guides and architecture below | Usage, commands and durable system structure |
| [Research](#research-and-history) | External references and historical evidence |

Read the relevant topic before a continuing task. Update it when the contract,
status or next direction changes; put detailed slice evidence in its tactical.
Keep one owner for each fact and link to it instead of copying a progress log
into agent instructions, the roadmap and several guides. Record approval status
as a dated checkpoint; the live review inbox owns subsequent human decisions.

Create a topic only when continuity helps. New implementation plans belong in
`tactical/NNN-short-name.md`; use the next unused number and update the index.
Preserve completed tacticals as execution records. Archive genuinely superseded
material with a pointer to its replacement; don't discard evidence or infer
completion from an old unchecked checklist. Existing guide filenames stay stable.

## Guides and architecture

| Area | Read |
| --- | --- |
| Setup and portable data | [Setup](setup-and-local-data.md) |
| Workshop, login and feedback APIs | [Workshop](tilefun-workshop.md), [art workbench](art-workbench.md) |
| Embedded gameplay labs | [Engine alignment](topics/embedded-engine-labs.md), [scenario runtime](topics/gameplay-scenarios.md) |
| World exploration and generation | [World explorer](world-explorer.md), [city topic](topics/city-generation.md) |
| Rooms, furniture and drawing | [Interior workbench](interior-workbench.md), [counterexample search](interior-counterexamples.md), [editing topic](topics/patterns-and-interiors.md) |
| Authority, transport and hosting | [Client/server](client-server-architecture.md), [network design](NETWORK-ARCHITECTURE.md), [networking topic](topics/multiplayer-networking.md), [server security](SERVER-SECURITY.md) |
| Rendering and backend separation | [Architecture](topics/rendering-architecture.md), [progress tracker](tactical/022-renderer-backend-decoupling.md), [performance evidence](topics/performance.md) |
| 3D assets and GPU experiments | [Asset workstream](topics/3d-assets.md), [investigations and renderer options](research/sprite-to-3d-and-renderer-options.md) |
| Simulation and prediction | [3D physics](3D-PHYSICS-DESIGN.md), [riding debugging](RIDING-DEBUG.md), [prediction lessons](hard-won-knowledge.md), [spatial optimization](SPATIAL-OPTIMIZATION.md) |
| Entity persistence and unloading | [Current status](topics/entity-activation.md), [target architecture (planned)](entity-streaming-architecture.md), [refactor sequence](tactical/019-entity-streaming-and-persistence.md) |
| Experiences and scripting | [Scripting API design](SCRIPTING-API-DESIGN.md), [vision](VISION.md) |
| Art and characters | [Sprite inventory](SPRITE-INVENTORY.md), [Blender workflow](blender-pixel-characters.md), [character roster](pixel-character-roster.md), [asset credits](../public/assets/SOURCES.md) |
| Product possibilities | [Vision](VISION.md), [competitive analysis](COMPETITIVE-ANALYSIS.md), [ideas](ideas.md) |

Current architecture guides have been separated from their original proposals.
The [archive index](archive/README.md) maps preserved plans/investigations to
current owners. Earlier speculative interfaces and bug hypotheses remain useful
history, not instructions to implement or confirmed present-day failures.

## Research and history

- [Train reload presentation pacing](research/train-refresh-pacing.md)
- [Airborne support momentum](research/airborne-support-momentum.md)
- [Rider-free camera timing reproductions](research/camera-basics-reproductions.md)

- [Sprite-to-3D investigations and renderer options](research/sprite-to-3d-and-renderer-options.md)
- [Entity streaming: Minecraft Java and mclone](research/entity-streaming-reference.md)
- [Wire protocol survey](research/wire-protocol-survey.md)
- [Roblox economy and ownership](research/roblox-economy-and-ownership.md)
- [Roblox VR/XR API](research/roblox-vr-xr-api.md)
- [WebXR support](research/webxr-vr-support.md)
- [Archive index and current replacements](archive/README.md)
- [Archived physics drift plan](archive/physics-sim-drift-reduction-plan.md)
- [Instrumentation tools](../scripts/instrumentation/README.md)

Research records external findings at the time of writing; recheck them when a
new decision depends on current platform behavior.
