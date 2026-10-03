import { expect, it } from "vitest";
import { MemoryRecordStore } from "./MemoryRecordStore.js";
import { RecordPersistenceStore } from "./RecordPersistenceStore.js";
import { SaveManager } from "./SaveManager.js";
import { WorldStorePool } from "./WorldStorePool.js";

const meta = () => ({ playerX: 0, playerY: 0, cameraX: 0, cameraY: 0, cameraZoom: 1 });
const dirty = (saves: SaveManager, value: number) =>
  saves.markRecordDirty("entities", "actor", () => ({
    collection: "entities",
    key: "actor",
    scope: "0,0",
    value,
  }));

it("uses a finite flush barrier while newer live mutations remain dirty", async () => {
  const executor = new MemoryRecordStore(),
    saves = new SaveManager(new RecordPersistenceStore(executor));
  saves.bind(() => undefined, meta);
  await saves.open();
  let acknowledge = () => {};
  const blocked = new Promise<void>((resolve) => {
    acknowledge = resolve;
  });
  let started = () => {};
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  executor.beforeCommit = async () => {
    started();
    await blocked;
  };
  dirty(saves, 1);
  const flushing = saves.flushAsync();
  await entered;
  dirty(saves, 2);
  acknowledge();
  await flushing;
  expect(saves.hasDirty).toBe(true);
  expect((await executor.read("entities", "actor"))?.value).toBe(1);
  delete executor.beforeCommit;
  await saves.close();
  expect((await executor.read("entities", "actor"))?.value).toBe(2);
});

it("atomically commits and retries related outdoor/interior snapshots on the shared world writer", async () => {
  const executor = new MemoryRecordStore();
  const pool = new WorldStorePool(() => new RecordPersistenceStore(executor));
  const outside = new SaveManager(pool.realm("world"));
  const inside = new SaveManager(pool.realm("room", "world"));
  for (const saves of [outside, inside]) {
    saves.bind(() => undefined, meta);
    await saves.open();
  }
  dirty(outside, 1);
  dirty(inside, 2);
  executor.beforeCommit = async () => {
    throw new Error("quota");
  };
  await expect(SaveManager.flushTogether([outside, inside])).rejects.toThrow("transfer");
  expect(await outside.store.get("entities", "actor")).toBe(1); // pending view
  expect(await executor.read("entities", "actor")).toBeUndefined();
  expect(outside.hasDirty && inside.hasDirty).toBe(true);
  delete executor.beforeCommit;
  const before = executor.commits;
  await SaveManager.flushTogether([outside, inside]);
  expect(executor.commits - before).toBe(1);
  expect(await inside.store.get("entities", "actor")).toBe(2);
  await outside.close();
  await inside.close();
});

it("pauses mutation producers under slow or failed storage and resumes after acknowledgement", async () => {
  const executor = new MemoryRecordStore(),
    saves = new SaveManager(new RecordPersistenceStore(executor));
  saves.bind(() => undefined, meta);
  await saves.open();
  for (let i = 0; i < 2048; i++)
    saves.markRecordDirty("entities", String(i), () => ({
      collection: "entities",
      key: String(i),
      scope: "0,0",
      value: i,
    }));
  expect(saves.pressured).toBe(true);
  executor.beforeCommit = async () => {
    throw Error("disk full");
  };
  await expect(saves.flushAsync()).rejects.toThrow("Could not save");
  expect(saves.pressured).toBe(true);
  expect(saves.dirtyCount).toBe(2048);
  delete executor.beforeCommit;
  await saves.flushAsync();
  expect(saves.pressured).toBe(false);
  expect(executor.records.size).toBe(2049);
  await saves.close();
});
