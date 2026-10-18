import { TILE_SIZE } from "../../config/constants.js";
import type { ShoppingCenter } from "../../traffic/ShoppingCenter.js";
import type { DistrictLot, DistrictPlan } from "./DistrictPlanner.js";
import { shoppingBuilding, shoppingSceneryPlacements } from "./ShoppingScenery.js";

/** Resolve only buildings actually present in this owner's generated plan. */
export function districtBuilding(
  plan: (DistrictPlan & { readonly shoppingCenters?: readonly ShoppingCenter[] }) | null,
  featureId: string,
): Pick<DistrictLot, "id" | "buildingType" | "anchor" | "entrance"> | undefined {
  const lot = plan?.blocks.flatMap((b) => b.lots).find((l) => l.id === featureId);
  if (lot) return lot;
  for (const center of plan?.shoppingCenters ?? []) {
    const placement = shoppingSceneryPlacements(center).find((p) => p.featureId === featureId);
    if (!placement) continue;
    const recipe = shoppingBuilding(placement.propType);
    if (!recipe) return;
    return {
      id: featureId,
      buildingType: placement.propType,
      anchor: { x: placement.wx / TILE_SIZE, y: placement.wy / TILE_SIZE },
      entrance: {
        x: (placement.wx + recipe.entrance.dx) / TILE_SIZE,
        y: (placement.wy + recipe.entrance.dy) / TILE_SIZE,
      },
    };
  }
}
