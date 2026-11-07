import { createBall } from "../entities/Ball.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { TOW, towAnchors } from "../traffic/Towing.js";
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
  bed: { position: { wx: -250, wy: -126 }, z: 0 },
  tow: { position: { wx: 300, wy: 186 }, z: 0 },
  transport: { position: { wx: 150, wy: 270 }, z: 0 },
};
/** Equipment yard (south-east): a tow truck backed up to a compact car's front
 * wheels, and a car transporter with a beetle parked behind its ramp. */
function equipmentYard(route: keyof typeof DYNAMICS_STARTS) {
  if (route !== "tow" && route !== "transport") return [];
  const front = towAnchors({ type: "vehicle-v1:compact-1" }).car.x;
  return [
    { name: "tow-truck", model: "tow-truck", wx: 340, wy: 160, facing: Direction.Right },
    {
      name: "tow-car",
      model: "compact-1",
      wx: 340 + TOW.hitch - front - 4,
      wy: 160,
      facing: Direction.Right,
    },
    { name: "transporter", model: "car-transporter", wx: 400, wy: 240, facing: Direction.Right },
    { name: "beetle", model: "beetle", wx: 150, wy: 240, facing: Direction.Right },
  ];
}
/** Loose balls resting in the parked dump truck's bed for the tipping start. */
function bedCargo() {
  return [
    [-262, -156],
    [-284, -166],
    [-246, -164],
  ].map(([wx = 0, wy = 0]) => ({ ...createBall(wx, wy), wz: 30, jumpVZ: 0 }));
}
/** Playable review course; every ramp/deck/car uses normal Realm owners. */
export function vehicleDynamicsRecipe(
  model = "compact-1",
  route: keyof typeof DYNAMICS_STARTS = "drive",
): ScenarioRecipe {
  const start = DYNAMICS_STARTS[route];
  const car =
    route === "ramp" ||
    route === "roof" ||
    route === "bed" ||
    route === "tow" ||
    route === "transport"
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
    ...(route === "bed" ? { actors: bedCargo() } : {}),
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
      ...equipmentYard(route),
    ],
  };
}
