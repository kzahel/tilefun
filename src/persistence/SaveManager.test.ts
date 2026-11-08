import { afterEach, expect, it, vi } from "vitest";
import { MemoryRecordStore } from "./MemoryRecordStore.js";
import { RecordPersistenceStore } from "./RecordPersistenceStore.js";
import { SaveManager } from "./SaveManager.js";
import { WorldStorePool } from "./WorldStorePool.js";

afterEach(() => {
  vi.restoreAllMocks();
});

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

it("coalesces a stable live snapshot without losing mutations across an in-flight write", async () => {
  const executor = new MemoryRecordStore();
  const saves = new SaveManager(new RecordPersistenceStore(executor));
  saves.bind(() => undefined, meta);
  await saves.open();
  let value = 1;
  const snapshot = () => ({ collection: "entities", key: "actor", scope: "0,0", value });
  for (let i = 0; i < 100; i++) saves.markRecordDirty("entities", "actor", snapshot);
  expect(saves.dirtyCount).toBe(1);
  let acknowledge = () => {};
  const blocked = new Promise<void>((resolve) => {
    acknowledge = resolve;
  });
  let entered = () => {};
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  executor.beforeCommit = async () => {
    entered();
    await blocked;
  };
  const flushing = saves.flushAsync();
  await started;
  value = 2;
  saves.markRecordDirty("entities", "actor", snapshot);
  acknowledge();
  await flushing;
  expect((await executor.read("entities", "actor"))?.value).toBe(1);
  expect(saves.hasDirty).toBe(true);
  delete executor.beforeCommit;
  await saves.close();
  expect((await executor.read("entities", "actor"))?.value).toBe(2);
});

it("reads a player's progress before it is written, during a write, and after a refused one", async () => {
  const executor = new MemoryRecordStore(),
    store = new RecordPersistenceStore(executor),
    saves = new SaveManager(store);
  saves.bind(() => undefined, meta);
  await saves.open();
  const player = (gemsCollected: number) => ({
    gemsCollected,
    x: 16,
    y: 32,
    cameraX: 16,
    cameraY: 32,
    cameraZoom: 1,
  });
  saves.markPlayerDirty("host#1", player(2));
  const unsaved = await saves.loadPlayerData("host#1");
  expect(unsaved).toEqual(player(2));
  expect(await executor.read("players", "host#1")).toBeUndefined();

  let acknowledge = () => {};
  const blocked = new Promise<void>((resolve) => {
    acknowledge = resolve;
  });
  executor.beforeCommit = () => blocked;
  saves.markPlayerDirty("host#1", player(3));
  const flushing = saves.flushAsync();
  const loading = saves.loadPlayerData("host#1");
  acknowledge();
  await flushing;
  expect(await loading).toEqual(player(3));
  expect(await saves.loadPlayerData("nobody")).toBeNull();

  // A write that fails puts its players back among the unsaved ones; a read waits for it.
  let fail = (_error: Error) => {};
  const writing = new Promise<void>((entered) => {
    executor.beforeCommit = () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
        entered();
      });
  });
  saves.markPlayerDirty("host#1", player(4));
  saves.flush();
  await writing;
  const reading = saves.loadPlayerData("host#1");
  fail(Error("disk full"));
  expect(await reading).toEqual(player(4));
  expect((await executor.read("players", "host#1"))?.value).toEqual(player(3));
  delete executor.beforeCommit;
  await saves.flushAsync();

  // A save refused before staging returns its players to the unsaved ones only once its
  // failure is handled; a read waits for that instead of reading the older record.
  vi.spyOn(store, "save").mockRejectedValueOnce(Error("Save queue is full"));
  saves.markPlayerDirty("host#1", player(5));
  saves.flush();
  expect(await saves.loadPlayerData("host#1")).toEqual(player(5));
  await saves.flushAsync();
  expect((await executor.read("players", "host#1"))?.value).toEqual(player(5));
});
