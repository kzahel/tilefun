import { applyPlayerModel } from "../characters/PlayerModels.js";
import { createBall } from "../entities/Ball.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { type Lane, path } from "../traffic/LaneGraph.js";
import { DUMP_BED } from "../traffic/VehicleBed.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

/** Qualified level-bed proof: ordinary traffic, player, physics and persistence. */
export function truckBedRecipe(direction = Direction.Right): ScenarioRecipe {
  const heading =
    direction === Direction.Left
      ? Math.PI
      : direction === Direction.Up
        ? -Math.PI / 2
        : direction === Direction.Down
          ? Math.PI / 2
          : 0;
  const c = Math.round(Math.cos(heading)),
    s = Math.round(Math.sin(heading));
  const a = { x: -512 * c, y: -512 * s },
    b = { x: 512 * c, y: 512 * s };
  const lane: Lane = {
    id: "truck-bed-road",
    from: "start",
    to: "finish",
    a,
    b,
    path: path([a, b]),
    direction,
    width: 128,
    intercity: false,
  };
  const player = createPlayer(DUMP_BED.center.x * c, DUMP_BED.center.x * s + 3);
  applyPlayerModel(player, "character-person-v1");
  player.wz = player.groundZ = DUMP_BED.floorZ;
  return {
    version: 1,
    id: `truck-bed-${direction}`,
    generation: FLAT_SCENARIO,
    player,
    props: [],
    actors: [
      createBall(-20 * c - 42 * s, -20 * s + 42 * c),
      createForageItem("fruit", -30 * c - 42 * s, -30 * s + 42 * c),
    ],
    trafficLanes: [lane],
    trafficSpeed: 0,
    roads: [
      c
        ? { left: -592, right: 592, top: -64, bottom: 64 }
        : { left: -64, right: 64, top: -592, bottom: 592 },
    ],
    traffic: [
      {
        name: "truck",
        model: "dump-truck",
        vehicleBed: true,
        laneId: lane.id,
        x: 0,
        y: 0,
        distance: 512,
      },
    ],
  };
}
