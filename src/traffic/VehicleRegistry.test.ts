import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { required } from "../shared/required.js";

it("reads durable old traffic poses as independent bodies and rejects a malformed batch atomically", async () => {
  const s = await ScenarioSession.create({
    version: 1,
    id: "vehicle-record-migration",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
  });
  try {
    const registry = required(s.realm.vehicleRegistry);
    const old = {
      identity: "traffic-v1:old-truck",
      model: "dump-truck",
      wx: 160,
      wy: 0,
      wz: 12,
      vx: 3,
      vy: 0,
      persistentId: "old-truck",
      originScope: "0,0",
      laneId: "removed-route",
      nextId: null,
      x: 160,
      y: 0,
      distance: 10,
      turning: false,
      choices: 1,
      speed: 3,
      towTargetIdentity: "old-load",
      vehicleBedTilt: 0.8,
      vehicleRamp: 1,
    };
    expect(() => registry.restore([old, { ...old, identity: "bad", wx: NaN }])).toThrow(/Invalid/);
    expect(registry.states.size).toBe(0);
    registry.restore([old]);
    const e = required([...registry.states.values()][0]).entity;
    expect(e.position).toEqual({ wx: 160, wy: 0 });
    expect(e.wz).toBe(12);
    expect(e.velocity).toEqual({ vx: 3, vy: 0 });
    expect(e.persistentId).toBe("old-truck");
    expect(e).not.toHaveProperty("towTargetId");
    expect(e).not.toHaveProperty("vehicleBedTilt");
    expect(e).not.toHaveProperty("vehicleRamp");
    registry.restore([old]);
    expect(registry.states.size).toBe(1);
    expect(() => registry.restore([{ ...old, persistentId: "conflicting-owner" }])).toThrow(
      /Conflicting/,
    );
    const saved = registry.snapshot(required(registry.states.get(e.id)));
    expect(saved.version).toBe(2);
    expect("laneId" in saved).toBe(false);
  } finally {
    await s.close();
  }
});

it("resumes a falling vehicle through a durable reload without resetting its vertical velocity", async () => {
  const s = await ScenarioSession.create({
    version: 1,
    id: "falling-car-save",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
    parkedVehicles: [{ name: "car", model: "compact-1", wx: 160, wy: 0, z: 40, facing: 3 }],
  });
  const car = () => required(s.realm.vehicleRegistry?.states.get(s.handles.car ?? -1)).entity;
  try {
    car().jumpVZ = -80;
    await s.step({ dx: 0, dy: 0, jump: false, sprinting: false });
    const z = car().wz ?? 0,
      vz = car().jumpVZ ?? 0;
    expect(vz).toBeLessThan(-80);
    await s.reload();
    expect(car().jumpVZ).toBeCloseTo(vz, 4);
    await s.step({ dx: 0, dy: 0, jump: false, sprinting: false });
    expect(car().wz).toBeLessThan(z + vz / 120);
  } finally {
    await s.close();
  }
});

it("saves and reloads an overturned vehicle's orientation and angular momentum", async () => {
  const s = await ScenarioSession.create({
    version: 1,
    id: "rotated-vehicle-record",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
  });
  try {
    const registry = required(s.realm.vehicleRegistry),
      state = required(registry.place("compact-1", 96, 0));
    state.entity.bodyRotation = [0.5, 0.5, 0.5, 0.5];
    state.entity.bodyAngularVelocity = [1, -2, 3];
    const saved = registry.snapshot(state);
    registry.onChange?.(state, false);
    await s.reload();
    const restored = required([...required(s.realm.vehicleRegistry).states.values()][0]).entity;
    expect(restored.bodyRotation).toEqual(saved.bodyRotation);
    expect(restored.bodyAngularVelocity).toEqual([1, -2, 3]);
    expect(() =>
      registry.restore([{ ...saved, identity: "bad-rotation", bodyRotation: [0, 0, 0, 0] }]),
    ).toThrow(/Invalid/);
  } finally {
    await s.close();
  }
});
