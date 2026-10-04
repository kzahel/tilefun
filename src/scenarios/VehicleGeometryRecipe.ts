import { createPlayer } from "../entities/Player.js";
import { type Lane, path, samplePath } from "../traffic/LaneGraph.js";
import { railCrossingRecipe } from "./RailCrossingRecipe.js";
import { type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { undergroundGarageRecipe } from "./UndergroundGarageRecipe.js";

export const VEHICLE_GARAGE_STARTS = {
  entrance: { position: { wx: -272, wy: 48 }, z: 0 },
  garage: { position: { wx: 80, wy: -40 }, z: -48 },
  street: { position: { wx: 80, wy: 0 }, z: 0 },
};
export const VEHICLE_BRIDGE_STARTS = {
  bridge: { position: { wx: 32, wy: 8 }, z: 64 },
  trackside: { position: { wx: 80, wy: 40 }, z: 0 },
};

/** Straight, terminal production traffic routes. The chassis stays level;
 * shared footprint support supplies height and checks the whole body envelope. */
export function vehicleGeometryRecipe(garage: boolean, reverse = false): ScenarioRecipe {
  const base = garage ? undergroundGarageRecipe() : railCrossingRecipe();
  const a = garage ? { x: reverse ? 80 : -272, y: 0 } : { x: 0, y: reverse ? -384 : 384 };
  const b = garage ? { x: reverse ? -320 : 128, y: 0 } : { x: 0, y: reverse ? 416 : -416 };
  const route = path([a, b]);
  const lane: Lane = {
    id: `vehicle-${garage ? "garage" : "bridge"}-${reverse ? "return" : "outbound"}`,
    from: "start",
    to: "end",
    a,
    b,
    path: route,
    direction: samplePath(route, 0).direction,
    width: 96,
    intercity: false,
    surfaceFollowing: true,
  };
  const start = garage ? VEHICLE_GARAGE_STARTS.garage : VEHICLE_BRIDGE_STARTS.bridge;
  const player = createPlayer(start.position.wx, start.position.wy);
  player.wz = player.groundZ = start.z;
  return {
    ...base,
    id: lane.id,
    player,
    props: [
      ...base.props.filter((p) => p.collider?.surface),
      ...(garage ? scenarioWalls(-352, -144, 256, 144) : scenarioWalls(-672, -464, 672, 464)),
    ],
    roads: [
      garage
        ? { left: -336, right: 160, top: -32, bottom: 32 }
        : { left: -48, right: 48, top: -448, bottom: 448 },
    ],
    trafficLanes: [lane],
    trafficSpeed: 72,
    traffic: [
      {
        name: "car",
        model: "compact-1",
        laneId: lane.id,
        x: a.x,
        y: a.y,
        distance: 0,
        z: garage && reverse ? -48 : 0,
      },
    ],
  };
}
