import { required } from "../art/ArtCatalog.js";
import {
  type CharacterDefinition,
  type CharacterSettings,
  createCharacterEntity,
} from "../characters/CharacterCatalog.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
/** Bounded fixture: a wall, 16px passage, three 4px steps, and 20px overhead clearance. */
export const CHARACTER_TEST_BLOCKS = [
  { x: -64, y: -25, w: 32, d: 10, z: 32, base: 0, name: "Wall" },
  { x: 48, y: -25, w: 24, d: 10, z: 32, base: 0, name: "16px gap" },
  { x: 88, y: -25, w: 24, d: 10, z: 32, base: 0, name: "" },
  { x: -72, y: 48, w: 16, d: 24, z: 4, base: 0, name: "Steps" },
  { x: -56, y: 48, w: 16, d: 24, z: 8, base: 0, name: "" },
  { x: -40, y: 48, w: 16, d: 24, z: 12, base: 0, name: "" },
  { x: 68, y: 50, w: 48, d: 12, z: 8, base: 20, name: "20px clearance" },
] as const;

export function characterObstacles(): Prop[] {
  return CHARACTER_TEST_BLOCKS.map((b, i) => ({
    id: i + 10,
    type: `character-test-block-${i}`,
    position: { wx: b.x, wy: b.y },
    sprite: {
      sheetKey: `character-test-block-${i}`,
      spriteWidth: b.w,
      spriteHeight: b.d + b.z + b.base,
      frameCol: 0,
      frameRow: 0,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: b.w,
      height: b.d,
      zHeight: b.z,
      zBase: b.base,
      walkableTop: true,
      passable: i >= 3 && i <= 5,
    },
    walls: null,
    isProp: true,
  }));
}
export function characterRecipe(
  def: CharacterDefinition,
  settings: CharacterSettings,
): ScenarioRecipe {
  const reference = createPlayer(-105, 6);
  return {
    version: 1,
    id: `character-${def.id}`,
    generation: FLAT_SCENARIO,
    player: createCharacterEntity(def, settings, 0, 8),
    physics: { walkSpeed: settings.speed, walkFrameDuration: 1000 / settings.fps },
    props: [
      ...characterObstacles(),
      ...scenarioWalls(-132, -64, 132, 76),
      {
        id: 2,
        type: "reference-player",
        position: reference.position,
        sprite: { ...required(reference.sprite) },
        collider: {
          ...required(reference.collider),
          zHeight: reference.collider?.physicalHeight ?? 12,
        },
        walls: null,
        isProp: true,
      },
    ],
  };
}
