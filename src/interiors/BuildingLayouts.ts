import type { FurniturePlacement } from "./FurnitureCatalog.js";
import type { InteriorIdentity } from "./GameplayInterior.js";

/** Saved identities pin these recipes. Changes require a new layout ID. */
export type BuildingLayout = "shop-v2" | "apartment-v2";
export function buildingLayout(identity: InteriorIdentity) {
  const apartment = identity.layout === "apartment-v2";
  if (identity.layout !== "shop-v2" && !apartment) throw new Error("Unknown building layout");
  const rows = apartment
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
  const furniture: FurniturePlacement[] = apartment
    ? [
        { id: "bed", asset: "single-bed", x: 64, y: 92 },
        { id: "dresser", asset: "dresser", x: 112, y: 72 },
        { id: "side-table", asset: "side-table", x: 40, y: 74 },
        { id: "table", asset: "worktable", x: 256, y: 80 },
        { id: "chair", asset: "stool", x: 192, y: 202 },
        { id: "plant", asset: "potted-tree", x: 304, y: 200 },
      ]
    : [
        { id: "prep-table", asset: "worktable", x: 112, y: 72 },
        { id: "storage", asset: "dresser", x: 256, y: 72 },
        { id: "counter", asset: "worktable", x: 160, y: 180 },
        { id: "stool", asset: "stool", x: 208, y: 200 },
        { id: "plant", asset: "potted-tree", x: 304, y: 184 },
      ];
  return { sketch: rows.join("\n"), furniture };
}
