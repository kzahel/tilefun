# Embedded engine labs

Topic: embedded-engine-labs
Status: shared scenario simulation and embedded outdoor presentation host delivered;
Traffic and Outdoor Geometry use shared engine interpolation, asset setup and render
lifecycle; Traffic also uses the shared terrain policy.
Other interactive lab presentation adapters remain to migrate.
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

`ScenarioPresentationHost` owns Traffic and Outdoor Geometry's client/Worker,
production `GameLoop`, render host, asset lifetime, camera and frame storage. The React page supplies
controls, input, viewport/settings and diagnostic UI. [Tactical 048](../tactical/048-embedded-presentation-host.md)
records this extraction and its validation. Shared owners are:

- `PlayerPresentation`: fixed-tick follow and exponential sub-tick camera
  interpolation, called by both `PlayScene` and the lab. Predictor previous poses
  supply body and camera interpolation together. The lab's -12px framing offset
  is explicit; position commands snap, while ordinary movement interpolates.
- `OutdoorPresentation.presentTerrain`: one scheduler/publication policy for game
  and lab, retaining the shared default 2 ms/128-row budget and experimental
  two-row/completed-chunk mode. `collectScene` and `collectSceneOrder` provide the
  common actor/prop/grass/elevation/mesh presentation.
- The existing Canvas/GPU `RenderHost` implementations configure complete terrain
  assets (blend sheets, roads, variants) and own recovery/disposal. Embedded GPU
  placement keeps the world canvas beneath the lab's input/UI canvas through
  scrolling and resize. The replica uses server-computed autotiles.

Pause submits no simulation steps; hidden views stop/restart the clock without
hidden-time debt. Disposal releases the Worker, frame, host and assets; late
asset arrivals close without publishing a renderer. Diagnostics are on-demand,
including interpolation and terrain state, and are detached with readiness on exit.
Traffic reset still creates a fresh canvas. Context loss/recovery uses the
production render host. The [cache investigation](performance.md#traffic-workshop-cache-churn)
records the earlier competing-preparation failure.

Outdoor Geometry now uses this host with an explicit fixed world camera, no terrain
or grass, pixel-exact shadows and a scoped asset loader. Its grid underlay and
geometry overlay use backend-neutral `OverlayFrame` commands before/after the
replicated scene. Player collider outlines use the scene collector's interpolated
position and predictor history; fixed framing never turns into player follow on
movement or teleport. The host owns each walker bitmap and releases it on metadata
changes/unmount; the catalog's borrowed HTML image remains usable. Grid lines,
fixture selection and DOM input remain lab responsibilities. Closing the geometry
panel stops the clock and disposes its Worker and GPU sibling canvas. See
[Tactical 050](../tactical/050-outdoor-geometry-presentation.md) for validation.

This host currently presents outdoor scenarios. It does not replace the full
GameClient's menus, audio, particles, indoor scenes or world/profile persistence.
The bounded scenario scheduling/transport remains distinct from LocalServerRuntime.

| Remaining consumer | Current boundary / next work |
| --- | --- |
| `CharactersPage` | Shared scenario authority; local clock and native CharacterTestScene presentation/cycle inspector. Preserve source-hashed approval references when separating interactive presentation. |
| `interiors/playtest/main.ts` | Shared scenario authority; furniture-specific layout and native room presentation. Needs an indoor host adapter and review-contract validation. |
| Static diagrams, source experiments and frozen approval renders | Intentional diagnostic/reference adapters; no claim of full gameplay parity. |

Shared authority alone does not establish presentation or performance parity for
these remaining tools. Migrate them with focused evidence, preserving approved
reference pixels and explicit diagnostic camera/overlay policies.

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

Next: migrate the interactive character lab clock/presentation into the shared
host, preserving the independent source-hashed approval renderer; then address
the indoor playtest adapter. This topic owns the continuing constraint and
outstanding gaps; tacticals own bounded migration evidence.
