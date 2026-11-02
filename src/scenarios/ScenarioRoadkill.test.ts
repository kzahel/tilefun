import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createFrog } from "../wildlife/Frog.js";
import { isRoadkill } from "../wildlife/Roadkill.js";
import { curvedTrainRecipe } from "./CurvedTrainRecipe.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

function frogInFront(s: ScenarioSession, car: Entity, reverse = false) {
  const box = getEntityAABB(car.position, required(car.collider));
  const frog = createFrog(reverse ? box.left - 3 : box.right + 3, (box.top + box.bottom) / 2);
  required(frog.frog).timer = 100;
  required(frog.wanderAI).timer = 100;
  frog.wz = frog.groundZ = car.wz ?? 0;
  frog.proceduralId = "roadkill-test-natural-frog";
  return s.realm.entityManager.spawn(frog);
}

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
