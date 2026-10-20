import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { RemoteStateView } from "../client/ClientStateView.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyVehicleFacing, createVehicle } from "../traffic/Vehicle.js";
import { World } from "../world/World.js";
import { PlayerSession } from "./PlayerSession.js";
import { RealmReplicator } from "./RealmReplicator.js";

it("replicates original, painted and cleared cars to two clients and a reconnect without stale snapshot reuse", () => {
  const entityManager = new EntityManager();
  const player = entityManager.spawn(createPlayer(0, 0));
  const car = entityManager.spawn(createVehicle("beetle", 20, 20));
  const sessions = new Map(["a", "b"].map((id) => [id, new PlayerSession(id, player)]));
  const source = {
    world: new World(new FlatStrategy()),
    entityManager,
    propManager: new PropManager(),
    sessions,
    tickCounter: 1,
    tickRate: 60,
    physicsMult: 1,
    playerNamesRevision: 0,
    editorCursorsRevision: 0,
  };
  const replicator = new RealmReplicator();
  const views = new Map(
    ["a", "b"].map((id) => [id, new RemoteStateView(new World(new FlatStrategy()))]),
  );
  const publish = (id: string) => {
    for (const message of replicator.build(id, source)) {
      const decoded = decodeServerMessage(encodeServerMessage(message));
      if (decoded.type === "frame") required(views.get(id)).applyFrame(decoded);
    }
    return required(required(views.get(id)).entities.find((e) => e.id === car.id));
  };
  expect(publish("a").paintSchemeId).toBeUndefined();
  expect(publish("b").paintSchemeId).toBeUndefined();
  for (const paint of ["forest", "teal", undefined]) {
    if (paint === undefined) delete car.paintSchemeId;
    else car.paintSchemeId = paint;
    applyVehicleFacing(car);
    for (const id of ["a", "b"]) {
      expect(publish(id).paintSchemeId).toBe(paint);
      expect(publish(id).sprite?.sheetKey).toBe(car.sprite?.sheetKey);
    }
    replicator.clearClient("b");
    expect(publish("b").paintSchemeId).toBe(paint);
  }
  replicator.clear();
});
