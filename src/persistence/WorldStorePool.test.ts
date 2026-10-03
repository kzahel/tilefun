import { expect, it } from "vitest";
import { MemoryRecordStore } from "./MemoryRecordStore.js";
import { RecordPersistenceStore } from "./RecordPersistenceStore.js";
import { WorldStorePool } from "./WorldStorePool.js";

it("shares one writer across outdoor/interior leases, separates namespaces, and closes after the last owner", async () => {
  let created = 0,
    closed = 0;
  const executor = new MemoryRecordStore();
  executor.close = async () => {
    closed++;
  };
  const pool = new WorldStorePool(() => {
    created++;
    return new RecordPersistenceStore(executor);
  });
  const outdoor = pool.realm("world"),
    indoor = pool.realm("interior", "world");
  await Promise.all([outdoor.open(), indoor.open(), indoor.open()]);
  expect(created).toBe(1);
  expect(outdoor.physical).toBe(indoor.physical);
  await outdoor.save([{ collection: "entities", key: "one", scope: "0,0", value: "outside" }]);
  await indoor.save([{ collection: "entities", key: "one", scope: "0,0", value: "inside" }]);
  expect(await outdoor.get("entities", "one")).toBe("outside");
  expect(await indoor.get("entities", "one")).toBe("inside");
  await outdoor.close();
  expect(closed).toBe(0);
  await indoor.close();
  expect(closed).toBe(1);
  expect(pool.openWorlds).toBe(0);
  await outdoor.open();
  expect(await outdoor.get("entities", "one")).toBe("outside");
  await outdoor.close();
});

it("retains the final lease when close fails and permits a durable retry", async () => {
  const executor = new MemoryRecordStore(),
    store = new RecordPersistenceStore(executor);
  const pool = new WorldStorePool(() => store),
    lease = pool.realm("world");
  await lease.open();
  store.coordinator.stage([{ put: { collection: "entities", key: "one", revision: 0, value: 1 } }]);
  executor.beforeCommit = async () => {
    throw Error("quota");
  };
  await expect(lease.close()).rejects.toThrow("quota");
  expect(pool.openWorlds).toBe(1);
  expect(await lease.get("entities", "one")).toBe(1);
  delete executor.beforeCommit;
  await lease.close();
  expect(pool.openWorlds).toBe(0);
  expect((await executor.read("entities", "one"))?.value).toBe(1);
});
