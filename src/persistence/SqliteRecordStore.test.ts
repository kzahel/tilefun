import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { PersistenceCoordinator } from "./PersistenceCoordinator.js";
import type { StoredRecord } from "./RecordStore.js";
import { SqliteRecordStore } from "./SqliteRecordStore.js";

it("SQLite persists indexed records, rolls back batches and holds a process-safe writer lease", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tilefun-records-"));
  const store = new SqliteRecordStore(directory);
  const second = new SqliteRecordStore(directory);
  const record: StoredRecord = {
    collection: "actors",
    key: "a",
    scope: "world:0,0",
    revision: 1,
    value: { bytes: new Uint8Array([1, 2, 3]), position: { x: 12 } },
  };
  try {
    await store.open();
    await expect(second.open()).rejects.toThrow(/locked/);
    await store.commit([{ put: record }]);
    await expect(
      store.commit([
        { put: { ...record, key: "b" } },
        { put: { ...record, key: undefined as unknown as string } },
      ]),
    ).rejects.toThrow();
    expect(await store.read("actors", "b")).toBeUndefined();
    const coordinator = new PersistenceCoordinator(store);
    coordinator.stage([{ put: { ...record, scope: "world:1,0" } }]);
    await coordinator.close();
    await second.open();
    expect(await second.scan({ collection: "actors", scope: "world:0,0", limit: 16 })).toEqual([]);
    const loaded = await second.scan({ collection: "actors", scope: "world:1,0", limit: 16 });
    expect(loaded[0]?.value).toEqual(record.value);
    await second.commit([{ delete: { collection: "actors", key: "a" } }]);
    expect(await second.read("actors", "a")).toBeUndefined();
  } finally {
    await store.close();
    await second.close();
    await rm(directory, { recursive: true, force: true });
  }
});
