import { expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { Direction } from "../entities/Entity.js";
import { createPerson1 } from "../entities/Person.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { required } from "../shared/required.js";
import { DUMP_BED, hasDumpBed } from "../traffic/DumpBed.js";
import { boardingDistance } from "../traffic/VehicleSeats.js";
import { createFauna } from "../wildlife/Fauna.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { controlDumpBed } from "./DumpBedControl.js";
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
    ).toBeLessThanOrEqual(112 * 1.02); // Tire slip can add lateral speed; diagonal input must not multiply propulsion.
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
    const released = { ...car.entity.position };
    s.realm.vehicles.exit(s.player);
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(
      Math.hypot(car.entity.position.wx - released.wx, car.entity.position.wy - released.wy),
    ).toBeLessThan(25);
    const parked = { ...car.entity.position },
      parkedHeading = car.entity.vehicleHeading;
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(
      Math.hypot(car.entity.position.wx - parked.wx, car.entity.position.wy - parked.wy),
    ).toBeLessThan(0.05);
    // Rapier island sleeping may still settle the suspension by sub-pixel amounts.
    const saved = { ...car.entity.position };
    await s.reload();
    const restored = [...(s.realm.vehicleRegistry?.states.values() ?? [])].find(
      (c) => c.entity.proceduralId === car.entity.proceduralId,
    );
    expect(restored?.entity.position).toEqual(saved);
    expect(restored?.entity.vehicleHeading).toBeCloseTo(parkedHeading ?? 0, 3);
  } finally {
    await s.close();
  }
});
it("nudges players at bounded speed, rejects distant boarding and exits even when fully boxed in", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
    s.player.player.position.wx -= 1000;
    expect(() => s.realm.vehicles.enter(s.player, car.entity.id)).toThrow(/beside/);
    s.player.player.position = { wx: car.entity.position.wx, wy: car.entity.position.wy - 28 };
    const boarded = { ...s.player.player.position };
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
    // Solid everywhere (even under the roof): return to the boarding spot.
    const collision = s.realm.world.getCollisionIfLoaded.bind(s.realm.world);
    s.realm.world.getCollisionIfLoaded = () => CollisionFlag.Solid | CollisionFlag.Water;
    s.realm.vehicles.exit(s.player);
    s.realm.world.getCollisionIfLoaded = collision;
    expect(s.player.player.parentId).toBeUndefined();
    expect(s.player.player.position).toEqual(boarded);
    for (let i = 0; i < 60; i++) await s.step(idle);
    s.realm.vehicles.enter(s.player, car.entity.id, true);
    s.realm.entityManager.remove(car.entity.id);
    s.realm.vehicles.sync();
    expect(s.player.player.parentId).toBeUndefined();
    expect(s.player.player.collider).not.toBeNull();
  } finally {
    await s.close();
  }
});

it("climbs out onto the roof of a car wedged in water or a ditch, unless something is on the roof", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
    const roofHeight = required(car.entity.collider?.physicalHeight);
    const collision = s.realm.world.getCollisionIfLoaded.bind(s.realm.world);

    // Only open ground is diagonally off a corner: step out there, not onto the roof.
    s.realm.vehicles.enter(s.player, car.entity.id);
    const b = getEntityAABB(car.entity.position, required(car.entity.collider));
    s.realm.world.getCollisionIfLoaded = (tx, ty) =>
      (tx + 1) * 16 <= b.left && (ty + 1) * 16 <= b.top ? 0 : CollisionFlag.Solid;
    s.realm.vehicles.exit(s.player);
    s.realm.world.getCollisionIfLoaded = collision;
    expect(s.player.player.position.wx).toBeLessThan(b.left);
    expect(s.player.player.position.wy).toBeLessThan(b.top);
    expect(s.player.player.wz).toBeCloseTo(car.entity.wz ?? 0, 0);

    // Surrounded by water: stand on the roof, and stay there under shared physics.
    s.realm.vehicles.enter(s.player, car.entity.id);
    s.realm.world.getCollisionIfLoaded = () => CollisionFlag.Water;
    s.realm.vehicles.exit(s.player);
    s.realm.world.getCollisionIfLoaded = collision;
    const roofZ = (car.entity.wz ?? 0) + roofHeight;
    expect(s.player.player.parentId).toBeUndefined();
    expect(s.player.player.wz).toBeCloseTo(roofZ, 3);
    expect(boardingDistance(s.player.player, car.entity)).toBe(0);
    for (let i = 0; i < 30; i++) await s.step(idle);
    expect(s.player.player.wz).toBeCloseTo(roofZ, 0);

    // Sunk in a ditch: level ground is too high to step onto, so use the roof.
    s.player.player.position = { wx: car.entity.position.wx, wy: car.entity.position.wy - 28 };
    s.player.player.wz = car.entity.wz ?? 0;
    s.realm.vehicles.enter(s.player, car.entity.id);
    car.entity.wz = -40;
    s.realm.vehicles.exit(s.player);
    expect(s.player.player.wz).toBeCloseTo(-40 + roofHeight, 3);

    // Something on the roof: fall back to the nearest open ground at any height.
    s.player.player.position = { wx: car.entity.position.wx, wy: car.entity.position.wy - 28 };
    s.player.player.wz = car.entity.wz;
    s.realm.vehicles.enter(s.player, car.entity.id);
    const rider = s.realm.entityManager.spawn(
      createPlayer(car.entity.position.wx, car.entity.position.wy),
    );
    rider.wz = -40 + roofHeight;
    s.realm.vehicles.exit(s.player);
    expect(s.player.player.wz).toBeCloseTo(0, 3);
    expect(boardingDistance(s.player.player, car.entity)).toBeGreaterThan(0);
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

it("allows a nearby player to right a settled overturned car through shared physics", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const car = required(s.realm.vehicleRegistry?.states.get(required(s.handles.car)));
    car.entity.bodyRotation = [1, 0, 0, 0];
    car.entity.wz = 30;
    for (let i = 0; i < 180; i++) await s.step(idle);
    const other = new PlayerSession("far-away", createPlayer(1000, 1000));
    other.editorEnabled = false;
    expect(() => s.realm.vehicles.recover(other, car.entity.id)).toThrow(/Stand beside/);
    await s.command({ kind: "recover-vehicle", entityId: car.entity.id });
    expect(car.entity.bodyRotation?.[3]).toBeCloseTo(1, 3);
    expect(car.entity.bodyAngularVelocity).toEqual([0, 0, 0]);
    for (let i = 0; i < 60; i++) await s.step(idle);
    expect(Math.abs(car.entity.wz ?? Infinity)).toBeLessThan(0.5);
  } finally {
    await s.close();
  }
});

it("tips and lowers a dump bed through ordinary requests, locks driving and survives reload mid-tip", async () => {
  const s = await ScenarioSession.create({
    ...recipe(),
    player: createPlayer(60, -40),
    parkedVehicles: [
      { name: "truck", model: "dump-truck", wx: 80, wy: 0, facing: Direction.Right },
    ],
  });
  try {
    let truck = required(s.realm.vehicleRegistry?.states.get(required(s.handles.truck))).entity;
    for (let i = 0; i < 30; i++) await s.step(idle);
    const tip = { entityId: truck.id, action: "tip" as const };
    const far = new PlayerSession("far-away", createPlayer(1000, 1000));
    far.editorEnabled = false;
    expect(() => controlDumpBed(s.realm.vehicles, far, tip)).toThrow(/Stand beside/);
    await s.command({ kind: "vehicle-bed", entityId: truck.id, action: "tip" });
    expect(truck.vehicleBedTarget).toBeCloseTo(DUMP_BED.maxTilt, 5);
    for (let i = 0; i < 60; i++) await s.step(idle);
    const partial = required(truck.vehicleBedTilt);
    expect(partial).toBeGreaterThan(0.2);
    expect(partial).toBeLessThan(DUMP_BED.maxTilt);
    await s.reload();
    truck = required(
      [...(s.realm.vehicleRegistry?.states.values() ?? [])].find((c) => hasDumpBed(c.entity)),
    ).entity;
    expect(truck.vehicleBedTilt).toBeGreaterThanOrEqual(partial);
    expect(truck.vehicleBedTarget).toBeCloseTo(DUMP_BED.maxTilt, 5);
    for (let i = 0; i < 240; i++) await s.step(idle);
    expect(truck.vehicleBedTilt).toBe(truck.vehicleBedTarget);
    // The cab driver may operate the bed, but cannot drive until it is lowered.
    s.realm.vehicles.enter(s.player, truck.id);
    const start = { ...truck.position };
    for (let i = 0; i < 60; i++) await s.step({ ...idle, dx: 1 });
    expect(Math.hypot(truck.position.wx - start.wx, truck.position.wy - start.wy)).toBeLessThan(1);
    await s.command({ kind: "vehicle-bed", entityId: truck.id, action: "lower" });
    for (let i = 0; i < 240; i++) await s.step(idle);
    expect(truck.vehicleBedTilt).toBeUndefined();
    for (let i = 0; i < 60; i++) await s.step({ ...idle, dx: 1 });
    expect(truck.position.wx - start.wx).toBeGreaterThan(10);
    expect(() =>
      controlDumpBed(s.realm.vehicles, s.player, { ...tip, entityId: truck.id }),
    ).toThrow(/stop/);
  } finally {
    await s.close();
  }
});
