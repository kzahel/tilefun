import {
  citySurfaceTileAt,
  type SurfacePiece,
  type SurfaceRect,
} from "../../road/CitySurfaceRecipes.js";
import { CITY_COMMERCIAL_ENVELOPE } from "./CityBuildingPrefabs.js";

/** New, unpromoted compositions. Never rewrite the archived v7 parking scenes. */
export const PARKING_CASES = [
  {
    id: "shopping",
    name: "Shopping center",
    description: "64 spaces, paired rows, three wide aisles and a central walk to the shops.",
  },
  {
    id: "town",
    name: "Town shops",
    description: "16 spaces in two rows, with one generous aisle and a short walk to the shops.",
  },
  {
    id: "parallel",
    name: "Long parking bays",
    description: "16 side-facing spaces around a central drive, using the native long-bay tiles.",
  },
] as const;
export type ParkingCaseId = (typeof PARKING_CASES)[number]["id"];
export interface ParkingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ParkingBay extends ParkingRect {
  id: string;
  facing: "north" | "south" | "east" | "west";
  occupied: boolean;
  color: number;
}
export interface ParkingStudy {
  id: ParkingCaseId;
  width: number;
  height: number;
  bays: ParkingBay[];
  drives: ParkingRect[];
  walks: ParkingRect[];
  pieces: SurfacePiece[];
}
export const PARKING_KIT = [
  { name: "Three upright spaces", rect: [0, 2112, 144, 80] },
  { name: "Long side-facing space", rect: [16, 2048, 80, 32] },
  { name: "Crosswalk repeat", rect: [64, 1968, 32, 16] },
  { name: "Rounded island", rect: [160, 1984, 48, 64] },
] as const;
const inside = (r: ParkingRect, x: number, y: number) =>
  x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;

export function parkingLayout(id: ParkingCaseId): ParkingStudy {
  const shopping = id === "shopping",
    parallel = id === "parallel";
  const width = shopping ? 1280 : 768,
    height = shopping ? 960 : 640;
  const bays: ParkingBay[] = [],
    pieces: SurfacePiece[] = [];
  const add = (
    label: string,
    rect: SurfaceRect,
    x: number,
    y: number,
    role: SurfacePiece["role"] = "paint",
  ) => pieces.push({ label, rect, x, y, role });
  const walks = shopping
    ? [{ x: 576, y: 192, width: 64, height: 672 }]
    : [{ x: 352, y: 176, width: 64, height: parallel ? 32 : 400 }];
  const drives: ParkingRect[] = shopping
    ? [208, 480, 752].map((y) => ({ x: 64, y, width: 1152, height: 112 }))
    : parallel
      ? [{ x: 288, y: 208, width: 192, height: 368 }]
      : [{ x: 64, y: 320, width: 640, height: 112 }];
  if (shopping)
    drives.push(
      { x: 64, y: 208, width: 80, height: 752 },
      { x: 1120, y: 208, width: 96, height: 752 },
    );
  else
    drives.push(
      { x: 64, y: 208, width: 96, height: 432 },
      { x: 608, y: 208, width: 96, height: 432 },
    );
  const paved: ParkingRect = { x: 64, y: 208, width: width - 128, height: height - 304 };
  // Shared production surface selection supplies native asphalt and curb joins.
  const road = (x: number, y: number) => {
    const px = x * 16,
      py = y * 16;
    return py >= height - 64 || inside(paved, px, py) || drives.some((r) => inside(r, px, py));
  };
  for (let y = 0; y < height / 16; y++)
    for (let x = 0; x < width / 16; x++) pieces.push(citySurfaceTileAt("neutral", x, y, road));
  const bay = (x: number, y: number, row: number, slot: number) => {
    const index = bays.length;
    bays.push({
      id: `${id}:${row}:${slot}`,
      x,
      y,
      width: parallel ? 80 : 48,
      height: parallel ? 32 : 80,
      facing: parallel ? (row ? "west" : "east") : row % 2 ? "south" : "north",
      occupied: index % 5 !== 1 && index % 7 !== 3,
      color: index % 6,
    });
    if (parallel) add("Long parking bay", [16, 2048, 80, 32], x, y);
    else {
      // Original group end/middle cells; no stretched, mirrored or invented paint.
      const groupSize = shopping ? 8 : 4;
      const sourceX = slot % groupSize === 0 ? 0 : slot % groupSize === groupSize - 1 ? 96 : 48;
      add("Upright parking bay", [sourceX, 2112, 48, 80], x, y);
    }
  };
  if (shopping) {
    for (const [row, y] of [320, 400, 592, 672].entries())
      for (let slot = 0; slot < 16; slot++)
        bay(192 + slot * 48 + (slot >= 8 ? 64 : 0), y, row, slot);
  } else if (parallel) {
    for (let side = 0; side < 2; side++)
      for (let slot = 0; slot < 8; slot++) bay(side ? 480 : 208, 224 + slot * 40, side, slot);
  } else {
    for (const [row, y] of [240, 432].entries())
      for (let slot = 0; slot < 8; slot++)
        bay(160 + slot * 48 + (slot >= 4 ? 64 : 0), y, row, slot);
  }
  // The path is raised between rows, with native zebra paint across driving aisles.
  for (const walk of walks)
    for (let y = walk.y; y < walk.y + walk.height; y += 16)
      for (let x = walk.x; x < walk.x + walk.width; x += 16) {
        const crossing = drives.some((r) => inside(r, x, y));
        if (crossing) add("Pedestrian crossing", [64, 1968, 32, 16], x, y);
        else
          add(
            "Walking spine",
            [96 + ((x / 16) % 2) * 16, 1984 + ((y / 16) % 2) * 16, 16, 16],
            x,
            y,
            "pavement",
          );
        if (crossing) x += 16;
      }
  // One-storey shop strip: native commercial roof and native storefronts.
  const count = shopping ? 7 : 3,
    start = shopping ? 192 : 208;
  for (let i = 0; i < count; i++) {
    const x = start + i * 112;
    add("Commercial roof", CITY_COMMERCIAL_ENVELOPE.roof, x, 32, "pavement");
    add("Shopfront", [i % 2 ? 1600 : 1120, 2384, 112, 80], x, 96, "pavement");
  }
  // Native planted islands sit outside the marked bays and driving lanes.
  for (const x of shopping ? [144, 1056] : [0, 720])
    for (const y of shopping ? [352, 624] : [256, 448]) {
      add("Island curb", [160, 1984, 48, 64], x, y, "median");
      add("Island tree", [256, 48, 32, 48], x + 8, y - 8, "median");
    }
  add("Shopping carts", [1280, 608, 64, 80], shopping ? 1056 : 608, 96, "pavement");
  add("Parking pay station", [816, 224, 16, 32], 80, 176, "pavement");
  return { id, width, height, bays, drives, walks, pieces };
}

/** Objects stay in ordinary prop depth/collision; all other pieces are ground. */
export function isParkingObject(label: string): boolean {
  return [
    "Commercial roof",
    "Shopfront",
    "Island tree",
    "Shopping carts",
    "Parking pay station",
  ].includes(label);
}
