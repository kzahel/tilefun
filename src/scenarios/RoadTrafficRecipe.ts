import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

export const TRAFFIC_STARTS = {
  sidewalk: { position: { wx: -240, wy: 128 }, z: 0 },
  crossing: { position: { wx: 96, wy: 96 }, z: 0 },
  "top road": { position: { wx: 0, wy: -160 }, z: 0 },
  "bottom road": { position: { wx: 0, wy: 160 }, z: 0 },
};

/** A loop and crossing using ordinary road planning, Worker authority and physics. */
export function roadTrafficRecipe(): ScenarioRecipe {
  const segments = [
    [-24, -16, 24, -16],
    [24, -16, 24, 16],
    [24, 16, -24, 16],
    [-24, 16, -24, -16],
    [-24, 0, 24, 0],
    [0, -16, 0, 16],
  ];
  return {
    version: 1,
    id: "road-traffic",
    generation: FLAT_SCENARIO,
    player: createPlayer(-240, 128),
    props: [],
    roads: [
      { left: -448, top: -320, right: 448, bottom: -192 },
      { left: -448, top: 192, right: 448, bottom: 320 },
      { left: -448, top: -320, right: -320, bottom: 320 },
      { left: 320, top: -320, right: 448, bottom: 320 },
      { left: -448, top: -64, right: 448, bottom: 64 },
      { left: -64, top: -320, right: 64, bottom: 320 },
    ],
    trafficRoads: segments.map(([ax = 0, ay = 0, bx = 0, by = 0]) => ({
      a: { x: ax, y: ay },
      b: { x: bx, y: by },
      width: 8,
      intercity: false,
    })),
    parkedVehicles: [
      { name: "car", model: "compact-1", wx: -240, wy: 96, facing: Direction.Right },
    ],
  };
}
