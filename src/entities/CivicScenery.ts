import type { Prop, PropCollider } from "./Prop.js";

// [atlas x, atlas y, width, height, physical width, physical depth, solid height].
const art = {
  wreck: [1776, 3104, 64, 48, 53, 25, 24],
  stack: [1904, 3072, 64, 80, 52, 27, 52],
  scrap: [1984, 3232, 80, 48, 62, 22, 18],
  gate: [1280, 4352, 64, 80, 0, 0, 0],
  stone: [960, 4352, 32, 32, 15, 7, 24],
  marble: [1088, 4352, 32, 32, 17, 8, 25],
  candle: [1136, 4384, 16, 48, 5, 5, 32],
  blossoms: [160, 4416, 32, 32, 0, 0, 0],
  autumn: [1104, 4464, 32, 48, 9, 8, 33],
  stretcher: [496, 2352, 48, 32, 42, 14, 13],
  mailbox: [2080, 5328, 16, 32, 12, 9, 18],
  dispatch: [2032, 5264, 32, 32, 22, 15, 18],
  parcels: [2032, 5264, 32, 32, 22, 15, 18],
  goal: [480, 3248, 64, 48, 0, 0, 0],
  pots: [352, 3472, 16, 32, 11, 9, 20],
  topiary: [416, 3456, 16, 48, 10, 9, 33],
  greenhouse: [2464, 3632, 128, 128, 0, 0, 0],
  sale: [96, 944, 32, 32, 24, 15, 17],
  clinicSign: [528, 2272, 80, 80, 12, 9, 36],
} as const;
export type CivicPiece = keyof typeof art;
const post = (
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  zHeight: number,
): PropCollider => ({ offsetX, offsetY, width, height, zHeight });
export function civicScenery(type: string, wx: number, wy: number): Prop | undefined {
  if (!type.startsWith("prop-civic-")) return;
  const key = type.slice(11) as CivicPiece;
  if (!Object.hasOwn(art, key)) return;
  const [x, y, w, h, pw, pd, z] = art[key];
  let walls: PropCollider[] | null = pw ? [post(0, -2, pw, pd, z)] : null;
  if (key === "gate" || key === "goal") walls = [post(-24, -2, 7, 7, 48), post(24, -2, 7, 7, 48)];
  if (key === "greenhouse")
    walls = [post(-59, 0, 6, 66, 55), post(59, 0, 6, 66, 55), post(0, -64, 118, 4, 54)];
  return {
    id: 0,
    isProp: true,
    type,
    position: { wx, wy },
    sprite: {
      sheetKey: "me-complete",
      frameCol: x / 16,
      frameRow: y / 16,
      spriteWidth: w,
      spriteHeight: h,
    },
    walls,
    collider: walls?.[0] ?? null,
  };
}
