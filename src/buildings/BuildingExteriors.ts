import {
  BUILDING_RECIPES,
  type BuildingRecipe,
  buildingBody,
  type FacadePiece,
} from "../generation/regional/BuildingRecipes.js";
import { CITY_ARCHITECTURE_BUILDINGS } from "../generation/regional/CityArchitectureAssets.js";
import {
  CITY_BUILDING_PREFABS,
  CITY_HOTEL_ART,
} from "../generation/regional/CityBuildingPrefabs.js";
import { DENSE_CITY_BUILDINGS } from "../generation/regional/DenseCityAssets.js";
import { shoppingScenery } from "../generation/regional/ShoppingScenery.js";
import { type BuildingSection, section } from "./BuildingSection.js";
import { civicExterior } from "./CivicExteriors.js";
import { farmhouse, japaneseHouse, shed, terracedHouse } from "./HouseExteriors.js";

export interface BuildingTrim {
  piece: FacadePiece;
  /** World Y of the sign face, or 'ground' for the entrance mat. */
  plane: number | "ground";
}
export interface BuildingExterior {
  sections: BuildingSection[];
  /** Separate shopfront sprite painted in front of its neighboring roof prop. */
  facadeOnly?: boolean;
  /** Repeatable wall bay or siding crop for elevations absent from the sprite.
   * Coordinates are pixels in the prop's native sheet. */
  siding: readonly [number, number, number, number];
  /** A single row of house windows. High gables and low plinths continue the siding. */
  windowBand?: { span: number; top: number; height: number };
  /** South wall hidden by the porch in the reference. Map a clean native door
   * and window bay onto the recessed ground storey behind the freestanding posts. */
  porchWall?: {
    front: number;
    left: number;
    right: number;
    height: number;
    crop: readonly [number, number, number, number];
  };
  bodyParts?: readonly FacadePiece[];
  trim?: BuildingTrim[];
}

const exteriors = new Map<string, BuildingExterior>();
exteriors.set("prop-country-house", {
  sections: farmhouse,
  porchWall: { front: -24, left: -55, right: 108, height: 50, crop: [105, 141, 138, 34] },
  siding: [157, 452 * 16 + 143, 61, 31],
  windowBand: { span: 82, top: 62, height: 40 },
});
exteriors.set("prop-japanese-house", {
  sections: japaneseHouse,
  siding: [140 * 16 + 148, 475 * 16 + 196, 24, 24],
});
exteriors.set("prop-shed", { sections: shed, siding: [7, 43, 6, 17] });
for (const [i, [col, row]] of (
  [
    [30, 454],
    [42, 454],
    [30, 472],
    [42, 472],
    [62, 472],
    [62, 457],
  ] as const
).entries())
  exteriors.set(`prop-terraced-house-${i + 1}`, {
    sections: terracedHouse(i + 1),
    siding: [col * 16 + 32, row * 16 + 162, 54, 29],
    windowBand: { span: 65, top: 58, height: 35 },
  });

function cityExterior(recipe: BuildingRecipe): BuildingExterior {
  const { depth, height } = buildingBody(recipe);
  const left = -recipe.width / 2,
    right = -left;
  const bodyParts: FacadePiece[] = [];
  const trim: BuildingTrim[] = [];
  for (const p of recipe.parts) {
    if (p.frameRow * 16 === CITY_HOTEL_ART.roofSign[1]) trim.push({ piece: p, plane: -depth + 12 });
    else if (p.frameCol * 16 === CITY_HOTEL_ART.sideSign[0] && p.spriteWidth === 48)
      trim.push({ piece: p, plane: -12 });
    else if (p.dy > 0) trim.push({ piece: p, plane: "ground" });
    else if (p.frameRow * 16 === 2384 && p.spriteHeight === 80) {
      trim.push({ piece: { ...p, spriteHeight: 32, dy: p.dy - 48 }, plane: 2 });
      bodyParts.push({ ...p, frameRow: p.frameRow + 2, spriteHeight: 48 });
    } else bodyParts.push(p);
  }
  if (recipe.type.includes("-condo-")) {
    // The left bay protrudes 16 pixels. The two bevels follow the painted
    // cornice and door at the foot of every module, at every floor count.
    const edge = [
      [left, -16],
      [left + 32, 0],
      [left + 64, 0],
      [left + 96, -16],
      [right, -16],
    ] as const;
    const sections = edge.slice(1).map(([x, y], i) => {
      const [prev, front] = edge[i] ?? edge[0];
      return section(prev, x, -depth, front, height, { frontRight: y });
    });
    return { sections, siding: [1320, 2080, 56, 48] };
  }
  const hotel = recipe.type.includes("-hotel-");
  const sections = [section(left, right, -depth, 0, height)];
  // Keep the raised frame around the recessed, flat roof deck.
  if (!hotel && bodyParts.some((p) => p.frameRow * 16 === 1936)) {
    const rim = 6;
    sections[0] = section(left, right, -depth, 0, height - 3);
    sections.push(
      section(left, right, -depth, -depth + rim, height, { base: height - 3 }),
      section(left, right, -rim, 0, height, { base: height - 3 }),
      section(left, left + rim, -depth + rim, -rim, height, { base: height - 3 }),
      section(right - rim, right, -depth + rim, -rim, height, { base: height - 3 }),
    );
  }
  return { sections, bodyParts, trim, siding: hotel ? [1920, 2032, 64, 64] : [2544, 1984, 64, 64] };
}

for (const recipe of [
  ...BUILDING_RECIPES,
  ...CITY_BUILDING_PREFABS,
  ...DENSE_CITY_BUILDINGS,
  ...CITY_ARCHITECTURE_BUILDINGS,
])
  exteriors.set(recipe.type, cityExterior(recipe));

// Each shop and its cap have distinct generated/saved prop identities. Their
// anchors differ by 48px, exactly the wall height. They can stream independently.
for (const prop of shoppingScenery) {
  const p = prop.sprite;
  if (!prop.collider && !(p.frameCol * 16 === 2256 && p.frameRow * 16 === 1936)) continue;
  const sections = prop.collider
    ? [section(-56, 56, -96, 0, 44)]
    : [section(-56, 56, -48, 48, 48, { base: 44 })];
  const trim: BuildingTrim[] = prop.collider
    ? [{ piece: { ...p, dx: 0, dy: -44, spriteHeight: 36 }, plane: 0 }]
    : [];
  exteriors.set(prop.type, {
    sections,
    facadeOnly: !!prop.collider,
    siding: [2544, 1984, 64, 64],
    trim,
  });
}

export function buildingExterior(type: string): BuildingExterior | undefined {
  return exteriors.get(type) ?? civicExterior(type);
}
