import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createChicken } from "../entities/Chicken.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RealmRecords } from "../persistence/RealmRecords.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { World } from "../world/World.js";
import { around } from "./InterestManager.js";
import { PlayerSession } from "./PlayerSession.js";
import { RealmStreaming } from "./RealmStreaming.js";

async function fixture() {
  const executor = new MemoryRecordStore();
  const store = new RecordPersistenceStore(executor);
  const saves = new SaveManager(store);
  const world = new World(createGenerator(createDescriptor("flat", 2026)).terrain);
  saves.bind(
    (key) => world.chunks.getChunkDataByKey(key),
    () => ({ playerX: 0, playerY: 0, cameraX: 0, cameraY: 0, cameraZoom: 1 }),
  );
  await saves.open();
  const entities = new EntityManager(),
    props = new PropManager();
  const records = new RealmRecords(entities, props, saves);
  let births = 0;
  const faults = { generate: false };
  const streaming = new RealmStreaming(
    world,
    records,
    props,
    saves,
    () => {},
    () => {},
    (key, seeded) => {
      if (seeded) return;
      const [cx = 0, cy = 0] = key.split(",").map(Number);
      const actor = createChicken(cx * 256 + 128, cy * 256 + 128);
      actor.proceduralId = `origin:${key}`;
      entities.spawn(actor);
      births++;
      if (faults.generate) throw new Error("injected publication failure");
    },
  );
  const visit = async (cx: number) => {
    streaming.interest.set("test", [{ range: around(cx, 0, 0), activity: 2, reason: "player" }]);
    streaming.residency.reconcile(streaming.interest.demand(0));
    await streaming.residency.settle();
  };
  const close = async () => {
    await streaming.close();
    await saves.close();
  };
  return {
    executor,
    faults,
    saves,
    world,
    entities,
    props,
    records,
    streaming,
    visit,
    close,
    births: () => births,
  };
}

it("unloads durable actors, moved procedural props and complete attachment groups without resurrection", async () => {
  const f = await fixture();
  try {
    await f.visit(0);
    const parent = required(f.entities.entities[0]);
    const parentId = parent.persistentId;
    const child = f.entities.spawn(createChicken(280, 128));
    child.parentId = parent.id;
    child.localOffsetX = 152;
    const childId = child.persistentId;
    const prop = createProp("prop-oak-tree", 150, 150);
    prop.proceduralId = "tree-origin";
    f.props.add(prop);
    f.props.move(prop.id, 300, 150);
    const propId = prop.persistentId;
    await f.visit(1);
    expect(f.records.byId.has(required(parentId))).toBe(false);
    expect(f.records.byId.has(required(childId))).toBe(false);
    expect(f.records.byId.has(required(propId))).toBe(true);
    f.props.move(prop.id, 330, 155);
    await f.visit(2);
    expect(f.records.byId.has(required(propId))).toBe(false);
    expect(f.world.chunks.loadedCount).toBe(1);
    await f.visit(0);
    const restored = required(f.records.byId.get(required(parentId)));
    const restoredChild = required(f.records.byId.get(required(childId)));
    expect(restored.id).not.toBe(parent.id);
    expect(restoredChild).toMatchObject({ parentId: restored.id, localOffsetX: 152 });
    expect(f.records.features.get("tree-origin")?.scope).toBe("0,0");
    expect(f.records.features.get("tree-origin")?.edit?.wx).toBe(330);
    f.entities.remove(restored.id);
    await f.visit(1);
    expect(f.records.byId.get(required(propId))?.position).toEqual({ wx: 330, wy: 155 });
    await f.visit(0);
    expect(f.records.byId.has(required(parentId))).toBe(false);
    expect(f.births()).toBe(3);
  } finally {
    await f.close();
  }
});

it("failed eviction retains actors and terrain until the durable snapshot is acknowledged", async () => {
  const f = await fixture();
  try {
    await f.visit(0);
    const actor = required(f.entities.entities[0]);
    f.executor.beforeCommit = async () => {
      throw new Error("disk full");
    };
    await f.visit(1);
    expect(f.records.byId.get(required(actor.persistentId))).toBe(actor);
    expect(f.world.chunks.get(0, 0)).toBeDefined();
    expect(f.saves.hasDirty).toBe(true);
    delete f.executor.beforeCommit;
    for (let i = 0; i < 65; i++) await f.visit(1);
    expect(f.records.byId.has(required(actor.persistentId))).toBe(false);
    await f.visit(0);
    expect(f.records.byId.get(required(actor.persistentId))?.position).toEqual(actor.position);
  } finally {
    await f.close();
  }
});

it("fixed interest over 1000 distinct chunks retains bounded decoded state and seeds each origin once", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 1000; i++) {
      await f.visit(i);
      expect(f.world.chunks.loadedCount).toBe(1);
      expect(f.entities.entities).toHaveLength(1);
      expect(f.records.byId.size).toBe(1);
      expect(f.records.buckets.size).toBe(1);
      expect(f.records.features.size).toBe(1);
    }
    expect(f.streaming.residency.metrics.highWater).toBeLessThanOrEqual(2);
    await f.visit(0);
    expect(f.births()).toBe(1000);
    expect(f.entities.entities[0]?.proceduralId).toBe("origin:0,0");
  } finally {
    await f.close();
  }
}, 30000);

it("camera observation does not activate actors and distant players retain independent ready neighborhoods", async () => {
  const f = await fixture();
  try {
    const one = new PlayerSession("one", createPlayer(128, 128));
    const two = new PlayerSession("two", createPlayer(25600 + 128, 128));
    f.streaming.update([around(200, 0, 1)], [one, two]);
    await f.streaming.residency.settle();
    expect(f.streaming.demand.get("200,0")?.activity).toBe(0);
    expect(f.streaming.demand.get("0,0")?.activity).toBe(2);
    expect(f.streaming.demand.get("100,0")?.activity).toBe(2);
    expect(f.streaming.demand.has("50,0")).toBe(false);
    expect(f.streaming.supported(one.player)).toBe(true);
    expect(f.streaming.supported(two.player)).toBe(true);
  } finally {
    await f.close();
  }
});

it("rolls back partial publication and retries generation without duplicate dirty actors", async () => {
  const f = await fixture();
  try {
    f.faults.generate = true;
    await f.visit(0);
    expect(f.entities.entities).toHaveLength(0);
    expect(f.records.byId.size).toBe(0);
    expect(f.records.features.size).toBe(0);
    expect(f.world.chunks.loadedCount).toBe(0);
    expect(f.saves.hasDirty).toBe(false);
    expect(f.streaming.residency.diagnostics()).toMatchObject({
      states: { loading: 0, ready: 0, saving: 0, failed: 1 },
      demanded: 1,
      inFlight: 0,
      lastError: "injected publication failure",
    });
    f.faults.generate = false;
    for (let i = 0; i < 61; i++) await f.visit(0);
    expect(f.entities.entities).toHaveLength(1);
    expect(f.streaming.residency.diagnostics().states.failed).toBe(0);
    await f.saves.flushAsync();
    expect((await f.saves.store.readScope("entities", "0,0")).size).toBe(1);
  } finally {
    await f.close();
  }
});

it("loads attachment support at the resolved destination before the first parent step", async () => {
  const f = await fixture();
  try {
    await f.visit(0);
    const parent = required(f.entities.entities[0]);
    const child = f.entities.spawn(createChicken(128, 128));
    child.parentId = parent.id;
    child.localOffsetX = 512;
    child.localOffsetY = 0;
    expect(f.streaming.supported(child)).toBe(false);
    const session = new PlayerSession("player", createPlayer(128, 128));
    f.streaming.update([], [session]);
    await f.streaming.residency.settle();
    expect(f.streaming.supported(child)).toBe(true);
    expect(f.records.projectedPosition(child)).toEqual({ wx: 640, wy: 128 });
  } finally {
    await f.close();
  }
});
