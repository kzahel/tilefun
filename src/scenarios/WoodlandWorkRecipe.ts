import { createBall } from "../entities/Ball.js";
import { createPlayer } from "../entities/Player.js";
import { durableId } from "../persistence/ActorRecords.js";
import { createFauna, type FaunaSpecies } from "../wildlife/Fauna.js";
import { createFoodSource, createForageItem, freshBallWork } from "../wildlife/ForageResources.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";
export function woodlandWorkRecipe(
  kind: "capuchin" | "raccoon" | "cat",
  coat?: FaunaSpecies,
): ScenarioRecipe {
  const animal = createFauna(
    coat ?? (kind === "capuchin" ? "capuchin-monkey" : kind),
    kind === "capuchin" ? 176 : 128,
    176,
  );
  const actors = [animal];
  if (kind === "capuchin") actors.push(createFoodSource("fruit-tree", 128, 104));
  if (kind === "raccoon") {
    const squirrel = createFauna("red-squirrel", 200, 208),
      cache = createForageItem("cache", 176, 176);
    if (squirrel.fauna) {
      squirrel.fauna.home = { wx: 168, wy: 160 };
      squirrel.fauna.shelter = { wx: 168, wy: 160 };
    }
    squirrel.persistentId = "demonstration:raccoon:squirrel";
    cache.persistentId = "demonstration:raccoon:cache";
    if (cache.workItem) {
      cache.workItem.owner = durableId(squirrel);
      cache.workItem.contents = ["nut", "fruit", "nut"];
    }
    squirrel.animalWork = {
      kind: "squirrel",
      state: "rest",
      elapsed: 0,
      cooldown: 0,
      deliveries: 1,
      eaten: 0,
      retrieved: 0,
      siteId: durableId(cache),
    };
    actors.push(squirrel, cache, createFoodSource("nut-tree", 128, 104));
  }
  if (kind === "cat") {
    const ball = createBall(192, 176);
    ball.workItem = freshBallWork("demonstration", { wx: 192, wy: 176 });
    actors.push(ball);
  }
  return {
    version: 1,
    id: `woodland-work-${coat ?? kind}-v1`,
    generation: FLAT_SCENARIO,
    player: createPlayer(288, 280),
    props: [],
    nativeProps: [{ type: "prop-oak-tree", wx: 128, wy: 104 }],
    actors,
    traffic: [],
  };
}
