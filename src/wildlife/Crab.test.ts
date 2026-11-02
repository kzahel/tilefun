import { expect, it } from "vitest";
import { createFauna } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { createPredator } from "./Predator.js";

it("makes the aquatic crab explicit bear prey without adding land-cat meals", () => {
  const crab = createFauna("crab", 128, 128);
  expect(canEat(createPredator("brown-bear", 128, 128), crab)).toBe(true);
  expect(canEat(createPredator("tiger", 128, 128), crab)).toBe(false);
});
