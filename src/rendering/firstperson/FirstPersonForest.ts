import type { Spritesheet } from "../../assets/Spritesheet.js";
import { ELEVATION_PX, MAX_ELEVATION } from "../../config/constants.js";
import { getEntityAABB } from "../../entities/collision.js";
import type { Prop } from "../../entities/Prop.js";
import { type FOREST_KITS, FOREST_ROW_STEP } from "../../patterns/ForestThicket.js";
import type { Billboard } from "./FirstPersonBillboards.js";
import { propPieces } from "./FirstPersonProps.js";
import type { WorldRect } from "./ObliqueCamera.js";

// Whole trees from the same exteriors sheet as the native forest compositions.
// The ground painted at their feet sits mostly below the perspective ground plane.
const GREEN_OAK = { sx: 2464, sy: 16, sw: 64, sh: 64 };
const TEAL_OAK = { ...GREEN_OAK, sy: 864 };
const GOLD_OAK = { ...GREEN_OAK, sy: 1280 };
const ORANGE_OAK = { ...GREEN_OAK, sy: 448 };
const TALL_OAK = { ...GREEN_OAK, sx: 2336, sy: 192 };
const GREEN_PINE = { sx: 2656, sy: 144, sw: 32, sh: 64 };
const TEAL_PINE = { ...GREEN_PINE, sy: 992 };
const TREE_PALETTES = [
  [TALL_OAK, TEAL_OAK, GREEN_OAK, TEAL_OAK, GOLD_OAK],
  [GREEN_OAK, TEAL_OAK, TEAL_PINE, GREEN_OAK, TEAL_OAK],
  [GREEN_OAK, TEAL_OAK, GREEN_PINE, TEAL_OAK, ORANGE_OAK],
] as const;
const TREE_SPACING = 37;
const MAX_TREE_SCALE = 1.36;
const MAX_CROWN_RADIUS = (64 * MAX_TREE_SCALE) / 2;

/** World coverage for either camera, including top-down height and the depth of
 * crowns that turn towards a perspective camera. */
export function forestRenderBounds(prop: Prop): WorldRect {
  const { wx, wy } = prop.position;
  const half = prop.sprite.spriteWidth / 2;
  return {
    left: wx - half - MAX_CROWN_RADIUS,
    right: wx + half + MAX_CROWN_RADIUS,
    top:
      wy -
      Math.max(
        prop.sprite.spriteHeight + MAX_ELEVATION * ELEVATION_PX,
        FOREST_ROW_STEP + MAX_CROWN_RADIUS,
      ),
    bottom: wy + MAX_CROWN_RADIUS,
  };
}

/** The original multipart artwork at its authored top-down coordinates. */
export function forestRowCards(prop: Prop, elevation: number, sheet: Spritesheet): Billboard[] {
  return propPieces(prop).map((piece) => {
    const { x, y } = sheet.getRegion(piece.frameCol, piece.frameRow);
    return {
      image: sheet.image,
      sx: x,
      sy: y,
      sw: piece.spriteWidth,
      sh: piece.spriteHeight,
      x: prop.position.wx + piece.dx,
      y: prop.position.wy + piece.dy,
      z: elevation,
      width: piece.spriteWidth,
      height: piece.spriteHeight,
    };
  });
}

/** Plant intact trees within the row's collision bands for perspective views
 * and for shadows. A stable coordinate seed staggers sizes, colours and roots. */
export function forestTreeCards(
  prop: Prop,
  kit: (typeof FOREST_KITS)[number]["id"],
  elevation: number,
  sheet: Spritesheet,
): Billboard[] {
  const palette = TREE_PALETTES[kit - 1] ?? TREE_PALETTES[0];
  const trees: Billboard[] = [];
  let seed = Math.imul(prop.position.wx, 1597334677) ^ Math.imul(prop.position.wy, 1221945259);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (const wall of prop.walls ?? []) {
    const { left, right, top, bottom } = getEntityAABB(prop.position, wall);
    const count = Math.max(1, Math.round((right - left) / TREE_SPACING));
    const step = (right - left) / count;
    for (let i = 0; i < count; i++) {
      const art = palette[Math.floor(random() * palette.length)] ?? palette[0];
      const scale = 0.9 + random() * (MAX_TREE_SCALE - 0.9);
      trees.push({
        ...art,
        image: sheet.image,
        x: left + (i + 0.25 + random() / 2) * step,
        y: top + (bottom - top) * (0.25 + random() / 2),
        z: elevation - 7 * scale,
        width: art.sw * scale,
        height: art.sh * scale,
      });
    }
  }
  return trees;
}
