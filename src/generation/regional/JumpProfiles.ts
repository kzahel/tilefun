import type { Prop } from "../../entities/Prop.js";

/** One planar piece of a jump profile: horizontal length and height change, px. */
export type JumpPiece = readonly [length: number, rise: number];
/** Consecutive pieces; a `gap` leaves open ground before the next run. */
export type JumpRun = readonly JumpPiece[] | { readonly gap: number };

/** Shared by the Workshop jump park (223) and generated motocross parks (224).
 * Curved lips are chains of steepening planes. Landing hills rise to takeoff
 * height through an eased foot, so a short jump lands in the gap and climbs out
 * instead of wedging against a sudden crease. */
export const JUMP_PROFILES = {
  kicker: [
    [
      [64, 6],
      [48, 10],
      [40, 14],
      [32, 18],
    ],
    { gap: 176 },
    [
      [48, 8],
      [96, 40],
      [384, -48],
    ],
  ],
  sky: [
    [
      [96, 8],
      [64, 12],
      [48, 16],
      [40, 20],
      [32, 24],
    ],
    { gap: 288 },
    [
      [64, 12],
      [128, 52],
      [576, -64],
    ],
  ],
  double: [
    [[128, 48]],
    { gap: 112 },
    [
      [48, 8],
      [96, 40],
      [256, -48],
    ],
  ],
  tabletop: [
    [
      [192, 24],
      [96, 24],
      [256, 0],
      [320, -48],
    ],
  ],
  rollers: [
    [
      [64, 12],
      [64, -12],
      [64, 12],
      [64, -12],
      [64, 12],
      [64, -12],
      [64, 12],
      [64, -12],
      [64, 12],
      [64, -12],
    ],
  ],
} as const satisfies Record<string, readonly JumpRun[]>;
export type JumpName = keyof typeof JUMP_PROFILES;
/** East-bound features rise toward +x; west-bound ones are mirrored. */
export type JumpDirection = "e" | "w";
/** Lane width across travel, px. */
export const JUMP_WIDTH = 128;

/** Each authored piece is split into coplanar slabs rising at most this much,
 * whose undersides meet the ground at their low ends: the profile reads as a
 * solid embankment and leaves no gap a car or player fits beneath. */
const SLAB_RISE = 12;

export interface JumpSlab {
  run: number;
  index: number;
  /** Travel distance from the feature start, px. */
  start: number;
  end: number;
  /** Height at `start` and change to `end`. */
  z: number;
  rise: number;
  count: number;
}

const slabs = new Map<JumpName, JumpSlab[]>();
export function jumpSlabs(name: JumpName): readonly JumpSlab[] {
  const cached = slabs.get(name);
  if (cached) return cached;
  const result: JumpSlab[] = [];
  let at = 0,
    run = 0;
  for (const part of JUMP_PROFILES[name] as readonly JumpRun[]) {
    if ("gap" in part) {
      at += part.gap;
      continue;
    }
    const first = result.length;
    let z = 0;
    for (const [length, rise] of part) {
      const count = Math.max(1, Math.ceil(Math.abs(rise) / SLAB_RISE));
      for (let i = 0; i < count; i++)
        result.push({
          run,
          index: result.length - first,
          start: at + (length * i) / count,
          end: at + (length * (i + 1)) / count,
          z: z + (rise * i) / count,
          rise: rise / count,
          count: 0,
        });
      at += length;
      z += rise;
    }
    for (const slab of result.slice(first)) slab.count = result.length - first;
    run++;
  }
  slabs.set(name, result);
  return result;
}

/** Total travel length of a feature, including its gaps, px. */
export function jumpLength(name: JumpName): number {
  return Math.max(...jumpSlabs(name).map((s) => s.end));
}

/** Height of a feature's top surface at a travel distance; 0 in gaps. */
export function jumpHeight(name: JumpName, travel: number): number {
  const slab = jumpSlabs(name).find((s) => travel >= s.start && travel < s.end);
  return slab ? slab.z + (slab.rise * (travel - slab.start)) / (slab.end - slab.start) : 0;
}

const TYPE = /^prop-mx-([a-z]+)-(\d+)-(\d+)-([ew])$/;

/** Ordinary procedural slab props for one feature starting at `startX` (travel
 * distance 0) on a lane centred at `laneY`; all world px. */
export function jumpPlacements(
  name: JumpName,
  direction: JumpDirection,
  startX: number,
  laneY: number,
  featureId: string,
) {
  return jumpSlabs(name).map((s) => {
    const center = (s.start + s.end) / 2;
    return {
      featureId: `${featureId}:${s.run}:${s.index}`,
      propType: `prop-mx-${name}-${s.run}-${s.index}-${direction}`,
      wx: direction === "e" ? startX + center : startX - center,
      wy: laneY + JUMP_WIDTH / 2,
    };
  });
}

/** One planar surface; the space identity derives from the feature start so
 * every slab of a run joins the same space wherever its chunk loads. */
export function jumpSlabProp(type: string, wx: number, wy: number): Prop | undefined {
  const match = TYPE.exec(type);
  if (!match || !(match[1] && match[1] in JUMP_PROFILES)) return;
  const name = match[1] as JumpName,
    run = Number(match[2]),
    index = Number(match[3]),
    east = match[4] === "e";
  const slab = jumpSlabs(name).find((s) => s.run === run && s.index === index);
  if (!slab) return;
  const center = (slab.start + slab.end) / 2;
  // Fractional slab centres: round so every slab names the same run space.
  const startX = Math.round(east ? wx - center : wx + center);
  const space = `mx:${name}:${match[4]}:${startX}:${wy}:${run}`;
  const id = (i: number) => `${space}:${i}`;
  return {
    id: 0,
    type,
    isProp: true,
    position: { wx, wy },
    sprite: {
      sheetKey: "geometry-surface",
      frameCol: 0,
      frameRow: 0,
      spriteWidth: 0,
      spriteHeight: 0,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: slab.end - slab.start,
      height: JUMP_WIDTH,
      surface: {
        id: id(index),
        spaceId: space,
        // Surfaces store their north-west height; west-bound slabs mirror.
        z: east ? slab.z : slab.z + slab.rise,
        riseX: east ? slab.rise : -slab.rise,
        riseY: 0,
        thickness: Math.min(slab.z, slab.z + slab.rise) + 1,
        connectsTo: [index > 0 && id(index - 1), index < slab.count - 1 && id(index + 1)].filter(
          (n): n is string => !!n,
        ),
      },
    },
    walls: null,
  };
}
