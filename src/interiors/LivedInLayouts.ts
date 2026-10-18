import type { FurniturePlacement } from "./FurnitureCatalog.js";
import type { InteriorIdentity } from "./GameplayInterior.js";
import type { LayeredInteriorMap } from "./LayeredInteriorMap.js";

export type LivedInLayout = "home-v3" | "restaurant-v3" | "market-v3";
export const isLivedIn = (id: InteriorIdentity): boolean =>
  id.layout === "home-v3" || id.layout === "restaurant-v3" || id.layout === "market-v3";

const item = (id: string, asset: string, x: number, y: number): FurniturePlacement => ({
  id,
  asset,
  x,
  y,
});

/** Versioned, complete compositions. Door lanes and workstation approaches stay clear. */
export function livedInLayout(identity: InteriorIdentity) {
  const home = identity.layout === "home-v3";
  const restaurant = identity.layout === "restaurant-v3";
  const rows = home
    ? [
        "###########",
        "#BBBB#KKKK#",
        "#BBBB#KKKK#",
        "#BBBB+KKKK#",
        "##+####+###",
        "#LLLLLLLLL#",
        "#LLLLLLLLL#",
        "#HHHHHHHHH#",
        "###########",
      ]
    : [
        "###########",
        "#KKKKKKKKK#",
        "#KKKKKKKKK#",
        "#####+#####",
        "#LLLLLLLLL#",
        "#LLLLLLLLL#",
        "#LLLLLLLLL#",
        "#LLLLLLLLL#",
        "###########",
      ];
  for (const door of identity.doors ?? []) {
    const x = Math.floor(door.inside.wx / 32);
    rows[8] = `${rows[8]?.slice(0, x)}+${rows[8]?.slice(x + 1)}`;
  }
  const furniture = home
    ? [
        item("bed", "single-bed", 64, 88),
        item("bedside", "side-table", 40, 65),
        item("wardrobe", "wardrobe", 120, 65),
        item("dresser", "dresser", 120, 112),
        item("fridge", "fridge", 208, 65),
        item("cabinet", "kitchen-cabinet", 240, 65),
        item("cooker", "cooker", 272, 65),
        item("kitchen-plant", "flowers", 304, 65),
        item("books", "bookcase", 48, 183),
        item("sofa", "settee", 112, 183),
        item("reading-lamp", "floor-lamp", 144, 180),
        item("rug", "rug", 112, 222),
        item("dining", "dining-table", 240, 184),
        item("chair", "stool", 212, 186),
        item("plant", "potted-tree", 304, 190),
        item("picture", "wall-picture", 96, 25),
      ]
    : restaurant
      ? [
          item("fridge", "fridge", 48, 65),
          item("cabinet", "kitchen-cabinet", 96, 65),
          item("cooker", "cooker", 128, 65),
          item("prep", "worktable", 240, 65),
          item("storage", "bread-shelf", 288, 65),
          item("display", "bakery-display", 288, 145),
          item("table-a", "dining-table", 104, 166),
          item("table-b", "dining-table", 216, 166),
          item("table-c", "dining-table", 104, 230),
          item("table-d", "dining-table", 216, 230),
          item("chair-a", "stool", 76, 164),
          item("chair-b", "stool", 188, 164),
          item("chair-c", "stool", 76, 228),
          item("chair-d", "stool", 188, 228),
          item("flowers", "flowers", 48, 153),
          item("plant", "potted-tree", 304, 220),
          item("picture", "wall-picture", 208, 25),
        ]
      : [
          item("stock-a", "stocked-fridge", 64, 65),
          item("stock-b", "bread-shelf", 112, 65),
          item("storage", "wardrobe", 256, 65),
          item("prep", "worktable", 304, 65),
          item("drinks", "stocked-fridge", 64, 158),
          item("bread", "bread-shelf", 128, 158),
          item("produce-a", "produce", 208, 158),
          item("produce-b", "produce", 256, 158),
          item("checkout", "checkout", 288, 210),
          item("flowers", "flowers", 48, 220),
          item("picture", "wall-picture", 208, 25),
        ];
  for (const door of identity.doors ?? [])
    furniture.push(item(`mat-${door.id}`, "rug", door.arrival.wx, 252));
  return { sketch: rows.join("\n"), furniture };
}

/** Matching source-family slots retain the wall solver's geometry. No RGB tinting. */
export function dressLivedInMap(
  map: LayeredInteriorMap,
  identity: InteriorIdentity,
): LayeredInteriorMap {
  if (!isLivedIn(identity)) return map;
  const home = identity.layout === "home-v3",
    restaurant = identity.layout === "restaurant-v3";
  const colShift = home ? -8 : restaurant ? 8 : 0;
  const rowShift = 0;
  const wood = home
    ? "room-builder/floors/c01-r12"
    : restaurant
      ? "room-builder/floors/c09-r14"
      : "room-builder/floors/c09-r33";
  const tile = home ? "room-builder/floors/c13-r33" : "room-builder/floors/c13-r35";
  for (const row of map.cells)
    for (const cell of row) {
      for (const visual of cell.floor) {
        if (visual.key === "room-builder/floors/c01-r31") visual.key = wood;
        if (visual.key === "room-builder/floors/c13-r35") visual.key = tile;
      }
      for (const visual of [...cell.wall, ...cell.foreground]) {
        const match = /^room-builder\/3d-walls\/c(\d+)-r(\d+)$/.exec(visual.key);
        if (match)
          visual.key = `room-builder/3d-walls/c${String(Number(match[1]) + colShift).padStart(2, "0")}-r${String(Number(match[2]) + rowShift).padStart(2, "0")}`;
      }
    }
  // A street opening ends at a short threshold, rather than a floor tongue in the void.
  // Its activation anchor remains on the rendered, traversable half of the sketch cell.
  for (const door of identity.doors ?? []) {
    const x = Math.floor(door.inside.wx / 32) * 2,
      y = Math.floor(door.inside.wy / 32) * 2;
    for (const dx of [0, 1]) {
      const cell = map.cells[y + 1]?.[x + dx];
      if (cell) cell.floor = [];
    }
  }
  return map;
}
