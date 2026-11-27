import type { FurniturePlacement } from "./FurnitureCatalog.js";
import type { InteriorIdentity } from "./InteriorIdentity.js";

type Fixture = readonly [asset: string, x: number, y: number];
const waiting: Fixture[] = [
  ["settee", 80, 175],
  ["settee", 80, 222],
  ["side-table", 128, 172],
  ["flowers", 304, 196],
  ["worktable", 256, 164],
  ["single-bed", 80, 77],
  ["kitchen-cabinet", 240, 66],
  ["floor-lamp", 120, 79],
];
const mail: Fixture[] = [
  ["worktable", 96, 162],
  ["worktable", 250, 162],
  ["bookcase", 64, 65],
  ["wardrobe", 112, 65],
  ["dresser", 240, 68],
  ["side-table", 287, 210],
  ["wall-picture", 96, 25],
];
const civicFurniture: Record<string, Fixture[]> = {
  hospital: waiting,
  clinic: waiting,
  post: mail,
  "postal-depot": [...mail, ["worktable", 288, 72]],
  school: [
    ["bookcase", 64, 65],
    ["bookcase", 112, 65],
    ["worktable", 256, 70],
    ["wall-picture", 158, 25],
    ...[160, 214].flatMap((y) =>
      [80, 200].flatMap((x): Fixture[] => [
        ["dining-table", x, y],
        ["stool", x - 25, y + 9],
      ]),
    ),
  ],
  nursery: [
    ["worktable", 246, 163],
    ...[
      [64, 65],
      [110, 65],
      [72, 164],
      [120, 218],
      [286, 219],
    ].map(([x = 0, y = 0]): Fixture => ["potted-tree", x, y]),
    ["flowers", 264, 66],
    ["flowers", 64, 216],
  ],
  fire: [
    ["wardrobe", 64, 65],
    ["wardrobe", 110, 65],
    ["worktable", 250, 65],
    ["settee", 80, 174],
    ["dining-table", 235, 190],
    ["stool", 206, 198],
    ["wall-picture", 96, 25],
  ],
  salvage: [
    ["worktable", 80, 68],
    ["worktable", 252, 157],
    ["wardrobe", 246, 66],
    ["bookcase", 64, 155],
    ["stool", 116, 205],
  ],
};
export function civicRoom(identity: InteriorIdentity) {
  const rows = [
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
  for (const d of identity.doors ?? []) {
    const col = Math.floor(d.inside.wx / 32);
    rows[8] = `${rows[8]?.slice(0, col)}+${rows[8]?.slice(col + 1)}`;
  }
  const fixtures = civicFurniture[identity.buildingType.slice("prop-city-civic-".length)];
  if (!fixtures) throw new Error("Missing civic room furniture");
  return {
    sketch: rows.join("\n"),
    furniture: fixtures.map(
      ([asset, x, y], i): FurniturePlacement => ({ id: `${asset}-${i}`, asset, x, y }),
    ),
  };
}
