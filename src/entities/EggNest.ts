import { Direction, type Entity } from "./Entity.js";

const EGG_NEST_SPRITE_SIZE = 16;
const EGG_NEST_FRAME_DURATION = 400;
const EGG_NEST_FRAME_COUNT = 4;

/** Create an egg & nest decoration — always animating, stationary. */
export function createEggNest(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "egg-nest",
    position: { wx, wy },
    velocity: null,
    sprite: {
      sheetKey: "egg-nest",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: EGG_NEST_FRAME_DURATION,
      frameCount: EGG_NEST_FRAME_COUNT,
      direction: Direction.Down,
      moving: true,
      spriteWidth: EGG_NEST_SPRITE_SIZE,
      spriteHeight: EGG_NEST_SPRITE_SIZE,
    },
    collider: null,
    wanderAI: null,
  };
}
