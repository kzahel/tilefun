# Embedded engine labs

Topic: embedded-engine-labs
Status: shared scenario simulation and renderer components delivered; shared
presentation hosting remains incomplete. Traffic cache churn fixed; interpolation
and broader lab presentation alignment remain follow-up work.
Updated: 2026-10-04.

Owns the architectural constraint that interactive labs are embedded consumers of
the game engine and must evolve with it. [Gameplay scenarios](gameplay-scenarios.md)
owns recipes, memory persistence and simulation hosting;
[rendering architecture](rendering-architecture.md) owns presentation/backend
contracts; [performance](performance.md) owns timing evidence and its limits.

## Required architecture

**An engine change is incomplete until its affected embedded lab consumers have
been accounted for.** Shared simulation, prediction, presentation and resource
lifecycle fixes must reach both the game and the relevant labs. Importing the
same renderer class alone does not establish parity: configuration, scheduling,
interpolation, preparation, invalidation and disposal are part of the contract.

- Interactive gameplay labs use the production Realm, gameplay definitions,
  streaming, replication and player prediction through the scenario host. Recipes
  supply data and authority commands, not replacement movement or physics loops.
- Game and lab hosts must consume shared presentation and lifecycle policies.
  Extract reusable engine behavior when a lab needs it; avoid copying a reduced
  game loop into a React view. This does not require mounting the whole game UI
  or instantiating `GameClient` for every inspector.
- Each view has one coordinated terrain preparation/retention policy. A visible
  completion pass must not evict a scheduler's retained surrounding chunks or
  repeatedly discard partial work. Warm stationary scenes should settle, without
  rebuilding or uploading unchanged content indefinitely.
- Interpolation, animation/pose evaluation, asset configuration, projection,
  ordering and mesh fallback follow shared engine contracts. Diagnostic camera
  presets and intentional paused/single-step modes are explicit host options;
  they must not silently redefine ordinary movement presentation.
- Each embedded session owns its disposable Worker, replica, frame storage and
  graphics resources. Reset, tool changes, resize, late asset arrival and teardown
  must respect engine ownership rules. Temporary persistence stays isolated from
  player worlds; candidate settings stay session-scoped.

Lab-specific responsibilities are fixture selection, DOM controls, viewport and
camera intent, diagnostic overlays and review actions. Static art diagrams,
source/geometry experiments and immutable approval renders may intentionally use
independent reference adapters. Label those boundaries; their exceptions do not
justify a second interactive gameplay pipeline or imply end-to-end engine parity.
Changed review pixels still follow [art review](art-review.md).

## Current implementation and gaps

`ScenarioSession` hosts a production Realm over `MemoryRecordStore` and
`RecordPersistenceStore`; `ScenarioClient` uses a dedicated scenario Worker,
binary replicas and `PlayerPredictor`. This is a temporary engine host, with
explicit step scheduling, rather than the game's complete `LocalServerRuntime`
and `GameClient` composition. The simulation migration is delivered.

Presentation is less consolidated. `src/workshop/TrafficPage.tsx` selects the
shared Canvas/GPU backend and uses `collectScene`, but owns its own animation
loop, camera updates and terrain calls. The game uses `PlayScene`, `renderWorld`
and its render host. Traffic alignment status:

- Terrain now uses the same single budgeted scheduler and default 2 ms/128-row
  limits as gameplay. The redundant visible-only pass, which discarded offscreen
  resources and partial builds every frame, has been removed.
- The camera snaps to the player and scene collection receives interpolation
  alpha 1. The game's interpolated player/camera path is not used.

The [traffic investigation](performance.md#traffic-workshop-cache-churn) records
the cache diagnosis and fix validation. `tests/traffic-rendering.spec.ts` checks
stationary cache settling, riding, pause, reset and exit in Canvas, GPU sprites
and GPU + meshes. The lab exposes on-demand terrain diagnostics without adding
per-frame measurement work; teardown removes that callback and its ready flag.
Reset also replaces the canvas: a disposed GPU backend deliberately loses its
context, so its old canvas cannot host the replacement renderer.
Other interactive labs need a consumer audit; shared scenario
simulation does not establish presentation or performance parity for all tools.

## Change and validation discipline

When changing simulation/transport, prediction/time, asset setup, rendering,
terrain preparation or host lifecycle:

1. Identify the affected game and embedded consumers. Update the shared owner and
   its callers together; record any intentional diagnostic difference here.
2. Add or extend a regression at the boundary that could drift. A gameplay-only
   test or a lab's “ready” flag is insufficient evidence for shared behavior.
3. Exercise the affected interactive lab through its real Worker and backend as
   well as the game. For cache/scheduling changes check stationary settling,
   movement readiness and bounded resources. For time/prediction changes check
   motion and pause/resume; for lifecycle changes check repeated reset/tool exit.
4. Run the applicable repository validation from [AGENTS.md](../../AGENTS.md).
   GPU evidence uses bundled full Chromium. Compare matched scenes and report
   device, backend and measurement limits; functional or pixel parity alone does
   not establish frame pacing.

Existing entry points include `tests/traffic.spec.ts`, `tests/gpu-renderer.spec.ts`,
the scenario tests under `src/scenarios/`, and the shared renderer boundary and
terrain preparation tests. Prefer behavioral/cache counters over brittle FPS
thresholds in regression tests, with separate browser timing evidence.

Next: consolidate presentation scheduling/interpolation and audit the remaining
interactive labs against this contract. Track bounded implementation slices in
tacticals; this topic owns the continuing constraint and outstanding gaps.
