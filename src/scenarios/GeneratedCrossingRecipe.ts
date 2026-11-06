import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { RailwayStrategy } from "../railway/RailwayStrategy.js";
import { ROAD_RAIL_BRIDGE } from "../railway/RoadRailBridge.js";
import { required } from "../shared/required.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

export const GENERATED_CROSSINGS = [
  { seed: 100, cx: -2, cy: -1, label: "Seed 100 · chunk seam" },
  { seed: 42, cx: 2, cy: -4, label: "Seed 42 · northern route" },
  { seed: 3, cx: -4, cy: -5, label: "Seed 3 · western route" },
] as const;
/** A real regional world, not painted fixture roads or substitute routes/props.
 * Only the initial observer/car poses are staged to avoid minutes of waiting. */
export function generatedCrossingRecipe(index = 0, reverse = false) {
  const choice = required(GENERATED_CROSSINGS[index]);
  const strategy = new RailwayStrategy(regionalWorld(choice.seed));
  const line = required(strategy.railways.owner(choice.cx, choice.cy));
  const bridge = required(line.bridges[0]);
  const x = bridge.x * 16,
    y = bridge.y * 16;
  const starts = {
    "south approach": { position: { wx: x + 76, wy: y + 480 }, z: 0 },
    bridge: { position: { wx: x + 76, wy: y + 8 }, z: ROAD_RAIL_BRIDGE.height },
    trackside: { position: { wx: x + 128, wy: y + 40 }, z: 0 },
    "north approach": { position: { wx: x + 76, wy: y - 480 }, z: 0 },
  };
  const start = starts["south approach"];
  const recipe: ScenarioRecipe = {
    version: 1,
    id: `generated-crossing-${choice.seed}`,
    generation: createDescriptor("regional", choice.seed),
    player: createPlayer(start.position.wx, start.position.wy),
    props: [],
    parkedVehicles: [
      {
        name: "car",
        model: "compact-1",
        wx: x,
        wy: y + (reverse ? -548 : 548),
        facing: reverse ? Direction.Down : Direction.Up,
        // The world's own parked/traffic cars may occupy the staged lane spot.
        backUp: 160,
      },
    ],
  };
  return { recipe, starts, bridge, line };
}
