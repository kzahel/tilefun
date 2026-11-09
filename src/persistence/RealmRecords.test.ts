import { expect, it, vi } from "vitest";
import { createChicken } from "../entities/Chicken.js";
import { EntityManager } from "../entities/EntityManager.js";
import { PropManager } from "../entities/PropManager.js";
import { EntityHandle } from "../server/EntityHandle.js";
import { required } from "../shared/required.js";
import { encodeActor } from "./ActorRecords.js";
import { MemoryRecordStore } from "./MemoryRecordStore.js";
import { RealmRecords, SWEEP_SECONDS } from "./RealmRecords.js";
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

async function sweepFixture(count: number) {
  const executor = new MemoryRecordStore();
  const saves = new SaveManager(new RecordPersistenceStore(executor));
  saves.bind(() => undefined, metadata);
  await saves.open();
  const entities = new EntityManager();
  const records = new RealmRecords(entities, new PropManager(), saves);
  records.restore(
    Array.from({ length: count }, (_, i) => {
      const entity = createChicken(16 + i * 8, 16);
      entity.persistentId = `a${i}`;
      return encodeActor(entity);
    }),
  );
  return { executor, saves, entities, records };
}

it("sweeps continuous state into storage within one sweep period, and at explicit flushes", async () => {
  const { saves, entities, records } = await sweepFixture(20);
  const moved = required(entities.entities[3]);
  moved.position.wx += 3;
  required(moved.velocity).vx = 12;
  const tick = 1 / 60;
  for (let i = 0; i < 5; i++) records.tick(tick);
  expect(saves.hasDirty).toBe(false);
  for (let i = 0; i < SWEEP_SECONDS * 60; i++) records.tick(tick);
  expect(saves.dirtyCount).toBe(1);
  await saves.flushAsync({ sweep: false });
  expect(await saves.store.get("entities", "a3")).toMatchObject({ wx: moved.position.wx });

  // Periodic checkpoints skip the sweep; explicit barriers include unswept changes.
  const other = required(entities.entities[7]);
  other.position.wy += 2;
  await saves.flushAsync({ sweep: false });
  expect(await saves.store.get("entities", "a7")).toBeUndefined();
  await saves.flushAsync();
  expect(await saves.store.get("entities", "a7")).toMatchObject({ wy: 18 });
  await saves.close();
});

it("re-indexes chunk crossings and attachments on the next tick and saves them promptly", async () => {
  const { saves, entities, records } = await sweepFixture(2);
  const [a, b] = [required(entities.entities[0]), required(entities.entities[1])];
  const revision = records.membershipRevision;
  a.position.wx = 300;
  expect(records.buckets.get("1,0")).toBeUndefined();
  records.tick(0);
  expect(records.buckets.get("1,0")?.has(a)).toBe(true);
  expect(records.membershipRevision).toBeGreaterThan(revision);
  expect(saves.dirtyCount).toBe(1);
  await saves.flushAsync({ sweep: false });

  b.parentId = a.id;
  b.localOffsetX = 4;
  records.tick(0);
  expect(records.group(a)).toEqual(expect.arrayContaining([a, b]));
  expect(records.buckets.get("1,0")?.has(b)).toBe(true);
  expect(saves.dirtyCount).toBe(1);
  await saves.flushAsync({ sweep: false });
  delete b.parentId;
  records.tick(0);
  expect(records.group(a)).toEqual([a]);
  expect(saves.dirtyCount).toBe(1);
  await saves.close();
});

it("sweeps one released scope without encoding the rest of the realm", async () => {
  const { saves, entities, records } = await sweepFixture(40);
  for (const entity of entities.entities) entity.position.wy += 1;
  const far = entities.spawn(createChicken(600, 16));
  await saves.flushAsync({ sweep: false });
  far.position.wy += 1;
  const sweepAll = vi.spyOn(records, "sweepAll");
  records.sweepScope("0,0");
  expect(sweepAll).not.toHaveBeenCalled();
  // Chickens a0–a29 (x < 256) are in 0,0; a30–a39 and the far one are not swept.
  expect(saves.dirtyCount).toBe(30);
  expect(saves.dirtyInScope("2,0")).toBe(false);
  await saves.close();
});

it("keeps each actor's sweep cadence after most of the queue unloads", async () => {
  const { saves, entities, records } = await sweepFixture(100);
  records.tick(0.1); // one credit: fills the queue with all 100 and checks one
  for (const entity of entities.entities.slice(10)) entities.remove(entity.id, false);
  for (const entity of entities.entities) entity.position.wy += 1;
  for (let i = 0; i < SWEEP_SECONDS * 60; i++) records.tick(1 / 60);
  expect(saves.dirtyCount).toBe(10);
  await saves.close();
});

it("retries a sweep-found change after a failed write", async () => {
  const { executor, saves, entities } = await sweepFixture(1);
  required(entities.entities[0]).position.wx = 40;
  executor.beforeCommit = async () => {
    throw new Error("disk full");
  };
  await expect(saves.flushAsync()).rejects.toThrow();
  delete executor.beforeCommit;
  await saves.flushAsync({ sweep: false });
  expect(await saves.store.get("entities", "a0")).toMatchObject({ wx: 40 });
  await saves.close();
});

it("sweeps realms flushed together unless the caller opts out", async () => {
  const one = await sweepFixture(1),
    two = await sweepFixture(1);
  required(one.entities.entities[0]).position.wx = 40;
  required(two.entities.entities[0]).position.wx = 50;
  await SaveManager.flushTogether([one.saves, two.saves], { sweep: false });
  expect(one.saves.hasDirty || two.saves.hasDirty).toBe(false);
  await SaveManager.flushTogether([one.saves, two.saves]);
  expect(await one.saves.store.get("entities", "a0")).toMatchObject({ wx: 40 });
  expect(await two.saves.store.get("entities", "a0")).toMatchObject({ wx: 50 });
  await one.saves.close();
  await two.saves.close();
});

it("script handle edits are marked at once, not left for the sweep", async () => {
  const { saves, entities } = await sweepFixture(1);
  const handle = new EntityHandle(required(entities.entities[0]), entities);
  handle.setFollowing(true);
  expect(saves.dirtyCount).toBe(1);
  await saves.flushAsync({ sweep: false });
  handle.setPosition(20, 20);
  handle.setAITimer(4);
  expect(saves.dirtyCount).toBe(1);
  await saves.flushAsync({ sweep: false });
  expect(await saves.store.get("entities", "a0")).toMatchObject({
    wx: 20,
    state: { wanderAI: { following: true, timer: 4 } },
  });
  await saves.close();
});
