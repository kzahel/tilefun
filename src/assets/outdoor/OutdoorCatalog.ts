import type { ArtRect } from "../../art/ArtCatalog.js";
import type { Prop, PropCollider } from "../../entities/Prop.js";

export const OUTDOOR_CATEGORIES = [
  "seating",
  "shade",
  "planting",
  "market",
  "lighting",
  "street",
  "vehicle",
  "building",
  "terrain",
  "decoration",
  "other",
] as const;
export const OUTDOOR_KINDS = [
  "prop",
  "modular",
  "animation",
  "terrain",
  "composition",
  "unknown",
] as const;
export interface OutdoorMetadata {
  name: string;
  category: (typeof OUTDOOR_CATEGORIES)[number];
  kind: (typeof OUTDOOR_KINDS)[number];
  tags: string[];
  settings: string[];
  facing: "unknown" | "south" | "north" | "east" | "west";
  /** Native source pixels relative to the slice's top-left. */
  anchor: [number, number];
  /** Ground-plane rectangle relative to the placement anchor; not image bounds. */
  footprint: ArtRect | null;
  /** null = unknown, [] = deliberately nonblocking. Offsets use production feet convention. */
  colliders: PropCollider[] | null;
  depthOffset: number;
}
export interface OutdoorAsset {
  id: string;
  aliases: { key: string; name: string; theme: string }[];
  rect: ArtRect;
  visualBounds: ArtRect;
  metadata: OutdoorMetadata;
  evidence: "inferred" | "candidate" | "runtime";
  runtimeTypes: string[];
}
export interface OutdoorCatalog {
  version: 1;
  sourceFingerprint: string;
  revision: string;
  width: number;
  height: number;
  assets: OutdoorAsset[];
  coverage: {
    totalCells: number;
    occupiedCells: number;
    indexedCells: number;
    gapCells: number;
    /** Every nonempty 16px cell not covered by a named slice, merged into horizontal runs. */
    gaps: ArtRect[];
    originalMatched: number;
    originalUnmatched: number;
  };
}
export function outdoorId(rect: ArtRect) {
  return `me:${rect.join(":")}`;
}
export function readableName(name: string) {
  return name
    .replace(/^ME_Singles_/, "")
    .replace(/_16x16/g, "")
    .replace(/^24_Additional_Houses_/, "")
    .replace(/_/g, " ")
    .replace(/\bChiar\b/gi, "Chair")
    .replace(/\s+/g, " ")
    .trim();
}
export function inferMetadata(name: string, theme: string, rect: ArtRect): OutdoorMetadata {
  const text = `${name} ${theme}`.toLowerCase();
  const category = /umbrella|canopy|gazebo|awning/.test(text)
    ? "shade"
    : /table|bench|chair|picnic/.test(name.toLowerCase())
      ? "seating"
      : /tree|flower|plant|bush|vase/.test(name.toLowerCase())
        ? "planting"
        : /cart|stall|market/.test(text)
          ? "market"
          : /lamp|light/.test(name.toLowerCase())
            ? "lighting"
            : /car_|truck|bus_|vehicle/.test(text)
              ? "vehicle"
              : /roof|floor|house|condo|hotel|building/.test(text)
                ? "building"
                : /terrain|asphalt|sidewalk|grass|water/.test(text)
                  ? "terrain"
                  : /meter|trash|pole|mailbox/.test(text)
                    ? "street"
                    : "other";
  const kind =
    category === "terrain"
      ? "terrain"
      : /roof|middle_floor|corner|wall|balcony|entrance/.test(name.toLowerCase())
        ? "modular"
        : /animation|frame/.test(name.toLowerCase())
          ? "animation"
          : /composition/.test(name.toLowerCase())
            ? "composition"
            : "unknown";
  const settings = ["seating", "shade", "planting"].includes(category)
    ? ["park", "square"]
    : category === "market"
      ? ["market", "square"]
      : ["lighting", "street"].includes(category)
        ? ["sidewalk", "square"]
        : [];
  return {
    name: readableName(name),
    category,
    kind,
    tags: [category, readableName(theme).replace(/^\d+ /, "")].filter(Boolean),
    settings,
    facing: "unknown",
    anchor: [rect[2] / 2, rect[3]],
    footprint: null,
    colliders: null,
    depthOffset: 0,
  };
}
function strings(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 20 ||
    value.some((v) => typeof v !== "string" || !v.trim() || v.length > 80)
  )
    throw new Error(`Invalid ${label}`);
  return value.map((v) => v.trim());
}
export function parseOutdoorMetadata(value: unknown, rect: ArtRect): OutdoorMetadata {
  if (!value || typeof value !== "object") throw new Error("Invalid asset metadata");
  const v = value as OutdoorMetadata;
  if (
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.length > 160 ||
    !OUTDOOR_CATEGORIES.includes(v.category) ||
    !OUTDOOR_KINDS.includes(v.kind) ||
    !["unknown", "south", "north", "east", "west"].includes(v.facing)
  )
    throw new Error("Invalid asset labels");
  if (
    !Array.isArray(v.anchor) ||
    v.anchor.length !== 2 ||
    v.anchor.some((n) => !Number.isFinite(n)) ||
    v.anchor[0] < 0 ||
    v.anchor[0] > rect[2] ||
    v.anchor[1] < 0 ||
    v.anchor[1] > rect[3]
  )
    throw new Error("Anchor is outside the asset");
  const footprint = v.footprint;
  if (
    footprint !== null &&
    (!Array.isArray(footprint) ||
      footprint.length !== 4 ||
      footprint.some((n) => !Number.isFinite(n) || Math.abs(n) > 2048) ||
      footprint[2] <= 0 ||
      footprint[3] <= 0)
  )
    throw new Error("Invalid ground footprint");
  if (v.colliders !== null && (!Array.isArray(v.colliders) || v.colliders.length > 16))
    throw new Error("Invalid collision geometry");
  const colliders =
    v.colliders?.map((c) => {
      if (
        !c ||
        [c.offsetX, c.offsetY, c.width, c.height].some(
          (n) => !Number.isFinite(n) || Math.abs(n) > 2048,
        ) ||
        c.width <= 0 ||
        c.height <= 0
      )
        throw new Error("Invalid collider rectangle");
      if (
        (c.zBase !== undefined && (!Number.isFinite(c.zBase) || c.zBase < 0 || c.zBase > 2048)) ||
        (c.zHeight !== undefined &&
          (!Number.isFinite(c.zHeight) || c.zHeight <= 0 || c.zHeight > 2048)) ||
        (c.passable !== undefined && typeof c.passable !== "boolean") ||
        (c.walkableTop !== undefined && typeof c.walkableTop !== "boolean")
      )
        throw new Error("Invalid collider height");
      if (c.walkableTop && c.zHeight === undefined)
        throw new Error("Walkable surfaces require height");
      return {
        offsetX: c.offsetX,
        offsetY: c.offsetY,
        width: c.width,
        height: c.height,
        ...(c.zBase === undefined ? {} : { zBase: c.zBase }),
        ...(c.zHeight === undefined ? {} : { zHeight: c.zHeight }),
        ...(c.passable === undefined ? {} : { passable: c.passable }),
        ...(c.walkableTop === undefined ? {} : { walkableTop: c.walkableTop }),
      };
    }) ?? null;
  if (!Number.isFinite(v.depthOffset) || Math.abs(v.depthOffset) > 2048)
    throw new Error("Invalid depth offset");
  return {
    name: v.name.trim(),
    category: v.category,
    kind: v.kind,
    tags: strings(v.tags, "tags"),
    settings: strings(v.settings, "settings"),
    facing: v.facing,
    anchor: [...v.anchor],
    footprint: footprint ? [...footprint] : null,
    colliders,
    depthOffset: v.depthOffset,
  };
}
/** The same production Prop shape for catalog testing and future promoted placements.
 * No inference turns unknown geometry into blocking collision. */
export function outdoorProp(
  asset: Pick<OutdoorAsset, "id" | "rect">,
  metadata: OutdoorMetadata,
  wx: number,
  wy: number,
): Prop {
  const [x, y, w, h] = asset.rect;
  const dx = w / 2 - metadata.anchor[0],
    dy = h - metadata.anchor[1];
  return {
    id: 0,
    type: `outdoor:${asset.id}`,
    position: { wx, wy },
    sprite: {
      sheetKey: "me-complete",
      frameCol: x / 16,
      frameRow: y / 16,
      spriteWidth: w + Math.abs(dx) * 2,
      spriteHeight: h + Math.abs(dy),
      parts: [{ frameCol: x / 16, frameRow: y / 16, spriteWidth: w, spriteHeight: h, dx, dy }],
    },
    collider: null,
    walls: metadata.colliders?.map((c) => ({ ...c })) ?? null,
    sortOffsetY: metadata.depthOffset,
    isProp: true,
  };
}
