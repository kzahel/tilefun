import { Direction, type Entity } from "./Entity.js";

const FISH_SPRITE_SIZE = 16;
const FISH_FRAME_DURATION = 180;

/** Create a fish decoration (variant 1) — always animating, stationary. */
export function createFish1(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "fish1",
    position: { wx, wy },
    velocity: null,
    sprite: {
      sheetKey: "fish1",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: FISH_FRAME_DURATION,
      frameCount: 12,
      direction: Direction.Down,
      moving: true,
      spriteWidth: FISH_SPRITE_SIZE,
      spriteHeight: FISH_SPRITE_SIZE,
    },
    collider: null,
    wanderAI: null,
    noShadow: true,
  };
}

/** Create a fish decoration (variant 2) — always animating, stationary. */
export function createFish2(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "fish2",
    position: { wx, wy },
    velocity: null,
    sprite: {
      sheetKey: "fish2",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: FISH_FRAME_DURATION,
      frameCount: 12,
      direction: Direction.Down,
      moving: true,
      spriteWidth: FISH_SPRITE_SIZE,
      spriteHeight: FISH_SPRITE_SIZE,
    },
    collider: null,
    wanderAI: null,
    noShadow: true,
  };
}

/** Create a fish decoration (variant 3) — always animating, stationary. */
export function createFish3(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "fish3",
    position: { wx, wy },
    velocity: null,
    sprite: {
      sheetKey: "fish3",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: FISH_FRAME_DURATION,
      frameCount: 14,
      direction: Direction.Down,
      moving: true,
      spriteWidth: FISH_SPRITE_SIZE,
      spriteHeight: FISH_SPRITE_SIZE,
    },
    collider: null,
    wanderAI: null,
    noShadow: true,
  };
}
