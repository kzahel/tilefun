import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { RailwayStrategy } from "../railway/RailwayStrategy.js";
import { ROAD_RAIL_BRIDGE } from "../railway/RoadRailBridge.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

export const GENERATED_CROSSINGS = [
  { seed: 100, cx: -2, cy: -1, label: "Seed 100 · chunk seam" },
  { seed: 42, cx: 2, cy: -4, label: "Seed 42 · northern route" },
  { seed: 3, cx: -4, cy: -5, label: "Seed 3 · western route" },
] as const;
/** A real regional world, not painted fixture roads or substitute routes/props.
 * Only the initial observer/car/train poses are staged to avoid minutes of waiting. */
export function generatedCrossingRecipe(index = 0, reverse = false) {
  const choice = required(GENERATED_CROSSINGS[index]);
  const strategy = new RailwayStrategy(regionalWorld(choice.seed));
  const line = required(strategy.railways.owner(choice.cx, choice.cy));
  const bridge = required(line.bridges[0]);
  const x = bridge.x * 16,
    y = bridge.y * 16;
  const lane = required(
    [...strategy.trafficNetwork(x, y).lanes.values()].find(
      (l) =>
        l.surfaceFollowing &&
        l.a.x === x &&
        (reverse ? l.a.y < l.b.y : l.a.y > l.b.y) &&
        Math.min(l.a.y, l.b.y) < y - 512 &&
        Math.max(l.a.y, l.b.y) > y + 512,
    ),
  );
  const first = required(lane.path.points[0]);
  const distance = Math.abs(y + (reverse ? -548 : 548) - first.y);
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
    physics: { walkSpeed: 120 },
    railwayStarts: [{ id: line.id, x: x + (reverse ? 480 : -480), target: reverse ? 0 : 1 }],
    trafficSpeed: 72,
    traffic: [{ name: "car", model: "compact-1", laneId: lane.id, x, y, distance }],
  };
  return { recipe, starts, bridge, line };
}
