# Client/server architecture

Current implementation map, checked 2026-10-06. The
[original extraction plan](archive/client-server-extraction-plan.md) is archived;
its shared-memory local mode and “future” multiplayer phases are historical.

## Runtime ownership

| Owner | Responsibility |
| --- | --- |
| [GameClient](../src/client/GameClient.ts) | Browser input, scenes, rendering and client state view |
| [PlayerPredictor](../src/client/PlayerPredictor.ts) | Local player/mount prediction and input replay reconciliation |
| [GameServer](../src/server/GameServer.ts) | Connections, world management and active realms |
| [Realm](../src/server/Realm.ts) | Simulation, editing, generated residency and persistence |
| [RealmReplicator](../src/server/RealmReplicator.ts) | Per-client baselines and frame/sync message construction |
| [RealmTransitions](../src/server/RealmTransitions.ts) | Guarded player transfer, persistence recovery and baseline reset |
| [WorldAPI](../src/server/WorldAPI.ts) | Trusted gameplay API and per-realm services |

Single player starts a dedicated server Worker from [main.ts](../src/main.ts).
[LocalServerRuntime](../src/server/LocalServerRuntime.ts) owns startup, visibility
pause/resume, periodic saves and acknowledged shutdown. HMR waits for shutdown
before replacement; Vite full reload also awaits shutdown before navigation. The main thread keeps a replicated client world, prediction
and rendering; normal single player does not read live server objects directly.

Browser P2P hosting still runs authority on the main thread. Dedicated Node
hosting uses the same GameServer/Realm model through
[standalone.ts](../src/server/standalone.ts). A direct LocalTransport/LocalStateView
path still exists for specialized callers/tests; it is not the default launcher.

All timed GameServer hosts use ServerLoop's monotonic fixed-step deadlines.
Integer timer rounding and callback work do not accumulate simulation drift;
short late wakes catch up, long stalls bound overdue debt to 250ms, and stop/resume
or rate changes start a fresh schedule. Embedded scenarios instead advance explicit
authority steps through ScenarioSession; they do not use ServerLoop.

## Transport and requests

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

[RequestBroker](../src/client/RequestBroker.ts) correlates request IDs with the
response mapping in [requests.ts](../src/shared/requests.ts), checks response
types, times out after 30 seconds and rejects pending calls on disconnect or
destruction. Reconnected transports can make fresh requests.

## Prediction and moving supports

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
or explicit travel resets support to ground. Restoring a train roof first readies
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

## Validation entry points

- Authority, transfers and requests: GameServer, RealmBrowser and RequestBroker
  tests beside their implementations.
- Movement: [physics parity](../src/physics/physicsParity.test.ts),
  [netcode parity](../src/server/NetcodeParityBaseline.test.ts) and
  [input queue prediction](../src/server/InputQueuePrediction.test.ts).
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
