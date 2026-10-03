import { type FurnitureMotion, furnitureCollider } from "../interiors/FurnitureMotion.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
/** Compile the editor's semantic layout into ordinary gameplay props. */
export function furnitureRecipe(model: FurnitureMotion): ScenarioRecipe {
  const { left, top, right, bottom } = model.floor;
  return {
    version: 1,
    id: "furniture",
    generation: FLAT_SCENARIO,
    player: structuredClone(model.player),
    physics: { gravityScale: model.gravityScale },
    props: [
      ...scenarioWalls(left, top, right, bottom),
      ...model.objects.map((o, id) => ({
        id,
        type: `furniture-${o.placement.id}`,
        position: { wx: o.x, wy: o.y },
        isProp: true as const,
        sprite: {
          sheetKey: o.definition.key,
          frameCol: 0,
          frameRow: 0,
          spriteWidth: o.definition.size[0],
          spriteHeight: o.definition.size[1],
        },
        collider: furnitureCollider(o.definition, model.bodies[o.placement.id]),
        walls: null,
      })),
    ],
  };
}
