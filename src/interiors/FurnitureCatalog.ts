/** Curated whole sprites. Coordinates are native pixels, independent of the 32px sketch grid. */
export interface FurnitureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type FurnitureLayer = "floor" | "standing" | "wall" | "surface";
export interface FurnitureDefinition {
  id: string;
  name: string;
  emoji: string;
  key: string;
  size: [number, number];
  /** Sprite point that meets the placement position; transparent padding is intentional. */
  anchor: [number, number];
  /** Occupied ground/support rectangle, relative to the anchor, not the image bounds. */
  footprint: FurnitureRect;
  layer: FurnitureLayer;
  blocking: boolean;
  /** Usable top surface in sprite coordinates. Children attach here, not to the floor. */
  surface?: FurnitureRect;
  /** Floor space needed to use this object, relative to its ground anchor. */
  access?: FurnitureRect;
  facing: "south" | "none";
}
const rect = (x: number, y: number, width: number, height: number): FurnitureRect => ({
  x,
  y,
  width,
  height,
});
const key = (theme: string, n: number) => `single/normal/${theme}/${theme}-singles-${n}`;
const standing = (
  id: string,
  name: string,
  emoji: string,
  theme: string,
  n: number,
  size: [number, number],
  anchor: [number, number],
  footprint: FurnitureRect,
  extra: Partial<Pick<FurnitureDefinition, "surface" | "access">> = {},
): FurnitureDefinition => ({
  id,
  name,
  emoji,
  key: key(theme, n),
  size,
  anchor,
  footprint,
  layer: "standing",
  blocking: true,
  facing: "south",
  ...extra,
});

/** Source inspected; placement metadata remains subject to the ordinary human review loop. */
export const FURNITURE_CATALOG: readonly FurnitureDefinition[] = [
  standing(
    "single-bed",
    "Single bed",
    "🛏️",
    "bedroom",
    140,
    [16, 48],
    [8, 38],
    rect(-8, -28, 16, 28),
    { access: rect(8, -24, 12, 24) },
  ),
  standing(
    "bunk-bed",
    "Bunk bed",
    "🛏️",
    "bedroom",
    125,
    [48, 48],
    [24, 48],
    rect(-20, -24, 40, 24),
    { access: rect(8, 0, 12, 12) },
  ),
  standing(
    "wardrobe",
    "Wardrobe",
    "🚪",
    "living-room",
    37,
    [32, 48],
    [16, 43],
    rect(-14, -12, 28, 12),
    { access: rect(-14, 0, 28, 12) },
  ),
  standing(
    "dresser",
    "Low dresser",
    "🗄️",
    "living-room",
    55,
    [32, 32],
    [16, 26],
    rect(-12, -12, 24, 12),
    { surface: rect(5, 5, 23, 10), access: rect(-12, 0, 24, 12) },
  ),
  standing(
    "side-table",
    "Bedside table",
    "🗄️",
    "living-room",
    63,
    [16, 32],
    [8, 25],
    rect(-8, -10, 16, 10),
    { surface: rect(1, 5, 14, 10) },
  ),
  standing(
    "worktable",
    "Wooden worktable",
    "🪑",
    "art",
    22,
    [32, 32],
    [16, 32],
    rect(-14, -12, 28, 12),
    { surface: rect(3, 14, 26, 9), access: rect(-12, 0, 24, 12) },
  ),
  standing("stool", "Wooden stool", "🪑", "art", 30, [16, 32], [8, 25], rect(-6, -8, 12, 8), {
    access: rect(-6, 0, 12, 12),
  }),
  standing(
    "potted-tree",
    "Potted tree",
    "🪴",
    "living-room",
    13,
    [32, 48],
    [16, 40],
    rect(-7, -8, 14, 8),
  ),
  standing(
    "floor-lamp",
    "Floor lamp",
    "💡",
    "living-room",
    79,
    [16, 48],
    [8, 41],
    rect(-6, -6, 12, 6),
  ),
  standing(
    "fireplace",
    "Stove fireplace",
    "🔥",
    "living-room",
    107,
    [32, 48],
    [16, 40],
    rect(-16, -14, 32, 14),
    { access: rect(-16, 0, 32, 12) },
  ),
  standing(
    "log-rack",
    "Log rack",
    "🪵",
    "living-room",
    116,
    [16, 32],
    [8, 23],
    rect(-6, -6, 12, 6),
  ),
  {
    id: "rug",
    name: "Square rug",
    emoji: "🟫",
    key: key("bedroom", 385),
    size: [32, 32],
    anchor: [16, 32],
    footprint: rect(-16, -32, 32, 32),
    layer: "floor",
    blocking: false,
    facing: "none",
  },
  {
    id: "wall-picture",
    name: "Landscape picture",
    emoji: "🖼️",
    key: key("art", 46),
    size: [16, 32],
    anchor: [8, 25],
    footprint: rect(-6, -15, 12, 15),
    layer: "wall",
    blocking: false,
    facing: "south",
  },
  {
    id: "table-plant",
    name: "Small potted plant",
    emoji: "🪴",
    key: key("living-room", 15),
    size: [16, 32],
    anchor: [8, 20],
    footprint: rect(-4, -3, 8, 3),
    layer: "surface",
    blocking: false,
    facing: "none",
  },
  {
    id: "table-lamp",
    name: "Table lamp",
    emoji: "💡",
    key: key("living-room", 71),
    size: [16, 32],
    anchor: [8, 28],
    footprint: rect(-4, -3, 8, 3),
    layer: "surface",
    blocking: false,
    facing: "south",
  },
  {
    id: "table-mirror",
    name: "Standing mirror",
    emoji: "🪞",
    key: key("living-room", 27),
    size: [16, 16],
    anchor: [8, 16],
    footprint: rect(-4, -3, 8, 3),
    layer: "surface",
    blocking: false,
    facing: "south",
  },
];
export const FURNITURE_CATALOG_VERSION = 1;
export function furnitureDefinition(id: string): FurnitureDefinition {
  const definition = FURNITURE_CATALOG.find((d) => d.id === id);
  if (!definition) throw new Error(`Unknown furniture: ${id}`);
  return definition;
}

export interface FurniturePlacement {
  id: string;
  asset: string;
  /** Ground/wall anchor in map pixels, or support anchor in the parent's sprite coordinates. */
  x: number;
  y: number;
  on?: string;
}

/** Historical records retain their identifiers even if future catalogs retire an asset. */
export function parseFurniturePlacements(value: unknown): FurniturePlacement[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid furniture list");
  const ids = new Set<string>();
  return value.map((p) => {
    if (
      !p ||
      typeof p !== "object" ||
      ![p.id, p.asset].every((v) => typeof v === "string" && /^[a-z0-9-]{1,80}$/.test(v)) ||
      ids.has(p.id) ||
      ![p.x, p.y].every((v) => Number.isInteger(v) && v >= 0 && v <= 2560) ||
      (p.on !== undefined && (typeof p.on !== "string" || !/^[a-z0-9-]{1,80}$/.test(p.on)))
    )
      throw new Error("Invalid furniture placement");
    if (p.rotation !== undefined || p.facing !== undefined || p.flip !== undefined)
      throw new Error("Unsupported furniture orientation; choose a catalog sprite");
    ids.add(p.id);
    return {
      id: p.id,
      asset: p.asset,
      x: p.x,
      y: p.y,
      ...(p.on !== undefined ? { on: p.on } : {}),
    };
  });
}
