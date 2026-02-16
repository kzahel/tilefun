# Plan: Delta Optimization for Slow-Changing GameStateMessage Fields

## Goal

Stop resending identical data every tick. Make slow-changing fields on `GameStateMessage` optional — server tracks what was last sent per client, only includes fields when they've changed. Client keeps previous values when a field is absent.

**Expected impact**: ~30-40% bandwidth reduction in steady state. Props, cvars, playerNames, loadedChunkKeys, editorCursors all drop to ~0 bytes/tick when unchanged. `invincibilityTimer` drops to 0 when idle (which is 99% of the time).

## Architectural Context

This is Phase 1 of the protocol evolution roadmap. The fields we're making
optional here map directly to the future reliable/unreliable WebRTC channel
split — the "always sent per tick" fields become unreliable entity frames,
and the "sent on change" fields become reliable sync events.

For the full architecture (data channel topology, QW/Source comparisons,
voice chat, protocol phases 1-7): **`docs/NETWORK-ARCHITECTURE.md`**

For wire protocol research (QW, Source, Roblox deep dives):
**`docs/research/wire-protocol-survey.md`**

## Design

### Semantics

- **Field present** = new value, apply it
- **Field absent (undefined)** = unchanged, keep previous value
- For `mountEntityId`: change from `number | undefined` to `number | null | undefined`. `null` = not riding (explicit). `undefined`/absent = unchanged.
- For `invincibilityTimer`: absent = unchanged. Sent every tick while actively counting down (since it changes every tick). Omitted when 0 and staying 0.
- First message to a new client always includes all fields (handled by initializing per-client tracking to "never sent" sentinel values)

### Server-side: Per-Client Delta Tracking

Add a `ClientDeltaState` tracked per client in `Realm`, alongside the existing `clientChunkRevisions`:

```ts
interface ClientDeltaState {
  gemsCollected: number;
  invincibilityTimer: number;
  editorEnabled: boolean;
  mountEntityId: number | null;
  propRevision: number;
  propRangeKey: string;           // "minCx,minCy,maxCx,maxCy"
  loadedChunkKeysJoined: string;  // sorted keys joined for cheap comparison
  playerNamesJson: string;
  editorCursorsJson: string;
  cvarsJson: string;
}
```

Scalars use `===` comparison. Objects use JSON.stringify comparison (they're small — cvars is 9 fields, playerNames is ~1-5 entries, editorCursors is 0-3 entries).

Props use a two-part check: `PropManager.revision` (incremented on add/remove) + visible range string. If either changed, resend all nearby props.

## Files to Modify

### 1. `src/shared/protocol.ts` — Make fields optional

Make these fields optional on `GameStateMessage`:
- `props?: PropSnapshot[]`
- `gemsCollected?: number`
- `invincibilityTimer?: number`
- `editorEnabled?: boolean`
- `loadedChunkKeys?: string[]`
- `chunkUpdates?: ChunkSnapshot[]` (already sometimes empty — omit when empty)
- `editorCursors?: RemoteEditorCursor[]`
- `playerNames?: Record<number, string>`
- `mountEntityId?: number | null` (change from `number | undefined` — null = not riding)
- `cvars?: PhysicsCVars`

Keep always-present: `type`, `serverTick`, `lastProcessedInputSeq`, `entities`, `playerEntityId`.

### 2. `src/entities/PropManager.ts` — Add revision counter

Add `revision = 0` field. Increment in `add()` and `remove()`.

### 3. `src/server/Realm.ts` — Delta-aware `buildGameState()`

- Add `ClientDeltaState` interface and `clientDeltaStates: Map<string, ClientDeltaState>` field
- Clean up delta state on client disconnect (alongside existing `clientChunkRevisions` cleanup)
- In `buildGameState()`: compare each field against last-sent state, only include if changed, update tracking after
- Fold the existing `clientChunkRevisions` Map into `ClientDeltaState` so all per-client tracking is in one place

### 4. `src/client/ClientStateView.ts` — Conditional apply

Change `applyGameState()` from blind overwrite to conditional:

```ts
// Only update fields that are present (delta protocol)
if (msg.props !== undefined) this._props = msg.props.map(deserializeProp);
if (msg.gemsCollected !== undefined) this._gemsCollected = msg.gemsCollected;
if (msg.invincibilityTimer !== undefined) this._invincibilityTimer = msg.invincibilityTimer;
if (msg.editorEnabled !== undefined) { /* log + update */ }
if (msg.editorCursors !== undefined) this._remoteCursors = msg.editorCursors;
if (msg.playerNames !== undefined) this._playerNames = msg.playerNames;
if (msg.mountEntityId !== undefined) this._mountEntityId = msg.mountEntityId ?? undefined;
if (msg.cvars !== undefined) { /* call 9 setters */ }
if (msg.loadedChunkKeys !== undefined) { /* build set, unload stale chunks */ }
if (msg.chunkUpdates !== undefined) { /* apply chunk snapshots */ }
```

### 5. `src/client/ClientStateView.ts` — Fix `bufferGameState()` merge

When merging pending states, preserve delta fields from the previous pending message that the new message omits. Since absent fields are `undefined` and won't be present as keys on the msg object, `{ ...old, ...new }` naturally preserves old values for absent keys. Only need the existing chunkUpdates merge on top.

### 6. Transport layer — No changes needed

- `SerializingTransport`: `JSON.parse(JSON.stringify(msg))` already strips `undefined` keys, mimicking real network behavior
- `PeerHostTransport`: `JSON.stringify()` also strips `undefined` — absent fields not transmitted
- `WebSocketServerTransport`: Same — `JSON.stringify()` handles it

## What NOT to Change

- **Entity snapshots**: Still full every tick (that's future Option B/C)
- **`serverTick`, `lastProcessedInputSeq`, `playerEntityId`**: Always sent (needed every tick for prediction)
- **Chunk revision delta logic**: Already works, just omit the `chunkUpdates` array when empty
- **Transport interfaces**: No changes to `IClientTransport` / `IServerTransport`
- **LocalStateView**: Only used in non-serialized mode, untouched
- **Message type**: Still `GameStateMessage`, no new message types yet (that's the next step)

## Verification

1. `npx tsc --noEmit` — typecheck
2. `npm test` — unit tests (vitest)
3. `npx biome check --write .` — lint + format
4. `npm run build && npx playwright test` — E2E smoke tests
5. Manual: open dev server, verify gameplay works (entities move, gems collect, editor toggle, props visible, chunk loading/unloading)

## Future Steps (not this PR)

See `docs/NETWORK-ARCHITECTURE.md` § Protocol Evolution Roadmap for the
full 7-phase plan. This PR is Phase 1. Next phases:
- Phase 2: SpriteDef registry (static/dynamic split, ~60% entity size reduction)
- Phase 3: Message type split (`FrameMessage` + typed sync events)
- Phase 4: Entity delta compression (ack-based, per-field bitmask)
- Phase 5: Binary encoding
- Phase 6: WebRTC unreliable channel
- Phase 7: Bandwidth budget and priority
