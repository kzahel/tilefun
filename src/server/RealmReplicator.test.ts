import { expect, it } from "vitest";
import { createChicken } from "../entities/Chicken.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import type { FrameMessage } from "../shared/protocol.js";
import { World } from "../world/World.js";
import { AiPlanningScheduler } from "./AiPlanningScheduler.js";
import { PlayerSession } from "./PlayerSession.js";
import { RealmReplicator } from "./RealmReplicator.js";

it("replicates ready collision terrain throughout actor interest, including narrow viewports", () => {
  const entityManager = new EntityManager();
  const player = entityManager.spawn(createPlayer(0, 0));
  const actor = entityManager.spawn(createChicken(500, 0));
  const session = new PlayerSession("local", player);
  // A rear-roof rider on a small viewport can have the leading carriage two
  // chunks ahead. Unknown terrain there must not falsely stop private replay.
  session.visibleRange = { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 };
  const world = new World(new FlatStrategy());
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) world.getChunk(x, y);
  const source = {
    world,
    entityManager,
    propManager: new PropManager(),
    sessions: new Map([["local", session]]),
    aiPlanning: new AiPlanningScheduler(),
    tickCounter: 1,
    tickRate: 60,
    playerNamesRevision: 0,
    editorCursorsRevision: 0,
  };
  const replicator = new RealmReplicator();
  const messages = replicator.build("local", source);
  expect((messages[0] as FrameMessage).entityBaselines?.map((e) => e.id)).toContain(actor.id);
  const terrain = messages.find((m) => m.type === "sync-chunks");
  if (terrain?.type !== "sync-chunks") throw Error("Missing collision context");
  expect(terrain.loadedChunkKeys).toHaveLength(25);
  expect(terrain.loadedChunkKeys).toContain("2,0");
  expect(terrain.loadedChunkKeys).toContain("-2,-2");
  expect(terrain.loadedChunkKeys).not.toContain("3,0");
  expect(terrain.chunkUpdates).toHaveLength(25);
  expect(replicator.build("local", source).some((m) => m.type === "sync-chunks")).toBe(false);
  // The wider collision buffer does not create authority terrain or defeat exits.
  session.visibleRange = { minCx: 3, maxCx: 3, minCy: 0, maxCy: 0 };
  const moved = replicator.build("local", source).find((m) => m.type === "sync-chunks");
  if (moved?.type !== "sync-chunks") throw Error("Missing updated interest");
  expect(moved.loadedChunkKeys).not.toContain("0,0");
  expect(moved.loadedChunkKeys).not.toContain("4,0");
  expect([...world.chunks.entries()]).toHaveLength(49);
});

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
    aiPlanning: new AiPlanningScheduler(),
    tickCounter: 1,
    tickRate: 60,
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

it("replicates distant realm players for location markers while keeping other distant actors culled", () => {
  const entityManager = new EntityManager();
  const local = entityManager.spawn(createPlayer(0, 0));
  const remote = entityManager.spawn(createPlayer(100_000, -100_000));
  const chicken = entityManager.spawn(createChicken(100_000, -100_000));
  const sessions = new Map([
    ["local", new PlayerSession("local", local)],
    ["remote", new PlayerSession("remote", remote)],
  ]);
  const source = {
    world: new World(new FlatStrategy()),
    entityManager,
    propManager: new PropManager(),
    sessions,
    aiPlanning: new AiPlanningScheduler(),
    tickCounter: 1,
    tickRate: 60,
    playerNamesRevision: 0,
    editorCursorsRevision: 0,
  };
  const replicator = new RealmReplicator();
  const frame = () => replicator.build("local", source)[0] as FrameMessage;
  const first = frame();
  expect(first.entityBaselines?.map((e) => e.id)).toContain(remote.id);
  expect(first.entityBaselines?.map((e) => e.id)).not.toContain(chicken.id);
  remote.position.wx += 10;
  expect(frame().entityDeltas?.find((e) => e.id === remote.id)?.position?.wx).toBe(100_010);
  expect(frame().entityBaselines).toBeUndefined();
  expect(frame().entityDeltas).toBeUndefined();
  // Leaving/disconnecting from this realm retires the marker via ordinary exits.
  sessions.delete("remote");
  entityManager.remove(remote.id);
  expect(frame().entityExits).toContain(remote.id);
  expect(frame().entityExits).toBeUndefined();
});
