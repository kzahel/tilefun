# Client-Server Architecture for Tilefun

## Architecture Overview

Split the monolithic `Game.ts` (977 lines) into three layers:

```
┌─────────────────────┐     ┌─────────────────────────────────┐
│   GameClient        │     │   GameServer                    │
│   (browser only)    │     │   (browser OR Node headless)    │
│                     │     │                                 │
│ Canvas, Camera      │     │ World, ChunkManager             │
│ TileRenderer        │◄──►│ EntityManager, PropManager       │
│ EntityRenderer      │     │ TerrainEditor                   │
│ InputManager        │     │ GemSpawner, BaddieSpawner       │
│ EditorMode/Panel    │     │ AI, Physics, Collision          │
│ TouchJoystick       │     │ Gameplay (gems, combat)         │
│ MainMenu, HUD       │     │ Persistence (IDB or FS)         │
└────────┬────────────┘     └──────────┬──────────────────────┘
         │                             │
         └──────────┬──────────────────┘
                    │
         ┌──────────▼──────────┐
         │     Transport       │
         │  LocalTransport     │  ← same JS heap, shared refs, no serialization
         │  WebSocketTransport │  ← JSON messages over network
         └─────────────────────┘
```

### Key Design Decisions

1. **Local mode = shared memory**: `LocalTransport` gives the client direct read access to server's `World`, `EntityManager`, `PropManager` objects. Zero copy for rendering. Messages only for mutations (input, edits).

2. **Server has no DOM deps**: Can run in Node/Bun as headless. Uses `setInterval` for tick loop (not `requestAnimationFrame`).

3. **Client reads through `ClientStateView` interface**: In local mode returns direct server object refs. In remote mode returns a mirrored copy updated from network messages.

4. **Editor edits become messages**: Client's `EditorMode` still produces pending edits, but instead of calling `TerrainEditor` directly, it sends messages to the server.

## New Files

### `src/shared/protocol.ts` — Message types
```typescript
// Client → Server
type ClientMessage =
  | { type: "player-input"; dx: number; dy: number; sprinting: boolean }
  | { type: "player-interact"; wx: number; wy: number }
  | { type: "edit-terrain-tile"; tx: number; ty: number; terrainId: number | null; paintMode: PaintMode; bridgeDepth: number }
  | { type: "edit-terrain-subgrid"; gsx: number; gsy: number; terrainId: number | null; paintMode: PaintMode; bridgeDepth: number; shape: SubgridShape }
  | { type: "edit-terrain-corner"; gsx: number; gsy: number; terrainId: number | null; paintMode: PaintMode; bridgeDepth: number }
  | { type: "edit-road"; tx: number; ty: number; roadType: number; paintMode: PaintMode }
  | { type: "edit-elevation"; tx: number; ty: number; height: number; gridSize: number }
  | { type: "edit-spawn"; entityType: string; wx: number; wy: number }
  | { type: "edit-delete-entity"; entityId: number }
  | { type: "edit-delete-prop"; propId: number }
  | { type: "edit-clear-terrain"; terrainId: number }
  | { type: "edit-clear-roads" }
  | { type: "request-chunks"; minCx: number; minCy: number; maxCx: number; maxCy: number }
  | { type: "set-editor-mode"; enabled: boolean }

// Server → Client (only used in remote mode)
type ServerMessage =
  | { type: "full-state"; ... }
  | { type: "tick"; entities: EntitySnapshot[]; ... }
  | { type: "chunk-data"; cx: number; cy: number; subgrid: Uint8Array; roadGrid: Uint8Array; heightGrid: Uint8Array }
  | { type: "player-assigned"; playerId: number }
  | { type: "player-state"; gemsCollected: number; invincibilityTimer: number }
```

### `src/transport/Transport.ts` — Interface
```typescript
interface IClientTransport {
  send(msg: ClientMessage): void;
  onMessage(handler: (msg: ServerMessage) => void): void;
  close(): void;
}
interface IServerTransport {
  send(clientId: string, msg: ServerMessage): void;
  broadcast(msg: ServerMessage): void;
  onMessage(handler: (clientId: string, msg: ClientMessage) => void): void;
  onConnect(handler: (clientId: string) => void): void;
  onDisconnect(handler: (clientId: string) => void): void;
  close(): void;
}
```

### `src/transport/LocalTransport.ts`
- Implements both `IClientTransport` and `IServerTransport`
- Direct function calls, no serialization
- Exposes `serverRef: GameServer` for client to read state directly
- `triggerConnect()` immediately fires the connect handler

### `src/server/GameServer.ts`
Owns all authoritative state. Extracted from `Game.ts`:
- **State**: World, EntityManager, PropManager, player entity, spawners, TerrainEditor, persistence
- **Per-client**: `PlayerSession` (entity, latestInput, gemsCollected, invincibilityTimer, knockback, visibleChunkRange)
- **Tick** (60Hz via `setInterval`):
  1. Process queued client messages
  2. Update player velocities from session inputs (Game.ts:577-581)
  3. Run AI for all entities (Game.ts:584-610)
  4. Run EntityManager.update() physics (Game.ts:619-624)
  5. Run gameplay: gem spawning/collection, baddie contact, knockback (Game.ts:630-736)
  6. Update chunk loading (union of all clients' visible ranges)
  7. Compute autotile for dirty chunks
  8. Persist (debounced)

### `src/server/PlayerSession.ts`
```typescript
class PlayerSession {
  clientId: string;
  entity: Entity;
  latestInput: Movement;
  editorEnabled: boolean;
  gemsCollected: number;
  invincibilityTimer: number;
  knockbackVx: number;
  knockbackVy: number;
  visibleChunkRange: ChunkRange;
}
```

### `src/server/ServerLoop.ts`
- `setInterval`-based fixed-timestep at TICK_RATE (60Hz)
- Platform-agnostic (works in browser and Node)

### `src/client/GameClient.ts`
Owns rendering, input, UI. Extracted from `Game.ts`:
- **State**: Canvas, ctx, Camera, TileRenderer, InputManager, TouchJoystick, EditorMode, EditorPanel, DebugPanel, MainMenu
- **State view**: `ClientStateView` (interface — `LocalStateView` or `RemoteStateView`)
- **rAF loop** (existing `GameLoop`):
  - `update(dt)`: Poll input → send `player-input` message. Consume editor edits → send `edit-*` messages. Camera follow.
  - `render(alpha)`: Read from `stateView.world`, `stateView.entities`, `stateView.props`. All existing rendering code unchanged.

### `src/client/ClientStateView.ts`
```typescript
interface ClientStateView {
  readonly world: World;
  readonly entities: readonly Entity[];
  readonly props: readonly Prop[];
  readonly playerEntity: Entity;
  readonly gemsCollected: number;
  readonly invincibilityTimer: number;
}

class LocalStateView implements ClientStateView {
  // Returns direct refs to GameServer's objects
  get world() { return this.server.world; }
  get entities() { return this.server.entityManager.entities; }
  // ...
}

class RemoteStateView implements ClientStateView {
  // Maintains mirrored copies, updated from ServerMessages
}
```

## Implementation Phases

### Phase 0: Prep (no behavior change)
Decouple existing code so the split is clean:

1. **Decouple spawners from Camera**: `GemSpawner.update()` and `BaddieSpawner.update()` take `camera: Camera` but only call `camera.getVisibleChunkRange()`. Change signature to accept `ChunkRange` instead.
   - Files: `src/entities/GemSpawner.ts`, `src/entities/BaddieSpawner.ts`, `src/core/Game.ts` (callsites)

2. **Extract gameplay simulation**: Pull Game.ts lines 630-736 (gem collection, baddie contact, knockback, invincibility, gem velocity decay, buddy scare) into `src/server/GameplaySimulation.ts` as a pure function `tickGameplay(session, entityManager, dt)`. Call from Game.ts.

3. **Extract AI tick**: Pull Game.ts lines 584-610 into `tickAllAI(entities, playerPos, dt, rng)` function.

4. **Decouple TerrainEditor from SaveManager**: TerrainEditor constructor takes `SaveManager` but only calls `markChunkDirty()`. Change to accept a `(key: string) => void` callback.
   - File: `src/editor/TerrainEditor.ts`, `src/core/Game.ts` (construction)

5. Run all tests — game must behave identically.

### Phase 1: Server + Transport + Client (single-player local)
Build the full stack, wire with LocalTransport, delete Game.ts:

1. Create `src/shared/protocol.ts` — message types
2. Create `src/transport/Transport.ts` — interfaces
3. Create `src/transport/LocalTransport.ts`
4. Create `src/server/ServerLoop.ts`
5. Create `src/server/PlayerSession.ts`
6. Create `src/server/GameServer.ts` — move state + logic from Game.ts
7. Create `src/client/ClientStateView.ts` — LocalStateView
8. Create `src/client/GameClient.ts` — move rendering + input + UI from Game.ts
9. Update `src/main.ts`:
   ```typescript
   const transport = new LocalTransport();
   const server = new GameServer({ transport, ... });
   const client = new GameClient(canvas, transport);
   await server.init();
   await client.init();
   server.start();
   ```
10. Delete `src/core/Game.ts`
11. Run all tests, verify identical behavior

### Phase 2 & 3 (future — not in this implementation)
- Phase 2: WebSocket transport, headless Node server, RemoteStateView
- Phase 3: Browser-hosted P2P (host runs GameServer + serves guests)

## Files Modified

| File | Change |
|------|--------|
| `src/entities/GemSpawner.ts` | Replace `camera: Camera` param with `visibleRange: ChunkRange` |
| `src/entities/BaddieSpawner.ts` | Same |
| `src/editor/TerrainEditor.ts` | Replace `SaveManager` dep with `markDirty` callback |
| `src/core/Game.ts` | Decomposed into GameServer + GameClient, then deleted |
| `src/main.ts` | Wire GameServer + GameClient + LocalTransport |

## Files Created

| File | Purpose |
|------|---------|
| `src/shared/protocol.ts` | Message type definitions |
| `src/transport/Transport.ts` | IClientTransport, IServerTransport interfaces |
| `src/transport/LocalTransport.ts` | In-memory transport |
| `src/server/GameServer.ts` | Authoritative game server |
| `src/server/ServerLoop.ts` | setInterval tick loop |
| `src/server/PlayerSession.ts` | Per-client state |
| `src/server/GameplaySimulation.ts` | Gem/combat/knockback logic |
| `src/client/GameClient.ts` | Rendering + input client |
| `src/client/ClientStateView.ts` | State access abstraction |

(Phase 2 adds WebSocket transports + server entry point)

## Tests

### Phase 0 Tests (additions/modifications)
- **GameplaySimulation.test.ts**: Unit test the extracted `tickGameplay()`:
  - Gem collection: player near gem → gem removed, gemsCollected incremented
  - Baddie contact: player near hostile → knockback applied, gems scattered, invincibility set
  - Invincibility: no damage during invincibility window
  - Buddy scare: baddie near buddy → buddy stops following, flees
  - Gem velocity decay: scattered gems slow down and stop
- **tickAllAI.test.ts**: Unit test AI tick:
  - Entities beyond activation distance get frozen (velocity zeroed)
  - Chase AI targets player when in range
  - Wander AI changes direction on timer
- **Spawner tests**: Verify GemSpawner/BaddieSpawner work with `ChunkRange` param instead of `Camera`

### Phase 1 Tests (new files)
- **LocalTransport.test.ts**:
  - Client send → server handler receives the exact message object
  - Server send → client handler receives the exact message object
  - triggerConnect() fires connect handler with client ID
  - close() prevents further messages
- **GameServer.test.ts**:
  - Construction: creates World, EntityManager, PropManager
  - `init()`: loads/generates world, spawns player for connected client
  - Processing `player-input` message: updates player velocity
  - Processing `edit-terrain-tile` message: modifies chunk subgrid
  - Processing `edit-spawn` message: spawns entity at position
  - Processing `edit-delete-entity` message: removes entity
  - Tick pipeline: AI runs, physics resolves, gameplay ticks
  - Multi-tick: player moves over multiple ticks with continuous input
- **GameClient.test.ts** (integration):
  - Construction with LocalTransport: can read server state
  - Input polling sends player-input message to server
  - Editor edits send edit-* messages to server
- **ClientStateView.test.ts**:
  - LocalStateView returns direct references to server objects
  - Mutations on server side are visible through LocalStateView (shared refs)
- **PlayerSession.test.ts**:
  - Default state is correct (zero input, editor enabled, zero gems)

### Existing Tests (must still pass)
- All existing vitest tests in `src/**/*.test.ts`
- All existing Playwright E2E tests in `tests/`
- `npm run build` succeeds (no type errors)
- `npx biome check .` clean

### Verification Procedure (each phase)
1. `npx vitest` — all unit tests pass (old + new)
2. `npm run build` — no type errors
3. `npx biome check --write .` — lint/format clean
4. Manual smoke test: open dev server, edit terrain, place entities/props, play mode, collect gems, get hit by ghost
5. `npm run build && npx playwright test` — E2E passes

## Edge Cases (Phase 0+1 scope)

- **Chunk.renderCache**: Client-only `OffscreenCanvas`. In local mode, lives on shared Chunk objects (server never reads it). This is acceptable tight coupling for local mode.
- **Persistence format**: Unchanged. SaveManager stays as-is, just constructed inside GameServer instead of Game.ts.
- **Zero latency in local mode**: LocalTransport dispatches messages synchronously (direct function call in same frame). Client reads server state objects directly. No serialization, no copying, no prediction needed.
- **Editor mode**: EditorMode still lives on client, still produces pending edits. The only change is those edits get sent as messages to server instead of calling TerrainEditor directly. In local mode this is a synchronous function call — feels identical to current behavior.

## Future concerns (Phase 2+, not implemented now)
- **Client-side prediction**: Remote clients will need to locally predict player movement, then reconcile with server. Not needed for local mode.
- **Entity ownership**: In multiplayer, each player's entity is controlled only by their input. NPCs controlled by server AI. Not relevant for single-player.
- **Multi-client chunks**: Server loads union of all clients' visible ranges.
- **Editor in multiplayer**: Last writer wins. Clear operations restricted to host.
