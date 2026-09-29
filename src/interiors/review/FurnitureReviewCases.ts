import type { FurniturePlacement } from "../FurnitureCatalog.js";
import type { ReviewCase } from "./ReviewCases.js";

const p = (id: string, asset: string, x: number, y: number, on?: string): FurniturePlacement => ({
  id,
  asset,
  x,
  y,
  ...(on ? { on } : {}),
});
export function furnitureReviewCases(): ReviewCase[] {
  const fixtures: [string, string, number, FurniturePlacement[]][] = [
    [
      "bedside",
      "Single bed · bedside table and lamp",
      4,
      [
        p("bed", "single-bed", 48, 92),
        p("table", "side-table", 80, 72),
        p("lamp", "table-lamp", 8, 12, "table"),
      ],
    ],
    [
      "storage",
      "Bunk bed · wardrobe",
      5,
      [p("bunk", "bunk-bed", 64, 80), p("wardrobe", "wardrobe", 108, 60)],
    ],
    [
      "worktable",
      "Worktable · separate plant and stool",
      4,
      [
        p("table", "worktable", 64, 72),
        p("plant", "table-plant", 10, 20, "table"),
        p("stool", "stool", 64, 100),
      ],
    ],
    [
      "dresser",
      "Dresser · standing mirror and wall picture",
      4,
      [
        p("dresser", "dresser", 64, 52),
        p("mirror", "table-mirror", 12, 12, "dresser"),
        p("picture", "wall-picture", 88, 28),
      ],
    ],
    [
      "rug",
      "Rug under a table · floor lamp",
      4,
      [p("rug", "rug", 64, 112), p("table", "worktable", 64, 98), p("lamp", "floor-lamp", 88, 64)],
    ],
    [
      "hearth",
      "Fireplace · log rack and potted tree",
      5,
      [
        p("fireplace", "fireplace", 64, 60),
        p("logs", "log-rack", 96, 60),
        p("tree", "potted-tree", 48, 104),
      ],
    ],
    [
      "bedroom",
      "Small bedroom · lamp, storage and rug",
      6,
      [
        p("bed", "single-bed", 64, 108),
        p("table", "side-table", 96, 84),
        p("lamp", "table-lamp", 8, 12, "table"),
        p("tree", "potted-tree", 140, 110),
        p("wardrobe", "wardrobe", 136, 60),
        p("rug", "rug", 104, 144),
        p("picture", "wall-picture", 96, 28),
      ],
    ],
    [
      "studio",
      "Small studio · tabletop details and clear entrance",
      6,
      [
        p("table", "worktable", 72, 80),
        p("plant", "table-plant", 10, 20, "table"),
        p("stool", "stool", 72, 108),
        p("dresser", "dresser", 128, 60),
        p("mirror", "table-mirror", 12, 12, "dresser"),
        p("lamp", "floor-lamp", 136, 132),
        p("rug", "rug", 72, 120),
        p("picture", "wall-picture", 128, 28),
      ],
    ],
  ];
  return fixtures.map(([id, name, width, furniture]) => {
    const height = width === 6 ? 6 : 5;
    const sketch = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) =>
        y === height - 1 && x === Math.floor(width / 2)
          ? "+"
          : y === 0 || y === height - 1 || x === 0 || x === width - 1
            ? "#"
            : "L",
      ).join(""),
    ).join("\n");
    return { id: `furniture-${id}`, name, stage: 15, sketch, furniture };
  });
}
