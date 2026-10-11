import { expect, it } from "vitest";
import { createChicken } from "../entities/Chicken.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import type { FrameMessage } from "../shared/protocol.js";
import { World } from "../world/World.js";
import { PlayerSession } from "./PlayerSession.js";
import { RealmReplicator } from "./RealmReplicator.js";

it("shares unchanged snapshots across clients while observing edits within the same tick", () => {
  const entityManager = new EntityManager();
  const player = entityManager.spawn(createPlayer(0, 0));
  const chicken = entityManager.spawn(createChicken(20, 20));
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
  const frame = (id: string) => replicator.build(id, source)[0] as FrameMessage;
  const first = frame("a"),
    second = frame("b");
  const snapshot = first.entityBaselines?.find((e) => e.id === chicken.id);
  expect(second.entityBaselines?.find((e) => e.id === chicken.id)).toBe(snapshot);
  chicken.position.wx = 25;
  chicken.tags?.delete("befriendable");
  const changed = frame("b");
  expect(changed.entityDeltas?.find((e) => e.id === chicken.id)?.position?.wx).toBe(25);
  expect(snapshot?.position.wx).toBe(20);
  expect(frame("a").entityDeltas).toEqual(changed.entityDeltas);
  expect(frame("a").entityDeltas).toBeUndefined();
  replicator.clearClient("a");
  expect(frame("a").entityBaselines).toBeDefined();
  entityManager.remove(chicken.id);
  expect(frame("a").entityExits).toContain(chicken.id);
  replicator.clear();
  expect(frame("b").entityBaselines).toBeDefined();
});
