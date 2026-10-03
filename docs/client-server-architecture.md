# Client/server architecture

Current implementation map, checked 2026-10-03. The
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
before replacement. The main thread keeps a replicated client world, prediction
and rendering; normal single player does not read live server objects directly.

Browser P2P hosting still runs authority on the main thread. Dedicated Node
hosting uses the same GameServer/Realm model through
[standalone.ts](../src/server/standalone.ts). A direct LocalTransport/LocalStateView
path still exists for specialized callers/tests; it is not the default launcher.

## Transport and requests

[Transport interfaces](../src/transport/Transport.ts) separate hosts from the
shared protocol. Worker traffic is ordered binary data with bounded batches and
acknowledgments for consumption/backpressure. Main-thread decode/application is
budgeted. These consumption acknowledgments are not an acknowledged entity
snapshot protocol. See [networking](topics/multiplayer-networking.md) for message
contracts and the dedicated WebRTC reliability boundary.

[RequestBroker](../src/client/RequestBroker.ts) correlates request IDs with the
response mapping in [requests.ts](../src/shared/requests.ts), checks response
types, times out after 30 seconds and rejects pending calls on disconnect or
destruction. Reconnected transports can make fresh requests.

## Persistence and shared tools

Realm transfers prepare the destination and save the source before detaching a
player. A destination-save failure restores the original live entity; successful
transfers reset replication state. Keep menu and building-door transitions on
this shared path.

[PersistenceStore](../src/persistence/PersistenceStore.ts) has IndexedDB and
filesystem implementations. SaveManager owns writes and migrations; registries
own world metadata. [Setup and local data](setup-and-local-data.md) distinguishes
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
