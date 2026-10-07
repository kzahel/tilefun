# Embedded engine labs

Topic: embedded-engine-labs
Status: shared scenario simulation and presentation host delivered for Traffic,
Outdoor Geometry, World Geometry, Character lab and indoor furniture playtest.
The identified interactive lab migrations are complete.
Updated: 2026-10-07.

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
binary replicas and `PlayerPredictor`. Interactive authority uses the same
`ServerLoop` as GameServer: fixed monotonic deadlines, bounded catch-up and a fresh
schedule after pause/resume. Main-thread GameLoop ticks submit binary input and
predict locally; they no longer advance authority. Unsolicited snapshots flow
through production `OrderedWorkerChannel`, with the same credits, byte/count
bounds and 2ms client decode budget. Output pressure defers replication without
advancing its delta baselines; authority keeps ticking.

Live ticks call the normal Realm streaming/replication path and do not await a
fully ready visible range. Realm's shared support admission decides when actors
can advance. Initial fixture construction and explicit inspection commands still
await readiness. Headless `ScenarioSession.step` remains manual and repeatable;
manual Worker sessions have no timer, and real-time sessions reject manual steps
until paused. In-memory storage does not dictate the scheduling choice.

Pause, hidden views and pose inspection stop authority as well as local input.
Acknowledged pause discards queued input and reconciles the displayed player;
resume starts without hidden-time debt. Async commands/reset/reload fence the
Worker clock throughout their operation. Lifecycle traffic is ordered with
inputs and snapshots; startup, paused/hidden views and pending controls keep a
bounded automatic message pump alive even when rendering is stopped. Disposal
terminates the Worker, clock and channel. Diagnostic reports distinguish submitted
client inputs (`steps`) from authoritative `clock.ticks`.

The lab still composes one Realm rather than the whole GameServer application:
recipe staging, temporary storage, review UI and explicit inspection controls
remain intentional differences. This alignment establishes clock/transport
ownership, not full application parity or a frame-pacing claim. See
[Tactical 069](../tactical/069-interactive-authority-scheduling.md) for validation.

`ScenarioPresentationHost` owns the migrated labs' client/Worker, production
`GameLoop`, render host, asset lifetime, camera and frame storage. The lab page supplies
controls, input, viewport/settings and diagnostic UI. [Tactical 048](../tactical/048-embedded-presentation-host.md)
records this extraction and its validation. Shared owners are:

- `PlayerPresentation`: fixed-tick follow and exponential sub-tick camera
  interpolation, called by both `PlayScene` and the lab. Predictor previous poses
  supply body and camera interpolation together. The lab's -12px framing offset
  is explicit; position commands snap, while ordinary movement interpolates.

  The shared timestamped presentation follow-up replaces interactive render-time
  camera advancement with pure `CameraFollow` and borrows sampled poses through
  RemoteStateView during render. Remote entities use bounded timestamp history;
  local voluntary input stays predicted. Diagnostic fixed/train cameras consume
  those same displayed entities. Paused views show committed current poses and
  resume without hidden-time debt. Static reference adapters keep their explicit
  untimed camera path; frozen review snapshots are not regenerated.

  `playerEntity` remains the physics/diagnostic pose during render borrowing.
  Cameras use `presentedPlayerEntity`; renderer overlays use `host.presentedPlayer`.
  The outdoor geometry browser checks caught and corrected this ownership boundary
  during integration, rather than weakening the collider-position assertions.
- `OutdoorPresentation.presentTerrain`: one scheduler/publication policy for game
  and lab, retaining the shared default 2 ms/128-row budget and experimental
  two-row/completed-chunk mode. `collectScene` and `collectSceneOrder` provide the
  common actor/prop/grass/elevation/mesh presentation.
- The existing Canvas/GPU `RenderHost` implementations configure complete terrain
  assets (blend sheets, roads, variants) and own recovery/disposal. Embedded GPU
  placement keeps the world canvas beneath the lab's input/UI canvas through
  scrolling and resize. The replica uses server-computed autotiles.

Pause and hidden views stop/restart both clocks without hidden-time debt. Disposal releases the Worker, frame, host and assets; late
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
The scenario application host remains distinct from LocalServerRuntime; authority
scheduling and bounded binary transport share production owners.

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

The [road/rail crossing](../tactical/058-road-rail-crossing-proof.md) supplies authored
route data to Realm's production railway service. `presentSurfaceScene` is shared
by outdoor gameplay and scenario presentation: each actor's height determines
its ordering against slabs; observer height controls only visibility.

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

The [vehicle grade fixtures](../tactical/064-vehicle-grade-proof.md) inject authored
traffic lanes through RealmOptions and seed bounded road areas once. Their cars
use the same TrafficSystem, actor replication and TrafficRecords as generated
traffic, including height and route restoration. The lab owns recipe selection
and observer controls only; it has no car movement loop.


[Train grades](../tactical/061-train-grade-proof.md) use the same RailwaySystem,
per-carriage replicas, native asset loader and surface ordering as gameplay.
The shared scenario host now requests bounded view-range updates during paused
camera inspection, and reload preserves the requested view range. Neither action
advances physics. Moving diagnostic cameras also drive the streaming range;
the scenario view includes the player’s prediction neighborhood when the camera
looks elsewhere. This supports the lab's follow-train/whole-route cameras without
an independent simulation or a renderer-only train substitute.

The [generated crossing previews](../tactical/062-generated-road-rail-crossing.md)
use real regional recipes, generated surfaces/routes and terrain presentation
through this same host. Their only staging is initial observer/car/train positions
and disabled extra traffic population. Generated train starts are valid saved
service records seeded before Realm startup, not a preview-only movement loop.


The [curved train fixtures](../tactical/063-curved-train-routes.md) supply tangent
line/arc paths and named stops to the same RailwaySystem. Native blue train crops are drawn
by the shared raster renderer on Canvas/GPU using replicated heading frames;
replicas derive matching cardinal colliders from those frames. Pose changes
intentionally snap, preserving the available sprites. Lab underlays
only draw the static alignment/platform/town diagram. Generated routes keep the
accepted native horizontal representation until the new motion/art is reviewed.

## City train integration

The World geometry loop/winding recipes now render procedural pixel tracks through
the production terrain cache on both backends. The overlay retains only labelled
schematic town/platform markers. `city-trains` instead uses real regional seed 2026
terrain and station props. Roof-start commands, carriage support, streaming and
save/reload use the shared Realm/Worker pipeline; road traffic is deliberately
omitted in this temporary scene. Full game tests separately exercise ordinary
station jumping and durable game reopening. See [tactical 065](../tactical/065-rideable-city-trains.md).

## Shared prediction checkpoint (2026-10-05)

[Player prediction](player-prediction.md) owns the shared timing correction and
[implementation evidence](../research/shared-prediction-fix.md). Cars/trains carry
roof passengers once per committed pose; prediction replays relative walking and
camera/body/lab overlays bind to the same support presentation. Native geometry,
clearance and saved support identities remain authoritative. Collision proxies and
bounded residual display correction share game/lab engine owners.

The subsequent [camera/jump reproduction](../research/train-camera-and-jump-reproductions.md)
finds that roof-relative alignment does not establish camera continuity: real Worker
authority timer drift and mixed carrier/client interpolation clocks create periodic
screen skips. Default shared air friction also erases takeoff momentum. Follow-up
must preserve the game/lab shared camera and movement owners; the reproduction
checkpoint has not changed runtime behavior. The separately authorized ServerLoop
timing fix now uses monotonic deadlines in game Worker/P2P/dedicated authority.
At that checkpoint labs still used explicit scenario steps. Tactical 069 later
aligns interactive labs with ServerLoop; headless fixtures retain manual stepping. Periodic drift is removed,
with rate-switch/delayed-snapshot presentation and jump friction still outstanding.

The subsequent [rider-free camera basics](../research/camera-basics-reproductions.md)
checkpoint exercises locked train framing (matching the existing lab diagnostic
callback) and shared ordinary smoothing without a passenger. It identifies remote
interpolation replay and catch-up camera targeting as separate faults; fast local
prediction/short-render-pause controls pass, including noclip. No host, camera mode,
runtime policy or frozen review pixels changed. Future sampling/camera fixes must
preserve diagnostic fixed framing and reach both shared consumers.


The airborne support follow-up uses shared PlayerMovement and PlayerPredictor,
including passive departure velocity, acknowledged jump-latch replay, sampled
support-to-flight display translation and ScenarioSession teleport/reset removal.
Native ScenarioSession car/train tests run the same Realm and binary replicas at
30/60Hz. No lab-specific airborne physics or renderer is introduced.
[Evidence](../research/airborne-support-momentum.md) records scoped acceptance.


Saved-train reload pacing now uses snapshot-anchored RemotePresentation startup
and pure bounded clock-debt recovery in the common RemoteStateView. Loading
renders, scenario reset and game refresh share this owner; no lab clock or
renderer-specific correction is added. [Reproduction/contract](../research/train-refresh-pacing.md).

The reload pacing checkpoint passes all 1,707 unit tests, 36 affected native
Canvas/GPU game/lab browser checks, both headless continuity CLIs and streaming
readiness. Separate headed 120Hz train captures measure smooth 60/30Hz source
streams across saved game refresh. These use an explicit clock-reset control;
they do not claim automated hidden-tab recovery. See the linked evidence.

Idle-jump travel uses shared Realm passive-time admission and landing eligibility
in both traffic and railway services. Game and lab RemoteStateView pass sampled
source time to the common predictor; inherited flight display and its contact
residual use that time while voluntary steering stays local. Future roof-landing
offsets bind to the committed roof frame. No lab-specific physics or presentation
path is added. Twelve new deterministic positional cases, all 1,719 units and 36
affected Canvas/GPU game/lab browser checks pass, with typechecks, lint/build and
streaming readiness. Native 120Hz idle/steering captures verify the real Worker
composition; [idle travel evidence](../research/idle-support-jump.md) records limits.


## Natural landscape preview

[Plan 068](../tactical/068-natural-landscape-preview.md) adds nine optional generated
landscape recipes to World geometry. `ScenarioRecipe.landscape` passes through the
normal Realm factory; NaturalStrategy retains production railway and traffic owners.
Explorer exact tiles and regional habitat views consume the same seed/profile
planner. The UI owns controls and camera follow only. Ordinary worlds omit this
experimental profile, and temporary scene save/reload preserves it through the
recipe. Forest edits and a complete lush roof-passenger journey exercise normal
persistence and authority; there is no separate forest collision or train loop.
The extra-dense profile's staggered forest rows are normal multipart props with
replicated solid footprints, native atlas crops and ordinary procedural deletion.
They add no lab-specific rendering, collision or editor persistence path.
