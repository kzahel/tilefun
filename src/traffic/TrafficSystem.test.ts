import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { Direction } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { createGenerator } from "../generation/Generator.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { getMovementPhysicsParams, stepPlayerFromInput } from "../physics/PlayerMovement.js";
import { createMovementContext, createSurfaceSampler } from "../physics/SimulationEnvironment.js";
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
  const entities = new EntityManager(),
    props = new PropManager(),
    traffic = new TrafficSystem(world, entities, props, strategy);
  const lane = required([...graph.lanes.values()].find((l) => l.direction === Direction.Right));
  const car = traffic.add("compact-1", lane, 40);
  const player = entities.spawn(
    createPlayer(car.entity.position.wx + 110, car.entity.position.wy + 3),
  );
  player.wz = 0;
  const queryEntities = () => entities.entities,
    queryProps = () => props.props;
  const ctx = createMovementContext({
    getCollision: () => 0,
    getHeight: () => 0,
    queryEntities,
    queryProps,
    movingEntity: player,
    excludeIds: new Set([player.id]),
    noclip: false,
  });
  let state = { jumpConsumed: false, lastJumpHeld: false };
  function step(jump = false, dx = 0, dy = 0) {
    state = stepPlayerFromInput(
      player,
      { dx, dy, jump, sprinting: false },
      1 / 60,
      ctx,
      () => 0,
      createSurfaceSampler({ queryEntities, queryProps }),
      state,
      getMovementPhysicsParams(),
    ).jumpState;
    traffic.tick(1 / 60, []);
  }
  return { graph, traffic, car, player, step, world, entities };
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
  it("keeps traffic off frozen revisions and provides a connected semantic network in v11", () => {
    const descriptor = {
      type: "regional",
      version: "regional-v11",
      seed: 2026,
      preset: "temperate-v1",
    } as const;
    expect(createGenerator({ ...descriptor, version: "regional-v5" }).terrain).not.toBeInstanceOf(
      TrafficStrategy,
    );
    const strategy = createGenerator(descriptor).terrain as TrafficStrategy;
    const graph = strategy.trafficNetwork(300 * 16, 519 * 16);
    expect(graph.lanes.size).toBeGreaterThan(50);
    expect([...graph.lanes.values()].some((l) => l.intercity)).toBe(true);
    for (const lane of graph.lanes.values())
      expect(samplePath(lane.path, 0).direction).toBe(lane.direction);
  });
  it("stops before a child, then resumes with the child on its roof without mounting", () => {
    const f = fixture();
    for (let i = 0; i < 600; i++) f.step();
    const stopped = f.car.entity.position.wx;
    expect(f.car.speed).toBe(0);
    expect(stopped).toBeLessThan(f.player.position.wx - 30);
    f.player.position = { wx: stopped, wy: f.car.entity.position.wy + 3 };
    f.player.wz = 24;
    for (let i = 0; i < 120; i++) f.step();
    expect(f.car.entity.position.wx).toBeGreaterThan(stopped + 25);
    expect(Math.abs(f.player.position.wx - f.car.entity.position.wx)).toBeLessThan(1);
    expect(f.player.wz).toBe(24);
    expect(f.player.parentId).toBeUndefined();
    f.step(true);
    expect(f.player.jumpVZ).toBeGreaterThan(0);
    expect(required(f.player.velocity).vx).toBeGreaterThan(20);
  });
  it("lands from a normal jump and carries a rider through a complete loop", () => {
    const f = fixture();
    f.player.position = { wx: f.car.entity.position.wx, wy: f.car.entity.position.wy + 3 };
    f.player.wz = 35;
    f.player.jumpVZ = -5;
    for (let i = 0; i < 120; i++) f.step();
    expect(f.player.wz).toBe(24);
    const start = f.car.entity.position.wx;
    for (let i = 0; i < 4200; i++) f.step();
    expect(f.car.choices).toBeGreaterThan(3);
    expect(f.player.wz).toBe(24);
    expect(
      Math.hypot(
        f.player.position.wx - f.car.entity.position.wx,
        f.player.position.wy - f.car.entity.position.wy,
      ),
    ).toBeLessThan(8);
    expect(f.car.entity.position.wx).not.toBe(start);
  });
  it("supports the stop, normal jump toward the car, land and ride interaction", () => {
    const f = fixture();
    for (let i = 0; i < 600; i++) f.step();
    for (let i = 0; i < 120; i++) f.step(i < 38, i < 38 ? -1 : 0);
    expect(f.player.wz).toBe(24);
    expect(f.player.jumpVZ).toBeUndefined();
    expect(f.car.speed).toBeGreaterThan(20);
    expect(f.player.parentId).toBeUndefined();
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
  it("two predicting clients agree with roof movement through turns and a jump off", () => {
    const f = fixture();
    f.world.getCollisionIfLoaded = () => 0;
    f.world.getCollision = () => 0;
    f.player.position = { wx: f.car.entity.position.wx, wy: f.car.entity.position.wy + 3 };
    f.player.wz = 24;
    const clients = [new PlayerPredictor(), new PlayerPredictor()];
    for (const client of clients) client.reset(deserializeEntity(serializeEntity(f.player)));
    for (let i = 0; i < 2400; i++) {
      const jump = i === 2350;
      const input = { dx: 0, dy: 0, jump, sprinting: false };
      const replicas = f.entities.entities.map((e) => deserializeEntity(serializeEntity(e)));
      for (const client of clients) {
        client.storeInput(i + 1, input, 1 / 60);
        client.update(1 / 60, input, f.world, [], replicas);
      }
      f.step(jump);
      for (const client of clients) {
        client.reconcile(f.player, i + 1, f.world, [], replicas);
        expect(required(client.lastReconcileDiagnostics).correctionPosErr).toBeLessThan(0.02);
      }
    }
    expect(f.car.choices).toBeGreaterThan(1);
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
  const record = f.traffic.save()[0]!;
  const count = f.traffic.states.size;
  expect(() =>
    f.traffic.restore([
      { ...record, identity: "copy" },
      { ...record, identity: "invalid", laneId: "missing" },
    ]),
  ).toThrow(/lane/);
  expect(f.traffic.states.size).toBe(count);
});
