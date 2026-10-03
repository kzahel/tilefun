# Network Architecture: WebRTC Data Channels, Protocol Evolution, and Voice

Design document for tilefun's multiplayer networking stack. Covers the transport
layer, data channel topology, protocol evolution roadmap, and future voice chat.

For wire protocol research (QW, Source, Roblox comparisons), see
`docs/research/wire-protocol-survey.md`.

---

## Current implementation

Checked 2026-10-03. [Multiplayer networking](topics/multiplayer-networking.md)
owns current status, code/test entry points and remaining reliability work.
[Client/server architecture](client-server-architecture.md) owns host boundaries.

The slow-field split, static entity definitions, frame/sync separation, entity
field deltas, binary encoding and dedicated dual-channel routing are implemented.
Dedicated WebRTC prefers unordered/unreliable `entities` for server frames;
client input and server sync/control use reliable `sync`. PeerJS remains
sync-only. WebSocket and local Worker delivery are ordered. Worker replication
defers under backpressure without stopping simulation.

Entity deltas use last-sent state, not acknowledged snapshot baselines. Frame
loss/reordering recovery must be validated before claiming reliable convergence
on the unreliable channel. Channel routing tests alone do not establish it.

The sections below preserve transport rationale and the phased design history.
Per-phase encodings and bandwidth estimates describe those milestones, not a
fresh end-to-end measurement. Voice, bandwidth scheduling and unreliable input
resend windows are proposals. External protocol/platform comparisons have not
been revalidated by this documentation cleanup.

---

## Transport Layer: Why One Connection, Multiple Channels

### The QW/Source Lesson

QuakeWorld (1996) and Source engine both use a **single UDP socket** per client
with hand-built reliability multiplexed on top:

- **QW**: 1-bit reliable toggle (stop-and-wait — one reliable message in flight)
- **Source**: 8-bit sub-channel system (8 independent reliable streams, fragmentation)

Both pack reliable and unreliable data into the **same UDP packet** each tick.
They didn't use TCP + UDP (two separate connections) because:

1. **Head-of-line blocking**: TCP guarantees ordered delivery. One lost packet
   stalls all subsequent data — even unrelated messages — for a full round-trip.
   A lost chat message would freeze entity updates.

2. **Frame synchronization**: When reliable data (e.g., a CVar change) and
   unreliable data (entity snapshots computed with that CVar) are in the same
   packet, they arrive atomically. With TCP + UDP, they arrive independently
   with different latencies, creating subtle desync windows.

3. **Competing congestion control**: Two independent connections fight each
   other for bandwidth. TCP's AIMD congestion response (halve throughput on
   loss) is designed for bulk transfers, not steady real-time streams.

4. **Correlation complexity**: Two sockets means correlating connections,
   handling partial disconnects, doubled NAT traversal.

### WebRTC SCTP: The Modern Equivalent

WebRTC data channels run over SCTP (Stream Control Transmission Protocol),
which was literally designed to solve these problems. A single SCTP
**association** (one connection) provides:

- **Multiple streams** — independent ordered channels, no head-of-line blocking
  between them (unlike TCP, where one lost packet blocks everything)
- **Per-message reliability** — each message or stream can be reliable or
  unreliable, configured at creation time
- **Single congestion window** — all streams share one congestion controller,
  cooperating instead of competing
- **Message-oriented** — preserves message boundaries (unlike TCP's byte stream)
- **Built-in fragmentation** — handles messages larger than the MTU

Creating two WebRTC data channels is NOT like running TCP + UDP. It's
architecturally equivalent to what QW/Source built by hand: one transport with
multiplexed reliable and unreliable streams. SCTP just handles it at the
protocol level instead of application-level sequence numbers and ack bits.

```
QW netchan (hand-built on UDP):
  [UDP socket] → [sequence numbers, 1-bit ack, manual retransmit]
                  → reliable payload + unreliable payload per packet

Source netchan (evolved):
  [UDP socket] → [sequence numbers, 8-bit sub-channels, fragmentation]
                  → reliable fragments + unreliable datagram per packet

WebRTC (protocol-level):
  [ICE transport] → [DTLS encryption] → [SCTP association]
                     → data channel 0 (unreliable, unordered)
                     → data channel 1 (reliable, ordered)
                     → data channel N...
```

**Note**: You CAN create multiple `RTCPeerConnection` instances to the same
peer (multiple SCTP associations), but this is strictly worse — you get
competing congestion windows, doubled NAT traversal, and lose frame
synchronization. Same problems as TCP + UDP. There is no reason to do this.

---

## Data Channel Topology

### Target Architecture

```
RTCPeerConnection (one per client-server pair)
  └── ICE transport (NAT traversal, STUN/TURN)
       ├── DTLS → SCTP
       │    ├── Channel 0: "entities" (unreliable, unordered)
       │    │     Entity snapshots, tick counters — the per-tick hot path.
       │    │     Delta updates; loss recovery needs validation. ~60 Hz.
       │    │
       │    ├── Channel 1: "sync" (reliable, ordered)
       │    │     Chunk data, props, CVars, player names, editor cursors,
       │    │     session state, game events. Sent on-change only.
       │    │     Must arrive: terrain, config, and state transitions.
       │    │
       │    └── Channel 2: "voice-signaling" (reliable, ordered)
       │          Voice channel negotiation, mute state, spatial audio params.
       │          (Lightweight control channel, not audio data.)
       │
       └── DTLS → SRTP
            └── Audio track(s): Voice chat
                  Opus codec, browser-managed echo cancellation,
                  noise suppression, jitter buffer, AGC.
```

### Channel 0: Entity Snapshots (Unreliable)

```js
peerConnection.createDataChannel("entities", {
  ordered: false,      // no head-of-line blocking
  maxRetransmits: 0,   // don't retry — next tick corrects
});
```

Contents (future `FrameMessage`):
- `serverTick` — frame sequence number
- `lastProcessedInputSeq` — for client-side prediction reconciliation
- `playerEntityId` — which entity is the local player
- `entities` — array of entity snapshots (delta-compressed in future)

**Why unreliable**: Entity state is overwritten every tick. A lost frame at
60 Hz means the client interpolates from data that's 33ms stale instead of
16ms — imperceptible. Retransmitting stale entity data wastes bandwidth and
adds latency for no benefit.

**MTU consideration**: When using unreliable delivery, SCTP messages larger
than the path MTU (~1200 bytes after DTLS overhead) may fragment at the SCTP
level. Unlike IP fragmentation (where one lost fragment drops the whole
packet), SCTP handles reassembly — but for unreliable messages, a lost
fragment means the whole message is dropped. So keeping unreliable messages
under ~1200 bytes is ideal. This motivates:
- Delta compression (idle entities = 0 bytes)
- Binary encoding (~4x smaller than JSON)
- Priority budgeting (fit most important entities first)

With binary encoding + delta compression, 20 moving entities at ~20 bytes
each = ~400 bytes. Well under MTU. Even 100 moving entities (~2 KB) would
only be 2 SCTP fragments — acceptable loss probability.

### Channel 1: World Sync (Reliable)

```js
peerConnection.createDataChannel("sync", {
  ordered: true,       // process in order
  // maxRetransmits: default (unlimited) — fully reliable
});
```

Contents (sent on-change only):
- Chunk terrain data (subgrid, road grid, height grid, derived tile data)
- Loaded chunk key set (for client-side chunk unloading)
- Prop snapshots (static objects — trees, structures)
- Physics CVars (gravity, friction, acceleration)
- Player names (join/leave events)
- Editor cursors (collaborative editing state)
- Session state (gems collected, editor mode, mount state)
- Game events (future: experience API events)

**Why reliable**: Chunk data, prop placement, and config changes must arrive.
A lost CVar change means the client predicts physics with wrong parameters.
A lost chunk update means terrain is visually wrong until the next edit.

**Size is fine**: These messages are infrequent (1-5 per second in steady
state) and can be large without concern — SCTP reliable delivery handles
fragmentation and retransmission automatically.

### Mapping Current Fields to Future Channels

| GameStateMessage field    | Channel | Frequency        | QW/Source equivalent          |
|---------------------------|---------|------------------|-------------------------------|
| `entities`                | 0 (unreliable) | Every tick  | `svc_packetentities`          |
| `serverTick`              | 0 (unreliable) | Every tick  | Packet sequence number        |
| `lastProcessedInputSeq`   | 0 (unreliable) | Every tick  | `svc_clientdata`              |
| `playerEntityId`          | 0 (unreliable) | Every tick  | Client slot (implicit in QW)  |
| `chunkUpdates`            | 1 (reliable)   | On edit     | `svc_spawnbaseline`           |
| `loadedChunkKeys`         | 1 (reliable)   | On movement | PVS (Potentially Visible Set) |
| `props`                   | 1 (reliable)   | On edit     | Static entity baselines       |
| `cvars`                   | 1 (reliable)   | On change   | `svc_maxspeed`, Source `NET_SetConVar` |
| `playerNames`             | 1 (reliable)   | On join/leave | Source StringTable update    |
| `editorCursors`           | 1 (reliable)   | On movement | (no equivalent)               |
| `gemsCollected`           | 1 (reliable)   | On pickup   | `svc_updatestat`              |
| `editorEnabled`           | 1 (reliable)   | On toggle   | (no equivalent)               |
| `mountEntityId`           | 1 (reliable)   | On mount    | `svc_updatestat`              |
| `sync-invincibility`      | 1 (reliable)   | On start/reset | `svc_damage`               |

---

## Protocol Evolution Roadmap

Historical sequence: phases 1–6 have implementations; phase 7 remains a
proposal. The delta tracking infrastructure carries forward, but the original
per-phase transport/encoding descriptions are not current deployment guidance.

### Phase 1: Delta Fields on GameStateMessage ✅

Make slow-changing fields optional. Server tracks per-client what was last
sent, omits unchanged fields. Client keeps previous values when absent.

- **Transport**: Single reliable channel (no change)
- **Encoding**: JSON (no change)
- **Impact**: ~30-40% bandwidth reduction (props, cvars, names, cursors drop
  to 0 bytes/tick when unchanged)
- **Details**: `docs/WIRE-PROTOCOL-DELTA-PLAN.md`

### Phase 2: SpriteDef Registry (static/dynamic split) ✅

Factor static entity metadata (sprite dimensions, sheet keys, collider shapes,
AI config) into a shared compile-time registry (`ENTITY_DEFS`). EntitySnapshot
carries the `type` string (which IS the def key) + dynamic-only state
(`SpriteState`, `WanderAIState`). Collider is entirely eliminated from the
wire — all 7 fields are static per entity type. Both sides look up static
props from the shared registry.

- **Transport**: Single reliable channel (no change)
- **Encoding**: JSON (no change)
- **Impact**: ~70% reduction in per-entity snapshot size (~460 bytes → ~120)
- **Prerequisite for**: Efficient delta compression (fewer fields to diff)
- **Details**: `docs/SPRITEDEF-SPLIT-PLAN.md`

### Phase 3: Message Type Split ✅

Split `GameStateMessage` into:
- `FrameMessage` — per-tick entity data (the hot path)
- Typed sync events — `SyncProps`, `SyncCVars`, `SyncSession`, etc.

No new transport capabilities needed — still one channel. But the message
types are now ready to route to different channels.

- **Transport**: Single reliable channel (but messages are separated)
- **Encoding**: JSON (no change yet)
- **Impact**: Cleaner code, explicit per-tick vs on-change semantics

### Phase 4: Entity Delta Compression ✅

Per-entity delta protocol:
- Server stores last-sent entity snapshot per client (`lastSentEntities` map)
- Entity lifecycle: enter (full baseline), update (field-level delta), exit (ID)
- Idle entities = 0 bytes
- Client maintains persistent `_entityMap` and applies deltas in-place
- Client-side animation (animTimer/frameCol) not serialized — computed locally

- **Transport**: Single channel at this milestone; last-sent deltas require ordered application
- **Encoding**: JSON or binary
- **Impact**: 80-90% reduction in entity data. 50 idle chickens = 0 bytes.

### Phase 5: Binary Encoding ✅

Replaced JSON with DataView/ArrayBuffer for hot-path messages. Type-byte
headers (0x01=Frame, 0x03=SyncChunks, 0x80=player-input, 0xFF=JSON fallback).
Entity type strings → u8 indices via `entityTypeIndex.ts`. SpriteState packed
into 2-4 bytes, WanderAIState into 3 bytes. Chunk arrays sent as raw bytes.

- **Transport**: Single channel
- **Encoding**: Binary (ArrayBuffer) for FrameMessage, player-input,
  SyncChunksMessage. JSON fallback (0xFF envelope) for remaining types.
- **Impact**: ~3-5x compression on top of delta compression. Idle frame = 19
  bytes. Position-only delta = 16 bytes. player-input = 8 bytes.
  Chunk data ~2x smaller (fixed 9.3 KB vs ~19 KB JSON).

### Phase 6: WebRTC Unreliable Channel ✅

Implemented channel routing policy:

- `frame` (server→client): preferred `entities` channel (`ordered: false`,
  `maxRetransmits: 0`)
- All other server messages (`sync-*`, `player-assigned`, `world-loaded`,
  realm/meta/chat/control): `sync` channel (`ordered: true`, reliable)
- All client→server messages (including `player-input`): `sync` channel

Dedicated WebRTC now uses two data channels on one peer connection:

- `sync` label: reliable/ordered
- `entities` label: unordered/unreliable

Fallback behavior:

- If `entities` is unavailable/closed, `frame` is transparently rerouted to
  `sync`, with a one-time warning log per connection.
- Reliable-channel fragmentation/reassembly remains active for large
  sync/control payloads.
- No app-level fragmentation/retransmit is done on the unreliable entities
  channel.

PeerJS (P2P) limit in Phase 6:

- PeerJS `DataConnection` cleanly exposes only one managed gameplay channel and
  does not provide a clean dual-channel API with unordered+maxRetransmits=0 on
  the same managed connection.
- P2P host/guest therefore run in explicit **sync-only fallback** mode for now
  (single reliable channel), while preserving the same routing classifier.

### Input Delivery Policy (initial dedicated WebRTC mode)

For the first dedicated-server WebRTC rollout, keep `player-input` on a
**reliable ordered** channel. This avoids duplicate-input handling while we
validate signaling, ICE, and server deployment.

- Client still sends one input per local simulation step (`seq` monotonic).
- Server still reports `lastProcessedInputSeq` in each frame for reconciliation.
- No input retransmit window yet (inputs are reliable to start).

Future optimization can move inputs to unreliable delivery with a rolling
re-send window keyed by `lastProcessedInputSeq`.

### Phase 7: Bandwidth Budget and Priority

When entity data exceeds the unreliable channel's MTU budget:
1. Player entity — always included
2. Priority queue: `(proximity × time_since_last_update)`
3. Fill packet highest-priority first until budget exhausted
4. Deferred entities accumulate urgency for next tick

QW's `rate` command equivalent: server respects a per-client bandwidth
limit. If the frame doesn't fit, choke (skip) and send a fuller delta
next tick.

---

## Voice Chat Architecture (proposal; not implemented)

WebRTC was built for voice/video chat (Google Hangouts). Voice is the primary
use case, not an afterthought. Adding it to an existing game PeerConnection
is straightforward.

### How It Works

Voice travels over SRTP (Secure Real-time Transport Protocol), separate from
SCTP data channels, but on the **same** ICE transport — one connection,
multiplexed:

```
RTCPeerConnection
  └── ICE transport
       ├── DTLS → SCTP → data channels (game data)
       └── DTLS → SRTP → media tracks (voice)
```

Adding voice to an existing connection:

```js
// Acquire microphone
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
});

// Add to existing peer connection (same one used for game data)
peerConnection.addTrack(stream.getAudioTracks()[0], stream);

// Receiving side
peerConnection.ontrack = (event) => {
  const audio = new Audio();
  audio.srcObject = event.streams[0];
  audio.play();
};
```

The browser handles everything hard:
- **Opus codec** — same codec Discord uses. Excellent quality at ~32 kbps.
- **Echo cancellation** — prevents speaker output from feeding back into mic
- **Noise suppression** — filters keyboard, fans, background noise
- **Automatic gain control** — normalizes volume between loud/quiet speakers
- **Jitter buffer** — smooths packet timing variations
- **Packet loss concealment** — Opus reconstructs missing frames from context

All hardware-accelerated, all built into the browser.

### Why SRTP Instead of Sending Audio on a Data Channel

We have an unreliable data channel — could we just send audio bytes on it?
Technically yes, but SRTP exists for real reasons:

- **Timing**: Audio needs precise 20ms frame intervals. SRTP integrates with
  the OS audio scheduler. SCTP's congestion control could add jitter.
- **Browser pipeline**: `getUserMedia()` → Opus → SRTP is a single optimized
  path. Routing through JavaScript + data channel adds latency and CPU cost.
- **Codec negotiation**: SDP handles Opus parameter negotiation automatically
  (bitrate, channels, sample rate). On a data channel we'd implement this.

### Topology for P2P Mode

In our current `PeerHostTransport` architecture, each guest has a
PeerConnection to the host. Voice tracks ride on those same connections:

```
Guest A ←── PeerConnection ──→ Host (also plays)
             data channels (game) + audio tracks (voice)

Guest B ←── PeerConnection ──→ Host
             data channels (game) + audio tracks (voice)
```

The host receives audio from all guests. For Guest A to hear Guest B, the
host must relay the audio — either by mixing streams or forwarding tracks.
For 2-4 players (parent + kid + a couple friends), this is fine.

### Scaling Beyond 4-5 Players

Full mesh voice (everyone connected to everyone) is O(N^2) connections.
4 players = 6 connections (fine). 10 players = 45 (bad). 20 players = 190
(impossible).

For larger lobbies, use an **SFU** (Selective Forwarding Unit) — a server
that receives everyone's audio and selectively forwards packets. Unlike an
MCU (Multipoint Conferencing Unit), an SFU doesn't decode/re-encode audio;
it just routes SRTP packets. Each client sends one upload stream and
receives N-1 download streams.

Open-source options: **mediasoup** (Node.js), **Janus** (C), **Pion**
(Go). These integrate with existing WebRTC signaling.

For our near-term use case (parent and kid on LAN), the P2P star topology
through the host is sufficient. SFU integration is a future consideration
if we support larger public realms.

### Game-Specific Voice Features

Since we have entity positions, we can do **spatial audio** via the Web
Audio API:

```js
const audioCtx = new AudioContext();
const panner = audioCtx.createPanner();
panner.panningModel = 'HRTF';
panner.distanceModel = 'inverse';
panner.refDistance = 100;  // pixels — full volume within this range
panner.maxDistance = 800;  // pixels — silent beyond this

// Update each tick based on entity positions
panner.setPosition(
  otherPlayer.wx / SCALE,
  otherPlayer.wy / SCALE,
  0
);
```

Players far away on the map sound distant; nearby players sound close.

Other features:
- **Push-to-talk** — clear keybind, visual indicator (better for kids)
- **Voice activity detection** — browser's VAD via `getUserMedia` constraints
- **Per-player volume** — Web Audio gain nodes per remote player
- **Mute/deafen** — toggle outgoing audio track / incoming audio elements
- **Speaking indicator** — visual feedback (WebRTC `getStats()` provides
  audio level metrics, or use `AudioContext.createAnalyser()`)

---

## WebSocket Fallback

Not all environments support WebRTC data channels (corporate firewalls,
restrictive NAT, some mobile browsers). The protocol design ensures graceful
degradation:

- **WebSocket-only mode**: All data (entities + sync) on one reliable ordered
  channel. This remains the default path and fallback. It works, just with higher latency
  under packet loss (TCP head-of-line blocking).
- **WebRTC upgrade**: When available, establish a peer connection and migrate
  entity data to the unreliable channel. Sync data can stay on WebSocket or
  move to the reliable data channel.
- **Hybrid**: Use WebSocket for signaling and reliable sync, WebRTC for
  unreliable entity data + voice. This matches the ROADMAP.md plan.

The message format is transport-agnostic — JSON or binary payloads work
over WebSocket, WebRTC data channels, or in-memory transport. The routing
decision is in the transport layer, not the protocol layer.

---

## Connection Lifecycle

### P2P (Browser-Hosted)

1. Host creates `PeerHostTransport` (PeerJS signaling server)
2. Host gets a peer ID, shares join URL
3. Guest opens URL → `PeerGuestTransport` connects via PeerJS
4. PeerJS establishes `RTCPeerConnection` with ICE/STUN
5. Single reliable data channel is used (explicit Phase 6 fallback mode)
6. Server message routing still classifies `frame` vs sync/control, but both are
   sent over the same reliable PeerJS channel
7. (Future) Voice: both sides add audio tracks after user permission

### Dedicated Server (WebSocket)

1. Server starts `WebSocketServerTransport` on HTTP server
2. Client connects via `WebSocketClientTransport` with UUID
3. All data flows over WebSocket (reliable, ordered)

### Dedicated Server (WebRTC datachannel + WS signaling)

1. Server starts signaling WebSocket endpoint (`/rtc-signal` by default)
2. Client opens signaling socket with UUID and sends SDP offer
3. Server answers and exchanges ICE candidates
4. Client creates two data channels on one peer connection:
   `sync` (reliable/ordered) and `entities` (unordered/unreliable)
5. Server routes `frame` to `entities`, all required state/control to `sync`
6. If `entities` is unavailable, `frame` falls back to `sync` and logs once

### Local (Dedicated Worker in the Same Browser Tab)

1. `WorkerClientTransport` transfers owned binary buffers to a Worker hosting the
   shared `GameServer` and `Realm`; the main thread holds a predicted client replica.
2. Each direction has one credited batch in flight, bounded queues and bounded
   consumption per pump. Delivery is asynchronous and preserves input/delta order.
3. Startup, visibility pause/resume, periodic saves and acknowledged shutdown
   have explicit lifecycle handling. No network process is needed.
4. `SerializingTransport` remains the synchronous binary loopback for tests and
   other in-process hosts.

See the [implementation and measurements](tactical/012-streaming-performance-and-local-server-worker.md).

## Phase 6 Testing Notes

### Dev mode (Vite + plugin server)

1. Run `npm run dev`
2. Open `http://localhost:5173/?multiplayer&transport=webrtc`
3. Confirm overlay debug transport shows `WebRTC dedicated dual-channel`
   (or `sync-only` fallback if entities channel is unavailable)
4. Verify initial chunk/world sync succeeds and gameplay runs without runtime
   errors

### Standalone mode

1. Terminal A: `NET_TRANSPORT=webrtc npm run start:server`
2. Terminal B (optional, for client assets): `npm run dev`
3. Open `http://localhost:5173/?server=localhost:3001&transport=webrtc`
   (or use standalone-served client URL if built assets are present)
4. Validate:
   - `frame` traffic stays smooth
   - world/chunk sync and control messages remain reliable
   - fallback to sync logs once if entities channel is unavailable

---

## References

- QW source: `~/code/reference/Quake/QW/` — `sv_ents.c`, `net_chan.c`
- Source engine: `~/code/reference/source-engine/` — `engine/net_chan.cpp`,
  `common/protocol.h`, `engine/baseclient.cpp`
- Wire protocol survey: `docs/research/wire-protocol-survey.md`
- Delta optimization plan: `docs/WIRE-PROTOCOL-DELTA-PLAN.md`
- Client/server architecture: `docs/client-server-architecture.md`
- WebRTC SCTP spec: RFC 8831 (WebRTC Data Channels), RFC 4960 (SCTP)
- Opus codec: RFC 6716
