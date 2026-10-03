# Slow-field protocol deltas — implemented and evolved

The original Phase 1 proposal is preserved in
[the archive](archive/wire-protocol-delta-plan.md). Its single GameStateMessage,
JSON transport and “future” phases are historical.

Current [RealmReplicator](../src/server/RealmReplicator.ts) emits entity frames
and typed on-change sync messages. Static entity metadata, entity field deltas
and binary encoding have since shipped. Read
[networking](topics/multiplayer-networking.md) for the actual reliability and
baseline contracts, and [network design](NETWORK-ARCHITECTURE.md) for rationale.

[Replication tests](../src/server/buildGameState.test.ts) and
[client state tests](../src/client/RemoteStateView.test.ts) exercise this path.
The old delta-field proposal is not the current wire schema or a pending task.
