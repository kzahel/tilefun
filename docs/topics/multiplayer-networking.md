# Multiplayer networking

Topic: multiplayer-networking
Status: dependent entity frames and world transitions use reliable ordered sync.
The bounded correctness fix is complete; broader network investigation is deferred.
Updated: 2026-10-03; checked against the current implementation.

Owns ongoing transport/replication decisions and gaps. The
[architecture guide](../client-server-architecture.md) owns runtime boundaries;
[network design](../NETWORK-ARCHITECTURE.md) retains channel rationale and future
proposals. [Server access](../SERVER-SECURITY.md) owns deployed admin policy.

## Current contract

- [RealmReplicator](../../src/server/RealmReplicator.ts) builds per-client frames
  with full baselines for new entities, field deltas for changed entities and
  exit IDs, plus on-change sync messages. It diffs against last-sent state;
  this is not an acknowledged snapshot baseline protocol.
- [EntityDefs](../../src/entities/EntityDefs.ts) owns static sprite/collider/AI
  metadata. [Serialization](../../src/shared/serialization.ts) carries dynamic
  state and reconstructs full entities; animation frame/timer and AI timer are
  not sent as in the original SpriteDef proposal.
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

## Evidence and next work

Protocol coverage lives in [binary codec tests](../../src/shared/binaryCodec.test.ts),
[entity delta tests](../../src/shared/entityDelta.test.ts),
[replication tests](../../src/server/buildGameState.test.ts),
[remote state tests](../../src/client/RemoteStateView.test.ts), and
[channel policy tests](../../src/transport/webrtcChannels.test.ts).
Worker lifecycle/readiness evidence lives in [performance](performance.md).

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
