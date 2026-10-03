# Multiplayer networking

Topic: multiplayer-networking
Status: binary replication and dedicated dual-channel WebRTC implemented;
broader loss/reordering and reconnect validation remains.
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
- [Channel policy](../../src/transport/webrtcChannels.ts) sends dedicated WebRTC
  frames over unordered/unreliable `entities` when available, falling back to
  reliable `sync`. All client messages and server sync/control stay reliable.
  PeerJS host/guest remain sync-only; WebSocket and local Worker are ordered.
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

Prioritize dedicated WebRTC loss/reordering and reconnect coverage. In
particular, last-sent deltas and an unreliable channel do not by themselves
establish recovery after a lost baseline/delta; don't describe this as proven
loss-tolerant full-snapshot delivery. This cleanup verified the code structure,
not a new adverse-network capture.

Bandwidth priority scheduling, unreliable input with resend windows and voice
remain proposals. Public-server player authentication is separate from the
existing administrative token and Workshop owner login.
