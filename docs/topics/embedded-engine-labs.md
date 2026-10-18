# Embedded engine labs

Topic: embedded-engine-labs
Status: shared scenario simulation and presentation host delivered for Traffic,
Outdoor Geometry, World Geometry, Character lab and indoor furniture playtest.
The identified interactive lab migrations are complete.
Updated: 2026-10-18.

Owns the architectural constraint that interactive labs are embedded consumers of
the game engine and must evolve with it. [Gameplay scenarios](gameplay-scenarios.md)
owns recipes, memory persistence and simulation hosting;
[rendering architecture](rendering-architecture.md) owns presentation/backend
contracts; [performance](performance.md) owns timing evidence and its limits.

Explicit scenario clock fences reset timed sprite animation to the last
replicated authority phase through shared `RemoteStateView` code. This prevents
client animation lead from changing the frozen frame after pause/reload.
The [scenario topic](gameplay-scenarios.md) owns that clock contract and the
replacement-host error guard used by furniture playtest.

[129](../tactical/129-vehicle-geometry-batching.md) batches road-model geometry through
the shared GPU asset factory used by game and ScenarioPresentationHost. Independent
wheel/equipment groups, tagged lights and qualified source surfaces stay intact;
source hierarchy remains the default for direct authoring probes and train prototypes.
Native pixel comparisons cover every road model and current train prototype; game/
Traffic browser assertions check compiled counts, fallback, switching and recovery.
No separate lab mesh compiler, simulation policy or art activation is introduced.

[130](../tactical/130-vehicle-game-camera-fit.md) shares fixed model-height fitting,
grounded mesh contact shadows, displayed-motion heading and ready-only roof-rider
attachment through ordinary game/ScenarioPresentationHost collection and raster
consumption. Direct authoring defaults and train inspection remain unchanged.

## Wildlife motion repairs

[140](../tactical/140-autonomous-wildlife-completion.md) selects completed sheep,
pig, deer, goat, cow, fox, cat, dog and elephant motion banks in the ordinary
shared definitions. The game and Worker landscape playground consume identical
clips, speed-matched authored strides and anchors. Existing pet coat banks own
independent frame ranges, preserving their immutable animation after base
cat/dog repairs. Canvas/GPU checks cover motion, contacts, pause/reload and
grounded escapes for every repaired species and all four pet coats.

The fresh hen in 140 uses a new shared Fauna definition and fixed natural
expansion slots in the regional generator. The editor and landscape lab obtain
its ordinary factory/profile automatically; neither owns a private spawn or
animation policy. Full Chromium game/lab tests and isolated streaming readiness
pass. Existing natural/placed food lineage rules apply unchanged.

Butterfly short flights use the existing shared timed Fauna airborne path,
including exact phase/height hydration and ground landing. Spiders use the
explicit diet entry; shared catch resolution rejects airborne prey above
1px and preserves natural-only replacement in both game and embedded lab.
Seven Canvas/GPU butterfly/food-chain browser checks pass.

## Fierce creatures

[139](../tactical/139-horse-motion-study.md) activates the completed horse and
giraffe motion banks through ordinary shared `Fauna` profiles. Game and natural
Worker playground use the same 32-pose walk/flee clips and native anchors.
Ground stride matches existing walk speed; mounted horse timing retains the
existing speed ratio. Physical bounds, authority and riding rules are unchanged.
Canvas/GPU checks cover walking, pause/reload, escape and mounting/dismounting.

[137](../tactical/137-fierce-creatures-and-food-web.md) adds natural-origin meal
replacement, an explicit food web, cross-predator meals and T. rex warning/charge
states to shared Realm authority. Main game and the natural Worker lab use the
same source banks, collisions, save/reload and audio/footstep consumers. Source
reviews remain immutable pending identities. Dragons guard durable hoards; wolves
coordinate stable packs. Griffin flight uses shared PredatorMotion and the ordinary
EntityManager collision/landing loop, including mid-flight saves, interruption
and actual rock/tree support, including ordinary landing-surface queries when
scenery is edited during descent. Live review fingerprints include Realm,
EntityManager, movement, diets, fierce profiles and dens. Spider web ambush and natural/placed food-chain
compositions also run ordinary shared authority; the lab has no private AI.

## City outskirts speedways

[138](../tactical/138-city-outskirts-racetracks.md) adds a native generated racetrack
arrival to the natural-landscape playground. Production generation owns the oval,
access, spectator props and durable population. TrafficSystem owns racing, braking,
collision, roof support and save/reload in both game and lab; the shared terrain
cache paints the saved kerb/start-line cells for Canvas and GPU. The lab adds only
overview framing and inspection data, with the normal GPU/vehicle-mesh default.

## Lived-in interiors

[136](../tactical/136-lived-in-interiors.md) adds resident activity decisions to the
shared Realm tick, collision checks, durable actor state and animation clips.
The normal game and embedded Realm consumers retain the same physics and
presentation owners; no lab-only controller is introduced. New resident actors
are seeded only by versioned gameplay interior recipes. Existing lab fixtures
and approved static room compositions remain pinned.

## Vehicle horns and contact profiles

[135](../tactical/135-vehicle-horns-speeds-and-pushing.md) shares per-model driving
profiles, bounded contact planning and private prediction contact copies between
game and ScenarioClient. Straight/curved rail and TrafficSystem authority commit
pushes only after all body and passenger checks pass. Traffic exposes Horn/H via
the normal scenario command, transient Worker event and shared AudioManager.
H and the screen button sustain one uninterrupted voice while held, stopping on
release, blur, pause or disposal; abandoned holds expire. Labs
without an audio consumer remain silent. Automatic road traffic and parking keep
yielding; no lab-specific speed or pushing implementation is added.

## Reviewed blue train alignment

The owner accepted the v3 curve lab and authorized game activation on 2026-10-12.
Game and ScenarioPresentationHost now select the same three reviewed blue carriage
models by default, using shared continuous track headings and signed wheel travel.
GPU + meshes renders them; Canvas, GPU sprites and failed/lazy loads retain native
crops. World Geometry offers `nativeTrains` for source-art comparison; its authored
fixture aliases remain usable. No lab-only physics, service spacing, roof support
or backend-default change is introduced. Main-game backend switching and the
existing curve/roof/save/reload scenarios qualify this integration.

## Farmstead and settlement alignment

[084](../tactical/084-common-pets-and-variations.md) adds four native pet-coat
inspection arrivals from actual seeded settlement populations. Ginger/black cats
and golden/shepherd dogs use the same production profiles, authority, safe yards,
harmless reactions and saved motion clocks in game and lab. Canvas/GPU checks
cover native motion, contact and pause/reload; no separate lab AI is introduced.

[083](../tactical/083-farms-town-pets-and-larger-cities.md) adds generated farm and
village/city pet and larger city-center arrivals to the existing natural Worker playground. All terrain,
placements, durable animals, safe yards and AI are production generator behavior.
Diagnostic scenery zooms frame the native compositions. Explicit ready/reload
now finishes shared Realm autotile preparation after async loads; it does not
advance authority or change live streaming budgets. Native Canvas/GPU tests cover
motion, paused saved phase and fully prepared ground after reload.

## Remaining wildlife alignment

[082](../tactical/082-complete-provisional-wildlife.md) tracks the remaining
17 species. Profile-based definitions/assets, durable `fauna` state and shared
authority motion/interaction owners serve the normal game and Worker lab.
Native regional arrivals, generic pose datasets and body-height-aware contact
controls supply inspection only; no separate lab AI or collision is introduced.
Pause/reload and both renderers are checked for each profile batch. C adds
native elephant/giraffe/kangaroo/cobra/ant arrivals and a Roomy camera zoom for
large bodies. Kangaroo height and movement use the shared saved hop clock;
inspection introduces no separate physics. D adds native fish/penguin/seal/ray
arrivals using production water/shore/depth behavior. Stationary actions share
durable clocks with travel. The ray camera frames both player and animal; native
zoom presets apply on scene changes, and full-cell visibility is exposed only as
a diagnostic. Body/ball/landing dispatch remains shared with the game.

## Deer gameplay alignment

[081](../tactical/081-durable-woodland-deer.md) adds a native deer glade arrival
using production regional populations. Shared owners cover definitions, seeded
herd/individual state, authority AI, actual grounded collision, no-bounce body
support, ball startle, durable travel and binary timed walk/flee poses. The lab
adds arrival, pose datasets and **Hop onto deer** through the existing authority
teleport/fall command. Canvas/GPU checks cover walking, pause/reload and landing
with no automatic upward player velocity. No lab-specific animal physics or AI
is introduced; no historical approval snapshot is regenerated.

[111](../tactical/111-server-snapshot-and-deer-scheduling.md) applies the deer
ambient planning cadence/quota through shared Realm, so game and ScenarioSession
retain the same motion, alarms, contacts, sleep and reload policy. RealmReplicator
also reuses unchanged wire snapshots after complete live scalar checks; lab
publication still uses the ordinary 60Hz frames and native protocol. No separate
inspection AI or clock is introduced. Six character-lab identities renew because
their contract hashes raw Realm source; wildlife identities and source art stay
unchanged, and existing approval records are not rewritten.

[113](../tactical/113-shared-ai-planning.md) replaces the deer-only pilot with one
Realm-owned planning scheduler for all six native wildlife families and ambient
wander. Game and temporary ScenarioSession worlds share distance cadence, bounded
candidate/path work, aged admission, immediate alarms and existing native motion.
Chase/follow/route steering and 60Hz physics/publication remain live. Reload uses
fresh transient scheduling phases while retaining durable semantic state. Source
art and frozen review pixels remain unchanged; raw-Realm character identities
renew through the ordinary inventory compiler. Final native game/lab validation
is recorded in 113.

## Robin gameplay alignment

[088](../tactical/088-wildlife-work-budgets.md) routes both game and labs through
shared Realm wildlife sleep and robin work quotas. Nearby controls retain native
motion/contact; paused resident motion/RNG survives reload and wakes with one
normal step. Predicted ordinary player/mount animation uses the shared predictor,
while physically timed wildlife clips retain their authority clock.

[090](../tactical/090-incremental-simulation-membership.md) applies the same
incremental demanded-group cache and sleep-before-readiness policy in Realm,
including ScenarioSession/ScenarioClient. Live contacts/wake checks and explicit
world/eviction teardown stay shared; no lab-specific activation or physics path.

[091](../tactical/091-static-prop-admission.md) also caches static scenery admission
in that shared Realm. ScenarioSession receives the same demand/readiness/edit
invalidation and teardown as the game; prop collision geometry remains live.

[093](../tactical/093-identical-collision-probes.md) opts shared EntityManager NPC
movement into identical per-call collision-probe reuse. Game and labs retain both
axis outcomes, blocked AI reactions, live support and later-call geometry changes.
Default generic resolver callbacks keep both queries.

[094](../tactical/094-interest-demand-cache.md) reuses stable ticket demand in the
shared InterestManager used by game, Worker/Node and ScenarioSession streaming.
Lab camera/player/arrival/attachment changes and lease expiry retain ordinary
invalidation; asynchronous residency reconciliation still runs every update.

[085](../tactical/085-robin-search-cost.md) optimizes the shared robin decision
function without a separate lab path. Canvas/GPU grove checks still pass flight,
actual perching, approach/contact and frozen trajectory reload; ordinary game
ball reactions and durable manual deletion pass. All decision/RNG/collision
samples in the headless original/optimized lane match. Art/clip timing is unchanged.

[080](../tactical/080-durable-woodland-robins.md) adds a native grove arrival using
the normal regional population and Worker. Game and lab share robin registration,
AI, crown queries, collision, support, no-bounce landing, ball reactions, durable
motion timelines and timed binary sprite phases. The lab only adds pose datasets,
arrival/controls and **Hop onto robin**, using the existing authority teleport/fall
command. Canvas/GPU checks exercise flight, actual crown rest, pause/reload and
player contact with zero maximum upward velocity after controlled landing. The
game's spatial chirp is intentionally absent in the silent scenario lab.

[119](../tactical/119-dense-ground-support.md) narrows crowded ground/support
candidates through shared EntityManager. The resident movement index is read-only
through ground tracking with live support Z; sparse chunk/prop reuse, player
jump/landing and prediction retain their owners. Game and ScenarioSession labs
consume the same path, including sleeper/edit invalidation and moving roofs.

[123](../tactical/123-npc-movement-profile.md) indexes fauna metadata through the
shared type lookup used by Realm, motion/contact and game/ScenarioSession consumers.
Original profile objects and all species/coat definitions remain live and identical;
AI cadence, physics, waterline transitions and presentation keep their owners.
Native fauna/wildlife/settlement checks exercise Canvas/GPU game and lab consumers.

## Parking shopping visits

[132](../tactical/132-parking-shopping-visits.md) adds a playable view to the
Parking lot lab through ScenarioPresentationHost and the ordinary scenario Worker.
Realm owns the bounded ParkingSystem; native drive sweeps, moving roof support,
EntityManager pedestrian collision, animation, replication and saved trip phases
serve both authored game infrastructure and the lab. React supplies controls and
camera intent only. Static v1 parking-pattern review snapshots remain separate.
[133](../tactical/133-generated-shopping-centers.md) subsequently activates
regional placement and ordinary road-traffic visits through these shared owners.

[134](../tactical/134-parking-as-city-terrain.md) replaces the authored playable
parking fixture with `CityParkingRecipe` on both legacy play URLs. Production city
planning, saved road cells, normal terrain chunks and TrafficSystem parked-car
population serve the game and lab. Only one incoming road visitor is staged for
inspection. The special static-sprite cache and its probe are removed from both
consumers; normal host diagnostics remain. Static pattern reviews stay separate.

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

  The 2026-10-07 camera raster prototype enables the same `RenderView.pixelSnap`
  policy in GameClient and ScenarioPresentationHost. Only the final shared screen
  translation is quantized; follow clocks, displayed world poses, fixed diagnostic
  framing and prediction remain unchanged. Backend view copying and terrain
  placement consume that policy; inverse picking follows the displayed projection.
  `?pixelsnap=0` disables it in either host for visual comparison. Reference adapters
  keep the original projection. See [rendering architecture](rendering-architecture.md)
  for placement regression scope, remaining texture-sampling limits and owner acceptance.

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

Frogs (2026-10-09) use the same Realm habitat decisions, EntityManager physics and
predicted wildlife landing contact. A physically timed hop has an optional binary
sprite phase shared by game/lab replicas and restored from actor records. The
**Pond · frogs & shallows** scene supplies a dry arrival near frogs, and **Hop onto
frog** uses the existing teleport/fall command. Frog diagnostics expose matching
pose/height on Canvas/GPU; croaks belong to the ordinary game's audio path.
See [078](../tactical/078-durable-pond-frogs.md).

Rabbits (2026-10-09) reuse the same saved/replicated hop-phase contract and shared
predicted wildlife body contact. The **Meadow · rabbits & woodland edge** scene
uses ordinary seeded glades, dry-ground authority AI and physical native hops;
**Hop onto rabbit** issues the normal teleport/fall command. Rabbit pose datasets
support Canvas/GPU checks, without a lab-specific simulation or animation clock.
See [079](../tactical/079-durable-meadow-rabbits.md).

The owner removed automatic landing bounces from all wildlife on 2026-10-09.
Game and lab consumers use the same grounded support rule and contact outcome;
Realm still startles the animal. Native Canvas/GPU landing checks record the
maximum authority player vertical velocity throughout escape/recovery to catch
an unintended relaunch. Explicit Jump retains ordinary input physics.

## Change and validation discipline

Tap movement (2026-10-10) is a game input/UI concern and does not add Options to
the labs. It supplies ordinary sampled axes to the existing predictor and
authority. The existing three-byte AI state now carries the live `befriendable`
tag using presence/value bits 5/6; shared serialization, binary baselines/deltas
and replica reconstruction preserve both values for game and lab consumers.
Physics, presentation hosting and projection remain shared and unchanged.
See [086](../tactical/086-tap-to-move-and-options.md).

Duck interactions (2026-10-09) keep body collision and grounded player landing in
shared movement physics; Realm owns quack/startle/escape and EntityManager owns the
collision-resolved flight arc. The pond lab's **Hop onto duck** control uses the
existing authority teleport/fall command, not lab-specific physics. Canvas/GPU
diagnostics expose duck elevation/clip/alarm and maximum player vertical velocity
after landing. The ordinary game's PlayScene plays the provisional synthesized quack; labs retain
their existing lack of game audio. See [077](../tactical/077-duck-contact-and-startle-flight.md).

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
planner. The UI owns controls and camera follow only. Ordinary regional worlds
now use the thicket profile by default; explicit lab profiles override it, and
temporary scene save/reload preserves the override through the recipe. Forest edits and a complete lush roof-passenger journey exercise normal
persistence and authority; there is no separate forest collision or train loop.
The extra-dense profile's staggered forest rows are normal multipart props with
replicated solid footprints, native atlas crops and ordinary procedural deletion.
They add no lab-specific rendering, collision or editor persistence path.

## Provisional pond wildlife

Tactical 076 adds mallards to generated natural pond scenes and ordinary worlds
through the same NaturalStrategy, ProceduralActors, Realm AI and persistence.
Named animation clips use the same sprite clock in EntityManager and the client
replica; clip selection is replicated in binary baselines/deltas. Lab pause and
save/reload exercise that shared system. World geometry exposes bounded per-frame
duck diagnostics for browser verification; it adds no animal simulation loop.


## Inside vehicle driving (2026-10-10)

The [car input-gap fix](../research/car-driving-prediction-jitter.md) lives in
shared Realm/VehicleControl: inside cars integrate consumed commands only, with
explicit release braking and a genuine stale-input stop. Native ScenarioSession
and binary-replica tests cover 30/60Hz authority and 120Hz presentation, delayed
turns/releases and roof carry. Game and embedded labs inherit one motion owner;
no lab-specific prediction, timer or physics path is added.

The shared VehicleControl prompt also offers **Call train · E** beside generated
station benches. ScenarioSession forwards the lab command to Realm/RailwaySystem,
matching game recall, occupancy/clearance checks, eight-second dwell and persisted
service location. Production city-train labs inherit this behavior without a
separate lab train loop; authored fixtures without station benches show no call prompt.

[Tactical 087](../tactical/087-player-driven-cars-and-trains.md) adds the same
Realm driver seats, native motion and proximity prompt to the game and shared
Traffic/World geometry presentation host. Hidden drivers and visible roof riders
use the shared collector; scenario commands/reload retain the authoritative
occupied parent. Parent resolution retains live service-owned bodies outside the
ordinary actor tick set without simulating them twice. Phone game checks exercise
car tap destinations and train side-tap start/stop/reversal on Canvas and GPU.


## Ground-query reuse (2026-10-11)

[Tactical 107](../tactical/107-ground-query-reuse.md) reuses exact-range candidate
lists only inside EntityManager's synchronous ground pass. Game and scenario
authority share this owner. Terrain and support outcomes are still resolved for
every actor, with live objects preserving earlier ground snaps. Lists are dropped
before index updates/separation and never carried across ticks, edits, readiness
or carrier motion. Prediction keeps the existing shared resolver without a cache.
Native game/lab Worker contact checks pass on Canvas/GPU in the full 541-check
browser run (one skipped); streaming readiness and phone timing are recorded in 107.

## Collision candidate reduction (2026-10-11)

[115](../tactical/115-collision-broad-phase.md) adds the same adaptive collision
grid to shared EntityManager in the game Worker and ScenarioSession labs. Each
crowded movement pass indexes resident solid bodies, including sleepers, and
refreshes movers sequentially; sparse passes keep chunk queries. Fixed physics,
prediction, support and lab lifecycle retain existing owners. The committed Realm
crowd fixture checks whole-tick costs and exact wire/durable outcomes; native game
controls and shared contact/ground regressions cover the ordinary path.

## Authored blue car presentation

[108](../tactical/108-authored-blue-car-gameplay.md) connects compact-1 v7 through
shared `CarMeshAsset`, `EntityMeshPose` and `GpuMeshBodies` in the game, Traffic
playground and renderer comparison. [112](../tactical/112-coherent-car-presentation-and-test-override.md)
supersedes 109's authored directional lens: body vertices now share the fixed
world projection, with static lateral asset registration, immediate displayed
motion heading and rest hold. All three use the same axis normalization, wheel
roll, silhouette pass, frame-stable sprite fallback and graphics lifecycle.
`?renderer=gpu&meshes&allcars3d` supplies a blue fallback for unregistered road
vehicle types in the game and Traffic lab; all 45 registered types use their own
assets. Original types/colliders stay unchanged. Traffic reset
retains the view option. Traffic's Worker, input, collision and roof support remain
native. This changes optional presentation only; the independent car-projection reference lab remains
on its original source geometry. Steering clearance and rotated physics are later
work.

## Ambulance driving controls

[117](../tactical/117-ambulance-driving-controls.md) uses shared VehicleControl authority,
TrafficSystem persistence, binary state and GPU mesh resources for ambulance v2.
Traffic playground's vehicle selector and emergency commands operate through
ScenarioSession; held Fast/Shift uses the same sprint input and driven motion.
SceneFrame receives host presentation time for cosmetic wheel/lens effects;
paused labs hold the light phase. Game audio remains browser composition in AudioManager.

[120](../tactical/120-firetruck-gameplay.md) adds stowed firetruck v2 to the same
mesh resolver/resource lifecycle and emergency-state authority. Traffic selects
its own GLB and uses ordinary held speed and siren controls; ladder motion remains
outside this slice. Canvas/GPU sprites keep their complete fallback.

[122](../tactical/122-complete-vehicle-port.md) exposes all 45 vehicle choices in
the Traffic playground and main-game renderer. Each uses its own retained asset through the shared
`AuthoredVehicleMeshes` registry, pose resolver and lazy GPU resource path.
Failed or pending model loads preserve the same sprite gameplay; no lab-specific
asset transform or driving implementation is introduced. The compact gameplay
browser test exercises every selection and an aborted silver GLB request.

## Player driving neighborhoods (2026-10-12)

[126](../tactical/126-driving-collision-neighborhoods.md) narrows shared
`drivenCarPose` prop searches using live authority indexes and lazy indexes of
immutable RemoteStateView prop snapshots. Game and ScenarioClient prediction
retain the same snapshot index during queued replay. Complete entity history
remains available for roof selection; separate rider sweeps and global excavation
presence retain native headroom/ground policy. No lab-only collision owner is added.

[128](../tactical/128-editor-vehicle-placement.md) gives every outdoor Realm the
shared traffic service, using an empty route graph when no roads exist. Game and
ScenarioSession retain identical placement, driving, collision, lights and durable
restore behavior. Placed anchors never enter automatic routing; generated-lane
traffic and authored fixtures retain their existing movement owner.

## Authored blue train inspection

[127](../tactical/127-authored-blue-train.md) adds three World Geometry fixture
opt-ins for retained blue carriage models: loop, winding reversal and existing
city service. They use ordinary ScenarioClient/Worker rail authority, SceneFrame
pose evaluation, mesh readiness/publication, fixed projection and ordered sprite
fallback. Only diagnostic presentation opts in; main-game/default labs retain
native train sprites. The native routes, spacing, colliders, support and movement
are unchanged. A read-only canvas diagnostics hook exposes the same host state
for browser qualification. Exact moving-art review precedes live activation.


## Generated shopping centers

[133](../tactical/133-generated-shopping-centers.md) reuses the same ParkingSystem
for external TrafficSystem-owned cars. TrafficRecords owns each native car and its
shopper snapshot; Realm readiness synchronizes restored occupants and admits live
shopper integration. Generated city preview and main game share these owners.
Parking presentation requests GPU meshes through the shared selectable host default,
while explicit renderer URLs remain authoritative. Native parked cars replace
painted references only in playable views; static review pixels remain independent.

The fresh gorilla also uses the shared Fauna definition: diagonal knuckle walk,
chest-beat display, ordinary alarms and escape. Its slower cadence sets the
full-cycle recovery allowance in shared gameplay checks. Expansion admission
fits around original water refuges so a new land profile cannot remove an
existing aquatic scenario population.

## Shared reverse driving (2026-10-19)

[140](../tactical/140-shared-input-ux-and-reverse.md) sends held reverse through the
ordinary input flag, Realm/TrafficSystem and PlayerPredictor. Native scenario
30/60Hz binary/replay regressions cover reverse with delayed commands. Car mesh
orientation uses replicated nose direction against velocity; signed backward
wheel travel is shared by game and lab presentation. Traffic inspection maps R
to reverse, L to lights and K to siren style, keeping Jump/Throw meanings separate.
No Deck-only physics, control scheme or lab driving loop is introduced.
