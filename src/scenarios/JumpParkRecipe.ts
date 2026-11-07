import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { surfaceProp } from "./WorldGeometryRecipe.js";

/** One planar piece of a lane profile: horizontal length and height change, px. */
type Piece = readonly [length: number, rise: number];
interface Feature {
  /** Lane centre (wy) and first piece's west edge (wx). */
  y: number;
  x: number;
  /** Consecutive pieces; a `gap` leaves open ground before the next run. */
  runs: readonly (readonly Piece[] | { gap: number })[];
}

const HALF_WIDTH = 64;
export const JUMP_RUN_UP = -768;
/** Lanes run west→east. Curved lips are chains of steepening planes. Landing
 * hills rise to takeoff height through an eased foot, so a short jump lands in
 * the gap and climbs out instead of wedging against a sudden crease. */
export const JUMP_FEATURES = {
  kicker: {
    y: 0,
    x: 0,
    runs: [
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
  },
  sky: {
    y: 192,
    x: 0,
    runs: [
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
  },
  double: {
    y: -192,
    x: 0,
    runs: [
      [[128, 48]],
      { gap: 112 },
      [
        [48, 8],
        [96, 40],
        [256, -48],
      ],
    ],
  },
  tabletop: {
    y: 384,
    x: 0,
    runs: [
      [
        [192, 24],
        [96, 24],
        [256, 0],
        [320, -48],
      ],
    ],
  },
  rollers: {
    y: -384,
    x: 0,
    runs: [
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
  },
} satisfies Record<string, Feature>;
export type JumpLane = keyof typeof JUMP_FEATURES;

export const JUMP_STARTS = Object.fromEntries(
  Object.entries(JUMP_FEATURES).map(([name, f]) => [
    name,
    { position: { wx: JUMP_RUN_UP, wy: f.y + 40 }, z: 0 },
  ]),
) as Record<JumpLane, { position: { wx: number; wy: number }; z: number }>;

/** Each authored piece is split into coplanar slabs rising at most this much,
 * whose undersides meet the ground at their low ends: the profile reads as a
 * solid embankment and leaves no gap a car or player fits beneath. */
const SLAB_RISE = 12;

/** Planar profile slabs chained west→east; tops are exactly the authored pieces. */
export function jumpFeatureProps(name: string, feature: Feature): Prop[] {
  const slabs: { left: number; right: number; z: number; rise: number }[][] = [];
  let x = feature.x;
  for (const part of feature.runs) {
    if ("gap" in part) {
      x += part.gap;
      continue;
    }
    const run: (typeof slabs)[number] = [];
    let z = 0;
    for (const [length, rise] of part) {
      const count = Math.max(1, Math.ceil(Math.abs(rise) / SLAB_RISE));
      for (let i = 0; i < count; i++)
        run.push({
          left: x + (length * i) / count,
          right: x + (length * (i + 1)) / count,
          z: z + (rise * i) / count,
          rise: rise / count,
        });
      x += length;
      z += rise;
    }
    slabs.push(run);
  }
  return slabs.flatMap((run, r) =>
    run.map((slab, i) => {
      const id = (n: number) => `${name}:${r}:${n}`;
      return surfaceProp(
        {
          left: slab.left,
          top: feature.y - HALF_WIDTH,
          right: slab.right,
          bottom: feature.y + HALF_WIDTH,
        },
        {
          id: id(i),
          spaceId: `${name}:${r}`,
          z: slab.z,
          riseX: slab.rise,
          riseY: 0,
          thickness: Math.min(slab.z, slab.z + slab.rise) + 1,
          connectsTo: [i > 0 && id(i - 1), i < run.length - 1 && id(i + 1)].filter(
            (n): n is string => !!n,
          ),
        },
      );
    }),
  );
}

/** Workshop jump park: ordinary surfaces, parked car and shared Realm physics. */
export function jumpParkRecipe(
  model = "rally-hatchback",
  lane: JumpLane = "kicker",
): ScenarioRecipe {
  const start = JUMP_STARTS[lane];
  const y = JUMP_FEATURES[lane].y;
  const lanes = Object.values(JUMP_FEATURES).map((f) => f.y);
  return {
    version: 1,
    id: "jump-park-v1",
    generation: FLAT_SCENARIO,
    player: { ...createPlayer(start.position.wx, start.position.wy), wz: 0 },
    measurePhysics: true,
    props: [
      ...Object.entries(JUMP_FEATURES).flatMap(([name, f]) => jumpFeatureProps(name, f)),
      ...scenarioWalls(-960, -512, 1856, 512),
    ],
    roads: lanes.map((ly) => ({
      left: -896,
      top: ly - HALF_WIDTH,
      right: 1792,
      bottom: ly + HALF_WIDTH,
    })),
    parkedVehicles: [{ name: "car", model, wx: JUMP_RUN_UP, wy: y, facing: Direction.Right }],
  };
}
