import { EntityManager } from "../../src/entities/EntityManager.js";
import { PropManager } from "../../src/entities/PropManager.js";
import type { GenerationDescriptor } from "../../src/generation/GenerationDescriptor.js";
import { createGenerator } from "../../src/generation/Generator.js";
import { ProceduralActors } from "../../src/generation/ProceduralActors.js";
import { ProceduralProps } from "../../src/generation/ProceduralProps.js";
import { MemoryRecordStore } from "../../src/persistence/MemoryRecordStore.js";
import { RealmRecords } from "../../src/persistence/RealmRecords.js";
import { RecordPersistenceStore } from "../../src/persistence/RecordPersistenceStore.js";
import { SaveManager } from "../../src/persistence/SaveManager.js";
import { around } from "../../src/server/InterestManager.js";
import { RealmStreaming } from "../../src/server/RealmStreaming.js";
import { World } from "../../src/world/World.js";
import { type Coordinate, contentHash, gridArrays, type Sample } from "./report.js";

export async function streamingFixture(descriptor: GenerationDescriptor, verify: boolean) {
  const generator = createGenerator(descriptor),
    world = new World(generator.terrain);
  const saves = new SaveManager(new RecordPersistenceStore(new MemoryRecordStore()));
  saves.bind(
    (key) => world.chunks.getChunkDataByKey(key),
    () => ({ playerX: 0, playerY: 0, cameraX: 0, cameraY: 0, cameraZoom: 1 }),
  );
  await saves.open();
  const entities = new EntityManager(),
    props = new PropManager();
  const records = new RealmRecords(entities, props, saves);
  const proceduralProps = new ProceduralProps(props, () => saves.markMetaDirty());
  proceduralProps.managed = true;
  const proceduralActors = new ProceduralActors(entities, proceduralProps.deleted, () =>
    saves.markMetaDirty(),
  );
  proceduralActors.persistent = true;
  proceduralActors.canGenerate = (id) => !records.features.has(id);
  let phases: Record<string, number> = {},
    published: (Coordinate & { ms: number })[] = [],
    planProps = 0,
    planActors = 0;
  const timed = <T>(name: string, call: () => T) => {
    const start = performance.now();
    try {
      return call();
    } finally {
      phases[name] = (phases[name] ?? 0) + performance.now() - start;
    }
  };
  // Wrap only this fixture's instance methods; no production/global instrumentation.
  const generate = generator.terrain.generate.bind(generator.terrain);
  generator.terrain.generate = (chunk, cx, cy) => timed("terrain", () => generate(chunk, cx, cy));
  const rails = generator.terrain.railPathsForChunk?.bind(generator.terrain);
  if (rails)
    generator.terrain.railPathsForChunk = (cx, cy) => timed("railMetadata", () => rails(cx, cy));
  const placements = generator.placements.bind(generator);
  generator.placements = (cx, cy, processed) => {
    const result = timed("propPlans", () => placements(cx, cy, processed));
    planProps += result.placements.length;
    return result;
  };
  const actors = generator.actors?.bind(generator);
  if (actors)
    generator.actors = (cx, cy) => {
      const result = timed("actorPlans", () => actors(cx, cy));
      planActors += result.length;
      return result;
    };
  const streaming = new RealmStreaming(
    world,
    records,
    props,
    saves,
    () => {},
    () => {},
    (key, seeded) => {
      if (seeded) throw Error("Unseen-chunk benchmark unexpectedly restored a seeded chunk");
      timed("propReconcile", () => {
        proceduralProps.forget(key);
        proceduralProps.reconcile(generator, [key]);
      });
      timed("actorReconcile", () => proceduralActors.reconcile(generator, [key]));
    },
  );
  const publish = streaming.residency.hooks.publish;
  streaming.residency.hooks.publish = (key, payload) => {
    const start = performance.now();
    publish(key, payload);
    const ms = performance.now() - start;
    const [cx = 0, cy = 0] = key.split(",").map(Number);
    published.push({ cx, cy, ms });
  };
  const loaded = new Set<string>();
  return {
    async visit(coordinates: Coordinate[]): Promise<Sample> {
      const first = coordinates[0];
      if (!first) throw Error("Empty streaming batch");
      for (const c of coordinates) {
        const key = `${c.cx},${c.cy}`;
        if (loaded.has(key)) throw Error(`Repeated streaming chunk ${key}`);
        loaded.add(key);
      }
      // Retain prior batches deliberately: no save/eviction contamination of admission timing.
      const demand = [...loaded].map((key) => {
        const [cx = 0, cy = 0] = key.split(",").map(Number);
        return { range: around(cx, cy, 0), activity: 0 as const, reason: "arrival" as const };
      });
      phases = {};
      published = [];
      planProps = 0;
      planActors = 0;
      const beforeProps = props.props.length,
        beforeActors = entities.entities.length;
      const start = performance.now();
      streaming.interest.set("bench", demand);
      streaming.residency.reconcile(streaming.interest.demand(0));
      await streaming.residency.settle();
      const end = performance.now();
      if (streaming.residency.error) throw streaming.residency.error;
      if (published.length !== coordinates.length || world.chunks.loadedCount !== loaded.size)
        throw Error("Streaming benchmark did not admit every requested chunk");
      const terrain = phases.terrain ?? 0,
        railMetadata = phases.railMetadata ?? 0,
        propPlans = phases.propPlans ?? 0,
        actorPlans = phases.actorPlans ?? 0;
      const propReconcile = phases.propReconcile ?? 0,
        actorReconcile = phases.actorReconcile ?? 0;
      const publishMs = published.reduce((a, b) => a + b.ms, 0);
      const chunks = coordinates.map(({ cx, cy }) => {
        const chunk = world.chunks.get(cx, cy);
        if (!chunk) throw Error("Missing published chunk");
        return chunk;
      });
      const sample = {
        ...first,
        coordinates,
        chunks: coordinates.length,
        props: props.props.length - beforeProps,
        actors: entities.entities.length - beforeActors,
        planProps,
        planActors,
        residentChunks: loaded.size,
        gridBytes: chunks.reduce(
          (n, c) => n + gridArrays(c).reduce((s, a) => s + a.byteLength, 0),
          0,
        ),
        totalMs: end - start,
        publications: published,
        phasesMs: {
          terrain,
          railMetadata,
          propPlans,
          actorPlans,
          propAdmission: propReconcile - propPlans,
          actorAdmission: actorReconcile - actorPlans,
          publishOther: publishMs - terrain - railMetadata - propReconcile - actorReconcile,
          outsidePublish: end - start - publishMs,
        },
        ...(verify ? { contentHash: chunks.map((c) => contentHash(c, [], [])).join(":") } : {}),
      };
      return sample;
    },
    async close() {
      await streaming.close();
      await saves.close();
    },
  };
}
