import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { TrafficStrategy } from "../traffic/TrafficNetwork.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

/** Inspect the ordinary generated city with one staged incoming road car. */
export function cityParkingRecipe(): ScenarioRecipe {
  const strategy = new TrafficStrategy(regionalWorld(2026));
  const center = required(strategy.districts.owner(0, 0)?.shoppingCenters?.[0]);
  const wx = center.wx + 1256,
    wy = center.roadY - 32;
  const lane = required(
    [...strategy.trafficNetwork(wx, wy).lanes.values()].find(
      (l) =>
        l.direction === Direction.Left &&
        Math.abs(required(l.path.points[0]).y - wy) < 1 &&
        required(l.path.points[0]).x >= wx &&
        required(l.path.points.at(-1)).x < wx,
    ),
  );
  return {
    version: 1,
    id: "city-shopping-v1",
    generation: createDescriptor("regional", 2026),
    player: createPlayer(center.wx + 608, center.wy + 192),
    props: [],
    trafficPopulation: true,
    traffic: [
      {
        model: "compact-1",
        laneId: lane.id,
        x: wx,
        y: wy,
        distance: required(lane.path.points[0]).x - wx,
        name: "car",
      },
    ],
  };
}
