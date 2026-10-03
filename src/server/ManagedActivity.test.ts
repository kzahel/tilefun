import { expect, it } from "vitest";
import { createBall } from "../entities/Ball.js";
import { createChicken } from "../entities/Chicken.js";
import { createProp } from "../entities/PropFactories.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import type { IWorldRegistry } from "../persistence/IWorldRegistry.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { around } from "./InterestManager.js";
import { PlayerSession } from "./PlayerSession.js";
import { Realm } from "./Realm.js";

it("freezes sleeping balls/tents/scripts and reduces AI decisions without accumulating physics steps", async () => {
  const store = new RecordPersistenceStore(new MemoryRecordStore());
  const realm = new Realm([]),
    transport = new LocalTransport();
  const registry = {
    getWorld: async () => ({
      id: "activity",
      name: "Activity",
      createdAt: 0,
      lastPlayedAt: 0,
      generation: createDescriptor("flat", 42),
    }),
    updateLastPlayed: async () => {},
  } as unknown as IWorldRegistry;
  try {
    await realm.loadWorld("activity", registry, () => store);
    const session = new PlayerSession("local");
    session.editorEnabled = false;
    await realm.addPlayer(session);
    session.player.position = { wx: 128, wy: 128 };
    session.visibleRange = around(12, 0, 1);
    await realm.ensureReady({ minCx: -1, maxCx: 14, minCy: -1, maxCy: 1 });
    const mid = realm.entityManager.spawn(createChicken(3 * 256 + 128, 128));
    if (!mid.wanderAI) throw Error("missing AI");
    mid.wanderAI.timer = 100;
    mid.wanderAI.befriendable = false;
    const sleeping = realm.entityManager.spawn(createBall(12 * 256 + 128, 128));
    sleeping.velocity = { vx: 80, vy: 0 };
    sleeping.jumpVZ = 50;
    sleeping.jumpZ = 20;
    sleeping.wz = 20;
    const tent = realm.propManager.add(createProp("prop-tent-blue", 12 * 256 + 128, 200));
    tent.spawnTimer = 5;
    let scriptSawSleeper = false;
    realm.worldAPI.tick.onPreSimulation(() => {
      scriptSawSleeper ||= realm.worldAPI.entities.all().some((actor) => actor.id === sleeping.id);
      scriptSawSleeper ||= realm.worldAPI.props.all().some((prop) => prop.id === tent.id);
    });
    const tick = () => realm.tick(1 / 60, transport.serverSide, false, new Set());
    tick();
    await realm.streaming?.residency.settle();
    const start = mid.wanderAI.timer;
    for (let i = 0; i < 8; i++) tick();
    expect(mid.wanderAI.timer).toBeCloseTo(start - 8 / 60);
    expect(sleeping.position.wx).toBe(12 * 256 + 128);
    expect(sleeping.jumpVZ).toBe(50);
    expect(tent.spawnTimer).toBe(5);
    expect(scriptSawSleeper).toBe(false);
    session.player.position.wx = 12 * 256 + 200;
    tick();
    await realm.streaming?.residency.settle();
    const beforeWake = sleeping.position.wx;
    tick();
    expect(sleeping.position.wx).toBeGreaterThan(beforeWake);
    expect(sleeping.position.wx - beforeWake).toBeLessThan(2);
    expect(tent.spawnTimer).toBeLessThan(5);
    expect(scriptSawSleeper).toBe(true);
  } finally {
    await realm.destroy();
    transport.serverSide.close();
  }
});

it("restores a player's durable mount and keeps a failed close available for retry", async () => {
  const executor = new MemoryRecordStore(),
    store = new RecordPersistenceStore(executor);
  const realm = new Realm([]),
    reopened = new Realm([]);
  const registry = {
    getWorld: async () => ({
      id: "mount",
      name: "Mount",
      createdAt: 0,
      lastPlayedAt: 0,
      generation: createDescriptor("flat", 42),
    }),
    updateLastPlayed: async () => {},
  } as unknown as IWorldRegistry;
  try {
    await realm.loadWorld("mount", registry, () => store);
    const session = new PlayerSession("rider");
    await realm.addPlayer(session);
    const mount = realm.entityManager.spawn(createChicken(128, 128));
    session.player.position = { wx: 132, wy: 128 };
    session.player.parentId = mount.id;
    session.player.localOffsetX = 4;
    session.player.localOffsetY = 0;
    session.player.wz = 12;
    session.player.jumpZ = 12;
    session.gameplaySession.mountId = mount.id;
    realm.savePlayerData(session);
    executor.beforeCommit = async () => {
      throw Error("disk full");
    };
    await expect(realm.destroy()).rejects.toThrow(/save/);
    expect(realm.entityManager.byId.get(mount.id)).toBe(mount);
    expect(realm.sessions.get("rider")).toBe(session);
    delete executor.beforeCommit;
    await realm.flushAsync();
    await realm.ensureReady(around(0, 0, 1));
    await realm.destroy();
    expect(realm.entityManager.byId.size).toBe(0);
    await reopened.loadWorld("mount", registry, () => store);
    const rider = new PlayerSession("rider");
    await reopened.addPlayer(rider);
    const restored = reopened.entityManager.entities.find(
      (entity) => entity.persistentId === mount.persistentId,
    );
    expect(restored).toBeDefined();
    expect(rider.gameplaySession.mountId).toBe(restored?.id);
    expect(rider.player.parentId).toBe(restored?.id);
    expect(rider.player.localOffsetX).toBe(4);
    expect(rider.player.wz).toBe(12);
  } finally {
    delete executor.beforeCommit;
    await realm.destroy();
    await reopened.destroy();
  }
});
