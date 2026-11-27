import type { BuildingRecipe, FacadePiece } from "./BuildingRecipes.js";

type Rect = readonly [number, number, number, number];
export interface CivicBuilding extends BuildingRecipe {
  label: string;
  threshold: number;
}
const recipes = new Map<string, CivicBuilding>();
// Original atlas pixels. Offset is the destination's top left in the assembled image.
type Panel = readonly [Rect, number, number];
function register(
  key: string,
  label: string,
  w: number,
  h: number,
  door: number,
  threshold: number,
  panels: readonly Panel[],
  home = false,
) {
  const parts: FacadePiece[] = panels.map(([[x, y, width, height], left, top]) => ({
    frameCol: x / 16,
    frameRow: y / 16,
    spriteWidth: width,
    spriteHeight: height,
    dx: left + width / 2 - w / 2,
    dy: top + height - h,
  }));
  const type = `prop-city-civic-${key}`;
  recipes.set(type, {
    type,
    label,
    kind: home ? "apartment" : "shop",
    facing: "south",
    width: w,
    height: Math.max(h, ...parts.map((p) => p.spriteHeight - p.dy)),
    groundDepth: 32,
    entrance: { dx: door - w / 2, dy: 8 },
    threshold,
    parts,
  });
}
function whole(key: string, label: string, rect: Rect, door: number, threshold = 0, home = false) {
  register(key, label, rect[2], rect[3], door, threshold, [[rect, 0, 0]], home);
}
whole("porch-house", "Porch house", [0, 7232, 288, 256], 132, -5, true);
whole("terrace-ochre", "Terraced house", [480, 7264, 192, 240], 101, -11, true);
whole("terrace-blue", "Terraced house", [672, 7264, 192, 240], 101, -11, true);
whole("victorian", "Victorian house", [16, 7808, 256, 400], 48, -7, true);
whole("salvage", "Salvage office", [2176, 3216, 96, 96], 48, 0);
whole("post", "Post office", [2208, 5120, 128, 208], 64, 0);
whole("postal-depot", "Parcel depot", [2336, 5328, 128, 208], 64, 0);
whole("fire", "Fire station", [2160, 4016, 256, 240], 48, -12);
whole("nursery", "Plant nursery", [1952, 3632, 128, 112], 64, 0);
// The hospital sheet interleaves optional middle storeys and alternative shutters.
// Join the roof and ground bands in each wing independently; retain the roof H.
register("hospital", "City hospital", 432, 336, 80, -17, [
  [[640, 2320, 128, 192], 16, 4],
  [[672, 2304, 96, 32], 48, -12],
  [[640, 2576, 128, 112], 16, 196],
  [[768, 2320, 144, 224], 144, 4],
  [[768, 2592, 144, 112], 144, 228],
  [[912, 2320, 160, 112], 288, 4],
  [[912, 2448, 160, 32], 288, 116],
  [[912, 2496, 160, 160], 288, 148],
]);
register("clinic", "Town clinic", 160, 160, 74, -9, [
  [[912, 2496, 160, 160], 0, 0],
  [[528, 2272, 80, 80], 38, -36],
]);
// Keep one entrance wing and the clock tower, leaving the rear of the block for play.
register("school", "Clocktower school", 384, 352, 132, -18, [
  [[2144, 2672, 192, 336], 0, 0],
  [[2464, 2672, 64, 336], 192, 0],
  [[2528, 2768, 128, 240], 256, 92],
  [[2256, 3008, 80, 32], 112, 316],
]);
export function civicBuilding(type: string) {
  return recipes.get(type);
}

export const CIVIC_BUILDINGS = [...recipes.values()];
