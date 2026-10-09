import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { PropManager } from "../entities/PropManager.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { ProceduralActors } from "../generation/ProceduralActors.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RealmRecords } from "../persistence/RealmRecords.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { around } from "../server/InterestManager.js";
import { RealmStreaming } from "../server/RealmStreaming.js";
import { tickAllAI } from "../server/tickAllAI.js";
import { World } from "../world/World.js";
import { createMallard, MALLARD_TYPE } from "./Mallard.js";

it("evicts and returns the same pond flock, including a moved duck, a manual duck and a deletion", async () => {
  const generator = createGenerator(createDescriptor("regional", 2026)),
    world = new World(generator.terrain),
    entities = new EntityManager(),
    props = new PropManager(),
    executor = new MemoryRecordStore(),
    saves = new SaveManager(new RecordPersistenceStore(executor));
  saves.bind(
    (key) => world.chunks.getChunkDataByKey(key),
    () => ({ playerX: 0, playerY: 0, cameraX: 0, cameraY: 0, cameraZoom: 1 }),
  );
  await saves.open();
  const records = new RealmRecords(entities, props, saves),
    deleted = new Set<string>();
  const actors = new ProceduralActors(entities, deleted, () => saves.markMetaDirty());
  actors.persistent = true;
  actors.canGenerate = (id) => !records.features.has(id);
  const streaming = new RealmStreaming(
    world,
    records,
    props,
    saves,
    (features) => {
      for (const f of features) if (f.deleted) deleted.add(f.id);
    },
    (features) => {
      for (const f of features) deleted.delete(f.id);
    },
    (key) => actors.reconcile(generator, [key]),
  );
  const visit = async (cx: number, cy: number, radius = 0) => {
    streaming.interest.set("test", [
      { range: around(cx, cy, radius), activity: 2, reason: "player" },
    ]);
    streaming.residency.reconcile(streaming.interest.demand(0));
    await streaming.residency.settle();
  };
  try {
    await visit(14, -12, 1);
    const flock = () => entities.entities.filter((e) => e.type === MALLARD_TYPE);
    const removed = required(flock()[0]),
      moved = required(flock()[1]);
    const removedIdentity = removed.persistentId;
    entities.remove(removed.id);
    // Move across its origin chunk: revisiting that origin must not seed a duplicate.
    moved.position.wx += 256;
    required(moved.mallard).timer = 3.25;
    const identity = moved.persistentId,
      position = { ...moved.position },
      behavior = JSON.parse(JSON.stringify(moved.mallard));
    const manual = entities.spawn(createMallard(moved.position.wx + 20, moved.position.wy));
    const manualId = manual.persistentId;
    const before = JSON.stringify(moved.mallard);
    tickAllAI(entities.entities, [], new Map(), () => 0.5, {
      canOccupy: () => true,
      isWater: () => false,
    });
    expect(JSON.stringify(moved.mallard)).toBe(before);
    await visit(100, 100);
    expect(flock()).toHaveLength(0);
    await visit(14, -12, 2);
    expect(flock().some((e) => e.persistentId === removedIdentity)).toBe(false);
    const restored = required(flock().find((e) => e.persistentId === identity));
    expect(restored.position).toEqual(position);
    expect(restored.mallard).toEqual(behavior);
    expect(flock().filter((e) => e.proceduralId === moved.proceduralId)).toHaveLength(1);
    expect(flock().some((e) => e.persistentId === manualId)).toBe(true);
    await visit(100, 100);
    await visit(14, -12, 2);
    expect(flock().some((e) => e.persistentId === removedIdentity)).toBe(false);
  } finally {
    await streaming.close();
    await saves.close();
  }
});
