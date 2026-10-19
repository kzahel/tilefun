import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { getEntityAABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFrog, FROG_TYPE } from "../wildlife/Frog.js";
import { isRoadkill, ROADKILL_LIFETIME } from "../wildlife/Roadkill.js";
import { curvedTrainRecipe } from "./CurvedTrainRecipe.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
function carRecipe(): ScenarioRecipe {
  return {
    version: 1,
    id: "roadkill",
    generation: FLAT_SCENARIO,
    props: [],
    player: createPlayer(128, 100),
    parkedVehicles: [{ model: "compact-1", wx: 128, wy: 128, facing: Direction.Right }],
  };
}
function frogInFront(s: ScenarioSession, car: Entity, reverse = false) {
  const box = getEntityAABB(car.position, required(car.collider));
  const frog = createFrog(reverse ? box.left - 3 : box.right + 3, (box.top + box.bottom) / 2);
  required(frog.frog).timer = 100;
  required(frog.wanderAI).timer = 100;
  frog.wz = frog.groundZ = car.wz ?? 0;
  frog.proceduralId = "roadkill-test-natural-frog";
  return s.realm.entityManager.spawn(frog);
}
it.each([false, true])(
  "drives through a frog with immutable replica prediction, saved death and expiring remains (reverse=%s)",
  async (reverse) => {
    const s = await ScenarioSession.create(carRecipe());
    try {
      const car = required([...required(s.realm.traffic).states.values()][0]);
      s.realm.vehicles.enter(s.player, car.entity.id);
      const frog = frogInFront(s, car.entity, reverse);
      const bodies = s.realm.entityManager.entities.map((e) =>
        deserializeEntity(serializeEntity(e)),
      );
      const frozen = structuredClone(bodies);
      const predictor = new PlayerPredictor();
      predictor.reset(
        deserializeEntity(serializeEntity(s.player.player)),
        deserializeEntity(serializeEntity(car.entity)),
      );
      const input = { ...idle, dx: reverse ? 0 : 1, reversing: reverse };
      for (let i = 0; i < 60; i++) {
        predictor.update(0.01667, input, s.realm.world, [], bodies);
        await s.step(input);
      }
      expect(s.realm.entityManager.byId.has(frog.id)).toBe(false);
      expect(bodies).toEqual(frozen);
      expect(predictor.mount?.position.wx).toBeCloseTo(car.entity.position.wx, 3);
      expect(Math.abs(car.entity.position.wx - 128)).toBeGreaterThan(25);
      const remains = required(s.realm.entityManager.entities.find((e) => isRoadkill(e.type)));
      const identity = remains.persistentId;
      expect(remains.deathTimer).toBeGreaterThan(ROADKILL_LIFETIME - 2);
      expect(remains.flashHidden).not.toBe(true);
      await s.reload();
      const restored = required(
        s.realm.entityManager.entities.find((e) => e.persistentId === identity),
      );
      expect(restored.type).toBe(remains.type);
      expect(restored.collider).toBeNull();
      expect(restored.frog).toBeUndefined();
      expect(restored.deathTimer).toBeCloseTo(required(remains.deathTimer), 4);
      expect(s.realm.entityManager.entities.some((e) => e.type === FROG_TYPE)).toBe(false);
      // Expiry runs through ordinary gameplay timers; shorten only the test's wait.
      restored.deathTimer = 0.05;
      for (let i = 0; i < 6; i++) await s.step(idle);
      expect(s.realm.entityManager.entities.some((e) => isRoadkill(e.type))).toBe(false);
      await s.reload();
      expect(
        s.realm.entityManager.entities.some((e) => e.type === FROG_TYPE || isRoadkill(e.type)),
      ).toBe(false);
    } finally {
      await s.close();
    }
  },
);
it.each([false, true])("shared train service kills small animals (curved=%s)", async (curved) => {
  const recipe: ScenarioRecipe = curved
    ? curvedTrainRecipe()
    : {
        version: 1,
        id: "roadkill-train",
        generation: FLAT_SCENARIO,
        props: [],
        player: createPlayer(0, -24),
        railways: [{ id: "roadkill-track", y: 0, start: -32, end: 64 }],
      };
  const s = await ScenarioSession.create(recipe);
  try {
    const service = required([...required(s.realm.railway).services.values()][0]);
    const car = required([...service.carriages].sort((a, b) => b.position.wx - a.position.wx)[0]);
    s.player.player.position = { wx: car.position.wx, wy: car.position.wy - 24 };
    s.realm.vehicles.enter(s.player, car.id);
    const frog = frogInFront(s, car);
    for (let i = 0; i < 60; i++) await s.step({ ...idle, dx: 1 });
    expect(s.realm.entityManager.byId.has(frog.id)).toBe(false);
    expect(s.realm.entityManager.entities.filter((e) => isRoadkill(e.type))).toHaveLength(1);
    expect(service.speed).toBeGreaterThan(0);
  } finally {
    await s.close();
  }
});
