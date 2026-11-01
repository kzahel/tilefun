import { createPlayer } from "../../entities/Player.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "../../scenarios/ScenarioRecipe.js";
import { surfaceProp } from "../../scenarios/WorldGeometryRecipe.js";
import {
  bridgeFixture,
  bridgeSections,
  PLAYER_FOOT_OFFSET,
  physicsStart,
} from "./BridgeFixture.js";

export const PHYSICS_PIXELS_PER_METRE = 16;

export function rapierScenarioRecipe(sections: number): ScenarioRecipe {
  const n = bridgeSections(sections),
    scale = PHYSICS_PIXELS_PER_METRE;
  const start = physicsStart(n, "ramp");
  const player = createPlayer(start.x * scale, start.z * scale);
  player.collider = {
    offsetX: 0,
    offsetY: 0.28 * scale,
    width: 0.56 * scale,
    height: 0.56 * scale,
    physicalHeight: 2 * PLAYER_FOOT_OFFSET * scale,
    solid: true,
    clientSolid: true,
  };
  player.wz = (start.y - PLAYER_FOOT_OFFSET) * scale;
  return {
    version: 1,
    id: "rapier-prediction-proof",
    generation: FLAT_SCENARIO,
    player,
    experimentalRapier: { sections: n },
    props: bridgeFixture(n)
      .filter((shape) => shape.id !== "ground")
      .map((shape) =>
        surfaceProp(
          {
            left: (shape.x - shape.width / 2) * scale,
            right: (shape.x + shape.width / 2) * scale,
            top: (shape.z - shape.depth / 2) * scale,
            bottom: (shape.z + shape.depth / 2) * scale,
          },
          {
            id: shape.id,
            spaceId: "rapier-proof",
            z: (shape.y + shape.low) * scale,
            riseX: (shape.high - shape.low) * scale,
            riseY: 0,
            thickness: shape.thickness * scale,
            connectsTo: [],
          },
        ),
      ),
  };
}
