import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { RoadType } from "../road/RoadType.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { World } from "../world/World.js";
import { RailwayPlanner } from "./RailwayPlanner.js";
import { RailwayStrategy } from "./RailwayStrategy.js";
import { RailwaySystem } from "./RailwaySystem.js";
import bank from "./rail-local-v1.json" with { type: "json" };
import { createTrain } from "./Train.js";

async function fixture() {
  const strategy = new RailwayStrategy(regionalWorld(2026));
  const line = required(strategy.railways.owner(2, -3));
  const world = new World(strategy),
    entities = new EntityManager(),
    props = new PropManager();
  const executor = new MemoryRecordStore();
  const saves = new SaveManager(new RecordPersistenceStore(executor));
  saves.bind(
    () => undefined,
    () => ({ playerX: 0, playerY: 0, cameraX: 0, cameraY: 0, cameraZoom: 1 }),
  );
  await saves.open();
  const system = new RailwaySystem(strategy.railways, world, entities, props, saves);
  const player = entities.spawn(createPlayer(line.start * 16, (line.y - 4) * 16));
  system.update([player]);
  await system.settle();
  if (system.error) throw system.error;
  const service = required(system.services.get(line.id));
  function tick(dt = 1) {
    const r = system.range(service);
    for (let y = r.minCy; y <= r.maxCy; y++)
      for (let x = r.minCx; x <= r.maxCx; x++) world.getChunk(x, y);
    system.tick(dt, () => true);
  }
  return { strategy, line, world, entities, props, saves, system, player, service, tick, executor };
}
describe("generated railway", () => {
  it("finds deterministic dry services with platforms and a continuous two-row track across chunk seams", () => {
    for (const seed of [42, 2026, 3, 100]) {
      const a = new RailwayPlanner(regionalWorld(seed));
      expect(a.start()).toBeDefined();
      expect(a.start()).toEqual(new RailwayPlanner(regionalWorld(seed)).start());
    }
    const strategy = new RailwayStrategy(regionalWorld(2026)),
      world = new World(strategy);
    const line = required(strategy.railways.owner(2, -3));
    expect(strategy.railways.owner(3, -3)).toBe(line);
    for (let x = line.bounds.minX; x < line.bounds.maxX; x++) {
      world.getChunk(Math.floor(x / 16), Math.floor((line.y - 1) / 16));
      world.getChunk(Math.floor(x / 16), Math.floor(line.y / 16));
      expect(world.getRoadAt(x, line.y - 1)).toBe(RoadType.RailHorizontalTop);
      expect(world.getRoadAt(x, line.y)).toBe(RoadType.RailHorizontalBottom);
      expect(world.getHeightAt(x, line.y)).toBe(0);
    }
    for (const station of line.stations) {
      world.getChunk(Math.floor(station.x / 16), Math.floor((station.y - 4) / 16));
      expect(world.getRoadAt(station.x, station.y - 4)).toBe(RoadType.CityPavement);
    }
  });
  it("pins the accepted horizontal train and includes its nose in adjacent-cell collision queries", () => {
    const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
    expect(hash(`public/${bank.image}`)).toBe(bank.sha256);
    expect(hash("public/assets/tilesets/railway-review-v1.png")).toBe(bank.sourceSha256);
    const entities = new EntityManager(),
      train = entities.spawn(createTrain(255, 100));
    expect(entities.spatialHash.queryRange(1, 0, 1, 0)).toContain(train);
    expect(entities.spatialHash.queryRange(0, 0, 1, 0).filter((e) => e === train)).toHaveLength(1);
    expect(deserializeEntity(serializeEntity(train)).collider).toEqual(train.collider);
    entities.remove(train.id, false);
    expect(entities.spatialHash.queryRange(1, 0, 1, 0)).not.toContain(train);
  });
  it("stops at both stations, reverses without mirroring, and pauses before unready chunks or children", async () => {
    const f = await fixture();
    for (let i = 0; i < 7; i++) f.tick();
    expect(f.service.entity.position.wx).toBe(f.line.start * 16);
    f.system.tick(1, () => false);
    expect(f.service.entity.position.wx).toBe(f.line.start * 16);
    let reachedEast = false,
      reachedWest = false;
    for (let i = 0; i < 220; i++) {
      f.tick();
      if (f.service.record.target === 0 && f.service.record.dwell > 0) reachedEast = true;
      if (reachedEast && f.service.record.target === 1 && f.service.record.dwell > 0) {
        reachedWest = true;
        break;
      }
    }
    expect(reachedEast && reachedWest).toBe(true);
    expect(f.service.entity.sprite?.flipX).toBe(false);
    f.player.position = { wx: f.line.start * 16 + 300, wy: f.line.y * 16 };
    f.entities.spatialHash.update(f.player);
    for (let i = 0; i < 20; i++) f.tick();
    expect(f.service.speed).toBe(0);
    expect(f.service.entity.position.wx).toBeLessThan(f.player.position.wx - 224);
    await f.system.close();
    await f.saves.close();
  }, 30000);
  it("persists one service through retirement, either station's observer, reload and explicit deletion", async () => {
    const f = await fixture();
    for (let i = 0; i < 12; i++) f.tick();
    const x = f.service.entity.position.wx;
    f.system.update([]);
    await f.system.settle();
    expect(f.system.services.size).toBe(0);
    f.player.position = { wx: f.line.end * 16, wy: (f.line.y - 4) * 16 };
    f.system.update([f.player, f.player]);
    await f.system.settle();
    const restored = required(f.system.services.get(f.line.id));
    expect(restored.entity.position.wx).toBe(x);
    expect(f.entities.entities.filter((e) => e.type === "train-local-v1")).toHaveLength(1);
    f.entities.remove(restored.entity.id, true);
    f.system.update([]);
    await f.system.settle();
    f.system.update([f.player]);
    await f.system.settle();
    expect(f.entities.entities.filter((e) => e.type === "train-local-v1")).toHaveLength(0);
    await f.system.close();
    await f.saves.close();
  });
  it("retains a train after a failed retirement write and restores committed state in a fresh controller", async () => {
    const f = await fixture();
    for (let i = 0; i < 12; i++) f.tick();
    const x = f.service.entity.position.wx;
    f.executor.beforeCommit = async () => {
      throw Error("disk unavailable");
    };
    f.system.update([]);
    await f.system.settle();
    expect(f.system.services.size).toBe(1);
    expect(f.entities.entities).toContain(f.service.entity);
    delete f.executor.beforeCommit;
    await f.system.close();
    await f.saves.close();
    const saves = new SaveManager(new RecordPersistenceStore(f.executor));
    saves.bind(
      () => undefined,
      () => ({ playerX: 0, playerY: 0, cameraX: 0, cameraY: 0, cameraZoom: 1 }),
    );
    await saves.open();
    const entities = new EntityManager();
    const system = new RailwaySystem(
      f.strategy.railways,
      f.world,
      entities,
      new PropManager(),
      saves,
    );
    system.update([f.player]);
    await system.settle();
    expect(system.error).toBeUndefined();
    expect(entities.entities).toHaveLength(1);
    expect(entities.entities[0]?.position.wx).toBe(x);
    await system.close();
    await saves.close();
  });
  it("stops when edited track no longer supports the full body", async () => {
    const f = await fixture();
    f.tick();
    const tx = f.line.start + 10,
      ty = f.line.y;
    f.world
      .getChunk(Math.floor(tx / 16), Math.floor(ty / 16))
      .setRoad(((tx % 16) + 16) % 16, ((ty % 16) + 16) % 16, 0);
    for (let i = 0; i < 15; i++) f.tick();
    expect(f.service.entity.position.wx).toBe(f.line.start * 16);
    await f.system.close();
    await f.saves.close();
  });
});

it("replicates independent carriage geometry and contiguous crops from the unchanged train bank", async () => {
  const { TRAIN_CARRIAGES, createTrainCarriages } = await import("./Train.js");
  const cars = createTrainCarriages(0, 0, [0, 12, 36]);
  for (const [i, car] of cars.entries()) {
    const copy = deserializeEntity(serializeEntity(car));
    expect(copy.wz).toBe([0, 12, 36][i]);
    expect(copy.sprite?.sheetKey).toBe(car.type);
    expect(copy.sprite?.spriteWidth).toBe(car.sprite?.spriteWidth);
    expect(copy.collider).toEqual(car.collider);
  }
  expect(TRAIN_CARRIAGES.map((c) => [c.x, c.width])).toEqual([
    [0, 136],
    [136, 160],
    [296, 160],
  ]);
  expect(TRAIN_CARRIAGES.reduce((n, c) => n + c.width, 0)).toBe(bank.width);
});
