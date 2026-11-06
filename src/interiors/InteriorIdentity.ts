import type { Prop } from "../entities/Prop.js";
import { buildingRecipe } from "../generation/regional/BuildingRecipes.js";
import type { BuildingDoor } from "./BuildingDoors.js";
import type { BuildingLayout } from "./BuildingLayouts.js";

export interface InteriorIdentity {
  readonly version: "interior-v1";
  readonly parentWorldId: string;
  readonly featureId: string;
  readonly buildingType: string;
  readonly floor: 0;
  readonly layout?: BuildingLayout;
  /** Optional explicit connections; absence preserves the original street doorway. */
  readonly doors?: readonly BuildingDoor[];
  readonly returnX: number;
  readonly returnY: number;
}
export const INTERIOR_ENTRY = { wx: 80, wy: 120 };
export const INTERIOR_EXIT = { wx: 80, wy: 144 };
export function exteriorEntrance(
  prop: Pick<Prop, "type" | "position">,
): { wx: number; wy: number } | null {
  const recipe = buildingRecipe(prop.type);
  if (!recipe && prop.type !== "prop-country-house" && prop.type !== "prop-shed") return null;
  return {
    wx: prop.position.wx + (recipe?.entrance.dx ?? 0),
    wy: prop.position.wy + (recipe?.entrance.dy ?? 8),
  };
}
export function interiorRealmId(parentWorldId: string, featureId: string): string {
  if (
    !/^[a-zA-Z0-9-]{1,100}$/.test(parentWorldId) ||
    !/^(?:settlement:-?\d+:-?\d+:(?:block:\d+:\d+:lot:\d+|shopping:\d+:prop-shopping-v1-(?:1|3|5|7|9|11|13))|farmstead:-?\d+:-?\d+:(?:east|south):(?:house|shed))$/.test(
      featureId,
    )
  )
    throw new Error("Invalid building identity.");
  return `interior~${parentWorldId}~${encodeURIComponent(featureId)}~0`;
}
