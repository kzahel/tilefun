import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createDeer } from "./Deer.js";
import { canEat } from "./FoodWeb.js";
import { createPredator, predatorType } from "./Predator.js";
import { updatePredatorAI } from "./predatorAI.js";
import { createRabbit } from "./Rabbit.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const open = { canOccupy: () => true, isWater: () => false, surfaceZ: () => 0 };
it("waits in its web until small prey approaches, then warns and scuttles", () => {
  const spider = createPredator("giant-spider", 0, 0),
    rabbit = createRabbit(120, 0);
  required(spider.predator).timer = 0;
  for (let i = 0; i < 60; i++) updatePredatorAI(spider, 0.1, open, [spider, rabbit], []);
  expect(spider.predator?.state).toBe("ambush");
  expect(spider.sprite?.clip).toBe(5);
  expect(spider.velocity).toEqual({ vx: 0, vy: 0 });
  expect(spider.predator?.targetId).toBeUndefined();
  expect(canEat(spider, createDeer(20, 0))).toBe(false);
  rabbit.position.wx = 60;
  required(spider.predator).timer = 0;
  updatePredatorAI(spider, 0.1, open, [spider, rabbit], []);
  expect(spider.predator?.state).toBe("display");
  expect(spider.predator?.targetId).toBe(rabbit.persistentId);
  updatePredatorAI(spider, 1.3, open, [spider, rabbit], []);
  updatePredatorAI(spider, 0.3, open, [spider, rabbit], []);
  updatePredatorAI(spider, 0.1, open, [spider, rabbit], []);
  expect(spider.predator?.state).toBe("chase");
  expect(Math.hypot(spider.velocity?.vx ?? 0, spider.velocity?.vy ?? 0)).toBe(48);
});
it("owns one persistent floor web, returns to ambush and never creates manual prey", async () => {
  const spider = createPredator("giant-spider", 120, 64);
  Object.assign(required(spider.predator), { home: { wx: 64, wy: 64 }, cooldown: 60, timer: 0 });
  const session = await ScenarioSession.create({
    version: 1,
    id: "spider-web",
    generation: FLAT_SCENARIO,
    player: createPlayer(64, 192),
    props: [],
    actors: [spider],
    traffic: [],
  });
  try {
    for (let i = 0; i < 600; i++) await session.step(idle);
    const animal = required(session.realm.entityManager.entities.find((e) => e.predator));
    expect(animal.predator?.state).toBe("ambush");
    expect(Math.hypot(animal.position.wx - 64, animal.position.wy - 64)).toBeLessThan(6);
    expect(session.realm.entityManager.entities.some((e) => e.rabbit)).toBe(false);
    const webs = () => session.realm.propManager.props.filter((p) => p.type === "prop-spider-web");
    expect(webs()).toHaveLength(1);
    const identity = webs()[0]?.persistentId;
    await session.reload();
    expect(webs()[0]?.persistentId).toBe(identity);
    session.realm.propManager.remove(required(webs()[0]).id);
    await session.reload();
    for (let i = 0; i < 60; i++) await session.step(idle);
    expect(webs()).toHaveLength(0);
  } finally {
    await session.close();
  }
});
it("seeds a repeatable web hunter and two natural rabbit placements in its clearing", () => {
  const nature = new NaturalLandscape(regionalWorld(2026), "thicket");
  let found = false;
  for (let gy = -12; gy < 12 && !found; gy++)
    for (let gx = -12; gx < 12 && !found; gx++) {
      const actors = Array.from({ length: 16 }, (_, i) =>
        nature.fiercePredators(gx * 4 + (i % 4), gy * 4 + Math.floor(i / 4)),
      ).flat();
      const spider = actors.find((a) => a.type === predatorType("giant-spider"));
      if (!spider) continue;
      const rabbits = actors.filter((a) => a.rabbit);
      expect(rabbits).toHaveLength(2);
      expect(rabbits.every((a) => a.featureId.startsWith("wildlife:fierce-prey:"))).toBe(true);
      expect(new Set(actors.map((a) => a.featureId)).size).toBe(3);
      expect(actors).toEqual(
        Array.from({ length: 16 }, (_, i) =>
          nature.fiercePredators(gx * 4 + (i % 4), gy * 4 + Math.floor(i / 4)),
        ).flat(),
      );
      found = true;
    }
  expect(found).toBe(true);
});
