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
import { createFrog, FROG_TYPE } from "./Frog.js";
import { createMallard, MALLARD_TYPE } from "./Mallard.js";
import { createRabbit, RABBIT_TYPE } from "./Rabbit.js";
import { createRobin, ROBIN_TYPE } from "./Robin.js";

it.each([
  {
    name: "robins",
    type: ROBIN_TYPE,
    create: createRobin,
    component: "robin" as const,
    cx: -11,
    cy: -33,
  },
  {
    name: "ducks",
    type: MALLARD_TYPE,
    create: createMallard,
    component: "mallard" as const,
    cx: 14,
    cy: -12,
  },
  {
    name: "frogs",
    type: FROG_TYPE,
    create: createFrog,
    component: "frog" as const,
    cx: 14,
    cy: -12,
  },
  {
    name: "rabbits",
    type: RABBIT_TYPE,
    create: createRabbit,
    component: "rabbit" as const,
    cx: -10,
    cy: -34,
  },
])(
  "evicts and returns the same $name, retaining movement, manual animals and deletion",
  async (animal) => {
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
      // Cross-chunk origin receipts can become dirty during concurrent releases.
      // Production reconciles every tick. Drain bounded save batches for all 25
      // old owner chunks, plus any follow-up dirty-origin reconciliation.
      for (let i = 0; i < 8; i++) {
        streaming.residency.reconcile(streaming.interest.demand(0));
        await streaming.residency.settle();
      }
    };
    try {
      await visit(animal.cx, animal.cy, 2);
      const flock = () => entities.entities.filter((e) => e.type === animal.type);
      const removed = required(flock()[0]),
        moved = required(flock()[1]);
      const removedIdentity = removed.persistentId;
      entities.remove(removed.id);
      // Move across its origin chunk: revisiting that origin must not seed a duplicate.
      moved.position.wx += Math.floor(moved.position.wx / 256) >= animal.cx + 2 ? -256 : 256;
      required(moved[animal.component]).timer = 3.25;
      const identity = moved.persistentId,
        position = { ...moved.position },
        behavior = JSON.parse(JSON.stringify(moved[animal.component]));
      const manual = entities.spawn(animal.create(moved.position.wx + 20, moved.position.wy));
      const manualId = manual.persistentId;
      const before = JSON.stringify(moved[animal.component]);
      tickAllAI(entities.entities, [], new Map(), () => 0.5, {
        canOccupy: () => true,
        isWater: () => false,
      });
      expect(JSON.stringify(moved[animal.component])).toBe(before);
      const localIds = new Set(flock().map((e) => e.persistentId));
      await visit(100, 100);
      expect(flock().some((e) => localIds.has(e.persistentId))).toBe(false);
      await visit(animal.cx, animal.cy, 2);
      expect(flock().some((e) => e.persistentId === removedIdentity)).toBe(false);
      const restored = required(flock().find((e) => e.persistentId === identity));
      expect(restored.position).toEqual(position);
      expect(restored[animal.component]).toEqual(behavior);
      expect(flock().filter((e) => e.proceduralId === moved.proceduralId)).toHaveLength(1);
      expect(flock().some((e) => e.persistentId === manualId)).toBe(true);
      await visit(100, 100);
      await visit(animal.cx, animal.cy, 2);
      expect(flock().some((e) => e.persistentId === removedIdentity)).toBe(false);
    } finally {
      await streaming.close();
      await saves.close();
    }
  },
);
