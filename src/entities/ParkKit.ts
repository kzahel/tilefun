import type { FacadePiece } from "../generation/regional/BuildingRecipes.js";
import type { Prop, PropCollider } from "./Prop.js";

/**
 * Outskirts park kit: unedited Modern Exteriors camping, pier and fence crops
 * (all on the atlas's 16px grid) as ordinary props with gameplay colliders.
 * Lab experiments only until the crops pass art review.
 */
type Rect = readonly [x: number, y: number, w: number, h: number];

const CROPS = {
  campSign: [1696, 96, 112, 64],
  tentBlue: [1696, 320, 64, 64],
  tentGreen: [1760, 320, 64, 64],
  tentTan: [1824, 320, 64, 64],
  logLong: [1856, 256, 48, 16],
  logShort: [1904, 256, 32, 16],
  cookingPot: [1888, 384, 48, 32],
  lantern: [1872, 128, 16, 16],
  backpack: [1808, 96, 16, 32],
  sleepingBag: [1888, 160, 16, 32],
  rock: [1872, 272, 16, 16],
  signpost: [1888, 336, 16, 32],
  dock: [2080, 240, 128, 48],
} as const satisfies Record<string, Rect>;
export type ParkPiece = keyof typeof CROPS;

/** Grey modular fence: corners and repeating runs, 16×16 each. */
const FENCE = {
  nw: [1376, 2976],
  n: [1392, 2976],
  ne: [1424, 2976],
  w: [1376, 2992],
  e: [1424, 2992],
  sw: [1376, 3024],
  s: [1392, 3024],
  se: [1424, 3024],
} as const;

function piece([x, y, w, h]: Rect, dx = 0, dy = 0, extra: Partial<FacadePiece> = {}): FacadePiece {
  return {
    frameCol: x / 16,
    frameRow: y / 16,
    spriteWidth: w,
    spriteHeight: h,
    dx,
    dy,
    ...extra,
  };
}

function atlasProp(
  type: string,
  wx: number,
  wy: number,
  rect: Rect,
  walls: PropCollider[] | null,
  parts?: FacadePiece[],
): Prop {
  return {
    id: 0,
    type,
    isProp: true,
    position: { wx, wy },
    sprite: {
      sheetKey: "me-complete",
      frameCol: rect[0] / 16,
      frameRow: rect[1] / 16,
      spriteWidth: rect[2],
      spriteHeight: rect[3],
      ...(parts ? { parts } : {}),
    },
    collider: walls?.[0] ?? null,
    walls,
  };
}

const solid = (width: number, height: number, zHeight: number, offsetX = 0, offsetY = 0) => ({
  offsetX,
  offsetY,
  width,
  height,
  zHeight,
});

/** Feet (`wx`, `wy`) are each sprite's bottom centre. */
export function parkProp(kind: ParkPiece, wx: number, wy: number): Prop {
  const rect = CROPS[kind];
  const type = `prop-park-${kind}`;
  switch (kind) {
    case "campSign":
      // Walk beneath the board between its two posts.
      return atlasProp(type, wx, wy, rect, [solid(6, 4, 64, -32, -2), solid(6, 4, 64, 32, -2)]);
    case "tentBlue":
    case "tentGreen":
    case "tentTan":
      return atlasProp(type, wx, wy, rect, [solid(52, 22, 40, 0, -2)]);
    case "logLong":
    case "logShort":
      // Sit or stand on the logs around the fire.
      return atlasProp(type, wx, wy, rect, [
        { ...solid(rect[2] - 8, 8, 8, 0, -3), walkableTop: true },
      ]);
    case "cookingPot":
      return atlasProp(type, wx, wy, rect, [solid(24, 6, 28, 0, -2)]);
    case "signpost":
      return atlasProp(type, wx, wy, rect, [solid(4, 4, 28, 0, -2)]);
    case "dock":
      // Planks rest on the sand jetty beneath them; their pixels are a floor.
      return atlasProp(type, wx, wy, rect, null, [piece(rect, 0, 0, { depthFloorZ: 0 })]);
    default:
      return atlasProp(type, wx, wy, rect, null);
  }
}

/** The dock's walkable plank band, relative to its feet: the jetty to paint beneath. */
export const DOCK_PLANKS = { width: 128, top: -48, bottom: -16 } as const;

/**
 * One straight fence side as a prop of 16px tiles. Horizontal runs draw from
 * `wx` eastward with feet on `wy`; vertical runs draw from `wy` southward.
 * Fences are 16px tall: players can hop them, wildlife cannot.
 */
export function fenceRun(
  side: "north" | "south" | "west" | "east",
  wx: number,
  wy: number,
  tiles: number,
): Prop {
  const horizontal = side === "north" || side === "south";
  const [first, middle, last] =
    side === "north"
      ? [FENCE.nw, FENCE.n, FENCE.ne]
      : side === "south"
        ? [FENCE.sw, FENCE.s, FENCE.se]
        : side === "west"
          ? [FENCE.w, FENCE.w, FENCE.w]
          : [FENCE.e, FENCE.e, FENCE.e];
  const parts = Array.from({ length: tiles }, (_, i) => {
    const [x, y] = i === 0 ? first : i === tiles - 1 ? last : middle;
    return horizontal
      ? piece([x, y, 16, 16], i * 16 + 8 - (tiles * 16) / 2, 0)
      : piece([x, y, 16, 16], 0, (i + 1) * 16 - tiles * 16);
  });
  const length = tiles * 16;
  const wall = horizontal
    ? solid(length, 4, 16, 0, side === "north" ? -2 : -4)
    : solid(4, length, 16, side === "west" ? -4 : 4);
  return atlasProp(
    `prop-park-fence-${side}`,
    horizontal ? wx + length / 2 : wx,
    horizontal ? wy : wy + length,
    [first[0], first[1], horizontal ? length : 16, horizontal ? 16 : length],
    [wall],
    parts,
  );
}
