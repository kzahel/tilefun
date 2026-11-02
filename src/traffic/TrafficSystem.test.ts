import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { CURRENT_REGIONAL_VERSION } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { World } from "../world/World.js";
import { buildLaneGraph, samplePath } from "./LaneGraph.js";
import { TrafficStrategy } from "./TrafficNetwork.js";
import { TrafficSystem } from "./TrafficSystem.js";
import { applyVehicleFacing, createVehicle, VEHICLE_BANK } from "./Vehicle.js";

function fixture() {
  const segments = [
    { a: { x: 0, y: 0 }, b: { x: 40, y: 0 }, width: 8, intercity: false },
    { a: { x: 40, y: 0 }, b: { x: 40, y: 40 }, width: 8, intercity: false },
    { a: { x: 0, y: 40 }, b: { x: 40, y: 40 }, width: 8, intercity: false },
    { a: { x: 0, y: 0 }, b: { x: 0, y: 40 }, width: 8, intercity: false },
  ];
  const graph = buildLaneGraph(segments),
    strategy = new TrafficStrategy(regionalWorld(2026));
  strategy.trafficNetwork = () => graph;
  const world = new World(strategy);
  world.getRoadAt = () => 5;
  for (let y = -1; y <= 3; y++) for (let x = -1; x <= 3; x++) world.getChunk(x, y);
  const entities = new EntityManager(),
    props = new PropManager(),
    traffic = new TrafficSystem(world, entities, props, strategy);
  const lane = required([...graph.lanes.values()].find((l) => l.direction === Direction.Right));
  const car = traffic.add("compact-1", lane, 40);
  const player = entities.spawn(
    createPlayer(car.entity.position.wx + 110, car.entity.position.wy + 3),
  );
  player.wz = 0;
  return { graph, traffic, car, player, world, entities };
}
describe("generated road traffic", () => {
  it("pins all 180 approved snapshots and reconstructs directional collision on both snapshot and delta", () => {
    expect(VEHICLE_BANK.views).toHaveLength(180);
    const car = createVehicle("bus-1", 30, 40),
      old = serializeEntity(car),
      client = deserializeEntity(old);
    expect(client.collider).toEqual(car.collider);
    applyVehicleFacing(car, Direction.Down);
    applyEntityDelta(client, required(diffEntitySnapshots(old, serializeEntity(car))));
    expect(client.collider).toEqual(car.collider);
    expect(client.noShadow).toBe(true);
  });
  it("provides a connected semantic traffic network in the current generator", () => {
    const descriptor = {
      type: "regional",
      version: CURRENT_REGIONAL_VERSION,
      seed: 2026,
      preset: "temperate-v1",
    } as const;
    const strategy = createGenerator(descriptor).terrain as TrafficStrategy;
    const graph = strategy.trafficNetwork(300 * 16, 519 * 16);
    expect(graph.lanes.size).toBeGreaterThan(50);
    expect([...graph.lanes.values()].some((l) => l.intercity)).toBe(true);
    for (const lane of graph.lanes.values())
      expect(samplePath(lane.path, 0).direction).toBe(lane.direction);
  });

  it("restores exact route position safely and rebuilds junction ownership", () => {
    const f = fixture();
    f.player.position = { wx: 2000, wy: 2000 };
    for (let i = 0; i < 850; i++) f.traffic.tick(1 / 60, []);
    const records = f.traffic.save(),
      positions = [...f.traffic.states.values()].map((s) => ({ ...s.entity.position }));
    const restored = new TrafficSystem(
      f.world,
      new EntityManager(),
      new PropManager(),
      f.traffic.strategy,
    );
    restored.restore(records);
    expect([...restored.states.values()].map((s) => s.entity.position)).toEqual(positions);
    expect([...restored.states.values()].map((s) => s.speed)).toEqual(
      records.map((record) => record.speed),
    );
    expect(restored.save()).toEqual(records);
  });
  it("does not ignore a jumping player below the roof or drive onto edited/unloaded road", () => {
    const f = fixture();
    f.player.wz = 12;
    for (let i = 0; i < 500; i++) f.traffic.tick(1 / 60, []);
    expect(f.car.speed).toBe(0);
    f.player.position.wx += 500;
    f.world.getRoadAt = () => 0;
    const before = { ...f.car.entity.position };
    for (let i = 0; i < 120; i++) f.traffic.tick(1 / 60, []);
    expect(f.car.entity.position).toEqual(before);
  });

  it("queues competing cars at a junction without overlap and releases it after exit", () => {
    const f = fixture();
    f.player.position = { wx: 2000, wy: 2000 };
    f.entities.spatialHash.update(f.player);
    const lane = required(
      [...f.graph.lanes.values()].find((l) => l.to === f.car.lane.to && l.id !== f.car.lane.id),
    );
    const second = f.traffic.add("bus-1", lane, Math.max(0, lane.path.length - 110));
    f.car.distance = f.car.lane.path.length - 110;
    const p = samplePath(f.car.lane.path, f.car.distance);
    f.car.entity.position = { wx: p.x, wy: p.y };
    f.entities.spatialHash.update(f.car.entity);
    let waiting = 0;
    for (let i = 0; i < 4000; i++) {
      f.traffic.tick(1 / 60, []);
      if (f.car.waiting === "junction" || second.waiting === "junction") waiting++;
      const a = required(f.car.entity.collider),
        b = required(second.entity.collider);
      const dx = Math.abs(f.car.entity.position.wx - second.entity.position.wx);
      const dy = Math.abs(f.car.entity.position.wy - second.entity.position.wy);
      expect(dx >= (a.width + b.width) / 2 || dy >= (a.height + b.height) / 2).toBe(true);
    }
    expect(waiting).toBeGreaterThan(0);
    expect(f.car.choices).toBeGreaterThan(0);
    expect(second.choices).toBeGreaterThan(0);
  });
});

it("validates an entire saved traffic batch before publishing any vehicle", () => {
  const f = fixture();
  const record = required(f.traffic.save()[0]);
  const count = f.traffic.states.size;
  expect(() =>
    f.traffic.restore([
      { ...record, identity: "copy" },
      { ...record, identity: "invalid", laneId: "missing" },
    ]),
  ).toThrow(/lane/);
  expect(f.traffic.states.size).toBe(count);
});

it.each(["garbage-truck-green", "garbage-truck-orange", "car-8"])(
  "rejects invalid %s persisted light state before changing the batch",
  (model) => {
    const f = fixture();
    const record = required(f.traffic.save()[0]);
    const count = f.traffic.states.size;
    expect(() =>
      f.traffic.restore([{ ...record, identity: "bad-lights", model, emergencyState: 3 }]),
    ).toThrow(/emergency state/);
    expect(f.traffic.states.size).toBe(count);
  },
);

it("reads overlapping flat-road tiles once within a car sweep, then observes edits next tick", () => {
  const f = fixture();
  f.player.position = { wx: 2000, wy: 2000 };
  f.entities.spatialHash.update(f.player);
  let reads = new Map<string, number>();
  let road = 5;
  let height = 0;
  f.world.getRoadAt = (x, y) => {
    const key = `${x},${y}`;
    reads.set(key, (reads.get(key) ?? 0) + 1);
    return road;
  };
  f.world.getHeightAt = () => height;
  f.traffic.tick(1 / 60, []);
  expect(reads.size).toBeGreaterThan(0);
  expect([...reads.values()].every((n) => n === 1)).toBe(true);
  expect(f.car.speed).toBeGreaterThan(0);
  const before = { ...f.car.entity.position };
  reads = new Map();
  height = 1;
  f.traffic.tick(1 / 60, []);
  expect(f.car.entity.position).toEqual(before);
  expect(f.car.waiting).toBe("road unavailable");
  expect(reads.size).toBeGreaterThan(0);
  height = 0;
  road = 0;
  f.traffic.tick(1 / 60, []);
  expect(f.car.entity.position).toEqual(before);
  road = 5;
  f.traffic.tick(1 / 60, []);
  expect(f.car.speed).toBeGreaterThan(0);
});

it("drops road reuse before callbacks and later cars even for overlapping footprints", () => {
  const f = fixture();
  f.player.position = { wx: 2000, wy: 2000 };
  f.entities.spatialHash.update(f.player);
  const second = f.traffic.add("compact-1", f.car.lane, f.car.distance + 6);
  f.world.getHeightAt = () => 0;
  f.traffic.onChange = (s) => {
    if (s === f.car) f.world.getRoadAt = () => 0;
  };
  f.traffic.tick(1 / 60, []);
  expect(second.waiting).toBe("road unavailable");
  expect(second.speed).toBe(0);
});

it("does not confuse different road cells that share a scratch slot", () => {
  const f = fixture();
  f.player.position = { wx: 2000, wy: 2000 };
  f.entities.spatialHash.update(f.player);
  f.world.getHeightAt = () => 0;
  // A deliberately fast lookahead spans more than the scratch grid's 16 tiles.
  f.car.speed = f.traffic.settings.speed = 200;
  const first = Math.floor(f.car.entity.position.wx / 16);
  f.world.getRoadAt = (x) => (x >= first + 16 ? 0 : 5);
  f.traffic.tick(1 / 60, []);
  expect(f.car.waiting).toBe("road unavailable");
});

it.each([NaN, Infinity, -4, 4])(
  "rejects invalid saved heading %s before publishing any vehicle",
  (vehicleHeading) => {
    const f = fixture();
    const record = required(f.traffic.save()[0]);
    const count = f.traffic.states.size;
    expect(() =>
      f.traffic.restore([{ ...record, identity: "bad-heading", vehicleHeading }]),
    ).toThrow(/heading/);
    expect(f.traffic.states.size).toBe(count);
  },
);
