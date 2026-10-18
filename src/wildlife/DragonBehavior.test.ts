import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createPredator } from "./Predator.js";
import { updatePredatorAI } from "./predatorAI.js";

const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
const idle = { dx: 0, dy: 0, sprinting: false, jump: false };

it("guards, sleeps and wakes with a warning without targeting the visitor", () => {
  const dragon = createPredator("small-dragon", 0, 0),
    ai = required(dragon.predator);
  ai.cooldown = 40;
  ai.timer = 0;
  updatePredatorAI(dragon, 0.1, open, [dragon], []);
  expect(ai.state).toBe("guard");
  updatePredatorAI(dragon, 2.1, open, [dragon], []);
  updatePredatorAI(dragon, 2.1, open, [dragon], []);
  expect(ai.state).toBe("sleep");
  expect(dragon.sprite?.clip).toBe(5);
  updatePredatorAI(dragon, 0.1, open, [dragon], [{ wx: 40, wy: 0 }]);
  expect(ai.state).toBe("display");
  expect(ai.targetId).toBeUndefined();
  expect(dragon.velocity).toEqual({ vx: 0, vy: 0 });
  expect(dragon.sprite?.clip).toBe(3);
  updatePredatorAI(dragon, 1.3, open, [dragon], [{ wx: 40, wy: 0 }]);
  expect(ai.state).toBe("guard");
  expect(ai.targetId).toBeUndefined();
  const restored = decodeActor(encodeActor(dragon));
  expect("predator" in restored && restored.predator).toEqual(ai);
});

it("owns one durable hoard, returns home, and respects deletion of its treasure", async () => {
  const dragon = createPredator("small-dragon", 144, 64);
  Object.assign(required(dragon.predator), { home: { wx: 64, wy: 64 }, cooldown: 60, timer: 0 });
  const session = await ScenarioSession.create({
    version: 1,
    id: "dragon-den",
    generation: FLAT_SCENARIO,
    player: createPlayer(64, 192),
    props: [],
    actors: [dragon],
    traffic: [],
  });
  try {
    const hoards = () =>
      session.realm.propManager.props.filter((p) => p.type === "prop-dragon-hoard");
    const animal = () => required(session.realm.entityManager.entities.find((e) => e.predator));
    await session.step(idle);
    expect(hoards()).toHaveLength(1);
    expect(hoards()[0]?.position).toEqual({ wx: 64, wy: 64 });
    const identity = hoards()[0]?.persistentId;
    for (let i = 0; i < 600; i++) await session.step(idle);
    expect(Math.hypot(animal().position.wx - 64, animal().position.wy - 64)).toBeLessThan(6);
    expect(["guard", "sleep", "rest"]).toContain(animal().predator?.state);
    await session.reload();
    expect(hoards()).toHaveLength(1);
    expect(hoards()[0]?.persistentId).toBe(identity);
    expect(animal().predator?.denPlaced).toBe(true);
    session.realm.propManager.remove(required(hoards()[0]).id);
    for (let i = 0; i < 30; i++) await session.step(idle);
    await session.reload();
    expect(hoards()).toHaveLength(0);
  } finally {
    await session.close();
  }
});
