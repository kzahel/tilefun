import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { PlayerSession } from "../server/PlayerSession.js";
import { decodeClientMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import { towAxle, towHitch, towPitch } from "../traffic/Towing.js";
import { vehicleCardinalHeading } from "../traffic/Vehicle.js";
import { scenarioWalls } from "./ScenarioRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { towingRecipe } from "./TowingRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const truckOf = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:tow-truck"));
const carOf = (s: ScenarioSession) =>
  required(s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:beetle"));
const tow = (s: ScenarioSession, action: "attach" | "release") =>
  s.command({ kind: "vehicle-tow-action", entityId: truckOf(s).id, action });

it.each([Direction.Down, Direction.Left, Direction.Up])(
  "tows through world and chunk axes at heading %s",
  async (direction) => {
    const s = await ScenarioSession.create(towingRecipe(direction));
    try {
      await tow(s, "attach");
      const truck = truckOf(s),
        car = carOf(s),
        before = { ...car.position };
      await s.command({ kind: "enter-vehicle", entityId: truck.id });
      const h = vehicleCardinalHeading(direction);
      for (let i = 0; i < 90; i++) await s.step({ ...idle, dx: Math.cos(h), dy: Math.sin(h) });
      expect(Math.hypot(car.position.wx - before.wx, car.position.wy - before.wy)).toBeGreaterThan(
        60,
      );
      expect(
        Math.hypot(
          towAxle(car, "front").wx - towHitch(truck).wx,
          towAxle(car, "front").wy - towHitch(truck).wy,
        ),
      ).toBeLessThan(0.00001);
    } finally {
      await s.close();
    }
  },
  30000,
);

it("predicts the same coupled turns without mutating the replicated trailer", async () => {
  const s = await ScenarioSession.create(towingRecipe());
  try {
    await tow(s, "attach");
    const truck = truckOf(s),
      car = carOf(s);
    await s.command({ kind: "enter-vehicle", entityId: truck.id });
    const predictor = new PlayerPredictor();
    predictor.reset(s.player.player, truck);
    for (let i = 0; i < 100; i++) {
      const input = { ...idle, dx: 1, dy: i > 30 ? 0.5 : 0 },
        before = JSON.stringify(car);
      const packet = decodeClientMessage(
        encodeClientMessage({ type: "player-input", seq: i, ...input, dtMs: 20 }),
      );
      if (packet.type !== "player-input") throw Error("Wrong input codec");
      predictor.update(
        0.02,
        packet,
        s.realm.world,
        s.realm.propManager.props,
        s.realm.entityManager.entities,
      );
      expect(JSON.stringify(car)).toBe(before);
      await s.step(packet, 0.02);
      expect(predictor.mount?.position.wx).toBeCloseTo(truck.position.wx, 3);
      expect(predictor.mount?.position.wy).toBeCloseTo(truck.position.wy, 3);
    }
  } finally {
    await s.close();
  }
}, 30000);

it("attaches, articulates, saves, reverses, releases and drives the same real car", async () => {
  const s = await ScenarioSession.create(towingRecipe());
  try {
    await tow(s, "attach");
    let truck = truckOf(s),
      car = carOf(s);
    expect(truck.towTargetId).toBe(car.id);
    expect(car.towedBy).toBe(truck.id);
    expect(towPitch(car)).toBeGreaterThan(0.2);
    await s.command({ kind: "enter-vehicle", entityId: truck.id });
    const start = car.position.wx;
    for (let i = 0; i < 150; i++) await s.step({ ...idle, dx: 1, dy: i < 70 ? 0 : 0.45 });
    expect(car.position.wx - start).toBeGreaterThan(65);
    expect(Math.abs((car.vehicleHeading ?? 0) - (truck.vehicleHeading ?? 0))).toBeGreaterThan(0.01);
    expect(
      Math.hypot(
        towAxle(car, "front").wx - towHitch(truck).wx,
        towAxle(car, "front").wy - towHitch(truck).wy,
      ),
    ).toBeLessThan(0.00001);
    const identity = car.proceduralId,
      position = { ...car.position };
    await s.reload();
    truck = truckOf(s);
    car = carOf(s);
    expect(car.proceduralId).toBe(identity);
    expect(car.position).toEqual(position);
    expect(truck.towTargetId).toBe(car.id);
    expect(car.towedBy).toBe(truck.id);
    for (let i = 0; i < 45; i++) await s.step({ ...idle, dx: -1, dy: 0 });
    for (let i = 0; i < 60; i++) await s.step(idle);
    await tow(s, "release");
    expect(car.towedBy).toBeUndefined();
    expect(truck.towTargetId).toBeUndefined();
    await s.command({ kind: "exit-vehicle" });
    await s.command({
      kind: "teleport",
      position: { wx: car.position.wx, wy: car.position.wy + 32 },
    });
    await s.command({ kind: "enter-vehicle", entityId: car.id });
    const before = car.position.wx;
    for (let i = 0; i < 45; i++) await s.step({ ...idle, dx: 1 });
    expect(car.position.wx).toBeGreaterThan(before + 5);
  } finally {
    await s.close();
  }
}, 30000);

it("protects occupied cars and nonowners, and rejects remote, paused and moving controls", async () => {
  const s = await ScenarioSession.create(towingRecipe());
  try {
    const truck = truckOf(s),
      car = carOf(s);
    const p = createPlayer(car.position.wx, 32),
      other = new PlayerSession("tow-other", p);
    await s.realm.addPlayer(other);
    other.editorEnabled = false;
    other.player.position = { wx: car.position.wx, wy: 32 };
    s.realm.vehicles.enter(other, car.id);
    await expect(tow(s, "attach")).rejects.toThrow();
    s.realm.vehicles.exit(other);
    other.player.position = { wx: 200, wy: 200 };
    s.player.debugPaused = true;
    await expect(tow(s, "attach")).rejects.toThrow();
    s.player.debugPaused = false;
    truck.velocity = { vx: 1, vy: 0 };
    await expect(tow(s, "attach")).rejects.toThrow();
    truck.velocity = { vx: 0, vy: 0 };
    await tow(s, "attach");
    expect(() => s.realm.vehicles.enter(other, car.id)).toThrow();
    s.realm.vehicles.enter(s.player, truck.id);
    other.player.position = { wx: 12, wy: 40 };
    expect(() => s.realm.vehicles.tow(other, truck.id, "release")).toThrow("driver");
    other.player.position = { wx: 2000, wy: 0 };
    expect(() => s.realm.vehicles.tow(other, truck.id, "release")).toThrow();
  } finally {
    await s.close();
  }
}, 30000);

it("blocks a trailer-only wall atomically, protects unload links and releases on deletion", async () => {
  const s = await ScenarioSession.create(towingRecipe());
  try {
    await tow(s, "attach");
    const truck = truckOf(s),
      car = carOf(s);
    const t = required(s.realm.traffic),
      state = required(t.states.get(truck.id));
    const wall = required(scenarioWalls(-160, 28, -60, 120)[0]);
    wall.position = { wx: -100, wy: 31 };
    wall.collider = { offsetX: 0, offsetY: 0, width: 70, height: 8 };
    s.realm.propManager.add(wall);
    const old = { ...car.position };
    for (let i = 0; i < 100; i++) t.drive(state, { dx: 0, dy: 1 }, 1 / 60);
    expect(car.position.wy).toBeLessThan(16);
    expect(
      Math.hypot(
        towAxle(car, "front").wx - towHitch(truck).wx,
        towAxle(car, "front").wy - towHitch(truck).wy,
      ),
    ).toBeLessThan(0.00001);
    expect(car.position).not.toEqual(old);
    s.realm.entityManager.remove(truck.id, false);
    expect(car.towedBy).toBe(0);
    expect(required(t.states.get(car.id)).towTruckIdentity).toBeTruthy();
    // Restore the evicted owner's ordinary durable record in a fresh batch.
    const saved = {
      ...t.snapshot(state),
      persistentId: required(state.entity.persistentId),
      originScope: "0,0",
    };
    t.restore([saved]);
    expect(car.towedBy).toBe(truckOf(s).id);
    s.realm.entityManager.remove(truckOf(s).id, true);
    expect(car.towedBy).toBeUndefined();
  } finally {
    await s.close();
  }
}, 30000);
