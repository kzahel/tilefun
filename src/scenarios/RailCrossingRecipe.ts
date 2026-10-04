import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { surfaceProp } from "./WorldGeometryRecipe.js";

export const CROSSING_STARTS = {
  "south approach": { position: { wx: 0, wy: 352 }, z: 0 },
  bridge: { position: { wx: 0, wy: 8 }, z: 64 },
  trackside: { position: { wx: 0, wy: 40 }, z: 0 },
  "north approach": { position: { wx: 0, wy: -352 }, z: 0 },
} as const;

/** Road ramps run north/south; the native horizontal train stays on level track.
 * 56px under the deck clears its 44px body. No train grade/art substitution.
 */
export function railCrossingRecipe(): ScenarioRecipe {
  const start = CROSSING_STARTS["south approach"];
  return {
    version: 1,
    id: "world-geometry-rail-crossing-v1",
    generation: FLAT_SCENARIO,
    player: createPlayer(start.position.wx, start.position.wy),
    physics: { walkSpeed: 120 },
    railways: [{ id: "crossing-shuttle", start: -24, end: 24, y: 0 }],
    props: [
      surfaceProp(
        { left: -48, right: 48, top: -320, bottom: -64 },
        {
          id: "north-ramp",
          spaceId: "road",
          z: 0,
          riseX: 0,
          riseY: 64,
          thickness: 8,
          connectsTo: ["road-bridge"],
        },
      ),
      surfaceProp(
        { left: -48, right: 48, top: -64, bottom: 64 },
        {
          id: "road-bridge",
          spaceId: "road",
          z: 64,
          riseX: 0,
          riseY: 0,
          thickness: 8,
          connectsTo: ["north-ramp", "south-ramp"],
        },
      ),
      surfaceProp(
        { left: -48, right: 48, top: 64, bottom: 320 },
        {
          id: "south-ramp",
          spaceId: "road",
          z: 64,
          riseX: 0,
          riseY: -64,
          thickness: 8,
          connectsTo: ["road-bridge"],
        },
      ),
      ...scenarioWalls(-672, -400, 672, 400),
    ],
  };
}
