import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { hasUnsecuredTransportLoad, TRANSPORTER } from "../traffic/CarTransporter.js";
import { checkedCarPose } from "../traffic/Driving.js";
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
