import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { characterRecipe } from "../scenarios/CharacterRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { CHARACTERS } from "./CharacterCatalog.js";

const def = required(CHARACTERS[0]);
async function walk(
  settings: typeof def.defaults,
  x: number,
  y: number,
  dx: number,
  dy: number,
  steps: number,
) {
  const recipe = characterRecipe(def, settings);
  recipe.player.position = { wx: x, wy: y };
  const session = await ScenarioSession.create(recipe);
  try {
    for (let i = 0; i < steps; i++) await session.step({ dx, dy, jump: false, sprinting: false });
    return JSON.parse(JSON.stringify(session.player.player)) as typeof recipe.player;
  } finally {
    await session.close();
  }
}
it("uses real Realm collision for walls and candidate passage widths", async () => {
  expect((await walk(def.defaults, -64, 8, 0, -1, 180)).position.wy).toBeGreaterThanOrEqual(-19.01);
  expect((await walk(def.defaults, 68, 8, 0, -1, 180)).position.wy).toBeLessThan(-40);
  expect(
    (await walk({ ...def.defaults, width: 20 }, 68, 8, 0, -1, 180)).position.wy,
  ).toBeGreaterThanOrEqual(-19.01);
});
it("uses real Realm step and overhead clearance with candidate physical height", async () => {
  const step = await walk(def.defaults, -96, 40, 1, 0, 80);
  expect(step.wz).toBeGreaterThan(0);
  expect((await walk(def.defaults, 68, 68, 0, -1, 120)).position.wy).toBeGreaterThanOrEqual(55.99);
  expect(
    (await walk({ ...def.defaults, physicalHeight: 19 }, 68, 68, 0, -1, 120)).position.wy,
  ).toBeLessThan(35);
});
