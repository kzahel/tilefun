import { expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import type { IWorldRegistry, WorldMeta } from "../persistence/IWorldRegistry.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
import { PlayerSession } from "../server/PlayerSession.js";
import { Realm } from "../server/Realm.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { samplePath } from "./LaneGraph.js";
import { TRAFFIC_DEMO_GENERATION } from "./TrafficScene.js";

it("persists a moving roof passenger, restores the ride, and removes a disconnected passenger", async () => {
  const store = new RecordPersistenceStore(new MemoryRecordStore());
  const meta: WorldMeta = {
    id: "traffic",
    name: "Traffic",
    createdAt: 0,
    lastPlayedAt: 0,
    generation: TRAFFIC_DEMO_GENERATION,
  };
  const registry: IWorldRegistry = {
    async open() {},
    close() {},
    async listWorlds() {
      return [meta];
    },
    async getWorld() {
      return meta;
    },
    async createWorld() {
      return meta;
    },
    updateLastPlayed: vi.fn(async () => {}),
    async renameWorld() {},
    async deleteWorld() {},
  };
  const transport = new LocalTransport();
  const realm = new Realm([]),
    restored = new Realm([]);
  try {
    await realm.loadWorld(meta.id, registry, () => store);
    const traffic = required(realm.traffic);
    const lane = required(
      [...traffic.strategy.trafficNetwork(4800, 8304).lanes.values()].find(
        (l) => !l.intercity && l.path.length > 500,
      ),
    );
    const pose = samplePath(lane.path, 160);
    await realm.ensureReady({
      minCx: Math.floor(pose.x / 256) - 1,
      maxCx: Math.floor(pose.x / 256) + 1,
      minCy: Math.floor(pose.y / 256) - 1,
      maxCy: Math.floor(pose.y / 256) + 1,
    });
    const car = traffic.add("compact-1", lane, 160);
    const session = new PlayerSession("rider");
    session.editorEnabled = false;
    await realm.addPlayer(session);
    session.player.position = { wx: car.entity.position.wx, wy: car.entity.position.wy + 3 };
    session.player.wz = 24;
    session.player.groundZ = 24;
    const cx = Math.floor(car.entity.position.wx / 256),
      cy = Math.floor(car.entity.position.wy / 256);
    session.visibleRange = { minCx: cx - 3, maxCx: cx + 3, minCy: cy - 3, maxCy: cy + 3 };
    realm.updateVisibleChunks(session.visibleRange);
    await realm.ensureReady(session.visibleRange);
    const start = { ...car.entity.position };
    for (let i = 0; i < 180; i++) {
      session.inputQueue.push({
        seq: i + 1,
        dx: 0,
        dy: 0,
        jump: false,
        sprinting: false,
        dtMs: 1000 / 60,
      });
      realm.tick(1 / 60, transport.serverSide, false, new Set());
    }
    expect(
      Math.hypot(car.entity.position.wx - start.wx, car.entity.position.wy - start.wy),
    ).toBeGreaterThan(15);
    expect(session.player.wz).toBe(24);
    expect(session.gameplaySession.mountId).toBeNull();
    await realm.flushAsync();
    const saved = realm.playerData(session);
    expect(saved.roofRide?.identity).toBe(car.entity.proceduralId);
    await realm.destroy();
    await restored.loadWorld(meta.id, registry, () => store);
    const returning = new PlayerSession("rider");
    await restored.addPlayer(returning);
    expect(returning.player.position).toEqual(session.player.position);
    expect(returning.player.wz).toBe(24);
    expect(restored.playerData(returning).roofRide).toEqual(saved.roofRide);
    restored.removePlayer(returning.clientId);
    expect(restored.entityManager.entities.some((e) => e.id === returning.player.id)).toBe(false);
    expect(required(restored.traffic).states.size).toBeGreaterThan(0);
  } finally {
    await realm.destroy();
    await restored.destroy();
    transport.serverSide.close();
  }
});
