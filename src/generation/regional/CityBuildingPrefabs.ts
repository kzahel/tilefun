import type { BuildingRecipe, FacadePiece } from "./BuildingRecipes.js";

/** Candidate source audit from the shared art inbox; frozen v1/v2/v3 planners never select these. */
export const CITY_PREFAB_SOURCE = {
  sheetId: "me-complete",
  fingerprint: "1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737",
  rect: [1104, 1808, 1136, 864] as const,
  noteId: "d9263255-88a1-4f83-90fb-e50fbfb5c3b7",
};
type SourceRect = readonly [number, number, number, number];
type Edge = "closed" | "condo-4";
export interface FacadeModule {
  id: string;
  width: number;
  left: Edge;
  right: Edge;
  /** Roof deck and facade are separate bands; all roof decks meet at the same datum. */
  roof: SourceRect;
  topWall: SourceRect;
  middle: SourceRect;
  ground: SourceRect;
}
export interface BuildingTopology {
  modules: { id: string; x: number; width: number; left: Edge; right: Edge }[];
  roof: { datum: number; depth: number; parts: readonly FacadePiece[] };
}
export interface CityBuildingPrefab extends BuildingRecipe {
  name: string;
  family: "condo-4" | "hotel" | "storefront";
  /** Native facade window levels, excluding the roof. No upper-floor gameplay implied. */
  floors: number;
  review: "candidate";
  topology: BuildingTopology;
  profile: "bay-front" | "flat-front";
}
const part = (x: number, y: number, w: number, h: number, dx: number, dy: number): FacadePiece => ({
  frameCol: x / 16,
  frameRow: y / 16,
  spriteWidth: w,
  spriteHeight: h,
  dx,
  dy,
});
const sourcePart = (rect: SourceRect, dx: number, dy: number) => part(...rect, dx, dy);

/** Condo 4 is a chain of left end, zero or more infills, and a right entrance end.
 * The detached roof-access sprites are accessories, not mandatory roof caps.
 * The 160px vendor top sprites already contain a complete 112px roof deck.
 */
export const CONDO_FACADE_MODULES = {
  bay: {
    id: "condo-4-left-bay",
    width: 112,
    left: "closed",
    right: "condo-4",
    roof: [1104, 1904, 112, 112],
    topWall: [1104, 2016, 112, 48],
    middle: [1104, 2080, 112, 48],
    ground: [1104, 2144, 112, 80],
  },
  infill: {
    id: "condo-4-infill",
    width: 64,
    left: "condo-4",
    right: "condo-4",
    roof: [1232, 1904, 64, 112],
    topWall: [1232, 2016, 64, 48],
    middle: [1232, 2080, 64, 48],
    ground: [1232, 2144, 64, 80],
  },
  entrance: {
    id: "condo-4-right-entrance",
    width: 80,
    left: "condo-4",
    right: "closed",
    roof: [1312, 1904, 80, 112],
    topWall: [1312, 2016, 80, 48],
    middle: [1312, 2080, 80, 48],
    ground: [1312, 2144, 80, 80],
  },
} as const satisfies Record<string, FacadeModule>;
export function validateFacadeTopology(modules: readonly FacadeModule[]): void {
  if (!modules.length || modules[0]?.left !== "closed" || modules.at(-1)?.right !== "closed")
    throw new Error("A complete building must close both exterior ends");
  for (const [i, module] of modules.entries()) {
    const previous = modules[i - 1];
    if (previous && (previous.right === "closed" || previous.right !== module.left))
      throw new Error(`Incompatible facade join: ${previous.id} → ${module.id}`);
    if (module.roof[2] !== module.width || module.roof[3] !== 112)
      throw new Error(`Incompatible roof deck: ${module.id}`);
  }
}
function composeFacade(modules: readonly FacadeModule[], floors: number) {
  validateFacadeTopology(modules);
  if (!Number.isInteger(floors) || floors < 2 || floors > 12)
    throw new Error("Invalid facade floor count");
  const width = modules.reduce((sum, m) => sum + m.width, 0);
  const roofDatum = -80 - (floors - 1) * 48;
  const walls: FacadePiece[] = [],
    roof: FacadePiece[] = [];
  const topology: BuildingTopology = {
    modules: [],
    roof: { datum: roofDatum, depth: 112, parts: roof },
  };
  let x = -width / 2;
  for (const m of modules) {
    const dx = x + m.width / 2;
    topology.modules.push({ id: m.id, x, width: m.width, left: m.left, right: m.right });
    roof.push(sourcePart(m.roof, dx, roofDatum));
    walls.push(sourcePart(m.topWall, dx, roofDatum + 48));
    for (let i = 0; i < floors - 2; i++) walls.push(sourcePart(m.middle, dx, -80 - i * 48));
    walls.push(sourcePart(m.ground, dx, 0));
    x += m.width;
  }
  return { width, topology, parts: [...roof, ...walls] };
}
function condo(style: "bay" | "narrow" | "wide", floors: number): CityBuildingPrefab {
  const count = style === "bay" ? 0 : style === "narrow" ? 1 : 2;
  const assembled = composeFacade(
    [
      CONDO_FACADE_MODULES.bay,
      ...Array.from({ length: count }, () => CONDO_FACADE_MODULES.infill),
      CONDO_FACADE_MODULES.entrance,
    ],
    floors,
  );
  return {
    ...assembled,
    type: `prop-city-v1-condo-${style}-${floors}`,
    name: `${style === "bay" ? "Bay-front" : style === "narrow" ? "Extended bay-front" : "Wide bay-front"} apartments · ${floors} levels`,
    family: "condo-4",
    profile: "bay-front",
    floors,
    review: "candidate",
    kind: "apartment",
    facing: "south",
    height: 112 - assembled.topology.roof.datum,
    groundDepth: 32,
    entrance: { dx: assembled.width / 2 - 32, dy: 24 },
  };
}
function hotel(floors: number): CityBuildingPrefab {
  const repeat = floors - 3;
  const roof = [part(1904, 1872, 272, 16, 0, -144 - repeat * 64 - 112)];
  const parts = [...roof, part(1904, 1904, 272, 112, 0, -144 - repeat * 64)];
  for (let i = 0; i < repeat; i++) parts.push(part(1904, 2032, 272, 64, 0, -144 - i * 64));
  parts.push(part(1904, 2112, 272, 144, 0, 0), part(2016, 2256, 48, 32, 0, 16));
  return {
    type: `prop-city-v1-hotel-${floors}`,
    name: `Hotel · ${floors} levels`,
    family: "hotel",
    profile: "flat-front",
    floors,
    review: "candidate",
    kind: "apartment",
    facing: "south",
    width: 272,
    height: 272 + repeat * 64,
    groundDepth: 32,
    entrance: { dx: 0, dy: 24 },
    parts,
    topology: {
      modules: [{ id: "hotel", x: -136, width: 272, left: "closed", right: "closed" }],
      roof: { datum: -144 - repeat * 64 - 112, depth: 16, parts: roof },
    },
  };
}
const SHOPS = [
  { id: "bakery", name: "Bakery", x: 1120, y: 2384, entrance: 40 },
  { id: "butcher", name: "Butcher", x: 1280, y: 2384, entrance: -16 },
  { id: "bait", name: "Bait shop", x: 1440, y: 2384, entrance: 0 },
  { id: "ice-cream", name: "Ice cream", x: 1600, y: 2384, entrance: 0 },
  { id: "gym", name: "Fitness", x: 1760, y: 2384, entrance: 40 },
] as const;
export interface StorefrontEnvelope {
  family: string;
  profile: "flat-front" | "bay-front";
  groundHeight: number;
  roof: SourceRect;
  floor: SourceRect;
}
/** Additional source audit: Floor_Modular_Building Roof_1 and Middle_Floor_1.
 * These lie outside the original shortlist; retain their exact source regions
 * rather than claiming that the first annotation selected them.
 */
export const CITY_COMMERCIAL_ENVELOPE = {
  family: "modular-commercial",
  profile: "flat-front",
  groundHeight: 48,
  roof: [2256, 1936, 112, 96],
  floor: [2544, 1984, 112, 64],
} as const satisfies StorefrontEnvelope;
export function validateStorefrontEnvelope(envelope: StorefrontEnvelope, store: SourceRect): void {
  if (
    envelope.family !== "modular-commercial" ||
    envelope.profile !== "flat-front" ||
    envelope.groundHeight !== 48 ||
    envelope.roof[2] !== store[2] ||
    envelope.floor[2] !== store[2]
  )
    throw new Error("Storefront requires a matching flat commercial envelope and ground datum");
}
function shop(s: (typeof SHOPS)[number], floors: number): CityBuildingPrefab {
  const e = CITY_COMMERCIAL_ENVELOPE;
  const store: SourceRect = [s.x, s.y, 112, 80];
  validateStorefrontEnvelope(e, store);
  const roofDatum = -e.groundHeight - (floors - 1) * e.floor[3];
  const roof = [sourcePart(e.roof, 0, roofDatum)];
  const parts = [...roof];
  for (let i = 0; i < floors - 1; i++)
    parts.push(sourcePart(e.floor, 0, -e.groundHeight - i * e.floor[3]));
  // Only the native shop sign overhangs its 48px ground wall. Draw it last;
  // the roof and all floors have the same flat, 112px frontage as the shop.
  parts.push(sourcePart(store, 0, 0));
  return {
    parts,
    type: `prop-city-v1-${s.id}-${floors}`,
    name: `${s.name} + apartments · ${floors} levels`,
    family: "storefront",
    profile: e.profile,
    floors,
    review: "candidate",
    kind: "shop",
    facing: "south",
    width: store[2],
    height: e.roof[3] - roofDatum,
    groundDepth: 48,
    entrance: { dx: s.entrance, dy: 32 },
    topology: {
      modules: [
        { id: e.family, x: -store[2] / 2, width: store[2], left: "closed", right: "closed" },
      ],
      roof: { datum: roofDatum, depth: e.roof[3], parts: roof },
    },
  };
}
export const CITY_BUILDING_PREFABS: readonly CityBuildingPrefab[] = [
  ...(["bay", "narrow", "wide"] as const).flatMap((style) =>
    [2, 3, 5].map((floors) => condo(style, floors)),
  ),
  ...[3, 4, 6].map(hotel),
  ...SHOPS.flatMap((s) => [2, 3].map((floors) => shop(s, floors))),
];
/** Retired storefront-only review links lead to the complete two-level composition. */
export function resolveCityPrefabType(type: string): string {
  return SHOPS.some((s) => type === `prop-city-v1-${s.id}-1`) ? type.replace(/-1$/, "-2") : type;
}
/** Stable hand-authored showcase layouts in native world pixels, with contiguous frontage. */
export function cityPrefabBlock(kind: "residential" | "mixed" | "hotel") {
  const types =
    kind === "residential"
      ? ["condo-bay-3", "condo-narrow-5", "condo-wide-3", "condo-narrow-2", "condo-bay-5"]
      : kind === "mixed"
        ? ["bakery-3", "butcher-2", "ice-cream-3", "gym-3", "bait-2"]
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
