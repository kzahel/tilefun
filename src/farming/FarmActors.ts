import { Direction, type Entity } from "../entities/Entity.js";
import type { AnimationClip, EntityDef } from "../entities/EntityDefs.js";

export const FARM_SHEET = "farm-garden";
export const FARM_IMAGE = "assets/farming/garden.png";
export const GARDEN_BED = "farm-garden-bed";
export const WOODLOT_TREE = "farm-woodlot-tree";
export const LOG_BUNDLE = "farm-log-bundle";
export const FENCE_STAKES = "farm-fence-stakes";
export const CHICKEN_FEEDER = "farm-chicken-feeder";
export const SCATTERED_CORN = "farm-scattered-corn";
export const GARDEN_FENCE = "prop-farm-fence";
export const GARDEN_FENCE_SIDE = "prop-farm-fence-side";
export const GROW_MS = 60_000;
export const FALL_MS = 600;

export interface FarmState {
  ripeAt?: number;
  watered?: boolean;
  chops?: number;
  effectUntil?: number;
}

const clip = (name: string, start: number, count = 1): AnimationClip => ({
  name,
  start,
  count,
  frameDuration: 150,
  loop: false,
});

function def(clips: AnimationClip[], trunk = false): EntityDef {
  return {
    sprite: {
      sheetKey: FARM_SHEET,
      spriteWidth: 32,
      spriteHeight: 32,
      clips,
      frameCount: 1,
      frameDuration: 150,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: trunk ? 9 : 10,
      height: 6,
      physicalHeight: trunk ? 9 : 3,
      solid: trunk,
    },
    wanderAI: null,
    hasVelocity: false,
    noShadow: true,
  };
}

export const FARM_DEFS: Record<string, EntityDef> = {
  [GARDEN_BED]: def([clip("soil", 0), clip("sprout", 1), clip("watered", 2), clip("ripe", 3)]),
  [WOODLOT_TREE]: def(
    [
      clip("tree", 4),
      clip("first-cut", 5, 3),
      clip("second-cut", 6, 2),
      clip("fall", 7, 4),
      clip("stump", 10),
    ],
    true,
  ),
  [LOG_BUNDLE]: def([clip("logs", 11)]),
  [FENCE_STAKES]: def([clip("stakes", 12)]),
  [CHICKEN_FEEDER]: def([clip("feed-here", 16)]),
  [SCATTERED_CORN]: def([clip("corn", 14)]),
};

export const FARM_FACTORIES = Object.fromEntries(
  Object.entries(FARM_DEFS).map(([type, definition]) => [
    type,
    (wx: number, wy: number): Entity => ({
      id: 0,
      type,
      position: { wx, wy },
      velocity: null,
      collider: definition.collider,
      wanderAI: null,
      noShadow: true,
      sprite: definition.sprite && {
        ...definition.sprite,
        clip: 0,
        frameCol: definition.sprite.clips?.[0]?.start ?? 0,
        frameRow: 0,
        animTimer: 0,
        direction: Direction.Down,
        moving: false,
      },
    }),
  ]),
);
