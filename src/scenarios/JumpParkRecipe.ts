import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import {
  JUMP_WIDTH,
  type JumpName,
  jumpPlacements,
  jumpSlabProp,
} from "../generation/regional/JumpProfiles.js";
import { required } from "../shared/required.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";

const HALF_WIDTH = JUMP_WIDTH / 2;
export const JUMP_RUN_UP = -768;
/** Lab lanes (wy centres), each running one shared profile west→east from x=0. */
export const JUMP_LANES = {
  kicker: 0,
  sky: 192,
  double: -192,
  tabletop: 384,
  rollers: -384,
} as const satisfies Record<JumpName, number>;
export type JumpLane = keyof typeof JUMP_LANES;

export const JUMP_STARTS = Object.fromEntries(
  Object.entries(JUMP_LANES).map(([name, y]) => [
    name,
    { position: { wx: JUMP_RUN_UP, wy: y + 40 }, z: 0 },
  ]),
) as Record<JumpLane, { position: { wx: number; wy: number }; z: number }>;

/** The same ordinary slab props generated motocross parks place. */
function laneProps(name: JumpLane): Prop[] {
  return jumpPlacements(name, "e", 0, JUMP_LANES[name], `jump-park:${name}`).map((p) =>
    required(jumpSlabProp(p.propType, p.wx, p.wy)),
  );
}

/** Workshop jump park: ordinary surfaces, parked car and shared Realm physics. */
export function jumpParkRecipe(
  model = "rally-hatchback",
  lane: JumpLane = "kicker",
): ScenarioRecipe {
  const start = JUMP_STARTS[lane];
  const y = JUMP_LANES[lane];
  const lanes = Object.values(JUMP_LANES);
  return {
    version: 1,
    id: "jump-park-v1",
    generation: FLAT_SCENARIO,
    player: { ...createPlayer(start.position.wx, start.position.wy), wz: 0 },
    measurePhysics: true,
    props: [
      ...(Object.keys(JUMP_LANES) as JumpLane[]).flatMap(laneProps),
      ...scenarioWalls(-960, -512, 1856, 512),
    ],
    roads: lanes.map((ly) => ({
      left: -896,
      top: ly - HALF_WIDTH,
      right: 1792,
      bottom: ly + HALF_WIDTH,
    })),
    parkedVehicles: [{ name: "car", model, wx: JUMP_RUN_UP, wy: y, facing: Direction.Right }],
  };
}
