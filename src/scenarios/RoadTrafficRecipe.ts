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

/** Sustained closed-grid traffic, using ordinary population and route authority. */
export function crowdedRoadTrafficRecipe(): ScenarioRecipe {
  const recipe = roadTrafficRecipe();
  recipe.player = createPlayer(160, 160);
  recipe.id = "crowded-road-traffic";
  recipe.measurePhysics = true;
  recipe.parkedVehicles = [];
  recipe.roads = [];
  recipe.trafficRoads = [];
  for (const axis of [0, 1])
    for (const k of [-48, -16, 16, 48]) {
      recipe.roads.push(
        axis
          ? { left: k * 16 - 64, right: k * 16 + 64, top: -832, bottom: 832 }
          : { left: -832, right: 832, top: k * 16 - 64, bottom: k * 16 + 64 },
      );
      recipe.trafficRoads.push({
        a: axis ? { x: k, y: -48 } : { x: -48, y: k },
        b: axis ? { x: k, y: 48 } : { x: 48, y: k },
        width: 8,
        intercity: false,
      });
    }
  return recipe;
}

/** A speedway oval: two clockwise rings of ordinary sports-car racers. Asphalt
 * strips approximate the circuit; the rings' own lanes guide the cars. */
export function racetrackRecipe(): ScenarioRecipe {
  return {
    version: 1,
    id: "racetrack-traffic",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
    roads: [
      { left: -880, top: -560, right: 880, bottom: -336 },
      { left: -880, top: 336, right: 880, bottom: 560 },
      { left: -960, top: -560, right: -720, bottom: 560 },
      { left: 720, top: -560, right: 960, bottom: 560 },
    ],
    racetracks: [{ id: "lab-speedway", center: { x: 0, y: 0 } }],
  };
}

/** One generated-style shopping center beside a westbound boulevard. Passing road
 * compacts may turn in, park, send a shopper inside and rejoin the boulevard. */
export function shoppingRecipe(): ScenarioRecipe {
  return {
    version: 1,
    id: "shopping-visits",
    generation: FLAT_SCENARIO,
    player: createPlayer(640, 520),
    props: [],
    roads: [
      { left: -320, top: 576, right: 1600, bottom: 704 },
      { left: 0, top: 160, right: 1280, bottom: 576 },
    ],
    trafficRoads: [{ a: { x: 100, y: 40 }, b: { x: -20, y: 40 }, width: 8, intercity: false }],
    shoppingCenters: [{ id: "lab-center", wx: 0, wy: 0, roadY: 640 }],
    parkedVehicles: [
      {
        name: "visitor",
        model: "compact-1",
        wx: 1480,
        wy: 608,
        facing: Direction.Left,
        autonomous: true,
      },
    ],
  };
}
