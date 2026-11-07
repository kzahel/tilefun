import { expect, it } from "vitest";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { durableId } from "../persistence/ActorRecords.js";
import { required } from "../shared/required.js";
import { faunaType } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";
import { resolvePredatorCatches } from "./predatorAI.js";
import { tickWildlifeRespawns } from "./WildlifeRespawns.js";

const wet = {
  isWater: () => true,
  isDeepWater: () => true,
  canOccupy: () => true,
  surfaceZ: () => 0,
};
it("orcas can eat natural sharks without reciprocal hunts or player meals", () => {
  const manager = new EntityManager(),
    orca = manager.spawn(createPredator("orca", 0, 0)),
    shark = manager.spawn(createPredator("shark", 38, 0));
  expect(canEat(orca, shark)).toBe(true);
  expect(canEat(shark, orca)).toBe(false);
  expect(canEat(orca, createPlayer(0, 0))).toBe(false);
  shark.naturalSpawnId = "natural-shark";
  required(shark.predator).home = { wx: 100, wy: 100 };
  Object.assign(required(orca.predator), {
    state: "pounce",
    elapsed: 0.5,
    targetId: durableId(shark),
  });
  resolvePredatorCatches(manager, [...manager.entities], wet, []);
  tickWildlifeRespawns(manager, 120, wet, []);
  const replacement = required(manager.entities.find((e) => e.type === shark.type));
  expect(replacement.naturalSpawnId).toBe("natural-shark");
  expect(replacement.predator?.home).toEqual(replacement.position);
  expect(replacement.predator?.targetId).toBeUndefined();
  expect(orca.predator?.meals).toBe(1);
  expect(manager.entities.filter((e) => e.type === faunaType("fish"))).toHaveLength(0);
});
