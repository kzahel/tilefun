import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { VEHICLE_PALETTE } from "../editor/EditorPalettes.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { VEHICLE_MODELS } from "../traffic/Vehicle.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { around } from "./InterestManager.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const recipe = () => ({
  version: 1 as const,
  id: "vehicle-placement",
  generation: FLAT_SCENARIO,
  player: createPlayer(0, 0),
  props: [],
});
function place(s: ScenarioSession, model = "ambulance", wx = 160, wy = 0) {
  s.player.editorEnabled = true;
  s.realm.handleMessage(s.player.clientId, s.player, {
    type: "edit-spawn",
    entityType: `vehicle-v1:${model}`,
    wx,
    wy,
  });
  return [...required(s.realm.traffic).states.values()].at(-1);
}
it("offers and places every vehicle, including raised fire, in a world with no traffic lanes", async () => {
  expect(new Set(VEHICLE_PALETTE.map((e) => e.type))).toEqual(
    new Set(VEHICLE_MODELS.map((m) => `vehicle-v1:${m}`)),
  );
  const s = await ScenarioSession.create(recipe());
  try {
    for (const model of VEHICLE_MODELS) {
      const vehicle = required(place(s, model));
      expect(vehicle.entity.type).toBe(`vehicle-v1:${model}`);
      expect(vehicle.entity.collider?.width).toBeGreaterThan(0);
      expect(vehicle.placed).toBe(true);
      expect(vehicle.parked).toBe(true);
      expect(vehicle.entity.velocity).toEqual({ vx: 0, vy: 0 });
      s.realm.entityManager.remove(vehicle.entity.id);
    }
    expect(s.realm.traffic?.states.size).toBe(0);
  } finally {
    await s.close();
  }
});
it("rejects player/body/prop overlap, water, unloaded terrain and invalid coordinates without publishing", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const traffic = required(s.realm.traffic);
    expect(place(s, "compact-1", 0, 0)).toBeUndefined();
    expect(place(s, "compact-1", NaN, 0)).toBeUndefined();
    expect(place(s, "unknown")).toBeUndefined();
    expect(place(s, "compact-1", 2 ** 29, 0)).toBeUndefined();
    expect(place(s, "compact-1", 20000, 20000)).toBeUndefined();
    const prop = s.realm.propManager.add(createProp("prop-oak-tree", 160, 0));
    expect(place(s, "compact-1")).toBeUndefined();
    s.realm.propManager.remove(prop.id);
    const getCollision = s.realm.world.getCollisionIfLoaded.bind(s.realm.world);
    s.realm.world.getCollisionIfLoaded = () => CollisionFlag.Water;
    expect(place(s, "compact-1")).toBeUndefined();
    s.realm.world.getCollisionIfLoaded = getCollision;
    const vehicle = required(place(s));
    expect(traffic.place("compact-1", 160, 0)).toBeUndefined();
    expect(traffic.states.size).toBe(1);
    expect(vehicle.entity.position).toEqual({ wx: 160, wy: 0 });
  } finally {
    await s.close();
  }
});
it("drives, persists its inside seat and lights, and remains parked after exit and reload", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    let state = required(place(s));
    const identity = state.entity.proceduralId;
    s.player.editorEnabled = false;
    s.player.player.position = { wx: 160, wy: -16 };
    s.realm.vehicles.enter(s.player, state.entity.id);
    s.realm.vehicles.emergency(s.player, "toggle");
    for (let i = 0; i < 80; i++) await s.step({ ...idle, dx: 1 });
    expect(state.entity.position.wx).toBeGreaterThan(220);
    const position = { ...state.entity.position };
    await s.reload();
    state = required(
      [...required(s.realm.traffic).states.values()].find(
        (v) => v.entity.proceduralId === identity,
      ),
    );
    expect(state.placed).toBe(true);
    expect(state.entity.position).toEqual(position);
    expect(state.entity.emergencyState).toBe(3);
    expect(s.player.player.parentId).toBe(state.entity.id);
    s.realm.vehicles.exit(s.player);
    for (let i = 0; i < 90; i++) await s.step(idle);
    expect(state.parked).toBe(true);
    expect(state.entity.position).toEqual(position);
    await s.reload();
    state = required(
      [...required(s.realm.traffic).states.values()].find(
        (v) => v.entity.proceduralId === identity,
      ),
    );
    expect(state.entity.position).toEqual(position);
    s.realm.entityManager.remove(state.entity.id);
    await s.reload();
    expect(
      [...required(s.realm.traffic).states.values()].some(
        (v) => v.entity.proceduralId === identity,
      ),
    ).toBe(false);
  } finally {
    await s.close();
  }
});
it("evicts and rehydrates parked placements without requiring a generated lane", async () => {
  const s = await ScenarioSession.create(recipe());
  try {
    const state = required(place(s, "compact-1", 128, 128));
    const id = state.entity.proceduralId;
    const streaming = required(s.realm.streaming);
    s.player.player.position = { wx: 3072, wy: 3072 };
    streaming.interest.retainOwners(new Set(), "");
    streaming.interest.set("placement-test", [
      { range: around(12, 12, 0), activity: 2, reason: "player" },
    ]);
    for (let turn = 0; turn < 64 && s.realm.traffic?.states.size; turn++) {
      streaming.residency.reconcile(streaming.interest.demand(0));
      await streaming.residency.settle();
    }
    expect(s.realm.traffic?.states.size).toBe(0);
    streaming.interest.set("placement-test", [
      { range: around(0, 0, 1), activity: 2, reason: "player" },
    ]);
    streaming.residency.reconcile(streaming.interest.demand(0));
    await streaming.residency.settle();
    expect(
      [...required(s.realm.traffic).states.values()].find((v) => v.entity.proceduralId === id)
        ?.placed,
    ).toBe(true);
  } finally {
    await s.close();
  }
});
