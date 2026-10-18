import { expect, it } from "vitest";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { EntityManager } from "../entities/EntityManager.js";
import { PropManager } from "../entities/PropManager.js";
import { withLivedInLayout } from "../interiors/BuildingDoors.js";
import { indoorResidents } from "../interiors/IndoorResidents.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RealmRecords } from "../persistence/RealmRecords.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { WorldStorePool } from "../persistence/WorldStorePool.js";
import type { Realm } from "./Realm.js";
import { transferResident } from "./ResidentTransfer.js";

function required<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error("Missing fixture value");
  return value;
}

async function setup() {
  const executor = new MemoryRecordStore();
  const pool = new WorldStorePool(() => new RecordPersistenceStore(executor));
  const identity = withLivedInLayout(
    {
      version: "interior-v1",
      parentWorldId: "world",
      featureId: "settlement:0:0:block:0:0:lot:0",
      buildingType: "prop-city-dense-v1-butcher-2",
      floor: 0,
      returnX: 0,
      returnY: 0,
    },
    { wx: 0, wy: 0 },
  );
  const make = async (id: string) => {
    const entities = new EntityManager(),
      props = new PropManager();
    const saves = new SaveManager(pool.realm(id, "world"));
    saves.bind(
      () => undefined,
      () => ({ playerX: 0, playerY: 0, cameraX: 0, cameraY: 0, cameraZoom: 1 }),
    );
    await saves.open();
    const records = new RealmRecords(entities, props, saves);
    return {
      entityManager: entities,
      saveManager: saves,
      records,
      interior: id === "room" ? identity : null,
      residentCanOccupy: () => true,
    } as unknown as Realm & { saveManager: SaveManager };
  };
  const inside = await make("room"),
    outside = await make("world");
  const p = required(indoorResidents(identity).find((p) => p.featureId.endsWith(":visitor")));
  const actor = required(ENTITY_FACTORIES[p.type])(p.wx, p.wy);
  actor.persistentId = p.featureId;
  actor.proceduralId = p.featureId;
  actor.resident = structuredClone(required(p.resident));
  inside.entityManager.spawn(actor);
  return {
    executor,
    inside,
    outside,
    actor,
    close: async () => {
      await inside.saveManager.close();
      await outside.saveManager.close();
    },
  };
}

it("moves one saved NPC through both realms atomically and restores its identity after reload", async () => {
  const f = await setup();
  try {
    await transferResident(f.inside, f.outside, f.actor, { wx: 1000, wy: 1000 });
    expect(f.inside.entityManager.entities).toHaveLength(0);
    const traveler = required(f.outside.entityManager.entities[0]);
    expect(traveler.persistentId).toBe(f.actor.persistentId);
    expect(traveler.resident?.place).toBe("outside");
    expect(
      await f.inside.saveManager.store.get("entities", required(f.actor.persistentId)),
    ).toBeUndefined();
    const saved = await f.outside.saveManager.store.get("entities", required(f.actor.persistentId));
    const restored = new EntityManager();
    const records = new RealmRecords(restored, new PropManager(), f.outside.saveManager);
    records.restore([
      saved as Parameters<RealmRecords["restore"]>[0] extends Iterable<infer R> ? R : never,
    ]);
    expect(restored.entities[0]?.resident?.place).toBe("outside");
    await transferResident(f.outside, f.inside, traveler, { wx: 72, wy: 248 });
    expect(f.outside.entityManager.entities).toHaveLength(0);
    expect(f.inside.entityManager.entities[0]?.persistentId).toBe(f.actor.persistentId);
    expect(f.inside.entityManager.entities[0]?.resident?.place).toBe("inside");
    expect(f.inside.records?.features.has(required(f.actor.proceduralId))).toBe(true);
  } finally {
    await f.close();
  }
});

it("a failed doorway commit leaves the original NPC at its source, with no durable duplicate", async () => {
  const f = await setup();
  try {
    await SaveManager.flushTogether([f.inside.saveManager, f.outside.saveManager]);
    f.executor.beforeCommit = async (mutations) => {
      if (mutations.some((m) => "delete" in m)) throw new Error("door commit rejected");
    };
    await expect(
      transferResident(f.inside, f.outside, f.actor, { wx: 1000, wy: 1000 }),
    ).rejects.toThrow("door commit rejected");
    expect(f.inside.entityManager.entities).toContain(f.actor);
    expect(f.outside.entityManager.entities).toHaveLength(0);
    expect(f.actor.resident?.transferring).toBeUndefined();
    // Retry the exact atomic group, rather than publishing a partial destination.
    delete f.executor.beforeCommit;
    await transferResident(f.inside, f.outside, f.actor, { wx: 1000, wy: 1000 });
    expect(f.inside.entityManager.entities).toHaveLength(0);
    expect(f.outside.entityManager.entities).toHaveLength(1);
  } finally {
    delete f.executor.beforeCommit;
    await f.close();
  }
});

it("replaces rejected transfer intents before an unrelated producer retries storage", async () => {
  const f = await setup();
  try {
    await SaveManager.flushTogether([f.inside.saveManager, f.outside.saveManager]);
    f.executor.beforeCommit = async (mutations) => {
      if (mutations.some((m) => "delete" in m)) throw new Error("offline");
    };
    await expect(
      transferResident(f.inside, f.outside, f.actor, { wx: 1000, wy: 1000 }),
    ).rejects.toThrow("offline");
    delete f.executor.beforeCommit;
    await f.outside.saveManager.store.save([
      { collection: "features", key: "unrelated", value: { id: "unrelated" } },
    ]);
    expect(
      await f.inside.saveManager.store.get("entities", required(f.actor.persistentId)),
    ).toBeDefined();
    expect(
      await f.outside.saveManager.store.get("entities", required(f.actor.persistentId)),
    ).toBeUndefined();
    expect(f.inside.entityManager.entities).toContain(f.actor);
    expect(f.outside.entityManager.entities).toHaveLength(0);
  } finally {
    delete f.executor.beforeCommit;
    await f.close();
  }
});

it("an occupied arrival leaves the NPC waiting at the source", async () => {
  const f = await setup();
  try {
    f.outside.residentCanOccupy = () => false;
    await expect(
      transferResident(f.inside, f.outside, f.actor, { wx: 1000, wy: 1000 }),
    ).rejects.toThrow("occupied");
    expect(f.inside.entityManager.entities).toContain(f.actor);
    expect(f.actor.resident?.phase).toBe("act");
    expect(f.actor.resident?.transferring).toBeUndefined();
    expect(f.outside.entityManager.entities).toHaveLength(0);
  } finally {
    await f.close();
  }
});
