import { expect, it } from "vitest";
import { createChicken } from "../entities/Chicken.js";
import { EntityManager } from "../entities/EntityManager.js";
import { PropManager } from "../entities/PropManager.js";
import { encodeActor } from "./ActorRecords.js";
import { MemoryRecordStore } from "./MemoryRecordStore.js";
import { RealmRecords } from "./RealmRecords.js";
import { RecordPersistenceStore } from "./RecordPersistenceStore.js";
import { SaveManager } from "./SaveManager.js";

const metadata = () => ({ playerX: 0, playerY: 0, cameraX: 0, cameraY: 0, cameraZoom: 1 });

it.each([100, 10_000])(
  "production dirty tracking saves one edit among %i resident actors",
  async (count) => {
    const executor = new MemoryRecordStore();
    const saves = new SaveManager(new RecordPersistenceStore(executor));
    saves.bind(() => undefined, metadata);
    await saves.open();
    const entities = new EntityManager();
    const records = new RealmRecords(entities, new PropManager(), saves);
    records.restore(
      Array.from({ length: count }, (_, i) => {
        const entity = createChicken(i * 16, 0);
        entity.persistentId = String(i);
        return encodeActor(entity);
      }),
    );
    const before = executor.recordsWritten;
    const actor = entities.entities[0];
    if (!actor) throw new Error("Missing actor");
    actor.position.wx = 512;
    await saves.flushAsync();
    expect(executor.recordsWritten - before).toBe(1);
    expect(await executor.scan({ collection: "entities", scope: "2,0", limit: 16 })).toHaveLength(
      1,
    );
    expect(await executor.scan({ collection: "entities", scope: "0,0", limit: 16 })).toHaveLength(
      0,
    );
    await saves.close();
  },
);

it("restores durable identity, AI/motion state and attachments with fresh runtime IDs", async () => {
  const executor = new MemoryRecordStore();
  const store = new RecordPersistenceStore(executor);
  const saves = new SaveManager(store);
  saves.bind(() => undefined, metadata);
  await saves.open();
  const entities = new EntityManager();
  new RealmRecords(entities, new PropManager(), saves);
  const parent = entities.spawn(createChicken(0, 0));
  const child = entities.spawn(createChicken(0, 0));
  child.parentId = parent.id;
  child.localOffsetX = 5;
  child.wz = 18;
  child.jumpVZ = 22;
  if (parent.wanderAI) parent.wanderAI.timer = 7;
  const id = parent.persistentId;
  await saves.flushAsync();
  await saves.close();
  await store.open();
  const next = new EntityManager();
  next.setNextId(50);
  const nextSaves = new SaveManager(store);
  nextSaves.bind(() => undefined, metadata);
  const restored = new RealmRecords(next, new PropManager(), nextSaves);
  restored.restore(
    (await store.getAll("entities")).values() as Iterable<ReturnType<typeof encodeActor>>,
  );
  const loadedParent = next.entities.find((e) => e.persistentId === id);
  const loadedChild = next.entities.find((e) => e.persistentId === child.persistentId);
  expect(loadedParent?.id).not.toBe(parent.id);
  expect(loadedParent?.wanderAI?.timer).toBe(7);
  expect(loadedChild).toMatchObject({
    parentId: loadedParent?.id,
    localOffsetX: 5,
    wz: 18,
    jumpVZ: 22,
  });
  next.remove(loadedParent?.id ?? -1);
  await nextSaves.flushAsync();
  expect(await store.get("entities", id ?? "")).toBeUndefined();
  await nextSaves.close();
});
