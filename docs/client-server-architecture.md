# Client/server architecture

Current implementation map, updated 2026-11-03 after reset 205 and pacing fix 208. The
[original extraction plan](archive/client-server-extraction-plan.md) is archived;
its shared-memory local mode and “future” multiplayer phases are historical.

## Runtime ownership

[205](tactical/205-physics-reset.md) replaces ordinary Realm integration with one
fixed 60Hz `PhysicsScene` step. Players/NPCs submit intent; physics owns poses.
Normal prediction uses the same kernel in a private bounded scene, with numerical
body snapshots at explicit ticks and epochs. Authority and prediction have separate
WASM instances/memory; there is no additional physics Worker or shared-memory
requirement. Only gravity remains exposed as physics tuning. Old physics engines,
backend selectors, variable command timing and specialized vehicle services are
deleted. [205](tactical/205-physics-reset.md) records native, ordinary Worker/delayed
P2P, lifecycle and physical Chromebook qualification and explicit deferrals.
Earlier190/191 experimental simulation owners are historical; the co-op lab now
uses normal ScenarioSession/Worker authority and one normal predictor per pane.

| Owner | Responsibility |
| --- | --- |
| [GameClient](../src/client/GameClient.ts) | Browser input, scenes, rendering and client state view |
| [PlayerPredictor](../src/client/PlayerPredictor.ts) | Bounded coupled-body prediction and fixed-tick input replay |
| [GameServer](../src/server/GameServer.ts) | Connections, world management and active realms |
| [Realm](../src/server/Realm.ts) | Simulation, editing, generated residency and persistence |
| [RealmReplicator](../src/server/RealmReplicator.ts) | Per-connection stream baselines and frame/sync message construction |
| [RealmTransitions](../src/server/RealmTransitions.ts) | Guarded player transfer, persistence recovery and baseline reset |
| [WorldAPI](../src/server/WorldAPI.ts) | Trusted gameplay API and per-realm services |

Single player and browser P2P hosting start a dedicated server Worker from [main.ts](../src/main.ts).
[LocalServerRuntime](../src/server/LocalServerRuntime.ts) owns startup, visibility
pause/resume, periodic saves and acknowledged shutdown. HMR waits for shutdown
before replacement; Vite full reload also awaits shutdown before navigation. The main thread keeps a replicated client world, prediction
and rendering; normal single player does not read live server objects directly.

P2P keeps PeerJS connections on the main thread and transfers owned binary buffers
through one independent ordered MessagePort per guest. Guest decode, simulation,
replication and encoding run in the same authority Worker as the local host client.
Per-recipient readiness is checked before advancing last-sent replication state;
a blocked local replica or guest does not stop other ready recipients. Hidden
single player pauses; hidden P2P keeps authority/guest delivery running and defers
ordinary local replication until visible again. Browser/OS suspension can still
interrupt a browser host. See [188](tactical/188-p2p-worker-authority.md).
Dedicated Node hosting uses the same GameServer/Realm model through
[standalone.ts](../src/server/standalone.ts). `GameClient` always talks to authority
through a transport and mirrors it in `RemoteStateView`; an in-process
`LocalTransport` + `GameServer` pair remains only for Node tests (`memoryServer`,
the replication harness).

All timed GameServer hosts use ServerLoop's monotonic fixed-step deadlines.
Integer timer rounding and callback work do not accumulate simulation drift;
short late wakes catch up, long stalls bound overdue debt to 250ms, and stop/resume
start a fresh schedule. Both authority and client updates are fixed at 60Hz; there
are no runtime rate/substep/time-scale setters. Interactive embedded scenarios now use the
same ServerLoop and OrderedWorkerChannel. Their temporary Realm host separates
input admission from ticks and uses ordinary streaming readiness policy. Explicit
ScenarioSession steps remain available for headless tests and paused inspection.
See [embedded labs](topics/embedded-engine-labs.md) for lifecycle and parity limits.
Labs moving onto the game view (226) use the game's own Worker host instead:
`recipe-world.worker.ts` serves a `RecipeWorldAuthority` (recipe staging over
one Realm) through `LocalServerRuntime`, and the lab connects with
`WorkerClientTransport` and `RemoteStateView` like the game. Lab instruments
(clock, step, teleport, reset, reload, diagnostics) are an opaque `admin`
packet on the local host channel, ordered with play and answered after a full
snapshot; `GameServer` refuses them.

## Transport and requests

Frame tag `0x16` carries normal entity baselines/deltas plus the bounded numerical
physics state. Replicated `physicsGroupId` keeps a train consist coherent in
bounded selection and private replay; no private service IDs are required. The
numerical state includes previous poses, full vehicle quaternions/angular velocity/sleep, solved contact pairs, vehicle motor targets, retained takeoff support velocity, a one-use held jump queue and the motor's exclusive input deadline. Earlier frame tags
reject and matching endpoint builds are required. Position coordinates retain
Float64 precision in the physics payload; previous positions use float32 displacement
from that pose. Reset 205 removed retired equipment fields.
[Vehicle paints](vehicle-paint-variants.md) owns
paint identity, which is independent of the physics reset.

[Transport interfaces](../src/transport/Transport.ts) separate hosts from the
shared protocol. Worker traffic is ordered binary data with bounded batches and
acknowledgments for consumption/backpressure. Main-thread decode/application is
budgeted. These consumption acknowledgments are not an acknowledged entity
snapshot protocol. See [networking](topics/multiplayer-networking.md) for message
contracts and the dedicated WebRTC reliability boundary.

`sync-chunks` preserves the fixed ordinary chunk layout. A flagged, length-prefixed
geometry extension carries deterministic rail paths for curved track chunks;
replicas use these paths with the replicated road mask to bake normal terrain
caches. The authority service uses the same alignment for carriage motion. Paths
are generator-derived metadata, not duplicated durable terrain records.

A connection is a device that can seat up to four local players
([226](tactical/226-player-views-and-local-split-screen.md): server side since
slice 4b-i, client seats and their prediction since 5-i, split screen in the
game since 5-ii).
- **Sessions per seat:** each seat has its own `PlayerSession`. Seat 0's id is
  the bare connection id, so single player is unchanged; other seats are
  `connection#n`, and are guests of seat 0 without a profile.
  - A guest's per-realm player data is saved under seat 0's profile and seat
    (`persistId`, for example `profile#1`, pinned when the guest is first
    seated). Guests save no location, because they always follow seat 0.
  - Server transports close a connection whose id holds `#`, and profile ids
    holding it are ignored.
- **Routing:** [DeviceTransport](../src/server/DeviceTransport.ts) wraps the
  transport `GameServer` receives.
  - A device sends one `player-input` per tick, carrying every seat's movement
    under one sequence. A joined seat missing from it stands still.
  - Other seats' messages and replies travel in `seat` envelopes.
  - `set-debug` pauses every seat of that device.
  - A disconnect makes every seat dormant.
- **Joining and leaving:** [DeviceConnections](../src/server/DeviceConnections.ts)
  owns the connection lifecycle and `join-seat`/`leave-seat`. A guest arrives
  beside seat 0, clear of other bodies, and on the raised surface seat 0 stands
  on (a deck, a bridge's top) where it extends there. A dormant guest whose
  seat 0 has moved to another realm rejoins beside it.
- **Party travel** ([DeviceTravel](../src/server/DeviceTravel.ts)): a device's
  awake seats travel together, led by whichever seat asks.
  - This covers world travel, doors and `leave-realm` (the seats wait in the
    lobby and follow the device into its next realm), and leaving a deleted
    world.
  - The leader alone passes the destination's and the door's checks.
    The others arrive beside it (`RealmTransitions.moveParty`), on the raised
    surface it stands on where it extends there.
  - Through a walk-through door the leader alone walks; every seat waits out
    its walk out of the door before moving again.
  - Every seat arrives, or every seat goes back where it was.
  - The requesting seat gets the one reply; each other seat gets only its new
    `player-assigned`.
  - A resume from the lobby is the device's saved place, which only seat 0
    keeps, so seat 0 leads it whichever seat asks.
  - Deleting a world lets transfers in progress settle before each device
    leaves, so a travelling seat does not stop the deletion.
- **Replication** ([RealmPublication](../src/server/RealmPublication.ts)): a realm
  sends one stream per connection with a live seat in it. The stream goes
  through that connection's lowest live seat there: bare for seat 0, otherwise
  in the guest's envelope.
  - The stream has one acknowledgement.
  - Its frames list each seat's entity (`seats`) whenever it carries a guest.
  - Its interest is the seats' visible ranges as a list of rectangles
    ([ReplicationInterest](../src/server/ReplicationInterest.ts)).
  - Its physics snapshot is anchored on every seat
    ([PredictionSelection](../src/physics/PredictionSelection.ts)).
  - Each seat's own session sync goes to that seat.
  - The replicator keeps baselines per connection. A new lowest seat starts the
    stream over.
- **Client seats** ([DeviceSeats](../src/session/DeviceSeats.ts)): the device
  session holds seat 0 and the guests it has joined. Each seat owns its input
  composition, and a guest also owns its input set.
  - One device tick ([DeviceTick](../src/session/DeviceTick.ts)) sends every
    seat's command under one sequence. A locked seat sends still movement; a
    seat's cancel stops it on that tick, without an extra sequence.
  - The predictor stores every tick except while authority holds the device
    still (a storage pause or a door transition). Device-wide stops (lost focus,
    a hidden page, pausing play) also send one immediate still packet for every
    seat; it is off cadence and not stored.
  - One predictor replays every seat. Co-seat movement is keyed by seat, and
    each reconcile resolves a co-seat's body from the frame seat list by the
    authority's rule (its vehicle or mount, else its body), so mounting and
    realm changes stay in step. A co-seat outside seat 0's contact group eases
    its own correction.
  - A guest's envelope ([SeatEnvelope](../src/client/SeatEnvelope.ts)): its
    travel replies and request answers are the device's, its own sync goes to
    its seat, and its own door walk veils the device. A stream through a guest
    alone is ignored, because party travel keeps a device's live seats in one
    realm. A seat the client has not joined moves nothing, and authority sends
    a dormant guest nothing at all. After the connection drops, the device's
    next realm entry asks to seat each guest again (`DeviceSeats.reseat`); a
    guest authority refuses leaves.
  - Split screen: [LocalPlayers](../src/client/LocalPlayers.ts) joins guests
    from a pad or the second keyboard scheme and leaves them from the world
    menu. [SeatViews](../src/session/SeatViews.ts) gives each seat a view, and a
    guest's camera follows its controlled body
    ([SeatFocus](../src/session/SeatFocus.ts)). Each guest view's visible
    range goes in its envelope. A guest's place controls
    ([GuestPlaces](../src/client/GuestPlaces.ts)) read the same vehicle and
    door choices as seat 0's ([PlacePrompts](../src/ui/PlacePrompts.ts)) for
    its own body and send its requests in its envelope
    (`RequestBroker.send(request, seat)`).

[RequestBroker](../src/client/RequestBroker.ts) correlates request IDs with the
response mapping in [requests.ts](../src/shared/requests.ts), checks response
types, times out after 30 seconds and rejects pending calls on disconnect or
destruction. Reconnected transports can make fresh requests.

Normal `vehicle-tow-action` requests use the same vehicle-controlled response and
request-error path. Authority validates the stopped operator, parked unoccupied
load, bounded alignment and clear pickup/release. Reciprocal durable traffic
identities restore runtime links in either chunk order; pending links stop the
pair. See [towing](vehicle-towing.md).

## Prediction and moving supports

Inside-driven cars integrate consumed input command time only. Short empty-input
authority ticks hold the committed pose; they do not synthesize braking movement
or refresh the last-command timestamp. Real zero-axis commands brake normally;
the existing 250ms stale-command stop changes velocity without adding travel.
Driven trains retain service-clock braking on empty input. This shared Realm
policy keeps ordinary game and embedded lab prediction aligned; see
[car input-gap evidence](research/car-driving-prediction-jitter.md).

Authority frames carry elapsed simulation seconds independently of tick count;
binary frame headers are 27 bytes and endpoints must run the same build. Prediction
retains bounded collision-only motion history for nearby solid entities and uses
explicit replay time. Shared collision policy blocks `solid !== false` on both
endpoints. NPC AI remains authoritative.

Autonomous car/train roofs carry passengers once per committed support pose.
Command integration predicts relative walking/jumping; displayed passengers share
the carrier's sampled presentation pose. RemoteStateView retains bounded motion
history and borrows render-only clones at an explicit display time: a 50ms buffer,
up to 100ms extrapolation, then hold. Loading renders wait for the first snapshot
before establishing the source epoch. Exhausted forward clock debt is rebased
monotonically; large delivery bursts recover to the buffer rather than staying
behind pruned history. Ordinary in-buffer arrivals preserve the epoch.
Local roof walking remains predicted.
Pure camera follow consumes displayed targets and explicit time; local ground
movement uses admitted input time, while carrier motion uses remote presentation
time. Physics and collision replay never consume those render-only clones.
`playerEntity` retains physics ownership throughout a render; cameras use the
explicit `presentedPlayerEntity` accessor and renderers consume the borrowed
entity array. The host releases the borrow before subsequent input/simulation.
A bounded presentation-only decay handles
small residual ground-contact corrections without changing replay physics.
[Player prediction](topics/player-prediction.md) owns limits and acceptance evidence.

Physically timed wildlife clips can replicate an optional elapsed-millisecond phase
(u16, sprite flag bit 7). Frog hop push/air/landing frames follow the same saved
physics timeline in authority and both replica consumers, including mid-hop
baselines and delta removal. Ordinary animation clocks remain local. Endpoints
must run the same build; [078](tactical/078-durable-pond-frogs.md) records coverage.

## Persistence and shared tools

Realm transfers prepare the destination and save the source before detaching a
player, then commit the authoritative profile location after the destination is
saved. Destination/location-save failures restore the original live entity;
successful transfers reset replication state. Profile takeover and reconnect wait
for in-flight travel. Keep menu and building-door transitions on this shared path.
[PlayerLocationStore](../src/persistence/PlayerLocationStore.ts) owns current realm
and position; per-realm player records remain visit history. Startup restores the
current location, with validated fallback for unavailable interiors. Exact resume
retains absolute height and saved moving-roof support; a relocated safe arrival
or explicit travel resets support to ground. A place saved on a walkable surface
above the terrain (a deck, a bridge's top) is checked standing on it, so it
resumes exactly rather than being moved to the ground nearby. Restoring a train roof first readies
the saved service and resolves its stable carriage identity. See the
[interior topic](topics/patterns-and-interiors.md#player-location-reload-and-building-connections)
for door identities, reload guarantees and content boundaries.

[PersistenceStore](../src/persistence/PersistenceStore.ts) uses one shared record
coordinator over IndexedDB or SQLite on a Node IO worker. GameServer receives
required host dependencies; concrete browser adapters live in the browser host
composition module. SaveManager tracks dirty records and owns flush barriers;
registries own world metadata. Format 3 uses one physical world container with outdoor/interior namespaces,
individual actor/prop/traffic records and
transactional spatial indices; existing worlds are incompatible and are not migrated. [Setup and local data](setup-and-local-data.md) distinguishes
saved worlds from browser review drafts and server feedback histories.

The explorer uses SavedWorldSource for local/remote world reads and ReviewStore
for verdict persistence/export fallback. Explorer preview, gameplay and Workshop
share generation and art realization. See [world explorer](world-explorer.md),
[city generation](topics/city-generation.md) and [patterns/interiors](topics/patterns-and-interiors.md).

## Touch movement

Tap movement remains client intent: `TapMovement` supplies ordinary directional
axes to PlayScene's existing quantized input/prediction path. Destination and
local profile control preference are not sent to authority. The three-byte AI
state uses bits 5/6 for presence/value of live `befriendable` tag eligibility;
baselines and deltas carry both false and true, overriding static definitions.
Authority still performs `player-interact`; clients use the shared 24-pixel hit
rule only to choose whether a world tap means interaction or walking. Game and
embedded replicas share this state contract. Hold movement samples the latest presented view while a world contact remains
held, supplying the same ordinary axes. [Touch movement](topics/touch-movement.md)
owns modes and lifecycle; [086](tactical/086-tap-to-move-and-options.md) records
the original tap implementation.

## Validation entry points

- Authority, transfers and requests: GameServer, RealmBrowser and RequestBroker
  tests beside their implementations.
- Movement and prediction: [shared prediction](../src/client/SharedPrediction.test.ts)
  and [player controls](../src/physics/PlayerControls.test.ts).
- Worker lifecycle and streaming: [performance](topics/performance.md).
- Hosting authorization: [server access](SERVER-SECURITY.md).


Airborne support momentum uses optional `airMomentumX/Y` velocity components in
entity baselines/deltas. Authority and prediction retain total world velocity for
collision, while platformer air control acts on voluntary velocity. The optional
`jumpInputState` packs authority's consumed/held jump-button latch, restored before
pending-input replay. All fields have explicit delta removal and binary mask/buffer
coverage; endpoints must use the same build. Airborne player saves retain total and
passive XY motion; explicit travel and lifecycle resets clear passive state.
[Movement/presentation evidence](research/airborne-support-momentum.md) owns details.

Externally inherited XY displacement is admitted once per authority world interval,
across an input batch; commanded steering and jump gravity retain input time.
Input-landed passengers do not receive another service carry during that interval.
Prediction timestamps its world endpoints and samples inherited display motion at
the remote entities' source time, with local steering still interpolated locally.
Predicted landing binds its future roof offset back to the committed roof frame.
These policies live in shared Realm/movement/replica/predictor code used by game
and labs. [Idle travel evidence](research/idle-support-jump.md) owns acceptance.

Ambulance emergency state is an optional byte in entity baselines and a new delta
field with explicit removal. Delta change/null masks are now u32 (formerly u16);
clients and servers must run the same build. The inside driver alone changes it,
and TrafficSystem saves style/on-off through the normal durable traffic record.
The existing sprint input boosts shared car prediction/authority and service-owned
trains. [117](tactical/117-ambulance-driving-controls.md) owns feature validation.

Driven cars also carry optional float32 `vehicleHeading` in shared simulation,
traffic saves and entity replication. Baseline presence masks are now u32;
delta change/null masks retain u32 with heading at bit 17. Both endpoints require
the same build. Prediction restores the bearing before replay; presentation
interpolates shortest arcs on borrowed clones without writing physics state.
See [rolling steering](tactical/144-rolling-car-steering.md).

Car control interpretation travels with each command: input flag bit 4 means
relative steering/throttle. Authority and prediction apply it against the admitted
vehicle nose; tap/hold destinations send ordinary world-direction axes. Directional
reverse choice and conservative model-covering body envelopes are shared by main
game and embedded labs. Local profiles remember the manual preference. Retained
mesh bounds, native source footprints and continuous headings determine the same
collider on deserialize/delta/parked restore; see [154](tactical/154-car-controls-and-contact.md).
