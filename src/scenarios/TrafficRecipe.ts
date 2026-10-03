import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createGenerator } from "../generation/Generator.js";
import { samplePath } from "../traffic/LaneGraph.js";
import type { TrafficStrategy } from "../traffic/TrafficNetwork.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";
export const TRAFFIC_DEMO_GENERATION = {
  type: "regional",
  version: "regional-v11",
  seed: 2026,
  preset: "temperate-v1",
} as const;
export function trafficRecipe(): ScenarioRecipe {
  const strategy = createGenerator(TRAFFIC_DEMO_GENERATION).terrain as TrafficStrategy;
  const graph = strategy.trafficNetwork(4800, 8304);
  const lane = required(
    [...graph.lanes.values()]
      .filter(
        (l) =>
          !l.intercity && l.direction === Direction.Right && l.width >= 128 && l.path.length > 300,
      )
      .sort(
        (a, b) => Math.hypot(a.a.x - 4800, a.a.y - 8304) - Math.hypot(b.a.x - 4800, b.a.y - 8304),
      )[0],
  );
  const reverse = [...graph.lanes.values()].find((l) => l.from === lane.to && l.to === lane.from);
  const pose = samplePath(lane.path, 80);
  return {
    version: 1,
    id: "traffic",
    generation: TRAFFIC_DEMO_GENERATION,
    player: createPlayer(pose.x + 90, pose.y + 3),
    props: [],
    traffic: [
      { name: "car", model: "compact-1", laneId: lane.id, x: 4800, y: 8304, distance: 80 },
      ...(reverse
        ? [
            {
              name: "bus",
              model: "bus-1",
              laneId: reverse.id,
              x: 4800,
              y: 8304,
              distance: Math.min(120, reverse.path.length / 2),
            },
          ]
        : []),
    ],
  };
}
