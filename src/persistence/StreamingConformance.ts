import { createChicken } from "../entities/Chicken.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { around } from "../server/InterestManager.js";
import { RealmStreaming } from "../server/RealmStreaming.js";
import { World } from "../world/World.js";
import type { PersistenceStore } from "./PersistenceStore.js";
import { RealmRecords } from "./RealmRecords.js";
import { SaveManager } from "./SaveManager.js";

function requireState(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Streaming conformance: ${message}`);
}

/** Identical semantic fixture for the actual browser and Node storage adapters. */
export async function streamingConformance(create: () => PersistenceStore, distance = 1000) {
  const open = async () => {
    const saves = new SaveManager(create()),
      entities = new EntityManager(),
      props = new PropManager();
    const world = new World(createGenerator(createDescriptor("flat", 2026)).terrain);
    saves.bind(
      (key) => world.chunks.getChunkDataByKey(key),
      () => ({ playerX: 0, playerY: 0, cameraX: 0, cameraY: 0, cameraZoom: 1 }),
    );
    await saves.open();
    const records = new RealmRecords(entities, props, saves);
    let births = 0;
    const streaming = new RealmStreaming(
      world,
      records,
      props,
      saves,
      () => {},
      () => {},
      (key, seeded) => {
        if (seeded) return;
        const [cx = 0, cy = 0] = key.split(",").map(Number);
        const actor = createChicken(cx * 256 + 128, cy * 256 + 128);
        actor.proceduralId = `origin:${key}`;
        entities.spawn(actor);
        births++;
      },
    );
    const visit = async (cx: number, secondCx?: number) => {
      streaming.interest.set("fixture", [
        { range: around(cx, 0, 0), activity: 2, reason: "player" },
      ]);
      if (secondCx === undefined) streaming.interest.release("second-player");
      else
        streaming.interest.set("second-player", [
          { range: around(secondCx, 0, 0), activity: 2, reason: "player" },
        ]);
      streaming.residency.reconcile(streaming.interest.demand(0));
      await streaming.residency.settle();
      requireState(streaming.residency.ready(`${cx},0`), "destination ready");
      if (secondCx !== undefined)
        requireState(streaming.residency.ready(`${secondCx},0`), "second player destination ready");
    };
    return {
      saves,
      entities,
      props,
      records,
      streaming,
      world,
      visit,
      births: () => births,
      close: async () => {
        await streaming.close();
        await saves.close();
      },
    };
  };
  let f = await open();
  let maxActors = 0,
    maxChunks = 0,
    maxFeatures = 0;
  let parentId: string | undefined, childId: string | undefined, propId: string | undefined;
  try {
    for (let cx = 0; cx < distance; cx++) {
      await f.visit(cx);
      maxActors = Math.max(maxActors, f.entities.entities.length);
      maxChunks = Math.max(maxChunks, f.world.chunks.loadedCount);
      maxFeatures = Math.max(maxFeatures, f.records.features.size);
      requireState(
        f.entities.entities.length === 1 &&
          f.world.chunks.loadedCount === 1 &&
          f.records.features.size === 1,
        "fixed-interest plateau",
      );
    }
    for (let step = 0; step < distance; step++) {
      await f.visit(distance + step, -1 - step);
      requireState(
        f.entities.entities.length === 2 &&
          f.world.chunks.loadedCount === 2 &&
          f.records.features.size === 2 &&
          f.streaming.residency.holders.size === 2,
        "two distant moving players retain only their combined demand",
      );
      requireState(f.saves.store.health.pendingRecords === 0, "travel saves make progress");
    }
    await f.visit(0);
    const parent = f.entities.entities[0];
    requireState(parent, "origin reload");
    parentId = parent.persistentId;
    const child = f.entities.spawn(createChicken(130, 128));
    child.parentId = parent.id;
    child.localOffsetX = 2;
    child.localOffsetY = 0;
    childId = child.persistentId;
    requireState(parent.wanderAI, "chicken AI");
    parent.wanderAI.timer = 7.25;
    parent.velocity = { vx: 15, vy: -4 };
    const prop = createProp("prop-tent-blue", 150, 150);
    prop.proceduralId = "authored-tent";
    f.props.add(prop);
    f.props.move(prop.id, 400, 150);
    prop.spawnTimer = 3.75;
    propId = prop.persistentId;
    parent.position.wx += 256;
    child.position.wx += 256;
    await f.visit(1);
    await f.saves.flushAsync();
  } finally {
    await f.close();
  }
  f = await open();
  try {
    await f.visit(1);
    const parent = f.records.byId.get(parentId ?? ""),
      child = f.records.byId.get(childId ?? ""),
      prop = f.records.byId.get(propId ?? "");
    requireState(
      parent && !("isProp" in parent) && child && !("isProp" in child),
      "stable group identities reopen",
    );
    requireState(
      child.parentId === parent.id && parent.wanderAI?.timer === 7.25 && parent.velocity?.vx === 15,
      "attachment and semantic state",
    );
    requireState(prop && "isProp" in prop && prop.spawnTimer === 3.75, "prop timer continuity");
    f.entities.remove(child.id);
    f.entities.remove(parent.id);
    f.props.remove(prop.id);
    await f.visit(0);
    requireState(
      f.entities.entities.length === 0 && f.births() === 0,
      "moved/deleted actors never respawn at origin",
    );
    await f.visit(1);
    requireState(
      !f.records.byId.has(parentId ?? "") &&
        !f.records.byId.has(childId ?? "") &&
        !f.records.byId.has(propId ?? ""),
      "deletions survive reentry",
    );
    requireState(f.saves.store.health.pendingRecords === 0, "acknowledged eviction drains writes");
  } finally {
    await f.close();
  }
  return {
    chunksVisited: distance,
    distantPlayerSteps: distance,
    totalDistinctChunks: distance * 3,
    maxActors,
    maxChunks,
    maxFeatures,
    stableIdentity: true,
    attachments: true,
    timers: true,
    deletions: true,
  };
}
