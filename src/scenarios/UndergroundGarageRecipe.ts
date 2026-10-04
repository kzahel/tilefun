import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { surfaceProp } from "./WorldGeometryRecipe.js";

export const GARAGE_STARTS = {
  entrance: { position: { wx: -216, wy: 8 }, z: 0 },
  garage: { position: { wx: 80, wy: 8 }, z: -48 },
  street: { position: { wx: 80, wy: 8 }, z: 0 },
} as const;

/** A real opening in the flat world's blocking base, with usable ground above.
 * No generation change, second realm, teleport trigger or special movement loop.
 */
export function undergroundGarageRecipe(): ScenarioRecipe {
  const room = { left: 0, top: -64, right: 160, bottom: 64 };
  return {
    version: 1,
    id: "underground-garage-v1",
    generation: FLAT_SCENARIO,
    player: createPlayer(-216, 8),
    physics: { walkSpeed: 72 },
    props: [
      surfaceProp(
        { left: -192, top: -32, right: 0, bottom: 32 },
        {
          id: "garage-ramp",
          spaceId: "garage-entry",
          z: 0,
          riseX: -48,
          riseY: 0,
          thickness: 8,
          connectsTo: ["garage-floor"],
          excavation: {},
        },
      ),
      surfaceProp(room, {
        id: "garage-floor",
        spaceId: "garage",
        z: -48,
        riseX: 0,
        riseY: 0,
        thickness: 8,
        connectsTo: ["garage-ramp"],
        excavation: { ceilingId: "garage-roof" },
      }),
      surfaceProp(room, {
        id: "garage-roof",
        spaceId: "outside",
        z: 0,
        riseX: 0,
        riseY: 0,
        thickness: 8,
        connectsTo: [],
      }),
      ...scenarioWalls(-256, -144, 224, 144),
    ],
  };
}
