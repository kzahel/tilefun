# Embedded engine labs

[239](../tactical/239-repeatable-driving-workloads.md) adds the diagnostic-only
`driving-bench.html` entry on `LabView`, with clear-road and native traffic-queue
recipes. It uses the existing Worker/prediction/render host and ordinary movement
input; it owns no physics kernel or simulation clock. A recipe can opt into a
fixed vehicle population while retaining ordinary autonomous traffic decisions.
The normal game and other recipes keep their existing population policy.

[243](../tactical/243-client-prediction-work-counters.md) adds cadence-only client
work windows on the shared predictor for driving diagnostics. These counters are
separate from Worker authority metrics and exclude the pause fence; no lab-owned
physics kernel or clock is introduced.

## Labs on the game's Worker runtime (226 slice 3c, 2026-11-08)

Every Workshop lab except the two-pane physics lab now runs on the game's own
pieces. The lab shell's host (`ScenarioPresentationHost`) was deleted with its
last lab (226 slice 4a-v); the physics lab keeps `ScenarioClient` and the
scenario Worker until slice 6.

- **Authority:** `RecipeWorldAuthority` (`src/scenarios/`) stages the recipe
  with `ScenarioSession` and is served by the game's `LocalServerRuntime` from
  `recipe-world.worker.ts`, with the same Worker port wiring as the game Worker.
  The lab is the runtime's `local` connection and speaks the game protocol:
  `player-input`, horn, siren and throw presses, `visible-range`, frames and
  syncs with the game's backpressure. Two-seat recipes are refused (the physics
  lab keeps the scenario Worker until slice 6).
- **Lab instruments** travel as an opaque `admin` packet on the local host
  channel, ordered with play: open, clock run/pause, step (paused only),
  commands (teleport, placement, vehicle entry and recovery, equipment, train
  calls, view range), reset, reload and physics diagnostics. Each answer follows
  a full snapshot. Open, reset and reload send the game's `world-loaded`, so the
  client clears as on a realm change. The game's `GameServer` refuses `admin`.
  A paused lab never advances the realm; the loop's heartbeat keeps the
  client's watchdog satisfied, and a hidden page stops the loop as in the game.
- **Client:** `RecipeWorldClient` (`src/client/`) is the game's
  `WorkerClientTransport`, a `DeviceSession` over `RemoteStateView` and one
  predictor with the recipe's gravity. State is applied at the start of each lab
  tick as in `GameClient`, and resets seat the player on its parent.
- **View:** `LabView` (`src/client/`) is the lab view surface: one `View` with a
  camera policy (the game's follow by default), `LabInput`, `VehicleControl`,
  the production `GameLoop` and the selectable render host. Page plugins: zoom,
  pause, surface visibility, terrain pacing, pixel-exact shadows, a per-frame
  hook, commands and reload, `resize` (the Worker and world stay), and
  `underlay`/`overlay` hooks that draw diagnostic `OverlayFrame` geometry over
  the terrain and over the scene (they read the frame's `presentedPlayer` and
  `presentationAlpha`). A pose cycle inspects a sprite's four directions: it
  stops the world and draws a copy of the player with the cycled sprite, which
  is also the frame's `presentedPlayer`; the replica's own pose is never
  written. A room view (`interior`) draws an owned room cache through the shared
  interior presenter instead of terrain. A lab's own scripted `input` replaces
  the game's controls. `uiOverlay` draws diagnostic UI on the UI layer under the
  touch controls, and `captureFrame` draws a fresh report frame without
  advancing the world. Pause, a pose cycle, a hidden page and in-flight
  instruments stop play (an instrument holds play on the client while the
  authority keeps running); the camera's range still streams while paused. A
  new world clears the renderer's world caches, as the game router does, and
  the device presentation including the view's slab fades. `LabView` draws
  through `drawLabFrame` and reports `labPresentationDiagnostics`
  (`src/client/LabScene.ts`).
- **Diagnostics:** `RecipeWorldClient.getDiagnostics()` reports the
  transport's outgoing channel and a live clock: the running state from the
  last answer and the applied frames' tick. The realm's tick counter is the
  authority's clock (both count the same ticks and restart with a new world), and
  a paused world's frames repeat its tick. Browser checks can therefore watch the
  authority outrun a stalled page (`scenario-scheduling`).
- **Moved:** all of World geometry runs on `LabView` (slices 3c-ii and 4a-i),
  and so do Outdoor geometry's movement test (4a-ii), the Character lab
  (4a-iii), the Interiors playtest (4a-iv) and Natural landscape, World
  geometry's `nature-*` fixtures (4a-v).
  - The pages drive `LabView` directly. Fixed diagnostic frames use the
    `fixedCamera` policy, and World geometry's per-frame datasets come from
    `src/workshop/GeometryFrame.ts`.
  - No lab page imports the lab shell except the physics lab
    (`LabShellConsumers`).
  - Framing is unchanged on every fixture. Outdoor geometry's and the Character
    lab's idle and settled captures, the Character lab's pose-mode frames, and
    the Interiors playtest's idle, settled, diagnostic-guide, place-mode and
    report captures are pixel-identical to the old host's. World geometry's differ only in
    time-dependent content: grass wind, moving traffic and animals, and mesh
    suspension settling. Those differences are within the old host's own
    run-to-run variation, so `ENGINE_REVIEW_REVISION` is unchanged.

## Device sessions and views (226 slice 3b, 2026-11-08)

Labs and the game now share the device session and view objects in
`src/session/` (no `window`, `document`, `location`, storage or `navigator`
there; Biome enforces it). Each `ScenarioReplica` is a `DeviceSession`: the
game's replica, predictor and reconcile path (resets seat the player on its
parent, as before) and the device's `SceneFrame`, so the two-pane physics lab
already holds two device sessions. `ScenarioPresentationHost` draws one `View`
(camera, region, camera policy: `followSeat` or `fixedCamera` for diagnostic
framing, per-view slab fades) through the game's `renderViews`,
`drawViewTerrain` and `drawViewScene`; its private copies of camera follow,
terrain presentation and scene collection were deleted. Fixed cameras are still
placed before input and following still waits for the predicted step (the
policy's `beforeInput`), so lab framing is unchanged. The host keeps its Worker client, lifecycle and options
until labs move off it (slice 3c onward).

## Game controls in labs (226 slice 2, 2026-11-08)

[226](../tactical/226-player-views-and-local-split-screen.md) slice 2 gives the
World geometry, Natural landscape, Characters and Asset movement labs the game's
controls through the interim `LabInput` adapter (`src/scenarios/LabInput.ts`,
replaced by the game view in slice 3): the game's key bindings (play keys only,
so Tab, Escape and digits stay with the Workshop page), standard pads, the touch
joystick and action buttons on the lab canvas, and the shared `SeatComposer`.
Labs therefore gain sprint, throw, horn, sirens, reverse and jump press edges,
and E/F reach the vehicle control. Keys and pads count only while the lab
canvas has focus; Workshop fields, selects and buttons keep their keys. Touch
buttons draw only on touch screens, so desktop lab pixels are unchanged.
Horn, siren and throw presses travel on the seat's ordered input path
(`ScenarioClient.submitPress` → `ScenarioSession.input`), not as pausing commands.
Each page's private key sets, HTML arrow buttons and the host's vehicle input
were deleted. The physics lab runs one input set per pane (its canvas's focus
selects the seat).

Temporary differences, resolved when each lab moves onto the game view:
- The furniture/interiors playtest keeps its own input, now through
  `LabView`'s scripted `input` option (226 slice 4a-iv kept it). Its automatic
  walk and place mode are lab instruments, and its D-pad and Jump button are
  the phone review controls. On its room canvas (about 160 px wide, CSS-scaled)
  the game's floating joystick (120 canvas px across) would cover most of the
  room while steering, and disabling the touch buttons would leave touch
  without Jump. Place-mode dragging would need a touch rule, and the game's keys
  need canvas focus where the page listens on the window. The switch is an open
  owner decision (226 Decisions).
- The physics lab's WebGL collider panes cannot draw touch controls: dragging on
  a pane steers its player, but touch has no Jump there until slice 6.
- Characters' on-screen D-pad is replaced by dragging on the scene.

[227](../tactical/227-tree-house-and-ladders.md) adds the World Geometry `tree-house`
fixture. Its ladder rule runs inside the shared physics step and its room cutaway
lives in shared scene collection, so the game and labs behave the same. The
`outskirts-park` fixture adds recipe terrain painting through the ordinary editor
brush and a follow camera.

[223](../tactical/223-jump-park-and-race-tunes.md) adds the World Geometry `car-jumps`
fixture: data-only jump profiles on ordinary surface patches and the shared Realm,
seating the driver through the normal enter-vehicle command. No lab-only physics.

[220](../tactical/220-world-anchors-shadows-and-jump-transitions.md) shares anchored
resource classification, held one-use jump buffering, tilted caster projection
and rider display handoffs through the common game/lab owners. The real GPU decal
probe includes a tilted car over the ramp crest; it is diagnostic rendering,
not another simulation or lab-only shadow implementation.


[219](../tactical/219-vehicle-contact-and-train-continuity.md) repairs ordinary
shared chassis settling, carrier jump momentum and coherent full-consist display.
Game and labs inherit the same owners; no page-specific physics or smoothing is
introduced. The current streaming diagnostic adds a real-game racetrack course;
older pre-reset city-audit driving helpers require migration before use.


[218](../tactical/218-traffic-and-rail-gameplay-recovery.md) adds the ordinary
**train** station and **traffic-crowd** grid fixtures to World geometry. Train
recall and jump assistance share game authority, physics and input controls.
Opening/restoring a paused two-player ScenarioSession no longer advances a hidden
warm-up tick; ordinary publication already synchronizes membership without stepping.
The common Realm browser benchmark accepts the crowded fixture, mesh switch and
explicit desktop CPU throttling, while rejecting emulation for physical devices.

[217](../tactical/217-surface-projected-shadows-and-effects.md) shares the receiver,
decal and contact-effect implementation between PlayScene and ScenarioPresentationHost.
The car-dynamics course adds **ramp** and **roof** starts: press Space / controller A
or the touch Jump control to inspect ordinary landings. Diagnostics expose source/
triangle/query/fragment counts, grounded state and the last contact point/normal;
captures do not advance effect lifetimes. The collider-only co-op viewport retains
its physical inspection role. Geometry, prediction and authority remain shared.

[216](../tactical/216-dynamic-3d-vehicles.md) adds the shared car-dynamics handling course and a vehicle case in the two-client physics lab. Native Worker seats/recovery, full quaternion presentation and the normal shared physics scene own behavior; the collider viewport reads the same rotated body/static geometry. Production browser checks qualify delayed guest driving, pause/reload/seat ownership, full rotation preservation, compact/truck recovery and Worker teardown. Owner feel review is next. The follow-up defaults manual car controls to forward/reverse and left/right steering in both presentation and two-client labs; scripted inputs keep their explicit world-space contract.


[215](../tactical/215-coherent-world-raster.md) gives game and ScenarioPresentationHost
the same scoped aligned world frame and one final fractional composition. Both
restore logical projection before HUD/capture callbacks. Indoor/outdoor actors,
sprite fallbacks, mesh bodies and cached world surfaces share the repair for 214;
there is no lab-only camera or simulation workaround. Combined Canvas/GPU pixel
qualification includes static scenery, followed actors, atlas boundaries and fixed UI.

[213](../tactical/213-continuous-camera-projection.md) defaults both GameClient and
ScenarioPresentationHost to continuous camera projection, retaining shared-edge
raster alignment and inverse picking. The old grid-lock comparison is explicit
`?pixelsnap=1`; lab pages do not implement another camera policy.

[212](../tactical/212-matched-physics-tick-prediction.md) keeps game/lab replay on a
committed physics horizon, compares corrections at matching ticks and coalesces
overdue local controls with jump edges intact. The common predictor retains the
same replay slice budget, private scratch world and first-contact anchor.

[210](../tactical/210-first-contact-display-anchor.md) changes the shared predictor's
contact correction anchor for game and lab consumers. Stationary contacted actors
no longer inherit unrelated player offsets; native stalled-client/fractional-render
checks own the transition behavior. No page-specific collision or smoothing path.

[209](../tactical/209-car-driving-and-autonomous-traffic.md) restores Workshop's
Driving and traffic tool using a data-only road/crossing fixture in World Geometry.
Canonical LaneGraph, Realm planning, shared motor and normal Worker frames own NPC
motion; the page only observes/controls. Native road geometry fixtures supply a
bounded generated-lane source, and normal regional worlds use their existing source.
Pause/reload and NPC motion are exposed through the shared presentation host.
World Geometry / Driving and traffic also calls the common AudioManager engine
after **Enable engine sounds**, observing the occupied car and actual velocity.
Pause/mute/focus/visibility and scene teardown release audio; there is no separate
lab engine synthesizer or audio-driven simulation.

[208](../tactical/208-ground-seams-and-movement-pacing.md) keeps game/lab static
geometry in the same welded compound and preserves previous numerical poses at
restore. Both consumers use monotonic camera time and committed presentation
during sliced replay. Scenario diagnostics expose camera time/prediction alongside
the rendered camera pose for driving investigations. No alternate lab solver.

[207](../tactical/207-nearby-actor-display-corrections.md) changes the common
PlayerPredictor used by game and lab: nearby actors retain predicted time but
only solved contact members share display correction, and floor support pins its
vertical component. Ordinary numerical frames retain solved body pairs through
restore, including zero-replay updates. No lab-specific contact owner is added.

Delivered reset [205](../tactical/205-physics-reset.md): ordinary Realm authority now
uses one shared `PhysicsScene` step, including ordinary ScenarioSession consumers.
Ordinary ScenarioClient prediction now uses the same shared kernel and reconciles
live frames between control responses. The standalone prototype worlds, alternate Realm simulation owner,
full-world rollback engines, backend/hull selectors and single bridge-scale page
are deleted. The two-pane physics lab now runs two ordinary sessions through the
same independently clocked ScenarioWorkerHost and normal binary frames. Each view
has its own normal bounded PlayerPredictor. Shared data-only recipes/scripts stage
pushing, opposed movement, glancing, head support and quick reversal; guest latency
uses bounded ordered queues. Pause/replacement fences deliver earlier deltas before
clearing replicas. Keyboard, touch and standard-controller controls remain.

Scenario recipes now expose only scoped gravity, and World Geometry uses the shared
default with no backend selector. Read-only Three.js collider meshes belong to the
co-op diagnostic presentation; they do not implement another physics world. Older
mode-specific evidence below is historical. Specialized vehicle/equipment and rail
services are deferred; their old executable pages now explain that disposition.
Current car-garage/car-bridge/realm fixtures use normal basic driving. Reset 205
records ordinary Worker/P2P, lifecycle, device qualification and measurement limits.

[202](../tactical/202-persistent-realm-collision-proof.md) adds **Realm physics
replacement proof** to World Geometry. It stages ordinary NPCs, a ball and a parked
controlled car beside the existing ramp/deck; modes 3/4 share the normal Realm,
Worker, PlayerPredictor and renderer with `?physics=rapier-world` game startup.
Seeded crowd variants compare the same legacy/replacement inputs. Explicit
diagnostic requests sample bounded Worker metrics; they do not add a lab physics
owner or clock. Unqualified vehicle/wildlife cases remain explicit, and lab
acceptance does not establish default cutover or Chromebook performance parity.

[200](../tactical/200-npc-support-contact-ownership.md) adds real Realm NPC landing
coverage and a normal-game Worker/input test alongside the existing two-player
lab. NPCs retain their normal AI and legacy EntityManager phase. Opted-in on-foot
players exclude the duplicate legacy NPC overlap response after character-solver
movement; default players still use it. A passing two-controlled-player lab does
not by itself qualify NPC support in the game.

[199](../tactical/199-idle-player-head-support.md) adds **Land and stand on player**
to the cooperative reference, including raw falling/resting, exact replay and
delayed Realm checks. It accompanies the ordinary game's idle capsule-support fix.

[198](../tactical/198-character-support-and-jumping.md) keeps the ordinary opt-in
backend and cooperative lab aligned on horizontal-only character pushes, support
classification and actual ceiling handling. Two additional shared scripts expose
walking across shoulders and jumping against a pinned player; snapshot replay and
delayed Realm checks consume the same inputs as the visual lab.

[197](../tactical/197-opt-in-game-character-physics.md) adds an opt-in **Character
contacts** selector to the World Geometry deck fixture. Fixed box and capsule use
the same character backend as the ordinary game launcher, with normal Realm,
Worker, PlayerPredictor and ScenarioPresentationHost. Other fixtures keep their
existing backend. The full-world cooperative Rapier lab remains a separate dynamic
reference; its existing contact/presentation regressions remain required.

[196](../tactical/196-restore-controlled-player-pushing.md) restores intended player
pushing through the shared motor response, with positive idle-recipient movement,
bounded speed and release/wall checks. The cube-free pushing script shares visual
and native inputs. This supersedes 195's no-push behavior without reintroducing
previous-velocity feedback.

[195](../tactical/195-player-contact-feedback.md) fixes controlled-player velocity
feedback in the shared Rapier motor. Relative collider sweeps and normal-motion
clipping serve authority and both predictors. Two cube-free contact/release scripts
share their native and visual input source; the ordinary game owner is unchanged.

[194](../tactical/194-coherent-contact-presentation.md) replaces per-body display
offsets with coherent component timelines/rigid transforms. Idle views buffer
whole scenes; local activity predicts its contact component. First-push mesh-gap
checks qualify the reported observer case; both-active corrections remain open.

[193](../tactical/193-physics-reversal-catch-up.md) bounds whole-group physics-display
catch-up speed and adds the shared quick-reversal script, with native checks for
both control seats. Physics and normal input motion remain unchanged.

[192](../tactical/192-physics-correction-presentation.md) adds shared headless/visual
physics presentation: current-pose correction diagnostics, whole-group smoothing,
buffered remote display away from possible contacts and continuous source handoffs.
The original single-player bridge experiment keeps its existing presentation.

[191](../tactical/191-cooperative-physics-laboratory.md) adds the two-client physics
reference: one real temporary Realm, two sessions/replicas, full dynamic replay and
shared native/visual scripts. Its explicit coordinator clock enables repeatable
pause/step; it does not claim parity with independently scheduled game clocks.

[189](../tactical/189-rapier-physics-prototype.md) introduced the isolated backend
experiment at Workshop → 3D physics playground.
[190](../tactical/190-rapier-prediction-and-realm-proof.md) now hosts it through a
real ScenarioSession/Realm using an explicit whole-scene simulation owner, normal
input/replication and RemoteStateView. Rapier owns contacts throughout that temporary
scene; the old physics/AI phase does not also step it. The host still uses diagnostic
Three.js meshes and an alternate Rapier replay adapter, not ScenarioPresentationHost
or the ordinary PlayerPredictor. Unsupported generic commands/durable reload reject
explicitly. [The provisional plan](physics-engine.md) requires more qualification
before normal gameplay migration; other embedded labs retain their current engine.

[175](../tactical/175-vehicle-depot-and-walkable-ramps.md) extends the same shared
transporter support/collision and local-depth presentation with walkable steel
tracks and decks. Both the existing Worker playground and normal game consume it;
the generated depot uses ordinary regional planning, saved vehicles and props.

[173](../tactical/173-single-car-transporter.md) adds the Car transporter playground as another ScenarioPresentationHost consumer. The page supplies parked fixtures, framing and diagnostic teleports; shared authority/driving, secure/release, replica/prediction, persistence and GPU/fallback own the actual loading cycle.

Topic: embedded-engine-labs
Status: shared scenario simulation and presentation host delivered for Traffic,
Outdoor Geometry, World Geometry, Character lab and indoor furniture playtest.
The identified interactive lab migrations are complete. Tactical 226 is now
moving these labs onto the game's `LabView` (see the top of this topic).
Updated: 2026-11-08.

The F3 collision inspector and Truck bed playground now use the same read-only
`CollisionDebug` geometry collector, named layer colors and optional shape/height
labels. It reads the production car, bed, transporter and prop-support helpers;
neither host owns alternative collision geometry. Displayed XY/Z interpolation is
shared with ordinary presentation. The legacy orbit view still shows enclosing
boxes. [Vehicle inspection](vehicles.md#bed-geometry-and-debug-inspection) owns the
layer meanings, focused validation and remaining terrain/contact diagnostics.

[169](../tactical/169-wheel-lift-towing.md) adds the Tow truck playground using
ordinary parked-vehicle records, shared Attach/Release controls and coupled
TrafficSystem/PlayerPredictor steps. The real Worker owns both bodies, collision
and saved relationships. Pause/step/reload/backend replacement retain the pair;
the page owns only fixture data, input and camera framing.

[167](../tactical/167-tipping-dump-bed.md) extends those same normal controls and
fixed-clock authority with tipping/lowering. Inclined support, cargo gravity,
nullable replica state, renderer pose, debug and failed-mesh fallback are
shared; no lab equipment simulation exists. Pause/step/reload keep the same rig
and occupants. The playground camera now fits the fully raised tub.

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

[179](../tactical/179-cached-car-images.md) adds bounded unchanged car image reuse
through the same `GpuMeshBodies` backend in game and labs. Finished local-depth/
outlined images stay backend-owned; scene frames and authority gain no graphics
resources or cache policy. Scene reset, asset invalidation, renderer replacement
and context recovery retire them. Cargo/towed groups and flashing lights bypass
reuse. Exact-pixel, shared game/lab and native phone qualification are recorded in
179; there is no lab-specific shader, ordering or simulation branch.

[180](../tactical/180-ordered-texture-batches.md) shares up to eight textures in
one ordered indexed GPU batch across the same hosts. Cached car quads can remain
queued with surrounding sprites, while dirty target writes and retirement drain
them before mutation/disposal. Frames still lend only synchronous drawing data;
all GPU references remain backend-owned. Desktop/native exact-pixel checks,
all 829 browser cases and GPU streaming readiness pass. There is no lab-specific
batch policy, authority change or world-depth/outline change.

[232](../tactical/232-webgl2-only-renderer.md) slice 4 puts every paged image (sprite
sheets, terrain chunks, shadow ellipses, overlays) in one page atlas
(`TEXTURE_2D_ARRAY`) in the same GPU surface the game and labs use; seven texture
slots remain for mesh composites. The renderer lab's `gpu.surface.setPageAtlas(false)`
draws with separate page textures for A/B checks, and `probeWorldRegistration(false)`
repeats the composed-world probe that way. Sprites and shadows skip Canvas-shaped
state calls only on the GPU surface; the native review raster is unchanged.

[162](../tactical/162-shared-world-depth-comparison.md) is a standalone rendering
experiment fed by normal headless scenario authority, binary replication and
scene collection. It reuses production vehicle assets/loading without adding a
second gameplay implementation. Its shared-depth target is not yet part of the
game or an embedded host. [164](../tactical/164-playable-truck-bed.md) then adds
bounded truck-owned depth through normal `ScenarioPresentationHost`, real Worker,
replication and shared backends. Its opt-in hollow-bed physics/support is shared
with game code; renderer switches preserve that same Worker/world. This is local
group depth, not the broader shared world target from the earlier experiment.
[165](../tactical/165-truck-bed-gameplay.md) enables normal dump beds and extends
the existing shared vehicle control panel with boarding, exit and loose cargo.
ScenarioPresentationHost forwards the same actions to VehicleControl authority;
there is one panel and no separate lab cargo simulation. Pause locks those actions.

## Shared reverse driving (2026-10-19)

[156](../tactical/156-vehicle-paint-gameplay.md) shares model-scoped paint choices
between editor placements, ordinary road traffic and Traffic inspection. Scenario
fixtures pass their optional paint into the same Realm/TrafficSystem constructor,
record codec and replicated entity field. Both hosts use the same shared mesh,
lazy atlas cache and exact per-scheme sprite fallback; the lab has no private tint.

[145](../tactical/145-original-coupe-gameplay.md) adds the original red coupe through
the same vehicle definitions, asset loader and mesh registry used by the game and
Traffic playground. Its cardinal sprite fallback and physical bounds also belong
to the shared catalog; no lab-only rendering or traffic policy is introduced.

[148](../tactical/148-beetle-gameplay.md) uses that same additive path for the
accepted Beetle: shared palette, assets, traffic model selection, dimensions,
handling and mesh registry. Its 81×38×35px body and exact own mesh/cardinal fallback
are shared by game and Traffic playground; no separate lab car is introduced.

[150](../tactical/150-school-bus-gameplay.md) adds the accepted school bus through
that same catalog. Game and Traffic share its exact radius-112 model, matching
cardinal fallback, 122×43×44px bounds and slower bus handling. Its wider road
admission is derived by the ordinary shared rule; no lab-only bus is introduced.

[140](../tactical/140-shared-input-ux-and-reverse.md) sends held reverse through the
ordinary input flag, Realm/TrafficSystem and PlayerPredictor. Native scenario
30/60Hz binary/replay regressions cover reverse with delayed commands. Car mesh
orientation uses replicated nose direction against velocity; signed backward
wheel travel is shared by game and lab presentation. Traffic inspection maps R
to reverse, L to lights and K to siren style, keeping Jump/Throw meanings separate.
No Deck-only physics, control scheme or lab driving loop is introduced.

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

## Animal browser and natural return timing

[183](../tactical/183-small-animal-sound-parity.md) moves robin/frog/mallard calls
into shared AudioManager presentation. Game and lab consume the same replicated
action/alarm transitions; the lab supplies only opt-in and explicit auditions.


[172](../tactical/172-browsing-courtship-and-collecting.md) adds deer, peacock and
raven scenes using ordinary Realm work, native deer/fauna travel and saved real
resources/partners. The page supplies fixtures and camera framing. A normal placed
tiger triggers deer warning/escape; there is no lab-only alarm, courtship or cache AI.

[170](../tactical/170-rumination-flocks-and-dust-baths.md) adds cow, sheep and
donkey demonstrations with ordinary saved grass, actual flock mates and dust
patches. Shared Realm work owns meal accounting, regrouping, rolling support,
site claims, scuffs and action clocks. The page supplies fixtures and framing;
there is no separate lab rumination, flock steering or bathing simulation.

[166](../tactical/166-scratching-and-pollination.md) adds chicken/bee/hummingbird
activity scenes through ordinary Realm resources, flight/work clocks, clips and
replicated attachments. Flower contact derives from authored beak sockets. A
visiting hummingbird uses the same place-entity command as the game editor.
Pause locks this action; the lab supplies no private pollination/guard loop.

[163](../tactical/163-browsing-rooting-and-trunks.md) adds goat, pig and elephant
activity scenes through ordinary Realm/Worker authority. They share finite source
stock/growth, real prop support and collision, saved work/motion and ordinary
attachments. Source-derived trunk sockets determine both the safe approach and
carried fruit pose. Canvas/GPU presentation receives ordinary replicated clip,
phase, parent and height fields; there is no private lab behavior or growth clock.

[152](../tactical/152-explorer-boat-and-lakes.md) adds the large-lake boat case
through the same natural generator, vehicle authority, rolling prediction,
water-only swept-body collision, open driver presentation and saved traffic
records used in the game. Boats are explicitly excluded from road populations.
The shared mesh loader validates an authored zero-wheel watercraft rig and its
independent propeller; cardinal fallback remains available while
meshes load or fail. Driver seat height is shared by authority and prediction.

The Natural Landscape page now includes the sortable/searchable animal browser.
Its visible animated cards read ordinary shared sprite definitions; selecting an
animal switches the existing ScenarioPresentationHost fixture. There is one
simulation host, with no per-card Worker or separate animal AI. The same Realm
now schedules natural meal returns after 60–120 simulated seconds at distant,
validated ready sites. Independent scoped SaveManager records preserve pending
returns through reload; the wildlife topic owns distances, retry policy and
manual/natural origin rules. Scenario fingerprints include the return scheduler.

[161](../tactical/161-climbing-raids-and-play.md) uses the same shared authority
for continuous supported tree climbing, real cache transfers, physical cat toy
play, renewable food stocks and persistent bounded thrown balls. The five new
activity scenes include three base animals and the two inherited cat coats.
No lab-specific AI or accelerated growth timers are introduced. Capuchin framing
includes its complete source cell at the ground and on the crown. Saved grips,
carried food and action clocks restore through ordinary actor records and sprite
replication; both renderers use the same retained action banks.

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

The fresh gorilla also uses the shared Fauna definition: diagonal knuckle walk,
chest-beat display, ordinary alarms and escape. Its slower cadence sets the
full-cycle recovery allowance in shared gameplay checks. Expansion admission
fits around original water refuges so a new land profile cannot remove an
existing aquatic scenario population.

The crab uses the same shared motion clock with a perpendicular facing map
for its local +X scuttle. Heading, saved native phase and physical travel match
in all four world directions. Aquatic expansion uses 42 fixed reserved species
slots in existing ponds/lagoons, retaining original water actors and RNG.
Complete water footprints and small-pond separation are checked before spawning.
No embedded lab owns a separate animation, aquatic or expansion policy.

Octopus and jellyfish also use ordinary shared deep-water Fauna profiles.
Octopus has eight independent arm chains; jellyfish's authoring source uses a
closed volume-preserving bell deformation with attached rim arms. These are
committed sprite frames at runtime, with identical source phase in game/lab.
Deep-water inspection zoom includes the dry arrival and the complete animal.

Natural wolf/coyote/hyena profiles add explicit authored clips to the shared
Predator definition, preserving all original/fantasy banks. Their pounces keep
the matched chase pose; feeding uses its own jaw action. Fixed expansion homes
and additional natural prey feed the ordinary shared hunter AI. Ten browser
checks cover Worker-lab meals, real-world spawning/editor/deletion, and no
replacement for a player-placed wolf eaten by T. rex. Calls and weighted steps
are shared by game and labs; onset/mute/pause/removal guards cover the new voices.

Donkey/mule/llama/alpaca use shared ordinary Fauna definitions and existing
fixed expansion slots. Their articulated necks are source-authoring mechanics;
runtime consumes committed native frames with the same authority phase in game
and labs. Donkey/mule enable the existing mount code, body-aware falling arrival
and durable mounted reload. All twelve new Canvas/GPU/ball checks pass.

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

[143](../tactical/143-small-animal-roadkill.md) extends that shared contact planner
with atomic small-animal roadkill. Game and labs use the same eligibility, swept
body/height checks, inert actor factories, saved removal/lifetime and prediction
copies. Canvas/GPU share destination-only sprite compression and fade. The lab
keeps no separate collision or wildlife-death implementation.

## Reviewed blue train alignment

The owner accepted the v3 curve lab and authorized game activation on 2026-10-12.
Game and ScenarioPresentationHost now select the same three reviewed blue carriage
models by default, using shared continuous track headings and signed wheel travel.
GPU + meshes renders them; failed/lazy loads retain native
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
- Gravity is one value per JS realm (`physics/Gravity.ts`): the Worker authority
  and each page own a copy, and `RemoteStateView` applies replicated `sync-cvars`.
  A page hosting several scenario views therefore shares one gravity; scenario
  recipes set it explicitly and `ScenarioClient` ignores `sync-cvars`. Owner
  decision 2026-11-06 (B9): keep this rule rather than add per-view gravity.

Lab-specific responsibilities are fixture selection, DOM controls, viewport and
camera intent, diagnostic overlays and review actions. Static art diagrams,
source/geometry experiments and immutable approval renders may intentionally use
independent reference adapters. Label those boundaries; their exceptions do not
justify a second interactive gameplay pipeline or imply end-to-end engine parity.
Changed review pixels still follow [art review](art-review.md).

## Current implementation and gaps

Labs on `LabView` reach this Realm through the game's Worker runtime instead
(see the first section); this section describes the shared staging and the
physics lab's scenario Worker path.

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

`LabView` (since 226 slice 4a; `ScenarioPresentationHost` before it) owns the
labs' client/Worker, production `GameLoop`, render host, asset lifetime, camera
and frame storage, and the game's play controls. The lab page supplies
viewport/settings, diagnostic controls and UI.
[Tactical 048](../tactical/048-embedded-presentation-host.md) records the
original extraction and its validation. Shared owners are:

- `PlayerPresentation`: fixed-tick follow and exponential sub-tick camera
  interpolation, called by both `PlayScene` and the lab. Predictor previous poses
  supply body and camera interpolation together. The lab's -12px framing offset
  is explicit; position commands snap, while ordinary movement interpolates.

  The 2026-10-07 camera raster prototype exposed `RenderView.pixelSnap` in both
  hosts. 213 defaults to continuous projection because independent translation
  rounding made the followed actor oscillate. `?pixelsnap=1` retains the old
  grid-lock comparison; inverse picking follows the displayed projection. Reference adapters
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
- The production GPU `RenderHost` (the only one since 232) configures complete terrain
  assets (blend sheets, roads, variants) and own recovery/disposal. Embedded GPU
  placement keeps the world canvas beneath the lab's input/UI canvas through
  scrolling and resize. The replica uses server-computed autotiles.

Pause and hidden views stop/restart both clocks without hidden-time debt. Disposal releases the Worker, frame, host and assets; late
asset arrivals close without publishing a renderer. Diagnostics are on-demand,
including interpolation and terrain state, and are detached with readiness on exit.
Traffic reset still creates a fresh canvas. Context loss/recovery uses the
production render host. The [cache investigation](performance.md#traffic-workshop-cache-churn)
records the earlier competing-preparation failure.

Outdoor Geometry used this host until 226 slice 4a-ii moved it to `LabView` with
the same options and hooks (see the top of this topic): an explicit fixed world
camera, no terrain or grass, pixel-exact shadows and a scoped asset loader. Its
grid underlay and geometry overlay use backend-neutral `OverlayFrame` commands before/after the
replicated scene. Player collider outlines use the scene collector's interpolated
position and predictor history; fixed framing never turns into player follow on
movement or teleport. The host owns each walker bitmap and releases it on metadata
changes/unmount; the catalog's borrowed HTML image remains usable. Grid lines and
fixture selection remain lab responsibilities; play input comes from the host. Closing the geometry
panel stops the clock and disposes its Worker and GPU sibling canvas. See
[Tactical 050](../tactical/050-outdoor-geometry-presentation.md) for validation.

Character lab used this host until 226 slice 4a-iii moved it to `LabView` (see
the top of this topic). It has fixed framing, verified source/fixture
assets, semantic grid/geometry overlays and live viewport resize. Settings rebuild
only that temporary scenario; zoom leaves the Worker alive. Pose cycling explicitly
pauses simulation and supplies a display-only sprite copy to the ordinary scene
collector. It never overwrites replicated/predicted animation state. The production
clock drives both movement and inspection, and hidden views accrue no time debt.
`CharacterTestScene` remains the immutable reference renderer used by candidate
verification; it is no longer the interactive scene. The candidate fingerprint
formula, reference pixels and approved gameplay bank are unchanged. See
[Tactical 054](../tactical/054-character-presentation-host.md).

Furniture playtest used the same host (until 226 slice 4a-iv moved it to
`LabView`) for its production clock, prediction
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
5. Decide whether the change should reopen review of engine-driven Workshop
   scenes (natural landscapes, world geometry, physics, character lab, car
   projection, deferred vehicle labs). Their identities hash recipe/definition,
   art fingerprints and `ENGINE_REVIEW_REVISION`
   (`src/workshop/EngineReviewRevision.ts`), not engine source; bump that
   constant deliberately to reopen them. Older entries in this topic that say
   fingerprints include Realm or other engine source predate this rule.

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
and observer controls only; it has no car movement loop. Fleet ramp presentation
derives tyre contacts through shared `VehicleGroundPose`/`collectScene`,
so game and lab receive the same pitch, roll, height and fitted-roof correction.
See [vehicles](vehicles.md#turning-and-fleet-ramp-poses--2026-10-24) for
the upright collision boundary and qualification scope.


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
`?allcars3d` supplies a blue fallback for unregistered road
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

## Rolling car steering (2026-10-19)

[144](../tactical/144-rolling-car-steering.md) changes shared `drivenCarPose` to
longitudinal motion and distance-based turning. Traffic, Natural landscape and
World geometry keep ordinary directional axes/Reverse through ScenarioClient;
none owns a steering integrator. Float32 nose state is replicated, restored for
replay and saved in parked traffic records. Shared local/remote presentation
interpolates its angle and meshes retain it at rest. Sprite fallback retains the
immutable approved bank. [154](../tactical/154-car-controls-and-contact.md) adds
shared automatic reverse, relative steering input and model-covering collision
envelopes. Traffic inspection exposes both manual styles through the ordinary
binary input path; main-game tap/hold destinations remain world-relative. Traffic
lookahead/queues use the same calibrated body dimensions. Trains and automatic
road motion keep their existing owners.

The 2026-10-20 diagonal-contact fix keeps those query envelopes but adds shared
oriented-body contact through `drivenCarPose` and `VehiclePush`. Game and lab
prediction use the same translation/rolling-arc sweeps, overlap escape and gentle
push planning. No fixture or lab owns an alternate collision implementation.
The [vehicle topic](vehicles.md#rotated-body-contact-fix-2026-10-20) owns details.

## Racing diagnostics

Scenario Worker responses derive `racer:` handles from ordinary TrafficSystem
states whose lanes own racing. Speedway diagnostics use those durable handles,
so an ordinary road car sharing a racing model is not counted as another racer.
The diagnostic never owns population, movement or persistence. Same-model
ownership and reload tests cover the distinction.

## Native props in animal fixtures

Behavior fixtures `behavior-dog`, `behavior-crow` and `behavior-squirrel` use the
same Realm-owned AnimalWorkSystem, ball physics, resource entities and persistent
actor records as the game. The dog's lab button sends an ordinary throw-ball
command; the crow uses an ordinary native oak canopy. Client observations use
existing binary sprite phases, world height and parenting/socket offsets. The
lab does not own task decisions or food/nest counts. Animal Browser demonstrations
and progress filters consume generated data from the canonical behavior ledger.

Raptor inspection adds optional bounded `ScenarioRecipe.nativeProps` placements.
ScenarioSession creates them with the ordinary prop factory, preserving their
production type and persistence. Custom fixture geometry keeps its anonymous
scenario identity. This distinction matters to shared perch AI: a renamed
fixture rock has collision but is not a recognized native perch. No lab-only
perching or flight simulation is introduced; game and lab use PredatorMotion,
Realm support collision and durable ordinary props. Native flight/reload and
perch checks cover the boundary.


## Foraging and lookout demonstrations

Tactical 157 adds `behavior-rabbit`, `behavior-robin` and `behavior-meerkat` to
the same shared Realm fixtures. Food consists of ordinary saved resource actors;
tree canopies use native prop surfaces. `place-entity` scenario commands forward
the same `edit-spawn` message used by the game editor, letting the meerkat lab
introduce an ordinary tiger. The command does not own AI, hunger, sensing or alarm
state. Production motion, sprite clips and durable work records serve both hosts.

Same-tick resource consumption also exercises the shared EntityManager lifetime
contract: actors removed by AI are filtered out of the admitted physics list
before it can update spatial interest. Game clients and labs therefore both
observe the removal instead of retaining an indexed resource ghost.


[168](../tactical/168-grazing-browsing-and-building.md) adds horse, giraffe and
beaver scenes through shared Realm resource/work authority, native props, saved
branch attachments and ordinary animation replication. Mounted/attached/following
actors cancel work during shared synchronization when normal brain updates are
skipped, preserving controlled poses and releasing claims. There is no lab-only
grazing, growth or shelter-building simulation.

[171](../tactical/171-contextual-controller-actions.md) moves equipment into the
shared contextual menu. Embedded vehicle hosts retain canvas-relative primary
controls, Q/B Actions, neutral input while open and scoped controller sampling.
The normal game uses the same menu, focus/back semantics and authority requests.

## Wildlife defenses and physical ambushes (174)

[174](../tactical/174-curling-quills-and-fox-pounces.md) adds three ordinary
ScenarioPresentationHost scenes for hedgehog curling, porcupine quill warnings and
fox small-prey ambushes. Shared Realm/AnimalWork authority owns sensing, actual
catch protection, native predator retreat and physical fox landings/meals. The
page supplies fixtures, descriptions and framing only. Saved phase/motion and
source-derived named action poses survive Worker pause and scene reload. The
existing Canvas/GPU boundary checks visible animation and actual actor outcomes;
exhaustive interruption/readiness/replacement cases remain native tests.
