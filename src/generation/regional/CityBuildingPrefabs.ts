import type { BuildingRecipe, FacadePiece } from "./BuildingRecipes.js";

/** Candidate source audit from the shared art inbox; frozen v1/v2/v3 planners never select these. */
export const CITY_PREFAB_SOURCE = {
  sheetId: "me-complete",
  fingerprint: "1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737",
  rect: [1104, 1808, 1136, 864] as const,
  noteId: "d9263255-88a1-4f83-90fb-e50fbfb5c3b7",
};
export interface CityBuildingPrefab extends BuildingRecipe {
  name: string;
  family: "condo-4" | "hotel" | "storefront";
  /** Native facade window levels, excluding the roof. No upper-floor gameplay implied. */
  floors: number;
  review: "candidate";
}
const part = (x: number, y: number, w: number, h: number, dx: number, dy: number): FacadePiece => ({
  frameCol: x / 16,
  frameRow: y / 16,
  spriteWidth: w,
  spriteHeight: h,
  dx,
  dy,
});
const sourcePart = (rect: readonly number[], dx: number, dy: number) =>
  part(rect[0] ?? 0, rect[1] ?? 0, rect[2] ?? 0, rect[3] ?? 0, dx, dy);
const CONDO = {
  bay: {
    width: 112,
    ground: [1104, 2144, 112, 80],
    middle: [1104, 2080, 112, 48],
    top: [1104, 1904, 112, 160],
    cap: [1104, 1840, 96, 48],
    capDx: -8,
    entrance: -12,
  },
  narrow: {
    width: 64,
    ground: [1232, 2144, 64, 80],
    middle: [1232, 2080, 64, 48],
    top: [1232, 1904, 64, 160],
    cap: [1232, 1840, 64, 48],
    capDx: 0,
    entrance: 0,
  },
  wide: {
    width: 80,
    ground: [1312, 2144, 80, 80],
    middle: [1312, 2080, 80, 48],
    top: [1312, 1904, 80, 160],
    cap: [1312, 1824, 80, 64],
    capDx: 0,
    entrance: 8,
  },
} as const;
function condo(style: keyof typeof CONDO, floors: number): CityBuildingPrefab {
  const s = CONDO[style],
    repeat = floors - 2;
  const parts = [
    sourcePart(s.cap, s.capDx, -80 - repeat * 48 - 160),
    sourcePart(s.top, 0, -80 - repeat * 48),
  ];
  for (let i = 0; i < repeat; i++) parts.push(sourcePart(s.middle, 0, -80 - i * 48));
  parts.push(sourcePart(s.ground, 0, 0));
  // The 64px vendor strip has windows but no door: it is a wing, not a complete house.
  // Pair it with the 80px entrance strip rather than inventing an invisible entrance.
  if (style === "narrow") {
    for (const p of parts) p.dx -= 40;
    const door = CONDO.wide;
    parts.push(
      sourcePart(door.cap, 32, -80 - repeat * 48 - 160),
      sourcePart(door.top, 32, -80 - repeat * 48),
    );
    for (let i = 0; i < repeat; i++) parts.push(sourcePart(door.middle, 32, -80 - i * 48));
    parts.push(sourcePart(door.ground, 32, 0));
  }
  const height = Math.max(...parts.map((p) => p.spriteHeight - p.dy));
  return {
    type: `prop-city-v1-condo-${style}-${floors}`,
    name: `${style === "bay" ? "Bay-window" : style === "narrow" ? "Flat-front" : "Wide"} apartments · ${floors} levels`,
    family: "condo-4",
    floors,
    review: "candidate",
    kind: "apartment",
    facing: "south",
    width: style === "narrow" ? 144 : s.width,
    height,
    groundDepth: 32,
    entrance: { dx: style === "narrow" ? 40 : s.entrance, dy: 24 },
    parts,
  };
}
function hotel(floors: number): CityBuildingPrefab {
  const repeat = floors - 3;
  const parts = [
    part(1904, 1872, 272, 16, 0, -144 - repeat * 64 - 112),
    part(1904, 1904, 272, 112, 0, -144 - repeat * 64),
  ];
  for (let i = 0; i < repeat; i++) parts.push(part(1904, 2032, 272, 64, 0, -144 - i * 64));
  parts.push(part(1904, 2112, 272, 144, 0, 0), part(2016, 2256, 48, 32, 0, 16));
  return {
    type: `prop-city-v1-hotel-${floors}`,
    name: `Hotel · ${floors} levels`,
    family: "hotel",
    floors,
    review: "candidate",
    kind: "apartment",
    facing: "south",
    width: 272,
    height: 272 + repeat * 64,
    groundDepth: 32,
    entrance: { dx: 0, dy: 24 },
    parts,
  };
}
const SHOPS = [
  { id: "bakery", name: "Bakery", x: 1120, y: 2384 },
  { id: "butcher", name: "Butcher", x: 1280, y: 2384 },
  { id: "bait", name: "Bait shop", x: 1440, y: 2384 },
  { id: "ice-cream", name: "Ice cream", x: 1600, y: 2384 },
  { id: "gym", name: "Fitness", x: 1760, y: 2384 },
] as const;
function shop(s: (typeof SHOPS)[number], floors: number): CityBuildingPrefab {
  const parts: FacadePiece[] = [];
  // Shop signs overhang the 48px storefront wall; draw the ground pieces last.
  // Above them, two narrow Condo strips give a contiguous 128px facade.
  if (floors > 1) {
    for (const dx of [-32, 32]) {
      parts.push(
        sourcePart(CONDO.narrow.cap, dx, -48 - (floors - 2) * 48 - 160),
        sourcePart(CONDO.narrow.top, dx, -48 - (floors - 2) * 48),
      );
      for (let i = 0; i < floors - 2; i++)
        parts.push(sourcePart(CONDO.narrow.middle, dx, -48 - i * 48));
    }
  }
  parts.push(
    part(s.x - 16, s.y + 32, 16, 48, -64, 0),
    part(s.x + 112, s.y + 32, 16, 48, 64, 0),
    part(s.x, s.y, 112, 80, 0, 0),
  );
  return {
    type: `prop-city-v1-${s.id}-${floors}`,
    name: `${s.name}${floors > 1 ? ` + ${floors - 1} apartment level(s)` : " storefront"}`,
    family: "storefront",
    floors,
    review: "candidate",
    kind: "shop",
    facing: "south",
    width: 144,
    height: Math.max(...parts.map((p) => p.spriteHeight - p.dy)),
    groundDepth: 32,
    entrance: { dx: 40, dy: 24 },
    parts,
  };
}
export const CITY_BUILDING_PREFABS: readonly CityBuildingPrefab[] = [
  ...(["bay", "narrow", "wide"] as const).flatMap((style) =>
    [2, 3, 5].map((floors) => condo(style, floors)),
  ),
  ...[3, 4, 6].map(hotel),
  ...SHOPS.flatMap((s) => [1, 3].map((floors) => shop(s, floors))),
];
/** Stable hand-authored showcase layouts in native world pixels, with contiguous frontage. */
export function cityPrefabBlock(kind: "residential" | "mixed" | "hotel") {
  const types =
    kind === "residential"
      ? ["condo-bay-3", "condo-narrow-5", "condo-wide-3", "condo-narrow-2", "condo-bay-5"]
      : kind === "mixed"
        ? ["bakery-3", "butcher-1", "ice-cream-3", "gym-3", "bait-1"]
        : ["condo-narrow-3", "hotel-6", "condo-wide-3"];
  let x = 0;
  return types.map((suffix) => {
    const prefab = CITY_BUILDING_PREFABS.find((p) => p.type === `prop-city-v1-${suffix}`);
    if (!prefab) throw new Error("Unknown city showcase prefab");
    const wx = x + prefab.width / 2;
    x += prefab.width;
    return { prefab, wx, wy: 0 };
  });
}
