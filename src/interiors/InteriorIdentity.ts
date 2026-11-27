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

/** Both farm planners use the same building suffixes, with distinct owner prefixes. */
export function farmBuildingOwner(featureId: string) {
  const match = /^(farmstead|town-farm):(-?\d+):(-?\d+):(east|south):(?:house|shed)$/.exec(
    featureId,
  );
  if (!match) return undefined;
  return {
    nearTown: match[1] === "town-farm",
    cx: Number(match[2]),
    cy: Number(match[3]),
    axis: match[4] === "east" ? "east" : "south",
  } as const;
}

export function interiorRealmId(parentWorldId: string, featureId: string): string {
  if (
    !/^[a-zA-Z0-9-]{1,100}$/.test(parentWorldId) ||
    (!/^settlement:-?\d+:-?\d+:(?:block:\d+:\d+:lot:\d+|shopping:\d+:prop-shopping-v1-(?:1|3|5|7|9|11|13))$/.test(
      featureId,
    ) &&
      !farmBuildingOwner(featureId))
  )
    throw new Error("Invalid building identity.");
  return `interior~${parentWorldId}~${encodeURIComponent(featureId)}~0`;
}
