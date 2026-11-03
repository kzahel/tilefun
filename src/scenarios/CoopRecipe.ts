import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Movement } from "../input/ActionManager.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { surfaceProp } from "./WorldGeometryRecipe.js";

export const COOP_CASES = ["push", "opposed", "glance", "head", "reverse", "vehicle"] as const;
export type CoopCase = (typeof COOP_CASES)[number];
export const COOP_IDLE: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };

/** Diagnostic geometry is recipe data; the ordinary shared kernel remains unchanged. */
export function coopRecipe(scene: CoopCase): ScenarioRecipe {
  if (scene === "vehicle")
    return {
      version: 1,
      id: "coop-vehicle",
      generation: FLAT_SCENARIO,
      player: createPlayer(-64, 38),
      guest: createPlayer(-64, -38),
      measurePhysics: true,
      parkedVehicles: [
        { name: "car", model: "compact-1", wx: -64, wy: 0, facing: Direction.Right },
      ],
      props: [
        surfaceProp(
          { left: 0, top: -48, right: 96, bottom: 48 },
          {
            id: "ramp",
            spaceId: "bridge",
            z: 0,
            riseX: 24,
            riseY: 0,
            thickness: 6,
            connectsTo: ["deck"],
          },
        ),
        surfaceProp(
          { left: 96, top: -48, right: 192, bottom: 48 },
          {
            id: "deck",
            spaceId: "bridge",
            z: 24,
            riseX: 0,
            riseY: 0,
            thickness: 6,
            connectsTo: ["ramp"],
          },
        ),
        ...scenarioWalls(-144, -112, 288, 112),
      ],
    };
  const cube = createForageItem("seed", 12, 0);
  cube.collider = {
    offsetX: 0,
    offsetY: 0,
    width: 20,
    height: 20,
    physicalHeight: 20,
    solid: false,
  };
  const player = createPlayer(-40, 0),
    guest = createPlayer(45, 0);
  if (scene === "head") {
    guest.position.wx = 0;
    player.position.wx = 0;
    player.wz = 36;
  } else if (scene === "glance") guest.position = { wx: 0, wy: 8 };
  return {
    version: 1,
    id: `coop-${scene}`,
    generation: FLAT_SCENARIO,
    player,
    guest,
    actors: scene === "push" || scene === "opposed" ? [cube] : [],
    props: scenarioWalls(-112, -80, 112, 80),
    measurePhysics: true,
  };
}

/** Same inputs are available to native scenarios and the visual lab. */
export function coopScript(scene: CoopCase, tick: number, seat: 0 | 1): Movement {
  const t = tick % 360;
  if (t > 240) return COOP_IDLE;
  if (scene === "vehicle") return { ...COOP_IDLE, dx: seat === 0 && t < 180 ? 1 : 0 };
  if (scene === "head") return { ...COOP_IDLE, dx: seat === 0 && t > 60 && t < 90 ? 0.25 : 0 };
  if (scene === "glance") return { ...COOP_IDLE, dx: seat === 0 && t < 120 ? 1 : 0 };
  if (scene === "reverse")
    return { ...COOP_IDLE, dx: seat === 0 ? (t < 80 ? 1 : t < 100 ? -1 : t < 140 ? 1 : 0) : 0 };
  return {
    ...COOP_IDLE,
    dx: t < 120 ? (seat === 0 ? 1 : scene === "opposed" ? -1 : 0) : 0,
    jump: seat === 0 && t >= 160 && t < 170,
  };
}
