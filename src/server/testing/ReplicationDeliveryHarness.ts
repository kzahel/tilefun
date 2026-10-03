import { RemoteStateView } from "../../client/ClientStateView.js";
import { FlatStrategy } from "../../generation/FlatStrategy.js";
import { decodeServerMessage, encodeServerMessage } from "../../shared/binaryCodec.js";
import type { FrameMessage } from "../../shared/protocol.js";
import { serializeEntity } from "../../shared/serialization.js";
import { LocalTransport } from "../../transport/LocalTransport.js";
import { World } from "../../world/World.js";
import { GameServer } from "../GameServer.js";
import { browserServerDependencies } from "../hosts/browser.js";

// Faults apply only to server entity frames. Reliable input/control is untouched.
// No hand-authored snapshots: GameServer -> RealmReplicator -> binary codec -> replica.
export function createReplicationRig() {
  const transport = new LocalTransport();
  const server = new GameServer(transport.serverSide, browserServerDependencies());
  const frames: FrameMessage[] = [];
  let wireBytes = 0;
  transport.clientSide.onMessage((message) => {
    const encoded = encodeServerMessage(message);
    wireBytes += encoded.byteLength;
    const decoded = decodeServerMessage(encoded);
    if (decoded.type === "frame") frames.push(decoded);
  });
  server.start();
  server.broadcasting = true;
  transport.triggerConnect();
  server.getLocalSession().debugPaused = true;
  transport.clientSide.send({ type: "visible-range", minCx: -2, minCy: -2, maxCx: 2, maxCy: 2 });
  transport.clientSide.send({ type: "edit-spawn", entityType: "chicken", wx: 50, wy: 50 });
  const chicken = server.entityManager.entities.find((entity) => entity.type === "chicken");
  if (!chicken) throw new Error("Fixture failed to spawn chicken");
  const view = new RemoteStateView(new World(new FlatStrategy()));
  const control = new RemoteStateView(new World(new FlatStrategy()));
  function tick() {
    frames.length = 0;
    server.tick(1 / 60);
    if (frames.length !== 1 || !frames[0]) throw new Error("Expected one authoritative frame");
    control.applyFrame(frames[0]);
    return frames[0];
  }
  function settle(count = 120) {
    for (let i = 0; i < count; i++) view.applyFrame(tick());
  }
  function state(replica: RemoteStateView) {
    return replica.entities.map(serializeEntity).sort((a, b) => a.id - b.id);
  }
  return {
    server,
    transport,
    chicken,
    view,
    control,
    tick,
    settle,
    state,
    get wireBytes() {
      return wireBytes;
    },
  };
}
