import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { createRabbit } from "../wildlife/Rabbit.js";
import { createRobin } from "../wildlife/Robin.js";
import { robinTreePerches } from "../wildlife/robinPerches.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

/** All triggers are ordinary actors/food/trees; the lab owns no behavior loop. */
export function meadowWorkRecipe(kind: "rabbit" | "robin" | "meerkat"): ScenarioRecipe {
  const worker =
    kind === "rabbit"
      ? createRabbit(128, 176)
      : kind === "robin"
        ? createRobin(128, 148)
        : createFauna("meerkat", 128, 176);
  const actors = [
    worker,
    createForageItem(kind === "rabbit" ? "greens" : kind === "robin" ? "seed" : "fruit", 168, 188),
  ];
  if (kind === "meerkat")
    for (const [x, y] of [
      [100, 204],
      [152, 216],
    ])
      actors.push(createFauna("meerkat", x ?? 0, y ?? 0));
  if (kind === "robin") {
    const perch = robinTreePerches([createProp("prop-oak-tree", 128, 104)])[0];
    if (!perch) throw Error("Robin demonstration needs a native tree crown");
    worker.position = { wx: perch.wx, wy: perch.wy };
    worker.wz = perch.z;
    if (worker.robin) worker.robin.state = "perch";
  }
  return {
    version: 1,
    id: `meadow-work-${kind}-v1`,
    generation: FLAT_SCENARIO,
    player: createPlayer(288, 280),
    props: [],
    nativeProps: kind === "robin" ? [{ type: "prop-oak-tree", wx: 128, wy: 104 }] : [],
    actors,
    traffic: [],
  };
}
