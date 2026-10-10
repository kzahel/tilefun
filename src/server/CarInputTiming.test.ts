import { expect, it } from "vitest";
import { contactRecipe, IDLE, RIGHT } from "../../scripts/instrumentation/moving-contact-cases.js";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import type { Movement } from "../input/ActionManager.js";
import { curvedTrainRecipe } from "../scenarios/CurvedTrainRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { encodeClientMessage, quantizeInputDtMs } from "../shared/binaryCodec.js";
import { roofSupport } from "../traffic/RoofSupport.js";

async function openCar(hz: 30 | 60) {
  const recipe = contactRecipe("car-roof");
  recipe.player.position = { wx: -512, wy: -28 };
  const session = await ScenarioSession.create(recipe);
  session.realm.tickRate = hz;
  const car = required(session.realm.traffic?.states.get(required(session.handles.car))).entity;
  session.realm.vehicles.enter(session.player, car.id);
  let seq = session.player.lastProcessedInputSeq;
  const dt = 1 / hz;
  const commandDt = quantizeInputDtMs(dt * 1000) / 1000;
  const command = (movement: Movement) =>
    encodeClientMessage({
      type: "player-input",
      ...movement,
      seq: ++seq,
      dtMs: commandDt * 1000,
    });
  const tick = async (...inputs: ArrayBuffer[]) => {
    for (const input of inputs) session.input(input);
    await session.ready();
    session.tick(dt);
  };
  let lastInputAt = 0;
  for (let i = 0; i < hz; i++) {
    lastInputAt = session.realm.worldAPI.time;
    await tick(command(RIGHT));
  }
  expect(car.velocity?.vx).toBe(112);
  return { session, car, command, tick, commandDt, lastInputAt };
}

for (const hz of [30, 60] as const) {
  it(`holds a car and roof rider through a short input gap, then consumes delayed motion once (${hz}Hz)`, async () => {
    const { session, car, command, tick, commandDt } = await openCar(hz);
    try {
      const rider = session.realm.entityManager.spawn(
        createPlayer(car.position.wx, car.position.wy),
      );
      rider.wz = rider.groundZ = car.collider?.physicalHeight ?? 24;
      const position = { ...car.position },
        riderPosition = { ...rider.position };
      const ack = session.player.lastProcessedInputSeq;
      const delayed = command(RIGHT);
      for (let i = 0; i < Math.floor(hz * 0.2); i++) await tick();
      expect(car.position).toEqual(position);
      expect(car.velocity?.vx).toBe(112);
      expect(rider.position).toEqual(riderPosition);
      expect(session.player.lastProcessedInputSeq).toBe(ack);
      await tick(delayed, command(RIGHT));
      expect(session.player.lastProcessedInputSeq).toBe(ack + 2);
      expect(car.position.wx - position.wx).toBeCloseTo(112 * commandDt * 2, 6);
      expect(rider.position.wx - riderPosition.wx).toBeCloseTo(112 * commandDt * 2, 6);
      expect(roofSupport(rider, session.realm.entityManager.entities)?.id).toBe(car.id);
      expect(session.player.player.position).toEqual(car.position);
    } finally {
      await session.close();
    }
  });

  it(`brakes only on genuine release commands, including a delayed two-command release (${hz}Hz)`, async () => {
    const { session, car, command, tick, commandDt } = await openCar(hz);
    try {
      const position = { ...car.position },
        ack = session.player.lastProcessedInputSeq;
      const delayedRelease = command(IDLE);
      await tick();
      expect(car.position).toEqual(position);
      expect(car.velocity?.vx).toBe(112);
      await tick(delayedRelease, command(IDLE));
      expect(session.player.lastProcessedInputSeq).toBe(ack + 2);
      expect(car.velocity?.vx).toBeCloseTo(112 - 448 * commandDt * 2, 6);
      expect(car.position.wx).toBeGreaterThan(position.wx);
      for (let i = 0; i < hz; i++) await tick(command(IDLE));
      expect(car.velocity?.vx).toBe(0);
      const stopped = { ...car.position };
      await tick(command(IDLE));
      await tick();
      expect(car.position).toEqual(stopped);
    } finally {
      await session.close();
    }
  });

  it(`stops stale car input after 250ms without adding travel and recovers from rest (${hz}Hz)`, async () => {
    const { session, car, command, tick, commandDt, lastInputAt } = await openCar(hz);
    try {
      const position = { ...car.position },
        ack = session.player.lastProcessedInputSeq;
      while (session.realm.worldAPI.time - lastInputAt <= 0.25) {
        await tick();
        expect(car.velocity?.vx).toBe(112);
      }
      await tick();
      expect(car.position).toEqual(position);
      expect(car.velocity?.vx).toBe(0);
      expect(car.sprite?.moving).toBe(false);
      expect(session.player.lastProcessedInputSeq).toBe(ack);
      await tick(command(RIGHT));
      expect(car.velocity?.vx).toBeCloseTo(224 * commandDt, 6);
      expect(car.position.wx).toBeGreaterThan(position.wx);
      expect(car.position.wx - position.wx).toBeLessThan(112 * commandDt);
      expect(session.player.lastProcessedInputSeq).toBe(ack + 1);
      for (let i = 0; i < hz; i++) await tick(command(RIGHT));
      expect(car.velocity?.vx).toBe(112);
    } finally {
      await session.close();
    }
  });
}

it("releases and stops a car immediately when its driver disconnects", async () => {
  const { session, car } = await openCar(60);
  try {
    const position = { ...car.position };
    session.realm.removePlayer(session.player.clientId);
    expect(car.velocity?.vx).toBe(0);
    expect(session.realm.vehicles.get(session.player)).toBeUndefined();
    const state = required(session.realm.traffic?.states.get(car.id));
    expect(state.driverId).toBeUndefined();
    expect(state.parked).toBe(true);
    for (let i = 0; i < 20; i++) session.tick(1 / 60);
    expect(car.position).toEqual(position);
  } finally {
    await session.close();
  }
});

it("keeps missing-input train braking on the native service clock", async () => {
  const session = await ScenarioSession.create(curvedTrainRecipe(false));
  try {
    const service = required(session.realm.railway?.services.get("curved-service"));
    const car = required(service.carriages[1]);
    session.player.player.position = { wx: car.position.wx, wy: car.position.wy - 24 };
    session.realm.vehicles.enter(session.player, car.id);
    for (let i = 0; i < 90; i++) await session.step(RIGHT);
    const speed = service.speed,
      distance = service.record.distance ?? 0;
    const ack = session.player.lastProcessedInputSeq;
    session.tick(1 / 60);
    expect(session.player.lastProcessedInputSeq).toBe(ack);
    expect(Math.abs(service.driveInput ?? 0)).toBe(0);
    expect(service.speed).toBeCloseTo(speed - 192 / 60, 6);
    expect((service.record.distance ?? 0) - distance).toBeGreaterThan(0);
    expect((service.record.distance ?? 0) - distance).toBeLessThanOrEqual(speed / 60);
  } finally {
    await session.close();
  }
});
