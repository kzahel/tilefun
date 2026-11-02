import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { createPerson1 } from "../entities/Person.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createFauna } from "../wildlife/Fauna.js";
import { HORN_STARTLE_RADIUS } from "./HornReaction.js";
import { PlayerSession } from "./PlayerSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
function recipe(): ScenarioRecipe {
  return {
    version: 1,
    id: "driving-test",
    generation: FLAT_SCENARIO,
    player: createPlayer(80, -28),
    props: [],
    parkedVehicles: [{ name: "car", model: "compact-1", wx: 80, wy: 0, facing: Direction.Right }],
  };
}

it("normalizes diagonals, retains off-road cars through exit and reload, and restores an inside driver", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    let car = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
    s.realm.vehicles.enter(s.player, car.entity.id);
    const initial = { ...car.entity.position };
    for (let i = 0; i < 60; i++) await s.step({ ...idle, dx: 1, dy: -1 });
    expect(
      Math.hypot(car.entity.velocity?.vx ?? 0, car.entity.velocity?.vy ?? 0),
    ).toBeLessThanOrEqual(112.001);
    expect(car.entity.position.wy).toBeLessThan(initial.wy - 30);
    const savedHeading = car.entity.vehicleHeading;
    await s.reload();
    car = required(
      [...(s.realm.vehicleRegistry?.states.values() ?? [])].find(
        (c) => c.entity.proceduralId === car.entity.proceduralId,
      ),
    );
    expect(car.entity.vehicleHeading).toBe(savedHeading);
    expect(s.player.player.parentId).toBe(car.entity.id);
    expect(s.realm.vehicles.get(s.player)?.id).toBe(car.entity.id);
    expect(s.player.player.collider).toBeNull();
    for (let i = 0; i < 110; i++) await s.step({ ...idle, dy: -1 });
    const parked = { ...car.entity.position };
    const parkedHeading = car.entity.vehicleHeading;
    s.realm.vehicles.exit(s.player);
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(car.entity.position).toEqual(parked);
    await s.reload();
    const restored = [...(s.realm.vehicleRegistry?.states.values() ?? [])].find(
      (c) => c.entity.proceduralId === car.entity.proceduralId,
    );
    expect(restored?.entity.position).toEqual(parked);
    expect(restored?.entity.vehicleHeading).toBeCloseTo(parkedHeading ?? 0, 3);
  } finally {
    await s.close();
  }
});
it("nudges players at bounded speed and rejects distant boarding and obstructed exits", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
    s.player.player.position.wx -= 1000;
    expect(() => s.realm.vehicles.enter(s.player, car.entity.id)).toThrow(/beside/);
    s.player.player.position = { wx: car.entity.position.wx, wy: car.entity.position.wy - 28 };
    s.realm.vehicles.enter(s.player, car.entity.id);
    const guest = new PlayerSession("contact-guest");
    await s.realm.addPlayer(guest);
    guest.editorEnabled = false;
    guest.visibleRange = { ...s.player.visibleRange };
    const obstacle = guest.player;
    obstacle.position = { wx: car.entity.position.wx + 70, wy: car.entity.position.wy };
    const beforePush = obstacle.position.wx;
    for (let i = 0; i < 80; i++) await s.step({ ...idle, dx: 1 });
    expect(obstacle.position.wx).toBeGreaterThan(beforePush + 10);
    expect(car.entity.position.wx).toBeLessThan(obstacle.position.wx - 25);
    expect(car.entity.velocity?.vx).toBeGreaterThan(0);
    expect(car.entity.velocity?.vx).toBeLessThanOrEqual(112.01);
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

it("restores a returning player on clear ground when their saved seat is already claimed or gone", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
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

it.each(["garbage-truck-green", "garbage-truck-orange"])(
  "only the %s driver toggles a silent beacon; style is ignored and reload preserves it",
  async (model) => {
    const input = recipe();
    required(input.parkedVehicles?.[0]).model = model;
    const s = await ScenarioSession.create(input);
    try {
      const car = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
      const other = new PlayerSession("spectator", s.realm.entityManager.spawn(createPlayer(0, 0)));
      s.realm.vehicles.emergency(other, "toggle");
      expect(car.entity.emergencyState).toBeUndefined();
      s.realm.vehicles.enter(s.player, car.entity.id);
      s.realm.vehicles.emergency(s.player, "toggle");
      expect(car.entity.emergencyState).toBe(1);
      s.realm.vehicles.emergency(s.player, "style");
      expect(car.entity.emergencyState).toBe(1);
      await s.reload();
      const restored = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
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
    const car = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
    s.realm.handleMessage(s.player.clientId, s.player, { type: "vehicle-horn", active: true });
    expect(s.realm.vehicles.takeHorns()).toEqual([]);
    s.realm.vehicles.enter(s.player, car.entity.id);
    s.realm.handleMessage(s.player.clientId, s.player, { type: "vehicle-horn", active: true });
    s.realm.handleMessage(s.player.clientId, s.player, { type: "vehicle-horn", active: true });
    const hornPosition = { ...car.entity.position };
    const { decodeServerMessage } = await import("../shared/binaryCodec.js");
    const messages = s
      .tick()
      .map(decodeServerMessage)
      .filter((m) => m.type === "vehicle-horn");
    expect(messages).toEqual([
      {
        type: "vehicle-horn",
        vehicleId: car.entity.id,
        active: true,
        wx: hornPosition.wx,
        wy: hornPosition.wy,
        kind: "car",
      },
    ]);
    expect(s.realm.vehicles.takeHorns()).toEqual([]);
    for (let i = 0; i < 50; i++) await s.step(idle);
    s.realm.vehicles.honk(s.player);
    expect(s.realm.vehicles.takeHorns()).toHaveLength(1);
    s.realm.vehicles.exit(s.player);
    expect(s.realm.vehicles.takeHorns()).toEqual([expect.objectContaining({ active: false })]);
    s.realm.vehicles.honk(s.player);
    expect(s.realm.vehicles.takeHorns()).toEqual([]);
  } finally {
    await s.close();
  }
});

it("makes nearby people, cats and dogs escape from an admitted honk and then settle", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const r = s.realm,
      car = required(r.vehicleRegistry?.states.get(required(s.handles.car))).entity,
      origin = { ...car.position };
    const person = r.entityManager.spawn(createPerson1(origin.wx + 90, origin.wy));
    const resident = r.entityManager.spawn(createPerson1(origin.wx - 90, origin.wy));
    resident.resident = {
      homeRealm: "home",
      parentRealm: "outside",
      doorId: "door",
      place: "outside",
      inside: [],
      outside: [{ id: "rest", ...resident.position, action: "rest", seconds: 30 }],
      index: 0,
      phase: "act",
      elapsed: 0,
      retry: 0,
      path: [],
    };
    const cat = r.entityManager.spawn(createFauna("cat", origin.wx, origin.wy - 100));
    const dog = r.entityManager.spawn(createFauna("dog", origin.wx, origin.wy + 100));
    const distance = (e: typeof person) =>
      Math.hypot(e.position.wx - origin.wx, e.position.wy - origin.wy);
    r.vehicles.honk(s.player);
    expect(person.wanderAI?.state).toBe("idle");
    expect(cat.fauna?.alarmFrom).toBeUndefined();
    r.vehicles.enter(s.player, car.id);
    r.vehicles.honk(s.player);
    expect(person.wanderAI?.state).toBe("scared");
    expect(cat.fauna?.alarmFrom).toEqual(origin);
    expect(dog.fauna?.alarmFrom).toEqual(origin);
    for (let i = 0; i < 90; i++) {
      if (i % 12 === 0) r.vehicles.honk(s.player);
      await s.step(idle);
    }
    expect(distance(person)).toBeGreaterThan(120);
    expect(distance(resident)).toBeGreaterThan(120);
    expect(distance(cat)).toBeGreaterThan(110);
    expect(distance(dog)).toBeGreaterThan(110);
    for (let i = 0; i < 270; i++) await s.step(idle);
    expect(person.wanderAI?.scaredTimer).toBeUndefined();
    expect(resident.wanderAI?.scaredTimer).toBeUndefined();
    expect(cat.fauna?.alarmFrom).toBeUndefined();
    expect(dog.fauna?.alarmFrom).toBeUndefined();
    expect(cat.wanderAI?.state).not.toBe("scared");
    expect(dog.wanderAI?.state).not.toBe("scared");
  } finally {
    await s.close();
  }
});

it("bounds horn reactions, protects players and mounts, and does not restart escapes on horn spam", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const r = s.realm,
      car = required(r.vehicleRegistry?.states.get(required(s.handles.car))).entity,
      { wx, wy } = car.position;
    const distant = r.entityManager.spawn(createPerson1(wx + HORN_STARTLE_RADIUS + 1, wy));
    const elevated = r.entityManager.spawn(createPerson1(wx + 60, wy));
    elevated.wz = 64;
    const horse = r.entityManager.spawn(createFauna("horse", wx, wy + 90));
    required(horse.wanderAI).state = "ridden";
    const attached = r.entityManager.spawn(createPerson1(wx - 60, wy));
    attached.parentId = car.id;
    const player = r.entityManager.spawn(createPlayer(wx, wy - 90));
    const person = r.entityManager.spawn(createPerson1(wx + 90, wy));
    r.vehicles.enter(s.player, car.id);
    r.vehicles.honk(s.player);
    expect(distant.wanderAI?.state).toBe("idle");
    expect(elevated.wanderAI?.state).toBe("idle");
    expect(horse.wanderAI?.state).toBe("ridden");
    expect(horse.fauna?.alarmFrom).toBeUndefined();
    expect(attached.wanderAI?.state).toBe("idle");
    expect(player.velocity).toEqual({ vx: 0, vy: 0 });
    required(person.wanderAI).scaredTimer = 0.25;
    r.vehicles.honk(s.player, false);
    r.vehicles.honk(s.player, true);
    expect(person.wanderAI?.scaredTimer).toBe(0.25);
    const late = r.entityManager.spawn(createPerson1(wx, wy - 100));
    r.worldAPI.advanceTime(0.2);
    r.vehicles.honk(s.player, true);
    expect(late.wanderAI?.state).toBe("idle");
    r.worldAPI.advanceTime(3);
    r.vehicles.honk(s.player, false);
    r.vehicles.honk(s.player, true);
    expect(late.wanderAI?.state).toBe("scared");
  } finally {
    await s.close();
  }
});

it("sustains a held horn, releases immediately, and expires abandoned holds", async () => {
  const { decodeServerMessage } = await import("../shared/binaryCodec.js");
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
    s.realm.vehicles.enter(s.player, car.entity.id);
    for (let i = 0; i < 180; i++) {
      if (i % 12 === 0) s.realm.vehicles.honk(s.player, true);
      const horns = s
        .tick()
        .map(decodeServerMessage)
        .filter((m) => m.type === "vehicle-horn");
      expect(horns.every((h) => h.active)).toBe(true);
    }
    s.realm.vehicles.honk(s.player, false);
    expect(s.realm.vehicles.takeHorns()).toEqual([expect.objectContaining({ active: false })]);
    s.realm.vehicles.honk(s.player, true);
    expect(s.realm.vehicles.takeHorns()).toEqual([expect.objectContaining({ active: true })]);
    s.realm.worldAPI.advanceTime(0.61);
    s.realm.vehicles.sync();
    expect(s.realm.vehicles.takeHorns()).toEqual([expect.objectContaining({ active: false })]);
    s.player.editorEnabled = true;
    s.realm.vehicles.honk(s.player, true);
    expect(s.realm.vehicles.takeHorns()).toEqual([]);
  } finally {
    await s.close();
  }
});
