# Engine capability map and backlog

Reconciled against code on 2026-10-03. This replaces the old prioritized generic
checklist; [the original](archive/engine-architecture-checklist.md) is retained as
history. The [roadmap](ROADMAP.md) owns project priorities and [ideas](ideas.md)
owns uncommitted proposals.

## Existing foundations

| Capability | Current owner / limit |
| --- | --- |
| Authority and replication | [Client/server architecture](client-server-architecture.md), [networking topic](topics/multiplayer-networking.md) |
| Action mapping | [ActionManager](../src/input/ActionManager.ts) |
| Scene lifecycle | [SceneManager](../src/core/SceneManager.ts) and scene implementations |
| Assets and review | [GameAssets](../src/assets/GameAssets.ts), [art review](topics/art-review.md); committed inventories and immutable promoted banks |
| Persistence/migrations | [SaveManager](../src/persistence/SaveManager.ts), [migrations](../src/persistence/migrations.ts), IndexedDB and filesystem stores |
| Trusted scripting/services | [Scripting guide](SCRIPTING-API-DESIGN.md); no untrusted-mod sandbox |
| Fixed stepping and physics | [Physics guide](3D-PHYSICS-DESIGN.md); input replay and presentation interpolation |
| Spatial queries and tick tiers | [Spatial scheduling](SPATIAL-OPTIMIZATION.md) |
| Editor history | [Patterns/interiors](topics/patterns-and-interiors.md); atomic gestures and per-editor room history, not universal undo for every mutation |
| Audio | [AudioManager](../src/audio/AudioManager.ts); one-shot playback with volume/pitch/pan |
| Depth and prop support | [propDepth](../src/rendering/propDepth.ts), shared actor/furniture ordering |
| Console/debugging | [ConsoleEngine](../src/console/ConsoleEngine.ts), client CVars and 3D debug view |

## Candidates requiring a concrete need

- Broader undo/destructive-edit safety, outside existing pattern and room history.
- Audio beyond existing effects: music transitions and ambient soundscapes.
- Pooling or other allocation work after an entity/particle profile identifies it.
- Additional render layers/effects after checking current shared depth handling.
- General replay/export, localization, broader user settings and UI transitions.
- Loading progress and stronger asset-key typing where a real workflow benefits.

These are possibilities, not a requirement to build a framework or replace an
existing owner. Old performance estimates and “small effort” labels were guesses.
[Performance](topics/performance.md) records measured bottlenecks and next work.
