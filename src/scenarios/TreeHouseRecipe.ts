import { createPlayer } from "../entities/Player.js";
import { DECK_Z, TREE_HOUSE_LAYOUT, treeHousePoint, treeHouseProp } from "../entities/TreeHouse.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";

/** Tree house feet (composite bottom centre); the cabin sits near the origin. */
export const TREE_HOUSE_AT = { wx: 0, wy: 96 } as const;
const { ladder, room, door } = TREE_HOUSE_LAYOUT;
const ladderX = (ladder.left + ladder.right) / 2;
const at = (x: number, y: number) => treeHousePoint(TREE_HOUSE_AT.wx, TREE_HOUSE_AT.wy, x, y);

/** Player feet are the bottom of a 6px-deep footprint. */
export const TREE_HOUSE_STARTS = {
  ground: { position: at(ladderX, ladder.bottom + 12), z: 0 },
  porch: { position: at(ladderX, room.bottom + 9), z: DECK_Z },
  inside: { position: at((door.left + door.right) / 2, room.bottom - 8), z: DECK_Z },
} as const;

/** Workshop tree house: ladder, porch and cabin on the ordinary shared Realm physics. */
export function treeHouseRecipe(): ScenarioRecipe {
  const start = TREE_HOUSE_STARTS.ground;
  return {
    version: 1,
    id: "tree-house-v1",
    generation: FLAT_SCENARIO,
    player: { ...createPlayer(start.position.wx, start.position.wy), wz: 0 },
    props: [
      treeHouseProp(TREE_HOUSE_AT.wx, TREE_HOUSE_AT.wy),
      ...scenarioWalls(-256, -176, 256, 208),
    ],
    nativeProps: [
      { type: "prop-oak-tree", wx: -176, wy: -40 },
      { type: "prop-oak-tree", wx: 168, wy: 8 },
      { type: "prop-oak-tree", wx: 136, wy: -120 },
      { type: "prop-picnic-table", wx: 128, wy: 160 },
      { type: "prop-bench", wx: -136, wy: 152 },
    ],
  };
}
