# Wire Protocol Survey: QuakeWorld, RTS Lockstep, MMOs, and Roblox

Research notes from studying real-world networking approaches for multiplayer games.
Source material: Id Software's QuakeWorld source code (`~/code/reference/Quake/QW/`),
Roblox creator docs (`~/code/reference/roblox/creator-docs/`), and general industry knowledge.

## Table of Contents

1. [Our Current State](#our-current-state)
2. [QuakeWorld: Binary Delta Snapshots](#quakeworld-binary-delta-snapshots)
3. [RTS Lockstep: Deterministic Input Replay](#rts-lockstep-deterministic-input-replay)
4. [MMOs: Interest Management at Scale](#mmos-interest-management-at-scale)
5. [Roblox: Property-Level Replication on a Scene Graph](#roblox-property-level-replication-on-a-scene-graph)
6. [Comparison Matrix](#comparison-matrix)
7. [Applicability to Tilefun](#applicability-to-tilefun)
8. [Roblox Deep Dive: The ORM Model and Why It Matters for Modding](#roblox-deep-dive-the-orm-model-and-why-it-matters-for-modding)

---

## Our Current State

Every tick (60 Hz), each client gets a custom JSON `GameStateMessage` containing:

- Full `EntitySnapshot` for every nearby entity (~30 fields, ~400-600 bytes JSON each)
- Full `PropSnapshot` for every nearby prop
- Delta chunk updates (revision-based, the one thing we do right)
- Scalars (player ID, gems, editor state, cursor positions)

**No binary encoding, no entity delta, no field-level diffing, no bandwidth management.**

**TODO**: `PhysicsCVars` (gravity/friction/accelerate/stopSpeed/noBunnyHop) are sent as
JSON on every `GameStateMessage` (~80 bytes/tick). With delta compression or a binary
protocol these would be 0 bytes when unchanged. Until then, this is a small but constant
per-tick overhead that should be eliminated by any future wire protocol work.

Steady-state cost: ~12-15 KB/tick (20 entities), ~750 KB/s per client.
50-chicken scenario: ~30 KB/tick, ~1.8 MB/s per client.

Entity/prop IDs are sequential `number` (cheap, fine for single-server). Client
connection IDs are UUID strings. Chunk keys are `"cx,cy"` strings.

Key files:
- `src/shared/protocol.ts` (message types, snapshot shapes)
- `src/shared/serialization.ts` (entity/prop/chunk serialization)
- `src/server/Realm.ts` (per-client game state building, spatial filtering)
- `src/transport/` (SerializingTransport, PeerHostTransport, WebSocket transports)
- `src/client/ClientStateView.ts` (LocalStateView vs RemoteStateView)

---

## QuakeWorld: Binary Delta Snapshots

**Source**: `~/code/reference/Quake/QW/` (Id Software GPL release)

### Architecture

QW uses a **frame-based delta snapshot** model. The server is authoritative. Every
server tick (~77 Hz, configurable), the server builds a per-client packet containing
delta-compressed entity state, sends it over UDP.

### Entity State is Tiny

`entity_state_t` has only 9 fields (`protocol.h:252-264`):

```c
typedef struct {
    int number;      // edict index (9 bits, max 512 entities)
    int flags;       // render flags
    vec3_t origin;   // position (3 floats)
    vec3_t angles;   // rotation (3 floats)
    int modelindex;  // which model (byte index into precache table)
    int frame;       // animation frame (byte)
    int colormap;    // player color (byte)
    int skinnum;     // skin variant (byte)
    int effects;     // particle effects bitmask (byte)
} entity_state_t;
```

No velocity, no AI state, no sprite dimensions, no collision boxes. The client
derives everything else from `modelindex` via precache tables established at connect time.

### Per-Field Bitmask Delta

`SV_WriteDelta()` (`sv_ents.c:155-240`) compares each field of the current state
to a reference state and builds a bitmask of what changed:

```c
bits = 0;
for (i = 0; i < 3; i++) {
    miss = to->origin[i] - from->origin[i];
    if (miss < -0.1 || miss > 0.1)
        bits |= U_ORIGIN1 << i;
}
if (to->angles[0] != from->angles[0]) bits |= U_ANGLE1;
if (to->modelindex != from->modelindex) bits |= U_MODEL;
// ... etc
if (!bits && !force) return;  // nothing changed = 0 bytes!
```

Then writes **only changed fields** after a 2-byte header:

```c
MSG_WriteShort(msg, entityNumber | bits);  // 9-bit entity + 7-bit flags
if (bits & U_MOREBITS) MSG_WriteByte(msg, bits & 255);
if (bits & U_MODEL)    MSG_WriteByte(msg, to->modelindex);
if (bits & U_ORIGIN1)  MSG_WriteCoord(msg, to->origin[0]);  // 16-bit fixed-point
if (bits & U_ANGLE1)   MSG_WriteAngle(msg, to->angles[0]);  // 8-bit (1.4 deg)
```

An **idle entity = 0 bytes**. A moving entity with only position changed =
**8 bytes** (2-byte header + 3 x 2-byte coords). Compare to our ~400+ bytes JSON.

### Frame Ring Buffer and Ack-Based Delta Reference

The server doesn't delta from abstract "last known state" -- it deltas from a
**specific frame the client has acknowledged**.

```c
client_frame_t frames[UPDATE_BACKUP];  // ring buffer of 64 frames per client
int delta_sequence;                     // which frame client wants delta from
```

Each stored frame contains a complete `packet_entities_t` -- the sorted list of all
entities visible to that client on that tick.

`SV_EmitPacketEntities()` (`sv_ents.c:250-314`) walks two sorted entity lists (old
frame vs new frame) in a classic merge:

- **Entity in both**: delta from old state (only changed fields)
- **Entity in new only**: delta from baseline (new entity appeared)
- **Entity in old only**: send `U_REMOVE` flag (entity left view)
- **Terminator**: `MSG_WriteShort(msg, 0)`

The client does the inverse merge in `CL_ParsePacketEntities()` (`cl_ents.c:265-399`).
If the reference frame is too old (>63 frames back), it falls back to full updates.

### Baselines

When the map loads, the server sends `svc_spawnbaseline` for every entity. This is
the fallback delta reference for new entities or lost delta references. Established
once, never changes.

### Netchan: Reliable + Unreliable in One Packet

Every UDP packet has an 8-byte header (`net_chan.c`):

```
[31 bits] outgoing sequence  [1 bit] has reliable payload?
[31 bits] ack sequence       [1 bit] reliable ack even/odd
[16 bits] qport
```

Reliable data (chat, stats, config changes) and unreliable data (entity state) are
concatenated in a single packet. Reliable delivery uses stop-and-wait with a
single-bit toggle -- one reliable message in flight at a time.

### Rate Command and Bandwidth Throttling

The client sets `rate` in userinfo (e.g., `rate 2500` for 2.5 KB/s). The server
converts to seconds-per-byte (`sv_main.c:1550-1560`):

```c
cl->netchan.rate = 1.0 / i;  // i clamped to [500, 10000]
```

Every packet sent advances `cleartime` by `packet_size * rate`. Before sending each
frame, the server checks `Netchan_CanPacket()` -- if the pipe is full, it **chokes**
(skips the entire frame for that client) and increments `chokecount`.

The server reports `svc_chokecount` to the client so it can display packet loss in
`r_netgraph` and adjust interpolation.

**What QW does NOT do**: No entity prioritization, no adaptive detail, no variable
tick rate. It's all-or-nothing per frame. Fine for 16-32 players in 1996.

### Special-Case Encoding: Nails

Projectiles (nails) use a purpose-built ultra-compact encoding (`sv_ents.c:92-142`):

```c
// 6 bytes per nail: position (3x12 bits) + pitch (4 bits) + yaw (8 bits)
bits[0] = x;
bits[1] = (x>>8) | (y<<4);
bits[2] = (y>>4);
bits[3] = z;
bits[4] = (z>>8) | (p<<4);
bits[5] = yaw;
```

No entity ID, no delta, no model index. 6 bytes per projectile. This is the extreme
end of "know your data."

### Players vs Entities: Separate Paths

Players are NOT `entity_state_t`. They have their own `svc_playerinfo` message with
a different bitmask (`PF_*` flags). Always sends: slot number, flags, origin, frame.
Conditionally sends: msec (for dead reckoning), usercmd (for prediction), velocity,
model, skin, effects.

Your own player omits msec/usercmd (you know your own input). Spectators get stripped
to just origin + velocity.

### Demo Recording

QW has two demo formats:

**DEM (NetQuake)**: Records raw server messages only. Each frame is `[length][viewangles][data]`.
Must record from connection start (no mid-game recording). Timing derived from
in-band `svc_time` messages. ~400 lines of code.

**QWD (QuakeWorld)**: Records both server messages and client inputs. Three frame types:
`dem_read` (server msg), `dem_cmd` (client usercmd), `dem_set` (sequence sync).
Can start mid-game by synthesizing a fake connection sequence (~250 lines of state dump).
**Disables delta compression during recording** so the demo file is self-contained.

Both formats share the same trick: the demo layer sits between transport and parser,
injecting recorded data into `net_message`. The parser can't tell whether data came
from the network or a file. Demos are nearly free once you have a wire protocol.

---

## RTS Lockstep: Deterministic Input Replay

**Examples**: Age of Empires, StarCraft, Command & Conquer

### Architecture

All players run the **full simulation locally**. Nobody sends entity state. Instead,
each player broadcasts their commands, and all clients execute them at the same tick.

Commands are batched into "turns" (e.g., every 200ms). Player A's commands for turn N
are sent to all peers. All peers execute turn N's commands **only after all players'
commands for that turn have arrived**.

### What Gets Recorded

**Only commands.** A 30-minute AoE2 replay can be under 100 KB -- just timestamped
actions like "unit 47: move to (300, 150)."

### The Determinism Tax

If the simulation is deterministic, replaying the same inputs produces the same output.
But determinism is brutal:

- Floating-point math must produce identical results across CPUs/compilers/OS
- Random number generators seeded identically, called in the same order
- Entity iteration order must be deterministic (no hash map iteration)
- No threading race conditions in simulation
- **Replays are tightly coupled to engine version** -- any sim change breaks them

AoE2 used fixed-point integer math. StarCraft: Brood War was notorious for desyncs.
Clients periodically exchange state checksums to detect divergence.

### Latency Hiding

The 200ms turn delay is masked with animation/audio. "Yes, my lord" plays immediately
even though the command won't execute for 200ms. Input feels responsive because the
feedback is local even when the execution is delayed.

### Relevance to Tilefun

Deterministic lockstep is wrong for us. We have server-authoritative entity AI, an
editor with terrain changes, and a client/server architecture already in place.

However, **editor actions** (terrain paint, entity spawn, road placement) are already
command-shaped. These could be recorded as compact inputs for a "world edit replay"
feature that's version-independent as long as the command format is stable.

---

## MMOs: Interest Management at Scale

### The Problem

1000 entities in one area can't fit in any single client's pipe, regardless of encoding.
The solutions are layered.

### Area of Interest (AoI) with Graded Update Rates

Spatial partitioning with distance-based tiers:

| Ring | Distance | Update Rate | Detail |
|------|----------|-------------|--------|
| Inner (nearby) | ~20m | 10-20 Hz | Full state |
| Middle (visible) | ~100m | 2-5 Hz | Position + animation |
| Outer (distant) | ~200m+ | 0.5-1 Hz | Position only |
| Beyond | further | 0 Hz | Not sent |

### Entity Priority Queues

When bandwidth is limited, triage:

1. Your character (always full rate, always first in packet)
2. Your target / party members (high priority)
3. Other players actively fighting (medium)
4. Idle players standing around (low)
5. NPCs and environmental objects (lowest)

Each entity gets a priority score. Server fills the packet highest-priority first until
budget exhausted. Low-priority entities update less often but aren't permanently dropped.

### Aggregation / LOD for Entities

For distant crowds:
- **Blob representation**: "50 enemies at position (300, 400), moving northeast"
- **Representative sampling**: Full state for 5 of 50, client clones the rest
- **Visual-only aggregation**: Distant characters as dots/silhouettes

### Sharding / Instancing / Phasing

Avoid the problem by splitting the world:
- **Instancing**: Multiple copies of same area (dungeons)
- **Phasing** (WoW): Same area, different quest states = different visible entities
- **Channels** (Korean MMOs): Explicit parallel copies of zones
- **Dynamic sharding**: Server quietly splits crowded areas across invisible shards

### EVE Online's Time Dilation

In massive fleet battles (4000+ players), EVE literally **slows time**. The server
tick rate drops from 1 Hz to as low as 0.1 Hz (10% speed). Everyone's actions execute,
just in slow motion. The game announces it: "Time is moving at 10% speed."

### Server Tick Rates

| Game | Tick Rate | Notes |
|------|-----------|-------|
| WoW | ~10 Hz | "Spell batching" is a visible side effect |
| FF14 | ~3 Hz | Very coarse, noticeable in PvP |
| GW2 | ~10-15 Hz | Drops under load |
| EVE | 1 Hz (TiDi to 0.1 Hz) | Space game, strategic combat |
| QuakeWorld | 77 Hz | FPS needs this, MMOs don't |
| Tilefun (current) | 60 Hz | Way too fast for network |

### What MMO Entity Updates Look Like

```
[entity_id: u32]
[update_flags: u16]
[position: 3x u16, quantized to cm]    // if POSITION flag
[facing: u8]                            // 256 directions, 1.4 deg
[animation_state: u8]                   // enum index
[health_pct: u8]                        // not absolute HP
[target_id: u32]                        // if TARGET flag
```

Same bitmask-delta concept as QW, more aggressive quantization.

---

## Roblox: Property-Level Replication on a Scene Graph

**Source**: `~/code/reference/roblox/creator-docs/`

### Architecture

Roblox's approach is fundamentally different from frame-based snapshots or input replay.
It replicates a **tree of Instances** (their scene graph / data model). Every Instance
has typed properties (Position, Color, Name, etc.). The server is authoritative. When a
property changes on the server, **that specific property change** is replicated to
relevant clients.

Not the whole object, not a frame snapshot -- just the changed property. This is closer
to an ORM pushing diffs than a game state snapshot.

### Instance Streaming: Roblox's AoI System

`StreamingEnabled` (on by default) provides spatial interest management with two
concentric radii around each player's character:

- **StreamingMinRadius**: Inner zone. Highest-priority stream-in, never streams out.
- **StreamingTargetRadius**: Outer zone. Streams in as bandwidth allows, may stream out.

What streams: Only 3D `BasePart` instances and their descendants. Non-spatial things
(scripts, UI, data) replicate immediately on join.

**Stream-in**: Moving close to a Part causes the server to send the full Instance
creation + all properties. **Stream-out**: Under memory pressure or leaving target
radius, the Instance is parented to `nil` on the client (removed but not destroyed --
can come back if you return).

Per-model streaming controls let developers fine-tune:

- **Default/Nonatomic**: Individual parts stream independently
- **Atomic**: Entire model streams as a unit (all or nothing)
- **Persistent**: Always present on all clients, never streams out
- **PersistentPerPlayer**: Persistent for specific players only

Physics assemblies are special: if any part of a connected assembly streams in, ALL
parts stream in together. Half a vehicle on the client is not allowed.

### Network Ownership: Distributed Physics Simulation

Each unanchored `BasePart` has a **network owner** -- the client (or server)
responsible for simulating its physics:

- Server always owns **anchored** parts
- Unanchored parts are **automatically assigned** to the nearest player's client
- Developers can override with `SetNetworkOwner(player)` for specific gameplay needs
  (e.g., give the vehicle driver ownership instead of the first passenger)

The owner simulates physics locally (responsive, zero latency), then replicates the
results to the server and other clients. This distributes CPU load and makes physics
feel responsive.

**Security tradeoff**: The server cannot verify client physics calculations. A cheating
client can teleport owned parts or fire fake collision events. Roblox explicitly warns
about this and recommends server-side validation for gameplay-critical interactions.

### Bandwidth Management

The MicroProfiler reveals a server phase called "Allocate Bandwidth and Run Senders" --
the server has a **bandwidth budget per frame** and parcels out property updates within
it. If there's more to send than bandwidth allows, it queues and prioritizes.

The exact algorithm isn't publicly documented, but the system is adaptive: the server
decides each frame what to send based on available bandwidth, change priority, and
client state.

### Adaptive Physics Timestepping

Physics steps at 60 Hz, 120 Hz, or 240 Hz depending on mechanism complexity. Simple
assemblies get 60 Hz; complex constraints may get 240 Hz. This distributes physics CPU
where it's needed without a fixed global cost.

### Developer Guidance on Replication

From Roblox's performance optimization docs, common mistakes and their fixes:

**DON'T**: Replicate data every frame (e.g., TweenService server-side tweens a property
each frame, causing jittery results and unnecessary traffic).

**DO**: Replicate state **when it changes**, not on a fixed schedule.

**DON'T**: Send entire inventory when player buys one item.

**DO**: Send only the purchased item details.

**DON'T**: Create visual effects (explosions, particles) on the server.

**DO**: Fire a RemoteEvent with the location/parameters, let clients create visuals locally.

**DON'T**: Create/destroy complex instance trees (maps) all at once.

**DO**: Chunk them up and load across multiple frames.

### RemoteEvents and RemoteFunctions

Developer-facing custom networking for game logic the engine doesn't handle automatically:

- `RemoteEvent`: Fire-and-forget (one-way, ordered delivery)
- `RemoteFunction`: RPC with return value (yields until response)
- Can send arbitrary Lua data (tables, Instances, primitives)
- Developers must throttle themselves -- Roblox doesn't rate-limit custom events

### What Makes This Model Special

Roblox's replication is **not a game protocol -- it's an object synchronization system**.
The engine doesn't know or care what a "chicken" or a "vehicle" is. It knows that
Instance X's `Position` property changed, and it needs to tell relevant clients.

This generality has evolved over more than a decade of diverse user-created experiences:

1. **It doesn't constrain game design.** Racing games, RPGs, shooters, simulators, and
   tycoon games all work on the same replication system because it operates at the
   property level, not the game-mechanic level.

2. **Streaming emerged from necessity.** Early Roblox replicated everything. As worlds
   got bigger and device diversity increased (phones, tablets, low-end PCs), spatial
   streaming became essential.

3. **Network ownership emerged from physics.** Server-only physics felt terrible for
   the player touching objects. Client-authoritative physics for owned objects made
   vehicles, doors, and physics toys feel responsive.

4. **The developer API is minimal.** Creators mostly don't think about networking.
   Properties replicate automatically. You only use RemoteEvent when you need custom
   game logic across the boundary. This is the opposite of QW where the entire wire
   format is hand-crafted.

---

## Comparison Matrix

| Aspect | QuakeWorld | RTS Lockstep | MMOs | Roblox | Tilefun (now) |
|--------|-----------|-------------|------|--------|---------------|
| **Replication unit** | Entity state struct | Player commands | Varies | Property changes | Full EntitySnapshot |
| **Delta granularity** | Per-field bitmask | N/A (inputs only) | Per-field bitmask | Per-property dirty | None |
| **Spatial filtering** | PVS (BSP leaves) | N/A (all clients = full sim) | AoI rings | StreamingRadius | Chunk-radius hash |
| **Encoding** | Binary (MSG_Write*) | Binary commands | Binary | Internal binary | JSON text |
| **Bandwidth mgmt** | Rate + choke | Lockstep (all wait) | Budget + priority | Budget + priority | None |
| **Physics authority** | Server only | All clients (deterministic) | Server + client hints | Distributed ownership | Server only |
| **Static data** | Precache tables | Shared binary | Asset streaming | Instance creation | Resent every tick |
| **Tick rate** | 77 Hz | ~5 Hz (turn-based) | 3-15 Hz | 60 Hz | 60 Hz |
| **Replay format** | Server message recording | Input recording | N/A typically | N/A | None |
| **Replay file size** | Medium (~5-50 MB/30min) | Tiny (~50-100 KB/30min) | N/A | N/A | N/A |
| **Replay fragility** | Low (protocol-versioned) | Extreme (engine-coupled) | N/A | N/A | N/A |
| **Max entities** | 64 per packet | Thousands (all local) | Hundreds visible | Thousands (streamed) | Unbounded |

---

## Applicability to Tilefun

### Immediate Wins (in recommended implementation order)

#### 1. Static/Dynamic Split (SpriteDef Registry)

**Inspired by**: QW's precache tables, Roblox's Instance creation

Strip ~60% of per-entity bytes by not resending static fields every tick. Entity
carries `defKey: "chicken"` + dynamic state only. Both sides share the same def
registry at compile time. No protocol change needed, JSON still works.

QW equivalent: `modelindex` (1 byte) replaces the entire model/skin/frame-count
description. Our equivalent: `defKey` index replaces `sheetKey`, `spriteWidth`,
`spriteHeight`, `frameDuration`, `frameCount`, `drawOffsetY`, all of `ColliderComponent`,
and ~10 `WanderAIComponent` config fields.

Estimated entity size after: ~150 bytes JSON (down from ~400-600).

#### 2. Delta Compression with Ack-Based Frame Reference

**Inspired by**: QW's frame ring buffer + `SV_EmitPacketEntities` merge

Per-client frame tracking:
- Server stores last N entity snapshots per client in a ring buffer
- Client periodically acks: `{ type: "ack", tick: number }`
- Server deltas from the last ack'd frame
- On ack loss / reconnect: fall back to full state

Entity lifecycle messages (like QW's sorted-merge algorithm):
- Entity enters client view: full baseline
- Entity stays in view: delta (only changed fields, or 0 bytes if idle)
- Entity leaves view: removal message

50 idle chickens = 0 bytes. Player + 2 moving chickens ~= 50-100 bytes.
This is the 80-90% reduction.

#### 3. Client-Side Animation State

**Inspired by**: Roblox's "don't tween on the server" guidance, QW's `modelindex`
implying animation parameters

Remove `animTimer`, `frameCol`, and `flipX` from the wire. Server sends animation
state transitions ("entity X started walking direction SOUTH at tick T"). Client
computes frame progression locally from `frameDuration` + `frameCount`.

This eliminates the smoothly-incrementing-value-every-frame problem (the `animTimer`
is our equivalent of Roblox's server-side TweenService anti-pattern).

#### 4. Reduced Entity Update Rate

**Inspired by**: MMO tick rates, QW's rate command

Entity state at 20 Hz instead of 60 Hz (3x reduction with no encoding work). Client
interpolates entity positions between server updates. For a tile game, chickens
updating at 50ms intervals vs 16ms is imperceptible.

Keep player input processing at 60 Hz for responsiveness. Only entity broadcast
rate drops. This is similar to how MMOs run game logic at one rate but broadcast
state at a lower rate.

#### 5. Binary Encoding

**Inspired by**: QW's MSG_Write* functions

Fixed-layout DataView/ArrayBuffer with message-type byte header:

```
[msgType: u8][serverTick: u32][lastInputSeq: u16][entityCount: u16]
  per entity: [id: u16][flags: u8][wx: f32][wy: f32]...
[chunkCount: u8]
  per chunk: [cx: i16][cy: i16][revision: u16][subgrid: 1089 bytes raw]...
```

Entity: ~20-30 bytes binary vs ~150 JSON (after static split + delta).
Chunk: ~5 KB binary vs ~15-25 KB JSON (TypedArrays as raw bytes).
String fields become u8 enum indices.

#### 6. Bandwidth Budget Per Frame

**Inspired by**: Roblox's "Allocate Bandwidth and Run Senders", QW's rate command

Each frame, the server has N bytes of budget per client. Fill with highest-priority
entity deltas first:
1. Player entity (always)
2. Entities sorted by (proximity * time-since-last-update)
3. Distant idle entities naturally update less often

Simple version: just QW's rate/choke (10 lines of code). Advanced version: priority
queue with budget allocation.

### Medium-Term: Demo / Replay System

**Inspired by**: QW's demo recording, RTS input replay

If we build a binary wire protocol with delta compression, demo recording is nearly
free: dump binary packets to a file with timestamps. Playback feeds them back through
`RemoteStateView`. The demo layer sits between transport and parser (QW's architecture).

For editor actions, we could additionally record commands (RTS-style) for a compact
"world building replay" feature.

Design choice from QW: disable delta compression during recording (larger files, self-
contained) vs record deltas with periodic keyframes (smaller files, seekable). Keyframe
approach is better for "watch my kid build this world" replays.

### Long-Term: Entity Lifecycle Messages

**Inspired by**: QW's baseline + enter/exit/delta, Roblox's streaming

Full entity lifecycle:
- `entity-enter`: Sent when entity enters client's spatial range. Full state (baseline).
- `entity-update`: Delta from last ack'd state. Only changed fields, bitmask-flagged.
- `entity-exit`: Entity left range. Client removes it.

This eliminates the current pattern of "serialize all nearby entities every tick."
The client maintains its own entity table, applies deltas, handles enter/exit.

---

## Roblox Deep Dive: The ORM Model and Why It Matters for Modding

This section explores Roblox's replication model in depth because it has significant
implications for our scripting/modding system, even though we don't need to implement
it wholesale.

### What Roblox Actually Is

Roblox's networking isn't a "game protocol" -- it's an **object synchronization system**.
The engine doesn't know what a "chicken" or "vehicle" is. It knows that Instance X's
`Position` property changed, and relevant clients need to know.

This is the key insight: **replication is decoupled from game logic**. A racing game,
an RPG, a shooter, and a tycoon sim all run on the same replication system because it
operates at the property level, not the game-mechanic level.

### The Data Model as Replicated Scene Graph

Roblox's runtime is a tree of `Instance` objects. Each Instance:
- Has a class (Part, Model, Script, etc.)
- Has typed properties (Position: Vector3, Color: Color3, Name: string, etc.)
- Has a parent (forming the tree)
- Can have children (forming hierarchies)

When the server mutates any property, the engine:
1. Marks the property dirty
2. Determines which clients should know (based on streaming radius, ownership, etc.)
3. Queues the property change for those clients
4. Sends it within the bandwidth budget on the next applicable frame

Mod/script authors just write `part.Position = Vector3.new(10, 20, 30)` and replication
happens automatically. They don't think about serialization, delta compression, or
bandwidth. The engine handles it.

### How This Evolved

Roblox's system wasn't designed this way from day one -- it evolved over 15+ years:

**Early Roblox**: Everything replicated to everyone. Small worlds, few players, simple
physics. Worked fine.

**Streaming**: As worlds grew and mobile devices joined, the engine couldn't send
everything. Instance streaming emerged -- spatial interest management at the Instance
level. Parts outside your radius don't exist on your client.

**Network ownership**: Server-only physics felt terrible for players interacting with
objects. The solution: let the nearest client simulate physics for objects they're
touching. This distributes CPU and eliminates physics latency for the owning player.

**Adaptive timestepping**: Not all physics needs 240 Hz. Simple assemblies get 60 Hz,
complex mechanisms get 240 Hz. Budget where it matters.

**Per-model streaming controls**: Developers needed fine-grained control. Some models
must always be present (HUD elements), some should be atomic (vehicles), some can
stream part-by-part (terrain decorations). The `ModelStreamingMode` property emerged.

**Budget-based bandwidth allocation**: With hundreds of properties changing per frame
and diverse client connections (phones on cellular vs PCs on fiber), the server can't
just send everything. It allocates bandwidth per frame and prioritizes.

Each layer was added to solve a real problem encountered by real game creators. The
result is a system that supports remarkably diverse experiences without game-specific
protocol code.

### What This Means for Tilefun's Modding System

Our scripting API design (`docs/SCRIPTING-API-DESIGN.md`) is already Roblox-inspired:
tags (CollectionService), EventBus (BindableEvent), TickService (RunService),
OverlapService (Touched), attributes (SetAttribute).

The replication question is: **when a mod sets an attribute or changes entity state,
how does that get to clients?**

#### Current Model (Server Snapshot)

Mods run on the server. They mutate entities directly. The server serializes all
entity state every tick. Mods don't think about networking because everything is
brute-force replicated.

This works but doesn't scale. If a mod adds 10 custom attributes to each entity,
that's 10 more fields serialized 60x/second for every entity.

#### Possible Future: Attribute-Level Replication

Closer to Roblox's model. Entity attributes set via `api.setAttribute(entity, "glowing", true)`
would be tracked at the attribute level:

1. `setAttribute` marks the attribute dirty on that entity
2. Server's replication system includes dirty attributes in the next delta for
   clients who have that entity in range
3. Client receives attribute change, fires local `attributeChanged` event
4. Client-side mod code can react (e.g., render a glow effect)

This would mean:
- Mods don't think about networking (set attribute, it replicates)
- Only changed attributes are sent (not all attributes every tick)
- Client-side mod code can create visual effects locally (Roblox's guidance)
- Server validates attribute changes from mods (server authority preserved)

#### The Spectrum

We don't need the full Roblox model. There's a spectrum:

| Approach | Complexity | Bandwidth | Mod Experience |
|----------|-----------|-----------|----------------|
| Current (full snapshot) | Low | High | Mods don't think about it, but wasteful |
| Delta snapshot (QW-style) | Medium | Low | Mods still don't think about it, engine diffs |
| Property-level replication (Roblox-style) | High | Optimal | Mods set properties, engine replicates individually |

The QW-style delta snapshot is probably the right middle ground for now. The entity
state is compared field-by-field between frames, and only diffs are sent. Mods don't
need to know about networking -- they mutate entities, the diff system catches it.

Property-level replication becomes valuable when:
- Mods add many custom attributes with different update frequencies
- Some attributes should replicate to specific clients only
- Client-side mod code needs to react to individual property changes
- You want RemoteEvent-style custom networking in mods

#### What We Could Borrow Now

Even without full property-level replication, we can borrow Roblox's **developer
guidance** as principles for our mod API:

1. **Don't replicate visual state from server**: Mods should fire events ("entity X
   started glowing") and let client-side code render effects. The server doesn't need
   to track particle positions.

2. **Replicate state changes, not state**: Instead of sending entity health every tick,
   send health when it changes. Our delta system handles this automatically if mods
   just set fields normally.

3. **Use tags for categories, attributes for data**: Tags ("burnable", "collectible")
   are cheap boolean memberships. Attributes ("health: 50", "glow_color: red") carry
   data. Both can replicate efficiently.

4. **Streaming-aware mods**: If we add entity streaming (enter/exit lifecycle), mods
   need to handle entities appearing and disappearing from the client. Roblox solves
   this with `WaitForChild()` and CollectionService signals. Our TagService already
   has `GetInstanceAddedSignal` / `GetInstanceRemovedSignal` equivalents.

### Network Ownership: Future Physics

If tilefun ever adds real physics (bouncing balls, physics puzzles, vehicles with
momentum), Roblox's ownership model is the pattern:

- Server owns anchored/static objects
- Nearest player's client owns unanchored objects they're interacting with
- Ownership can be explicitly set for gameplay needs (driver owns vehicle)
- Owner simulates locally, replicates results

For now, all our entities are server-simulated, which is correct for chickens and
wander AI. But the architecture should be designed so ownership could be added later
without rewriting the protocol.

---

## References

- QuakeWorld source: `~/code/reference/Quake/QW/` (GPL, Id Software 1996-1997)
  - Key files: `server/sv_ents.c`, `client/cl_ents.c`, `client/protocol.h`,
    `client/net_chan.c`, `server/sv_send.c`, `client/cl_demo.c`
- Roblox creator docs: `~/code/reference/roblox/creator-docs/`
  - Key files: `content/en-us/workspace/streaming.md`,
    `content/en-us/physics/network-ownership.md`,
    `content/en-us/projects/client-server.md`,
    `content/en-us/performance-optimization/improve.md`
- Tilefun codebase: `src/shared/protocol.ts`, `src/shared/serialization.ts`,
  `src/server/Realm.ts`, `src/transport/`
- Tilefun scripting design: `docs/SCRIPTING-API-DESIGN.md`
