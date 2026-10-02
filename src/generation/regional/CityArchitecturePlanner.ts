import { edgeHash } from "../RoadGenerator.js";
import { buildingRecipe } from "./BuildingRecipes.js";
import type { CityPlacesPlan } from "./CityPlacesPlanner.js";
import { denseDoorThresholds } from "./DenseDoorThresholds.js";

/** Land use chooses pinned families; native recipe widths determine the rhythm. */
export function architectureDistrict(
  base: CityPlacesPlan,
  seed: number,
  id: string,
): CityPlacesPlan {
  const varied =
    edgeHash(Math.floor(base.center.x / 1024), Math.floor(base.center.y / 1024), seed + 71011) <
    0.5;
  const blocks = base.blocks.map((block) => {
    const types = block.id.endsWith(":0:0")
      ? [`prop-city-architecture-v1-condo-wide-${varied ? 5 : 3}`]
      : block.id.endsWith(":1:0")
        ? [
            `prop-city-architecture-v1-office-${varied ? 3 : 4}`,
            "prop-city-dense-v1-bakery-3",
            "prop-city-dense-v1-ice-cream-3",
          ]
        : [];
    if (!types.length) return block;
    const recipes = types.map((t) => {
      const r = buildingRecipe(t);
      if (!r) throw Error(`Missing architecture recipe ${t}`);
      return r;
    });
    const total = recipes.reduce((n, p) => n + p.width / 16, 0),
      gap = (block.bounds.maxX - block.bounds.minX - total) / (recipes.length + 1);
    if (gap < 1) throw Error("Architecture frontage exceeds its block");
    let cursor = block.bounds.minX + gap;
    return {
      ...block,
      lots: recipes.map((recipe, slot) => {
        const primary = denseDoorThresholds(recipe).find((d) => d.primary);
        if (!primary) throw Error("Missing primary door");
        const anchor = { x: cursor + recipe.width / 32, y: base.center.y - 12 };
        const lot = {
          id: `${block.id}:lot:${slot}`,
          buildingType: recipe.type,
          facing: "south" as const,
          anchor,
          entrance: { x: anchor.x + primary.dx / 16, y: anchor.y + recipe.entrance.dy / 16 },
          bounds: {
            minX: cursor,
            minY: anchor.y - recipe.height / 16,
            maxX: cursor + recipe.width / 16,
            maxY: anchor.y + recipe.groundDepth / 32,
          },
        };
        cursor += recipe.width / 16 + gap;
        return lot;
      }),
    };
  });
  const entrancePaths = blocks.flatMap((block) =>
    block.lots.flatMap((lot) => {
      const recipe = buildingRecipe(lot.buildingType);
      if (!recipe) throw Error("Missing entrance recipe");
      return denseDoorThresholds(recipe).map((door) => {
        const threshold = { x: lot.anchor.x + door.dx / 16, y: lot.anchor.y + door.dy / 16 };
        const sidewalk = { x: threshold.x, y: block.bounds.maxY };
        return {
          lotId: lot.id,
          doorId: door.id,
          threshold,
          sidewalk,
          bounds: {
            minX: Math.floor(threshold.x - door.width / 32),
            maxX: Math.ceil(threshold.x + door.width / 32),
            minY: threshold.y - 1,
            maxY: sidewalk.y + 1,
          },
        };
      });
    }),
  );
  return {
    ...base,
    id,
    recipe: "city-places-v9",
    blocks,
    entrancePaths,
    places: base.places
      .filter((p) => p.kind !== "pocket-park")
      .map((p) => ({
        ...p,
        id: p.id.replace(":city-places-v8:", ":city-places-v9:"),
        furniture: p.furniture.map((f) => ({
          ...f,
          featureId: f.featureId.replace(":city-places-v8:", ":city-places-v9:"),
        })),
      })),
  };
}
