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
it("nudges players at bounded speed and rejects distant boarding and obstructed exits", async () => {
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
    const beforePush = obstacle.position.wx;
    for (let i = 0; i < 80; i++) await s.step({ ...idle, dx: 1 });
    expect(obstacle.position.wx).toBeGreaterThan(beforePush + 10);
    expect(car.entity.position.wx).toBeLessThan(obstacle.position.wx - 25);
    expect(car.entity.velocity?.vx).toBeGreaterThan(0);
    expect(car.entity.velocity?.vx).toBeLessThanOrEqual(40);
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

it.each(["ambulance", "fire-truck-ladder-1", "police-car", "fire-truck-ladder-2"])(
  "only the %s driver switches persistent emergency state across binary replicas and reload",
  async (model) => {
    const input = recipe();
    const carSpec = required(input.traffic?.[0]);
    carSpec.model = model;
    const s = await ScenarioSession.create(input);
    try {
      const car = required(s.realm.traffic?.states.get(required(s.handles.car)));
      const other = new PlayerSession("spectator", s.realm.entityManager.spawn(createPlayer(0, 0)));
      s.realm.vehicles.emergency(other, "toggle");
      expect(car.entity.emergencyState).toBeUndefined();
      s.realm.vehicles.enter(s.player, car.entity.id);
      s.realm.handleMessage(s.player.clientId, s.player, {
        type: "vehicle-emergency",
        action: "toggle",
      });
      expect(car.entity.emergencyState).toBe(3);
      const predictor = new PlayerPredictor();
      const player = deserializeEntity(serializeEntity(s.player.player));
      const replica = deserializeEntity(serializeEntity(car.entity));
      predictor.reset(player, replica);
      expect(predictor.mount?.emergencyState).toBe(3);
      replica.emergencyState = 5;
      predictor.reconcile(player, 0, s.realm.world, [], [replica], replica.id);
      expect(predictor.mount?.emergencyState).toBe(5);
      delete replica.emergencyState;
      predictor.reconcile(player, 0, s.realm.world, [], [replica], replica.id);
      expect(predictor.mount?.emergencyState).toBeUndefined();
      s.realm.vehicles.emergency(other, "style");
      expect(car.entity.emergencyState).toBe(3);
      s.realm.vehicles.emergency(s.player, "style");
      expect(car.entity.emergencyState).toBe(5);
      await s.reload();
      const restored = required(s.realm.traffic?.states.get(required(s.handles.car)));
      expect(restored.entity.emergencyState).toBe(5);
      s.realm.vehicles.emergency(s.player, "style");
      expect(restored.entity.emergencyState).toBe(1); // lights only
      s.realm.vehicles.emergency(s.player, "toggle");
      expect(restored.entity.emergencyState).toBe(0);
      s.realm.vehicles.exit(s.player);
      s.realm.vehicles.emergency(s.player, "toggle");
      expect(restored.entity.emergencyState).toBe(0);
    } finally {
      await s.close();
    }
  },
);

it("boost shares authority/prediction motion, remains normalized and brakes on release", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.traffic?.states.get(required(s.handles.car)));
    s.realm.vehicles.enter(s.player, car.entity.id);
    const predictor = new PlayerPredictor();
    predictor.reset(
      deserializeEntity(serializeEntity(s.player.player)),
      deserializeEntity(serializeEntity(car.entity)),
    );
    const input = { ...idle, dx: 1, dy: 1, sprinting: true };
    for (let i = 0; i < 60; i++) {
      predictor.update(
        0.01667,
        input,
        s.realm.world,
        s.realm.propManager.props,
        s.realm.entityManager.entities,
      );
      await s.step(input);
    }
    const speed = Math.hypot(car.entity.velocity?.vx ?? 0, car.entity.velocity?.vy ?? 0);
    expect(speed).toBeGreaterThan(112);
    expect(speed).toBeLessThanOrEqual(179.201);
    expect(predictor.mount?.position.wx).toBeCloseTo(car.entity.position.wx, 3);
    for (let i = 0; i < 30; i++) await s.step(idle);
    expect(car.entity.velocity).toEqual({ vx: 0, vy: 0 });
  } finally {
    await s.close();
  }
});

it.each(["garbage-truck-green", "garbage-truck-orange"])(
  "only the %s driver toggles a silent beacon; style is ignored and reload preserves it",
  async (model) => {
    const input = recipe();
    required(input.traffic?.[0]).model = model;
    const s = await ScenarioSession.create(input);
    try {
      const car = required(s.realm.traffic?.states.get(required(s.handles.car)));
      const other = new PlayerSession("spectator", s.realm.entityManager.spawn(createPlayer(0, 0)));
      s.realm.vehicles.emergency(other, "toggle");
      expect(car.entity.emergencyState).toBeUndefined();
      s.realm.vehicles.enter(s.player, car.entity.id);
      s.realm.vehicles.emergency(s.player, "toggle");
      expect(car.entity.emergencyState).toBe(1);
      s.realm.vehicles.emergency(s.player, "style");
      expect(car.entity.emergencyState).toBe(1);
      await s.reload();
      const restored = required(s.realm.traffic?.states.get(required(s.handles.car)));
      expect(restored.entity.emergencyState).toBe(1);
      s.realm.vehicles.exit(s.player);
      s.realm.vehicles.emergency(s.player, "toggle");
      expect(restored.entity.emergencyState).toBe(1);
    } finally {
      await s.close();
    }
  },
);

it("admits horn events only from the driver, rate limits them, and broadcasts the authoritative sound", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.traffic?.states.get(required(s.handles.car)));
    s.realm.handleMessage(s.player.clientId, s.player, { type: "vehicle-horn" });
    expect(s.realm.vehicles.takeHorns()).toEqual([]);
    s.realm.vehicles.enter(s.player, car.entity.id);
    s.realm.handleMessage(s.player.clientId, s.player, { type: "vehicle-horn" });
    s.realm.handleMessage(s.player.clientId, s.player, { type: "vehicle-horn" });
    const { decodeServerMessage } = await import("../shared/binaryCodec.js");
    const messages = s
      .tick(1 / 60)
      .map(decodeServerMessage)
      .filter((m) => m.type === "vehicle-horn");
    expect(messages).toEqual([
      { type: "vehicle-horn", wx: car.entity.position.wx, wy: car.entity.position.wy, kind: "car" },
    ]);
    expect(s.realm.vehicles.takeHorns()).toEqual([]);
    for (let i = 0; i < 50; i++) await s.step(idle);
    s.realm.vehicles.honk(s.player);
    expect(s.realm.vehicles.takeHorns()).toHaveLength(1);
    s.realm.vehicles.exit(s.player);
    s.realm.vehicles.honk(s.player);
    expect(s.realm.vehicles.takeHorns()).toEqual([]);
  } finally {
    await s.close();
  }
});

it.each(["car-25", "sedan-12", "bus-1", "garbage-truck-green"])(
  "shares %s speed, acceleration and boost between authority and prediction",
  async (model) => {
    const input = recipe();
    required(input.traffic?.[0]).model = model;
    const s = await ScenarioSession.create(input);
    try {
      const car = required(s.realm.traffic?.states.get(required(s.handles.car)));
      s.realm.vehicles.enter(s.player, car.entity.id);
      const predictor = new PlayerPredictor();
      predictor.reset(
        deserializeEntity(serializeEntity(s.player.player)),
        deserializeEntity(serializeEntity(car.entity)),
      );
      const { vehiclePerformance } = await import("../traffic/VehiclePerformance.js");
      for (const sprinting of [false, true]) {
        for (let i = 0; i < 150; i++) {
          const movement = { ...idle, dx: 1, sprinting };
          predictor.update(0.01667, movement, s.realm.world, [], s.realm.entityManager.entities);
          await s.step(movement);
        }
        expect(car.entity.velocity?.vx).toBeCloseTo(
          vehiclePerformance(car.entity.type).speed * (sprinting ? 1.6 : 1),
          3,
        );
        expect(predictor.mount?.position.wx).toBeCloseTo(car.entity.position.wx, 3);
      }
    } finally {
      await s.close();
    }
  },
);

it("predicts sustained nudging against a frozen replica without mutating its players", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.traffic?.states.get(required(s.handles.car)));
    s.realm.vehicles.enter(s.player, car.entity.id);
    const obstacle = s.realm.entityManager.spawn(
      createPlayer(
        car.entity.position.wx + required(car.entity.collider).width / 2 + 5,
        car.entity.position.wy,
      ),
    );
    obstacle.wz = obstacle.groundZ = 0;
    const bodies = s.realm.entityManager.entities.map((e) => deserializeEntity(serializeEntity(e)));
    const before = structuredClone(bodies.find((e) => e.id === obstacle.id));
    const predictor = new PlayerPredictor();
    predictor.reset(
      deserializeEntity(serializeEntity(s.player.player)),
      deserializeEntity(serializeEntity(car.entity)),
    );
    for (let i = 0; i < 90; i++) {
      const movement = { ...idle, dx: 1 };
      predictor.update(0.01667, movement, s.realm.world, [], bodies);
      await s.step(movement);
    }
    expect(obstacle.position.wx).toBeGreaterThan(required(before).position.wx + 20);
    expect(predictor.mount?.position.wx).toBeCloseTo(car.entity.position.wx, 3);
    expect(bodies.find((e) => e.id === obstacle.id)).toEqual(before);
  } finally {
    await s.close();
  }
});

it("a curved service gently pushes at its front and preserves the train whistle command", async () => {
  const s = await ScenarioSession.create(curvedTrainRecipe());
  try {
    const service = required(s.realm.railway?.services.get("curved-service"));
    const car = required([...service.carriages].sort((a, b) => b.position.wx - a.position.wx)[0]);
    s.player.player.position = { wx: car.position.wx, wy: car.position.wy - 24 };
    s.realm.vehicles.enter(s.player, car.id);
    s.realm.vehicles.honk(s.player);
    expect(s.realm.vehicles.takeHorns()[0]?.kind).toBe("train");
    const person = s.realm.entityManager.spawn(
      createPlayer(car.position.wx + required(car.collider).width / 2 + 5, car.position.wy),
    );
    person.wz = person.groundZ = 0;
    const x = person.position.wx;
    for (let i = 0; i < 90; i++) await s.step({ ...idle, dx: 1 });
    expect(person.position.wx).toBeGreaterThan(x + 20);
    expect(service.speed).toBeLessThanOrEqual(80.01);
  } finally {
    await s.close();
  }
});
