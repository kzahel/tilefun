import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import type { SurfacePatch } from "../physics/SurfacePatch.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";

export function surfaceProp(
  bounds: { left: number; top: number; right: number; bottom: number },
  surface: SurfacePatch,
): Prop {
  return {
    id: 0,
    type: "geometry-surface",
    isProp: true,
    position: { wx: (bounds.left + bounds.right) / 2, wy: bounds.bottom },
    sprite: {
      sheetKey: "geometry-surface",
      frameCol: 0,
      frameRow: 0,
      spriteWidth: 0,
      spriteHeight: 0,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top,
      surface,
    },
    walls: null,
  };
}

export const GEOMETRY_STARTS = {
  ramp: { position: { wx: -216, wy: 8 }, z: 0 },
  deck: { position: { wx: 80, wy: 8 }, z: 48 },
  passage: { position: { wx: 80, wy: 8 }, z: 0 },
} as const;

export function worldGeometryRecipe(): ScenarioRecipe {
  return {
    version: 1,
    id: "world-geometry-deck-v1",
    generation: FLAT_SCENARIO,
    player: createPlayer(GEOMETRY_STARTS.ramp.position.wx, GEOMETRY_STARTS.ramp.position.wy),
    physics: { walkSpeed: 72 },
    props: [
      surfaceProp(
        { left: -192, top: -32, right: 0, bottom: 32 },
        {
          id: "ramp",
          spaceId: "upper",
          z: 0,
          riseX: 48,
          riseY: 0,
          thickness: 8,
          connectsTo: ["deck"],
        },
      ),
      surfaceProp(
        { left: 0, top: -64, right: 160, bottom: 64 },
        {
          id: "deck",
          spaceId: "upper",
          z: 48,
          riseX: 0,
          riseY: 0,
          thickness: 8,
          connectsTo: ["ramp"],
        },
      ),
      ...scenarioWalls(-256, -144, 224, 144),
    ],
  };
}
