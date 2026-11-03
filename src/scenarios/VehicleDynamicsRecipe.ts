import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { surfaceProp } from "./WorldGeometryRecipe.js";

export const DYNAMICS_STARTS = {
  drive: { position: { wx: -280, wy: 38 }, z: 0 },
  passage: { position: { wx: 118, wy: 120 }, z: 0 },
  jump: { position: { wx: -224, wy: 198 }, z: 0 },
  ledge: { position: { wx: -128, wy: -162 }, z: 0 },
  recover: { position: { wx: -280, wy: 38 }, z: 0 },
  ramp: { position: { wx: -80, wy: 0 }, z: 28 },
  roof: { position: { wx: -280, wy: 0 }, z: 24 },
};
/** Playable review course; every ramp/deck/car uses normal Realm owners. */
export function vehicleDynamicsRecipe(
  model = "compact-1",
  route: keyof typeof DYNAMICS_STARTS = "drive",
): ScenarioRecipe {
  const start = DYNAMICS_STARTS[route];
  const car =
    route === "ramp" || route === "roof"
      ? { wx: -280, wy: 0, facing: Direction.Right }
      : route === "passage"
        ? { wx: 80, wy: 120, facing: Direction.Up }
        : { wx: start.position.wx, wy: start.position.wy - 38, facing: Direction.Right };
  return {
    version: 1,
    id: "vehicle-dynamics-v1",
    generation: FLAT_SCENARIO,
    player: { ...createPlayer(start.position.wx, start.position.wy), wz: start.z },
    measurePhysics: true,
    props: [
      surfaceProp(
        { left: -192, top: -64, right: 0, bottom: 64 },
        {
          id: "ascent",
          spaceId: "bridge",
          z: 0,
          riseX: 48,
          riseY: 0,
          thickness: 6,
          connectsTo: ["bridge"],
        },
      ),
      surfaceProp(
        { left: 0, top: -64, right: 160, bottom: 64 },
        {
          id: "bridge",
          spaceId: "bridge",
          z: 48,
          riseX: 0,
          riseY: 0,
          thickness: 6,
          connectsTo: ["ascent", "descent"],
        },
      ),
      surfaceProp(
        { left: 160, top: -64, right: 352, bottom: 64 },
        {
          id: "descent",
          spaceId: "bridge",
          z: 48,
          riseX: -48,
          riseY: 0,
          thickness: 6,
          connectsTo: ["bridge"],
        },
      ),
      surfaceProp(
        { left: -160, top: 112, right: 0, bottom: 208 },
        { id: "jump", spaceId: "jump", z: 0, riseX: 48, riseY: 0, thickness: 6, connectsTo: [] },
      ),
      surfaceProp(
        { left: -64, top: -224, right: 128, bottom: -176 },
        {
          id: "ledge-ramp",
          spaceId: "ledge",
          z: 0,
          riseX: 48,
          riseY: 0,
          thickness: 6,
          connectsTo: ["ledge"],
        },
      ),
      surfaceProp(
        { left: 128, top: -224, right: 256, bottom: -176 },
        {
          id: "ledge",
          spaceId: "ledge",
          z: 48,
          riseX: 0,
          riseY: 0,
          thickness: 6,
          connectsTo: ["ledge-ramp"],
        },
      ),
      ...scenarioWalls(-400, -304, 528, 288),
    ],
    roads: [
      { left: -368, top: -48, right: 416, bottom: 48 },
      { left: -224, top: 112, right: 96, bottom: 208 },
    ],
    parkedVehicles: [
      {
        name: "car",
        model,
        ...car,
        ...(route === "recover"
          ? {
              rotation: [1, 0, 0, 0] as const,
              z: createVehicle(model, 0, 0).collider?.physicalHeight ?? 24,
            }
          : {}),
      },
      { name: "truck", model: "dump-truck", wx: -240, wy: -160, facing: Direction.Right },
      { name: "overlap-car", model: "compact-1", wx: -200, wy: -216, facing: Direction.Down },
    ],
  };
}
