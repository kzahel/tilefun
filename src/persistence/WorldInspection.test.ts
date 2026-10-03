import { expect, it } from "vitest";
import { MemoryRecordStore } from "./MemoryRecordStore.js";
import { RecordPersistenceStore } from "./RecordPersistenceStore.js";
import { readInspection } from "./WorldInspection.js";

it("suppresses a generated preview actor whose tombstone belongs to a distant birth chunk", async () => {
  const store = new RecordPersistenceStore(new MemoryRecordStore());
  await store.open();
  const id = "settlement:0:0:crossing:walker";
  await store.save([
    {
      collection: "features",
      key: id,
      scope: "100,100",
      value: {
        id,
        scope: "100,100",
        deleted: true,
        actor: true,
      },
    },
  ]);
  const snapshot = await readInspection(
    store,
    {
      type: "regional",
      version: "regional-v5",
      seed: 2026,
      preset: "temperate-v1",
    },
    [],
    { minX: 280, minY: 499, maxX: 320, maxY: 539 },
  );
  expect(snapshot.deleted).toContain(id);
  await store.close();
});
