# Multiplayer networking

Topic: multiplayer-networking
Status: reliable ordered replication and fragmented P2P snapshots; bounded guest
recovery with failure diagnostics. Broader network investigation is deferred.
Updated: 2026-10-19.

Owns ongoing transport/replication decisions and gaps. The
[architecture guide](../client-server-architecture.md) owns runtime boundaries;
[network design](../NETWORK-ARCHITECTURE.md) retains channel rationale and future
proposals. [Server access](../SERVER-SECURITY.md) owns deployed admin policy.

## Driven-car heading codec

[144](../tactical/144-rolling-car-steering.md) carries optional float32
`vehicleHeading` in baseline presence bit 16 and delta change/null bit 17.
Baseline masks expand from u16 to u32; existing delta masks stay u32. Removal is
explicit when a car returns to automatic route ownership. All endpoints must
update together. Authority and prediction consume the same quantized bearing;
remote presentation interpolates it without changing physics.

## Packaged host/join and shared menus

[Steam Deck and menus](steam-deck-and-menus.md) owns desktop packaging and UI.
Host/join/leave preserve the current installation origin and await local authority
persistence. Public invitation URLs always target the hosted web game. Optional
`peerServer` selects a self-hosted PeerJS broker for isolated WebRTC integration.
PeerJS guests negotiate **binary** serialization: its built-in chunking keeps world
snapshots below SCTP message limits. Raw serialization disconnected guests during
initial world transfer; the two-browser host/join/leave regression exercises actual
signaling and world data. Matching builds remain required for the gameplay codec.

## P2P reconnect-loop correction (2026-10-18)

The raw-serialization build reproduced the reported zoom-1 loop through the real
PeerJS host/guest game with local signaling. A 507,306-byte `sync-chunks` expansion
exceeded Chromium's measured 262,144-byte SCTP message limit. PeerJS caught the
native send exception and closed; reconnect then retried a 662,134-byte baseline.
Resetting the retry count on every channel open made every drop `Attempt 1/5`.
These sizes are one seeded reproduction, not universal browser limits.

Guests now negotiate PeerJS binary serialization (also integrated by the packaged
host/join work above). It wraps the existing gameplay ArrayBuffer and fragments it;
reliable SCTP delivery alone does not remove the per-message size limit. The same
large transfers and a forced reconnect passed with packets at most 16,331 bytes.
Both endpoints still require matching gameplay codecs; old raw guests must update.

PeerJS error-level logging is enabled through a shared logger that retains original
exception objects/stacks. Per-connection diagnostics retain only the last outgoing
message type/byte count, age, native state, buffered bytes and negotiated message
limit. Native handles/limits survive PeerJS clearing its fields before `close`.
No payloads, per-frame histories or routine telemetry uploads are added.

Guest recovery allows five retries at two-second intervals. An unopened attempt
times out after 30 seconds; duplicate/obsolete connection callbacks and canceled
timers cannot start extra retries. The budget resets only after ten seconds of
advancing server frames without a gap over three seconds. Brief opens, repeated
old ticks and idle time cannot reset it. A terminal failure leaves Retry (reload
this invitation) and Back (leave the invitation) usable instead of emitting a
synthetic kick that covers those controls with another overlay. Reconnect overlays
wait for decoded world frames or a lobby list before disappearing.

[Guest lifecycle unit tests](../../src/transport/PeerGuestTransport.test.ts) cover
short-lived connections, health reset, gaps, stale callbacks, offer errors, attempt
timeouts and cancellation. [P2P browser regressions](../../tests/p2p-recovery.spec.ts)
use a local PeerServer and full bundled Chromium with fresh browser contexts:
preload the host overview, join, zoom to 1, require a reassembled message over
the negotiated SCTP limit, force native channel closure and require resumed
replication. A second case exhausts rapid reconnects and exercises Retry and Back.
This is local native SCTP correctness evidence, not WAN/NAT/congestion or
cross-browser coverage.

Validation: typechecks, 2,867 unit tests, lint (existing warnings), production
build, regenerated catalog/manifest and all six streaming readiness scenarios
pass. Both new P2P browser cases pass in isolation and the full suite. The full
browser run records 706 passes and one failure in the previously recorded
`authored-train` renderer-swap snapshot check: it briefly reads no carriages.
Two of three one-worker isolated reruns pass; one repeats that snapshot failure.
The intermittent train check remains separate follow-up work.

## Current contract

- [RealmReplicator](../../src/server/RealmReplicator.ts) builds per-client frames
  with full baselines for new entities, field deltas for changed entities and
  exit IDs, plus on-change sync messages. It diffs against last-sent state;
  this is not an acknowledged snapshot baseline protocol.
- [EntityDefs](../../src/entities/EntityDefs.ts) owns static sprite/collider/AI
  metadata. [Serialization](../../src/shared/serialization.ts) carries dynamic
  state and reconstructs full entities; animation frame/timer and AI timer are
  not sent as in the original SpriteDef proposal.
- Player appearances use validated `set-player-model` requests and optional
  `SpriteState.model` in baselines/deltas; absence resets the classic appearance.
  The binary model list is append-only. See [characters](characters.md) for
  profile persistence and the cosmetic-only physics contract. Registry expansion
  changes sorted entity wire indices, so deploy matching clients and servers.
- [binaryCodec](../../src/shared/binaryCodec.ts) handles frame, player-input and
  chunk binary encoding with JSON envelopes for other message types. Consult
  code/tests for sizes; old JSON bandwidth estimates are historical.
- [Channel policy](../../src/transport/webrtcChannels.ts) sends all server and
  client gameplay messages over reliable ordered `sync`, including frame
  baselines, field deltas, exits and world/realm transitions. The optional legacy
  `entities` channel remains negotiated but current servers never send frames
  there. PeerJS uses the same policy; WebSocket and local Worker are ordered.
- Reliability may delay later updates behind a lost packet or a large chunk
  transfer. This is the accepted correctness-first tradeoff; frames cannot be
  dropped/coalesced without changing the dependent-delta protocol.
- Worker replication is bounded/backpressured. The client applies frame deltas
  sequentially; it cannot discard an intermediate delta as if each frame were a
  complete snapshot. Realm transfers clear replication baselines.
- Co-op players remain replicated throughout their current realm, even outside
  viewport interest; other distant actors and terrain retain their ordinary
  interest bounds. Play and Edit show a small colored pointer/name above other
  players and an inset screen-edge arrow toward offscreen players. The HUD uses
  displayed XY/height, camera projection and zoom on both Canvas and GPU, and
  excludes the local player. Realm departure removes the marker through ordinary
  entity exits; disconnected sessions retain the existing 60-second reconnect
  grace period before removal. Players in another realm are not tracked. Immersive XR
  does not draw these flat screen markers; embedded single-player labs have no
  co-op HUD and retain their shared presentation path.

## Evidence and next work

Protocol coverage lives in [binary codec tests](../../src/shared/binaryCodec.test.ts),
[entity delta tests](../../src/shared/entityDelta.test.ts),
[replication tests](../../src/server/buildGameState.test.ts),
[remote state tests](../../src/client/RemoteStateView.test.ts), and
[channel policy tests](../../src/transport/webrtcChannels.test.ts).
Worker lifecycle/readiness evidence lives in [performance](performance.md).
Location-marker geometry and distant-player replication coverage live in
[PlayerMarkers tests](../../src/ui/PlayerMarkers.test.ts) and
[RealmReplicator tests](../../src/server/RealmReplicator.test.ts). The
[two-client browser check](../../tests/player-markers.spec.ts) exercises real
Canvas/GPU HUD submissions, distant movement, portrait resizing, editing and
realm-departure cleanup with isolated dedicated-server data.

Validation on 2026-10-18: typechecks, lint, production build, 2,851 unit tests and
streaming readiness pass after integrating current main. Both marker browser
checks pass in isolation and in the full browser run. That full run records
672 passes and two failures (train snapshot and touch Jump); both failures pass
on a one-worker rerun alongside the marker checks after integration.

[Tactical 014](../tactical/014-webrtc-delivery-validation.md) preserves the pre-fix
loss/reordering audit and evidence. Its five known failures motivated
[Tactical 015](../tactical/015-webrtc-ordered-delivery.md): ordered routing and
passing regressions for baselines, final positions, exits, reordered updates
and delayed old-world frames crossing a transition.

The delivery harness models channel semantics: loss adds bounded delay on sync,
while unreliable traffic can drop/reorder. All 18 seeded production-policy runs
converge. This is a protocol/channel model, not measured SCTP loss performance.
The CLI's `--legacy-unreliable --expect-known-gaps` mode reproduces the old gaps.
Real dedicated WebRTC browser tests assert frames actually arrive on reliable
sync even with the optional unreliable channel open and faults armed. They also
hold/release the whole sync stream across a real world transition, and exercise
optional-channel closure and reconnect. No expected-failure annotations remain
in the delivery regression tests.

Deploy the updated server/host and reconnect existing clients to reset baselines;
changing routing cannot reconstruct state already lost in an old session. An old
server can still send unsafe unreliable frames to a compatible client, so a
client-only update does not apply this fix.

## Deferred work

The [networking investigation backlog](../ideas.md#deferred-networking-investigation)
owns OS UDP impairment, WAN/NAT/TURN, congestion, mobile/cross-browser coverage
and any future unreliable protocol. Reopen that work if measured latency or
connection failures justify it; it is not a prerequisite for this bounded fix.
Tick filtering alone does not repair lost fields. A future unreliable design
needs recoverable baselines, lifecycle/field repair and realm/session isolation.

Bandwidth priority scheduling, unreliable input with resend windows and voice
remain proposals. Public-server player authentication is separate from the
existing administrative token and Workshop owner login.
