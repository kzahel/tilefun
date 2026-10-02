import { CITY_ARCHITECTURE_BUILDINGS } from "./CityArchitectureAssets.js";
import { CITY_BUILDING_PREFABS } from "./CityBuildingPrefabs.js";
import { DENSE_CITY_BUILDINGS } from "./DenseCityAssets.js";

/** Audited ME modular facade recipes. Source rectangles remain in the original atlas. */
export interface FacadePiece {
  frameCol: number;
  frameRow: number;
  spriteWidth: number;
  spriteHeight: number;
  dx: number;
  /** Bottom of this piece relative to the building's feet. */
  dy: number;
}
export interface BuildingRecipe {
  type: string;
  kind: "apartment" | "shop";
  facing: "south";
  width: number;
  height: number;
  groundDepth: number;
  entrance: { dx: number; dy: number };
  parts: readonly FacadePiece[];
}
/** Art extents are independent of ground collision and doorway geometry. */
export function buildingVisualBounds(recipe: BuildingRecipe) {
  return {
    minX: Math.min(...recipe.parts.map((p) => p.dx - p.spriteWidth / 2)),
    maxX: Math.max(...recipe.parts.map((p) => p.dx + p.spriteWidth / 2)),
    minY: Math.min(...recipe.parts.map((p) => p.dy - p.spriteHeight)),
    maxY: Math.max(...recipe.parts.map((p) => p.dy)),
  };
}
function piece(x: number, y: number, w: number, h: number, dx: number, dy: number): FacadePiece {
  return { frameCol: x / 16, frameRow: y / 16, spriteWidth: w, spriteHeight: h, dx, dy };
}
function facade(type: string, floors: number, shop = false): BuildingRecipe {
  const parts: FacadePiece[] = shop
    ? [
        piece(1120, 2384, 112, 80, 0, 0),
        piece(1104, 2416, 16, 48, -64, 0),
        piece(1232, 2416, 16, 48, 64, 0),
      ]
    : [
        piece(2400, 2160, 112, 48, 0, 0),
        piece(2384, 2160, 16, 48, -64, 0),
        piece(2512, 2160, 16, 48, 64, 0),
      ];
  for (let floor = 0; floor < floors; floor++) {
    const dy = -48 - floor * 64;
    parts.push(
      piece(2544, 1984, 112, 64, 0, dy),
      piece(2528, 1984, 16, 64, -64, dy),
      piece(2656, 1984, 16, 64, 64, dy),
    );
  }
  const roof = -48 - floors * 64;
  parts.push(
    piece(2400, 2048, 112, 96, 0, roof),
    piece(2384, 2048, 16, 96, -64, roof),
    piece(2512, 2048, 16, 96, 64, roof),
  );
  return {
    type,
    kind: shop ? "shop" : "apartment",
    facing: "south",
    width: 144,
    height: 144 + floors * 64,
    groundDepth: 48,
    entrance: { dx: shop ? 40 : 24, dy: 8 },
    parts,
  };
}
export const BUILDING_RECIPES: readonly BuildingRecipe[] = [
  facade("prop-regional-apartment-2", 1),
  facade("prop-regional-apartment-3", 2),
  facade("prop-regional-bakery", 0, true),
  facade("prop-regional-shop-apartment", 1, true),
];
export function buildingRecipe(type: string): BuildingRecipe | undefined {
  return (
    BUILDING_RECIPES.find((recipe) => recipe.type === type) ??
    DENSE_CITY_BUILDINGS.find((recipe) => recipe.type === type) ??
    CITY_ARCHITECTURE_BUILDINGS.find((recipe) => recipe.type === type) ??
    CITY_BUILDING_PREFABS.find((recipe) => recipe.type === type)
  );
}
