# Embedded engine labs

Topic: embedded-engine-labs
Status: shared scenario simulation and presentation host delivered for Traffic,
Outdoor Geometry, World Geometry, Character lab and indoor furniture playtest.
The identified interactive lab migrations are complete.
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

`ScenarioPresentationHost` owns the migrated labs' client/Worker, production
`GameLoop`, render host, asset lifetime, camera and frame storage. The lab page supplies
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

Character lab now uses the same host with fixed framing, verified source/fixture
assets, semantic grid/geometry overlays and live viewport resize. Settings rebuild
only that temporary scenario; zoom leaves the Worker alive. Pose cycling explicitly
pauses simulation and supplies a display-only sprite copy to the ordinary scene
collector. It never overwrites replicated/predicted animation state. The production
clock drives both movement and inspection, and hidden views accrue no time debt.
`CharacterTestScene` remains the immutable reference renderer used by candidate
verification; it is no longer the interactive scene. The candidate fingerprint
formula, reference pixels and approved gameplay bank are unchanged. See
[Tactical 054](../tactical/054-character-presentation-host.md).

Furniture playtest now uses the same host for its production clock, prediction
interpolation, room presentation, Canvas/GPU configuration and resource lifetime.
`presentInterior` is shared with the game's indoor renderer; `collectScene` supplies
actors and support-aware ordering while `InteriorPresentation` caches room geometry.
The lab owns layout editing, path targets, Canvas diagnostic UI and an explicit
fixed-room camera with interpolated jump headroom. Reports capture the world and UI
together without advancing simulation. Reset/edit replaces and disposes the session;
CSS resize preserves it, and renderer query settings survive scene changes.

Static `drawFurnishedInterior` approval renders, source assets and image fixtures
remain unchanged. Live movement reviews now include `presentationVersion: 1`:
the engine's 60 Hz clock, interpolated actors and production shadows replace the
native 120 Hz loop/hand-built actor. The eleven motion identities reopen for review;
prior reports remain historical, and static candidate identities are preserved.
See [Tactical 056](../tactical/056-furniture-presentation-host.md).

This host presents outdoor and indoor scenarios. It does not replace the full
GameClient's menus, audio, particles or world/profile persistence.
The bounded scenario scheduling/transport remains distinct from LocalServerRuntime.

The [World geometry lab](world-geometry.md) uses the same host with a fixed camera
and schematic grid. Opt-in surface patches draw through shared
`SurfacePresentation`, also called by the game's outdoor renderer; automatic and
manual visibility affect presentation only. [Tactical 051](../tactical/051-world-geometry-proof.md)
records ramp/deck/passage coverage. It does not establish
full 3D debug-renderer/stacked-actor parity.

Its [underground garage fixture](../tactical/057-underground-garage-proof.md) also
uses shared terrain-base queries for bounded excavations, negative-height support
and shadows, and derived floor/ceiling space identity. It retains the same Realm,
Worker and predictor during street-to-garage traversal; no indoor realm switch or
lab-only collision path is involved.

No identified interactive consumer remains to migrate in this plan. Static diagrams,
source experiments and frozen approval renders intentionally retain diagnostic/reference
adapters; they do not claim full gameplay parity. Shared hosting establishes ownership
and behavior, not a frame-rate result: performance comparisons still need matched
scenes and device measurements.

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

Next: profile matched Traffic lab and in-game scenes on the same device/backend,
separating simulation/transport, scene collection and GPU work. The original frame-rate
concern needs measured evidence now that the migration list is complete. This topic
owns the continuing architecture constraint; tacticals own bounded migration evidence.
