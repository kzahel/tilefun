import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { TrainTapMovement } from "../input/TrainTapMovement.js";
import { Camera } from "../rendering/Camera.js";
import { collectScene } from "../rendering/collectScene.js";
import { curvedTrainRecipe } from "../scenarios/CurvedTrainRecipe.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { buildLaneGraph, samplePath } from "../traffic/LaneGraph.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { PlayerSession } from "./PlayerSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
function recipe(): ScenarioRecipe {
  const graph = buildLaneGraph([
    { a: { x: 0, y: 0 }, b: { x: 40, y: 0 }, width: 8, intercity: false },
    { a: { x: 40, y: 0 }, b: { x: 40, y: 40 }, width: 8, intercity: false },
    { a: { x: 40, y: 40 }, b: { x: 0, y: 40 }, width: 8, intercity: false },
    { a: { x: 0, y: 40 }, b: { x: 0, y: 0 }, width: 8, intercity: false },
  ]);
  const lane = required([...graph.lanes.values()].find((l) => l.direction === Direction.Right));
  const pose = samplePath(lane.path, 80);
  return {
    version: 1,
    id: "driving-test",
    generation: FLAT_SCENARIO,
    player: createPlayer(pose.x, pose.y - 28),
    props: [],
    roads: [{ left: -128, right: 768, top: -64, bottom: 704 }],
    trafficLanes: [...graph.lanes.values()],
    traffic: [{ name: "car", model: "compact-1", laneId: lane.id, x: 0, y: 0, distance: 80 }],
  };
}
it("admits one inside driver, predicts car motion, carries roof co-op and safely resumes traffic", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const r = s.realm,
      car = required(r.traffic?.states.get(required(s.handles.car)));
    const p = s.player.player;
    const rider = r.entityManager.spawn(
      createPlayer(car.entity.position.wx, car.entity.position.wy),
    );
    rider.wz = rider.groundZ = car.entity.collider?.physicalHeight ?? 24;
    const other = new PlayerSession("other", rider);
    other.editorEnabled = false;
    r.vehicles.enter(s.player, car.entity.id);
    expect(p.collider).toBeNull();
    expect(p.parentId).toBe(car.entity.id);
    const camera = new Camera();
    camera.setViewport(960, 600);
    camera.x = p.position.wx;
    camera.y = p.position.wy;
    const visible = collectScene(
      r.entityManager.entities,
      [],
      r.world,
      camera,
      camera.getVisibleChunkRange(),
      1,
      { collectElevationItems: () => [] },
      [],
      false,
    );
    expect(
      visible.filter((item) => item.kind === "sprite" && item.sheetKey === p.sprite?.sheetKey),
    ).toHaveLength(1);
    expect(() => r.vehicles.enter(other, car.entity.id)).toThrow(/already driving/);
    const predictor = new PlayerPredictor();
    predictor.reset(
      deserializeEntity(serializeEntity(p)),
      deserializeEntity(serializeEntity(car.entity)),
    );
    for (let i = 0; i < 30; i++) {
      const input = { ...idle, dx: 1 };
      predictor.update(0.01667, input, r.world, r.propManager.props, r.entityManager.entities);
      await s.step(input);
    }
    expect(car.entity.position.wx).toBeGreaterThan(170);
    expect(predictor.mount?.position.wx).toBeCloseTo(car.entity.position.wx, 3);
    expect(p.position).toEqual(car.entity.position);
    expect(roofSupport(rider, r.entityManager.entities)?.id).toBe(car.entity.id);
    expect(r.playerData(s.player).driving?.identity).toBe(car.entity.proceduralId);
    r.vehicles.exit(s.player);
    expect(p.collider).not.toBeNull();
    expect(p.parentId).toBeUndefined();
    expect(car.parked).toBe(false);
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(car.speed).toBeGreaterThan(0);
    expect(roofSupport(rider, r.entityManager.entities)?.id).toBe(car.entity.id);
  } finally {
    await s.close();
  }
});
it("normalizes diagonals, retains off-road cars through exit and reload, and restores an inside driver", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    let car = required(s.realm.traffic?.states.get(required(s.handles.car)));
    s.realm.vehicles.enter(s.player, car.entity.id);
    const initial = { ...car.entity.position };
    for (let i = 0; i < 60; i++) await s.step({ ...idle, dx: 1, dy: -1 });
    expect(
      Math.hypot(car.entity.velocity?.vx ?? 0, car.entity.velocity?.vy ?? 0),
    ).toBeLessThanOrEqual(112.001);
    expect(car.entity.position.wy).toBeLessThan(initial.wy - 40);
    await s.reload();
    car = required(
      [...(s.realm.traffic?.states.values() ?? [])].find(
        (c) => c.entity.proceduralId === car.entity.proceduralId,
      ),
    );
    expect(s.player.player.parentId).toBe(car.entity.id);
    expect(s.realm.vehicles.get(s.player)?.id).toBe(car.entity.id);
    expect(s.player.player.collider).toBeNull();
    for (let i = 0; i < 110; i++) await s.step({ ...idle, dy: -1 });
    const parked = { ...car.entity.position };
    s.realm.vehicles.exit(s.player);
    expect(car.parked).toBe(true);
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(car.entity.position).toEqual(parked);
    await s.reload();
    const restored = [...(s.realm.traffic?.states.values() ?? [])].find(
      (c) => c.entity.proceduralId === car.entity.proceduralId,
    );
    expect(restored?.parked).toBe(true);
    expect(restored?.entity.position).toEqual(parked);
  } finally {
    await s.close();
  }
});
it("stops at full-body obstacles and rejects distant boarding and obstructed exits", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.traffic?.states.get(required(s.handles.car)));
    s.player.player.position.wx -= 1000;
    expect(() => s.realm.vehicles.enter(s.player, car.entity.id)).toThrow(/beside/);
    s.player.player.position = { wx: car.entity.position.wx, wy: car.entity.position.wy - 28 };
    s.realm.vehicles.enter(s.player, car.entity.id);
    const obstacle = s.realm.entityManager.spawn(
      createPlayer(car.entity.position.wx + 70, car.entity.position.wy),
    );
    for (let i = 0; i < 80; i++) await s.step({ ...idle, dx: 1 });
    expect(car.entity.position.wx).toBeLessThan(obstacle.position.wx - 25);
    expect(car.entity.velocity?.vx).toBe(0);
    s.realm.world.getCollisionIfLoaded = () => 3;
    expect(() => s.realm.vehicles.exit(s.player)).toThrow(/No clear place/);
    expect(s.player.player.parentId).toBe(car.entity.id);
    s.realm.world.getCollisionIfLoaded = () => 0;
    s.realm.entityManager.remove(car.entity.id);
    s.realm.vehicles.sync();
    expect(s.player.player.parentId).toBeUndefined();
    expect(s.player.player.collider).not.toBeNull();
  } finally {
    await s.close();
  }
});
it("drives a whole curved train, brakes before reverse, stops and resumes service after exit", async () => {
  const s = await ScenarioSession.create(curvedTrainRecipe(false));
  try {
    const service = required(s.realm.railway?.services.get("curved-service"));
    const car = required(service.carriages[1]);
    s.player.player.position = { wx: car.position.wx, wy: car.position.wy - 24 };
    s.realm.vehicles.enter(s.player, car.id);
    const initial = service.record.distance ?? 0;
    for (let i = 0; i < 100; i++) await s.step({ ...idle, dx: 1 });
    expect(service.record.distance).toBeGreaterThan(initial + 100);
    const beforeReverse = service.record.distance ?? 0;
    await s.step({ ...idle, dx: -1 });
    expect(service.record.distance).toBeGreaterThan(beforeReverse);
    for (let i = 0; i < 150; i++) await s.step({ ...idle, dx: -1 });
    expect(service.record.distance).toBeLessThan(beforeReverse);
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(service.speed).toBe(0);
    const stopped = service.record.distance;
    for (let i = 0; i < 30; i++) await s.step(idle);
    expect(service.record.distance).toBe(stopped);
    expect(s.player.player.position).toEqual(car.position);
    s.realm.vehicles.exit(s.player);
    expect(service.driverId).toBeUndefined();
    expect(s.player.player.parentId).toBeUndefined();
  } finally {
    await s.close();
  }
});
it("train side taps start, stop and reverse without holding a finger", () => {
  const tap = new TrainTapMovement();
  tap.tap(1);
  expect(tap.direction).toBe(1);
  tap.tap(1);
  expect(tap.direction).toBe(0);
  tap.tap(-1);
  expect(tap.direction).toBe(-1);
  tap.tap(1);
  expect(tap.direction).toBe(1);
  tap.cancel();
  expect(tap.direction).toBe(0);
});

it("restores a returning player on clear ground when their saved seat is already claimed or gone", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.traffic?.states.get(required(s.handles.car)));
    s.realm.vehicles.enter(s.player, car.entity.id);
    const saved = s.realm.playerData(s.player);
    const returning = new PlayerSession("returning");
    await s.realm.addPlayer(returning, saved);
    expect(returning.player.parentId).toBeUndefined();
    expect(returning.player.collider).not.toBeNull();
    expect(returning.player.position).not.toEqual(car.entity.position);
    expect(s.player.player.parentId).toBe(car.entity.id);
    const missing = new PlayerSession("missing");
    await s.realm.addPlayer(missing, {
      ...saved,
      driving: { identity: "missing-car", exit: null },
    });
    expect(missing.player.parentId).toBeUndefined();
    expect(missing.player.collider).not.toBeNull();
    expect(missing.player.position).not.toEqual(car.entity.position);
  } finally {
    await s.close();
  }
});

it("saves a driven train through a bend and holds the open route end until reversed", async () => {
  const s = await ScenarioSession.create(curvedTrainRecipe(false));
  try {
    let train = required(s.realm.railway?.services.get("curved-service"));
    const car = required(train.carriages[1]);
    s.player.player.position = { wx: car.position.wx, wy: car.position.wy - 24 };
    s.realm.vehicles.enter(s.player, car.id);
    for (let i = 0; i < 500; i++) await s.step({ ...idle, dx: 1 });
    const before = train.record.distance ?? 0;
    expect(before).toBeGreaterThan(1000);
    await s.reload();
    train = required(s.realm.railway?.services.get("curved-service"));
    expect(train.record.distance).toBeCloseTo(before, 3);
    expect(s.realm.vehicles.get(s.player)?.proceduralId).toBe(car.proceduralId);
    expect(s.player.player.collider).toBeNull();
    for (let i = 0; i < 1500; i++) await s.step({ ...idle, dx: 1 });
    const end = required(train.line.path?.stops.at(-1)).distance;
    expect(train.record.distance).toBe(end);
    expect(train.speed).toBe(0);
    for (let i = 0; i < 90; i++) await s.step({ ...idle, dx: 1 });
    expect(train.record.distance).toBe(end);
    for (let i = 0; i < 90; i++) await s.step({ ...idle, dx: -1 });
    expect(train.record.distance).toBeLessThan(end - 50);
  } finally {
    await s.close();
  }
}, 15000);
