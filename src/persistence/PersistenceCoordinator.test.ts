import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "./MemoryRecordStore.js";
import { PersistenceCoordinator, SavePressureError } from "./PersistenceCoordinator.js";
import type { RecordMutation } from "./RecordStore.js";

const put = (key: string, value: unknown, scope = "realm:0,0"): RecordMutation => ({
  put: { collection: "actors", key, scope, revision: 0, value },
});
const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("shared persistence coordination", () => {
  it("retains changes made during a write and owns immutable snapshots", async () => {
    const store = new MemoryRecordStore();
    const gate = deferred();
    store.beforeCommit = () => gate.promise;
    const coordinator = new PersistenceCoordinator(store);
    const value = { x: 1 };
    coordinator.stage([put("a", value)]);
    value.x = 999;
    const saving = coordinator.flush();
    coordinator.stage([put("a", { x: 2 })]);
    expect((await coordinator.read("actors", "a"))?.value).toEqual({ x: 2 });
    expect(store.records.size).toBe(0);
    gate.resolve();
    await saving;
    expect((await store.read("actors", "a"))?.value).toEqual({ x: 2 });
    expect(store.recordsWritten).toBe(2);
    expect(coordinator.dirty).toBe(false);
  });

  it("retries a failed atomic group without losing newer mutations", async () => {
    const store = new MemoryRecordStore();
    const coordinator = new PersistenceCoordinator(store);
    const gate = deferred();
    store.beforeCommit = async () => {
      await gate.promise;
      throw new Error("quota");
    };
    coordinator.stage([put("actor", 1), put("inventory", 1)]);
    const saving = coordinator.flush();
    coordinator.stage([put("actor", 2)]);
    gate.resolve();
    await expect(saving).rejects.toThrow("quota");
    expect(store.records.size).toBe(0);
    expect(coordinator.pendingRecords).toBe(2);
    delete store.beforeCommit;
    await coordinator.flush();
    expect((await store.read("actors", "actor"))?.value).toBe(2);
    expect((await store.read("actors", "inventory"))?.value).toBe(1);
  });

  it("merges indexed moves and deletes without skipping intervening disk records", async () => {
    const store = new MemoryRecordStore();
    await store.commit([put("a", 1), put("b", 2), put("c", 3), put("d", 4)]);
    const coordinator = new PersistenceCoordinator(store);
    coordinator.stage([
      put("a", 1, "realm:1,0"),
      { delete: { collection: "actors", key: "b" } },
      put("z", 26),
    ]);
    expect(
      (await coordinator.scan({ collection: "actors", scope: "realm:0,0", limit: 2 })).map(
        (r) => r.key,
      ),
    ).toEqual(["c", "d"]);
    expect(
      (await coordinator.scan({ collection: "actors", scope: "realm:1,0", limit: 2 })).map(
        (r) => r.key,
      ),
    ).toEqual(["a"]);
    await coordinator.flush();
    expect(await store.read("actors", "b")).toBeUndefined();
  });

  it("rejects entire groups at count/byte limits, including outstanding writes", async () => {
    const store = new MemoryRecordStore();
    const coordinator = new PersistenceCoordinator(store, { records: 2, bytes: 2048 });
    const gate = deferred();
    store.beforeCommit = () => gate.promise;
    coordinator.stage([put("a", 1)]);
    const saving = coordinator.flush();
    expect(() => coordinator.stage([put("b", 2), put("c", 3)])).toThrow(SavePressureError);
    expect(() => coordinator.stage([put("b", new Uint8Array(4096))])).toThrow(SavePressureError);
    expect(coordinator.pendingRecords).toBe(1);
    gate.resolve();
    await saving;
    coordinator.stage([put("b", 2)]);
    await coordinator.close();
    expect(() => coordinator.stage([put("c", 3)])).toThrow("closing");
  });

  it.each([100, 10_000, 100_000])(
    "writes one changed actor with %i stored actors",
    async (count) => {
      const store = new MemoryRecordStore();
      await store.commit(Array.from({ length: count }, (_, i) => put(String(i), { x: i })));
      const coordinator = new PersistenceCoordinator(store);
      coordinator.stage([put("0", { x: 5 })]);
      await coordinator.flush();
      expect(coordinator.metrics.recordsWritten).toBe(1);
      expect(coordinator.metrics.commits).toBe(1);
      expect((await store.read("actors", "1"))?.value).toEqual({ x: 1 });
    },
  );
});

it("reconciles a whole paged scope when moves, deletes and inserts commit during its read", async () => {
  const store = new MemoryRecordStore();
  await store.commit(Array.from({ length: 300 }, (_, i) => put(String(i).padStart(4, "0"), i)));
  const gate = deferred(),
    started = deferred();
  const scan = store.scan.bind(store);
  let first = true;
  store.scan = async (query) => {
    const rows = await scan(query);
    if (first) {
      first = false;
      started.resolve();
      await gate.promise;
    }
    return rows;
  };
  const coordinator = new PersistenceCoordinator(store);
  const loading = coordinator.readScope("actors", "realm:0,0");
  await started.promise;
  coordinator.stage([
    { delete: { collection: "actors", key: "0000" } },
    put("0299", 299, "realm:1,0"),
    put("0000-new", "new"),
  ]);
  await coordinator.flush();
  gate.resolve();
  const rows = await loading;
  expect(rows).toHaveLength(299);
  expect(rows.some((row) => row.key === "0000" || row.key === "0299")).toBe(false);
  expect(rows.find((row) => row.key === "0000-new")?.value).toBe("new");
});

it("returns a newer committed edit instead of an older point-read completion", async () => {
  const store = new MemoryRecordStore();
  await store.commit([put("actor", 1)]);
  const gate = deferred(),
    started = deferred(),
    read = store.read.bind(store);
  store.read = async (collection, key) => {
    const old = await read(collection, key);
    started.resolve();
    await gate.promise;
    return old;
  };
  const coordinator = new PersistenceCoordinator(store);
  const loading = coordinator.read("actors", "actor");
  await started.promise;
  coordinator.stage([put("actor", 2)]);
  await coordinator.flush();
  gate.resolve();
  expect((await loading)?.value).toBe(2);
});
