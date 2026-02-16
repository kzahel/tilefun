# Network Architecture: WebRTC Data Channels, Protocol Evolution, and Voice

Design document for tilefun's multiplayer networking stack. Covers the transport
layer, data channel topology, protocol evolution roadmap, and future voice chat.

For wire protocol research (QW, Source, Roblox comparisons), see
`docs/research/wire-protocol-survey.md`.

---

## Current State

Every tick at 60 Hz, the server builds a per-client `GameStateMessage` (JSON)
containing full entity snapshots, prop snapshots, chunk deltas, physics CVars,
player names, editor cursors, and session state. This is sent over a single
reliable ordered channel (WebSocket, WebRTC reliable data channel, or in-memory
`SerializingTransport`).

**Steady-state cost**: ~12-15 KB/tick (20 entities), ~750 KB/s per client.
50-entity scenario: ~30 KB/tick, ~1.8 MB/s per client.

The only optimization in place: chunk data uses revision-based delta (only sends
chunk snapshots when the revision exceeds the client's last-seen revision).
Everything else is brute-force full-state every tick.

Key files:
- `src/shared/protocol.ts` — message types, snapshot shapes
- `src/shared/serialization.ts` — entity/prop/chunk serialization
- `src/server/Realm.ts` — per-client game state building
- `src/transport/` — all transport implementations
- `src/client/ClientStateView.ts` — client state application

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
       │    │     Loss-tolerant: next tick overwrites. ~60 Hz.
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
| `invincibilityTimer`      | 1 (reliable)   | On damage   | `svc_damage`                  |

---

## Protocol Evolution Roadmap

Each step builds on the previous. The delta tracking infrastructure carries
forward through all phases.

### Phase 1: Delta Fields on GameStateMessage (current)

Make slow-changing fields optional. Server tracks per-client what was last
sent, omits unchanged fields. Client keeps previous values when absent.

- **Transport**: Single reliable channel (no change)
- **Encoding**: JSON (no change)
- **Impact**: ~30-40% bandwidth reduction (props, cvars, names, cursors drop
  to 0 bytes/tick when unchanged)
- **Details**: `docs/WIRE-PROTOCOL-DELTA-PLAN.md`

### Phase 2: SpriteDef Registry (static/dynamic split)

Factor static entity metadata (sprite dimensions, sheet keys, collider shapes,
AI config) into a shared compile-time registry. Entities carry a `defKey`
string + dynamic-only state. Both sides look up static props from the registry.

- **Transport**: Single reliable channel (no change)
- **Encoding**: JSON (no change)
- **Impact**: ~60% reduction in per-entity snapshot size (~400 bytes → ~150)
- **Prerequisite for**: Efficient delta compression (fewer fields to diff)

### Phase 3: Message Type Split

Split `GameStateMessage` into:
- `FrameMessage` — per-tick entity data (the hot path)
- Typed sync events — `SyncProps`, `SyncCVars`, `SyncSession`, etc.

No new transport capabilities needed — still one channel. But the message
types are now ready to route to different channels.

- **Transport**: Single reliable channel (but messages are separated)
- **Encoding**: JSON (no change yet)
- **Impact**: Cleaner code, explicit per-tick vs on-change semantics

### Phase 4: Entity Delta Compression

QW-style ack-based frame reference with per-field bitmask deltas:
- Server stores last N entity snapshots per client in a ring buffer
- Client acks received frames
- Server deltas from last ack'd frame (only changed fields)
- Entity lifecycle: enter (full baseline), update (delta), exit (removal)
- Idle entities = 0 bytes

- **Transport**: Single channel (but designed for unreliable tolerance)
- **Encoding**: JSON or binary
- **Impact**: 80-90% reduction in entity data. 50 idle chickens = 0 bytes.

### Phase 5: Binary Encoding

Replace JSON with DataView/ArrayBuffer. Fixed-layout binary messages with
type-byte headers. String fields become u8 enum indices.

- **Transport**: Single channel
- **Encoding**: Binary (ArrayBuffer)
- **Impact**: ~3-4x compression on top of all previous optimizations
- Entity snapshot: ~20-30 bytes binary vs ~150 JSON (post-SpriteDef split)

### Phase 6: WebRTC Unreliable Channel

Route `FrameMessage` to an unreliable/unordered data channel. Route sync
events to a reliable/ordered data channel. The protocol is already split
(Phase 3) and binary-encoded (Phase 5) — this is just a routing change.

- **Transport**: Two SCTP data channels on one RTCPeerConnection
- **Encoding**: Binary
- **Impact**: Eliminates TCP head-of-line blocking for entity updates.
  Lost entity frames are simply skipped (next tick corrects). Reliable
  sync data (chunks, props, config) is unaffected by entity frame loss.

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

## Voice Chat Architecture

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
  channel. This is what we have today. It works, just with higher latency
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
5. Reliable data channel created automatically by PeerJS
6. (Future) Host creates unreliable data channel, guest accepts
7. (Future) Voice: both sides add audio tracks after user permission

### Dedicated Server (WebSocket)

1. Server starts `WebSocketServerTransport` on HTTP server
2. Client connects via `WebSocketClientTransport` with UUID
3. All data flows over WebSocket (reliable, ordered)
4. (Future) Optional WebRTC upgrade: client and server establish a
   peer connection for unreliable entity data + voice relay

### Local (Same Browser Tab)

1. `SerializingTransport` — in-memory JSON roundtrip
2. Zero latency, validates serialization correctness
3. No network involved — used for single-player and development

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
