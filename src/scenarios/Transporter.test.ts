import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { createPlayer } from "../entities/Player.js";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeServerMessage,
} from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import {
  hasUnsecuredTransportLoad,
  TRANSPORTER,
  transportable,
  transporterLocal,
  transporterSupport,
} from "../traffic/CarTransporter.js";
import { checkedCarPose } from "../traffic/Driving.js";
import profiles from "../traffic/towing-profiles.json" with { type: "json" };
import { createVehicle } from "../traffic/Vehicle.js";
import { vehiclePaintSchemes } from "../traffic/VehiclePaint.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { transporterRecipe } from "./TransporterRecipe.js";
import { surfaceProp } from "./WorldGeometryRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const truckOf = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.type === TRANSPORTER.type));
const carOf = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:beetle"));
const action = (s: ScenarioSession, action: "deploy" | "stow" | "secure" | "release") =>
  s.command({ kind: "vehicle-transporter-action", entityId: truckOf(s).id, action });
async function boardCar(s: ScenarioSession) {
  const car = carOf(s);
  await s.command({ kind: "teleport", position: { wx: car.position.wx, wy: 40 } });
  await s.command({ kind: "enter-vehicle", entityId: car.id });
}
async function load(s: ScenarioSession) {
  await action(s, "deploy");
  await boardCar(s);
  for (let i = 0; i < 200 && carOf(s).position.wx < -30; i++) await s.step({ ...idle, dx: 1 });
  for (let i = 0; i < 30; i++) await s.step(idle);
}
it("drives continuously up the real ramp, secures, carries, saves and unloads the same car", async () => {
  const s = await ScenarioSession.create(transporterRecipe());
  try {
    await action(s, "deploy");
    await boardCar(s);
    let pitched = false;
    for (let i = 0; i < 200 && carOf(s).position.wx < -30; i++) {
      await s.step({ ...idle, dx: 1 });
      pitched ||= (transporterSupport(carOf(s), truckOf(s))?.pitch ?? 0) > 0.1;
    }
    for (let i = 0; i < 30; i++) await s.step(idle);
    expect(pitched).toBe(true);
    expect(carOf(s).wz).toBeCloseTo(TRANSPORTER.height, 3);
    await s.command({ kind: "exit-vehicle" });
    await action(s, "secure");
    await action(s, "stow");
    let truck = truckOf(s),
      car = carOf(s);
    const identity = car.proceduralId;
    expect(car.transportedBy).toBe(truck.id);
    await s.command({ kind: "enter-vehicle", entityId: truck.id });
    const predictor = new PlayerPredictor();
    predictor.reset(s.player.player, truck);
    const start = truck.position.wx;
    for (let i = 0; i < 80; i++) {
      const input = decodeClientMessage(
        encodeClientMessage({
          type: "player-input",
          seq: i,
          ...idle,
          dx: 1,
          dy: i > 35 ? 0.3 : 0,
          dtMs: 20,
        }),
      );
      if (input.type !== "player-input") throw Error("Wrong input");
      const before = JSON.stringify(car);
      predictor.update(
        0.02,
        input,
        s.realm.world,
        s.realm.propManager.props,
        s.realm.entityManager.entities,
      );
      expect(JSON.stringify(car)).toBe(before);
      await s.step(input, 0.02);
      expect(predictor.mount?.position.wx).toBeCloseTo(truck.position.wx, 3);
      expect(transporterLocal(truck, car.position).x).toBeCloseTo(TRANSPORTER.loadX, 3);
      expect(car.wz).toBeCloseTo((truck.wz ?? 0) + TRANSPORTER.height, 3);
    }
    expect(truck.position.wx).toBeGreaterThan(start + 40);
    for (let i = 0; i < 30; i++) await s.step(idle);
    await s.reload();
    truck = truckOf(s);
    car = carOf(s);
    expect(car.proceduralId).toBe(identity);
    expect(car.transportedBy).toBe(truck.id);
    expect(truck.transportLoadId).toBe(car.id);
    await action(s, "deploy");
    await action(s, "release");
    expect(car.transportedBy).toBeUndefined();
    await s.command({ kind: "exit-vehicle" });
    await s.command({
      kind: "teleport",
      position: { wx: car.position.wx, wy: car.position.wy + 40 },
    });
    await s.command({ kind: "enter-vehicle", entityId: car.id });
    for (let i = 0; i < 260; i++) await s.step({ ...idle, reversing: true });
    expect(car.wz).toBe(0);
    expect(transporterLocal(truck, car.position).x).toBeLessThan(-190);
  } finally {
    await s.close();
  }
}, 30000);

it("locks driving with a deployed ramp and protects occupied/unsecured loads and deployment space", async () => {
  const s = await ScenarioSession.create(transporterRecipe());
  try {
    await s.command({ kind: "enter-vehicle", entityId: truckOf(s).id });
    const blocker = s.realm.entityManager.spawn(createPlayer(-120, 0));
    await expect(action(s, "deploy")).rejects.toThrow("Clear");
    s.realm.entityManager.remove(blocker.id, false);
    s.player.debugPaused = true;
    await expect(action(s, "deploy")).rejects.toThrow();
    s.player.debugPaused = false;
    await action(s, "deploy");
    const start = { ...truckOf(s).position };
    for (let i = 0; i < 20; i++) await s.step({ ...idle, dx: 1 });
    expect(truckOf(s).position).toEqual(start);
    await s.command({ kind: "exit-vehicle" });
    await load(s);
    await expect(action(s, "secure")).rejects.toThrow();
    await s.command({ kind: "exit-vehicle" });
    await expect(action(s, "stow")).rejects.toThrow();
    await action(s, "secure");
    await action(s, "stow");
    await expect(action(s, "release")).rejects.toThrow("ramp");
    const records = required(s.realm.traffic).save();
    const truck = required(records.find((r) => r.model === "car-transporter"));
    truck.transportLoadIdentity = truck.identity;
    expect(() => required(s.realm.traffic).prepareRestore(records)).toThrow();
  } finally {
    await s.close();
  }
}, 30000);

it("replicates nullable equipment and high uint32 partner IDs without stale links", () => {
  const car = transporterRecipe().player;
  car.vehicleRamp = 1;
  car.transportLoadId = 0xfedcba98;
  car.transportedBy = 0xfedcba97;
  const before = serializeEntity(car);
  const frame = decodeServerMessage(
    encodeServerMessage({
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: car.id,
      entityBaselines: [before],
    }),
  );
  if (frame.type !== "frame") throw Error("Wrong frame");
  const copy = deserializeEntity(required(frame.entityBaselines?.[0]));
  expect(copy.transportLoadId).toBe(0xfedcba98);
  expect(copy.transportedBy).toBe(0xfedcba97);
  delete car.vehicleRamp;
  delete car.transportLoadId;
  delete car.transportedBy;
  const delta = required(diffEntitySnapshots(before, serializeEntity(car)));
  const change = decodeServerMessage(
    encodeServerMessage({
      type: "frame",
      serverTick: 2,
      lastProcessedInputSeq: 0,
      playerEntityId: car.id,
      entityDeltas: [delta],
    }),
  );
  if (change.type !== "frame") throw Error("Wrong frame");
  applyEntityDelta(copy, required(change.entityDeltas?.[0]));
  expect(copy.vehicleRamp).toBeUndefined();
  expect(copy.transportedBy).toBeUndefined();
  expect(copy.transportLoadId).toBeUndefined();
});

it("protects a load-only overhead obstruction and resolves durable partners in either order", async () => {
  const s = await ScenarioSession.create(transporterRecipe());
  try {
    await load(s);
    await s.command({ kind: "exit-vehicle" });
    await action(s, "secure");
    await action(s, "stow");
    const truck = truckOf(s),
      car = carOf(s),
      traffic = required(s.realm.traffic);
    await s.command({ kind: "enter-vehicle", entityId: truck.id });
    const beforeTruck = { ...truck.position },
      beforeCar = { ...car.position };
    s.realm.propManager.add({
      id: 0,
      type: "test-overhead",
      isProp: true,
      position: { wx: car.position.wx + 20, wy: 0 },
      sprite: {
        sheetKey: "geometry-surface",
        frameCol: 0,
        frameRow: 0,
        spriteWidth: 0,
        spriteHeight: 0,
      },
      collider: { offsetX: 0, offsetY: 50, width: 8, height: 100, zBase: 45, zHeight: 40 },
      walls: null,
    });
    for (let i = 0; i < 60; i++) await s.step({ ...idle, dx: 1 });
    expect(truck.position).toEqual(beforeTruck);
    expect(car.position).toEqual(beforeCar);
    const records = [...traffic.states.values()].map((state) => ({
      ...traffic.snapshot(state),
      persistentId: required(state.entity.persistentId),
      originScope: "0,0",
    }));
    const savedTruck = required(records.find((r) => r.model === "car-transporter")),
      savedCar = required(records.find((r) => r.model === "beetle"));
    for (const first of [savedTruck, savedCar]) {
      const second = first === savedTruck ? savedCar : savedTruck;
      s.realm.entityManager.remove(truckOf(s).id, false);
      s.realm.entityManager.remove(carOf(s).id, false);
      traffic.restore([first]);
      const pending = required([...traffic.states.values()][0]).entity;
      expect(first === savedTruck ? pending.transportLoadId : pending.transportedBy).toBe(0);
      traffic.restore([second]);
      expect(truckOf(s).transportLoadId).toBe(carOf(s).id);
      expect(carOf(s).transportedBy).toBe(truckOf(s).id);
    }
  } finally {
    await s.close();
  }
}, 30000);

it.each(Object.keys(profiles).filter((model) => transportable(createVehicle(model, 0, 0))))(
  "loads, saves and releases qualified %s with its original paint",
  async (model) => {
    const recipe = transporterRecipe();
    const parked = required(recipe.parkedVehicles);
    const car = required(parked[1]);
    car.model = model;
    const paint = vehiclePaintSchemes(model)[0];
    if (paint) car.paintSchemeId = paint.id;
    const s = await ScenarioSession.create(recipe);
    const loaded = () =>
      required(s.realm.entityManager.entities.find((e) => e.type === `vehicle-v1:${model}`));
    try {
      await action(s, "deploy");
      await s.command({ kind: "teleport", position: { wx: -205, wy: 40 } });
      await s.command({ kind: "enter-vehicle", entityId: loaded().id });
      const predictor = new PlayerPredictor();
      predictor.reset(s.player.player, loaded());
      for (let i = 0; i < 240 && loaded().position.wx < -30; i++) {
        const input = decodeClientMessage(
          encodeClientMessage({ type: "player-input", seq: i, ...idle, dx: 1, dtMs: 20 }),
        );
        if (input.type !== "player-input") throw Error("Wrong input");
        predictor.update(
          0.02,
          input,
          s.realm.world,
          s.realm.propManager.props,
          s.realm.entityManager.entities,
        );
        await s.step(input, 0.02);
        expect(predictor.mount?.wz).toBeCloseTo(loaded().wz ?? 0, 2);
      }
      for (let i = 0; i < 30; i++) await s.step(idle);
      expect(loaded().wz).toBeCloseTo(TRANSPORTER.height, 3);
      await s.command({ kind: "exit-vehicle" });
      await action(s, "secure");
      await action(s, "stow");
      const identity = loaded().proceduralId;
      await s.reload();
      expect(loaded().proceduralId).toBe(identity);
      expect(loaded().paintSchemeId).toBe(paint?.id);
      await action(s, "deploy");
      await action(s, "release");
      expect(loaded().transportedBy).toBeUndefined();
    } finally {
      await s.close();
    }
  },
  30000,
);

it("keeps a bridge car independent of a transporter directly below it", async () => {
  const s = await ScenarioSession.create(transporterRecipe());
  try {
    const truck = truckOf(s),
      car = carOf(s);
    car.position = { wx: -21, wy: 0 };
    car.wz = car.groundZ = 96;
    car.vehicleHeading = 0;
    car.velocity = { vx: 10, vy: 0 };
    expect(hasUnsecuredTransportLoad(truck, [car])).toBe(false);
    const deck = surfaceProp(
      { left: -400, right: 400, top: -200, bottom: 200 },
      { id: "upper", spaceId: "bridge", z: 96, riseX: 0, riseY: 0, thickness: 8, connectsTo: [] },
    );
    const pose = checkedCarPose(
      car,
      { ...car, position: { wx: -20.9, wy: 0 } },
      0.01,
      s.realm.world,
      [deck],
      [car, truck],
    );
    expect(pose?.wz).toBe(96);
  } finally {
    await s.close();
  }
}, 30000);
