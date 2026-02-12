import { Direction, type Entity } from "./Entity.js";

const CAMPFIRE_WIDTH = 16;
const CAMPFIRE_HEIGHT = 32;
const CAMPFIRE_FRAME_DURATION = 150;
const CAMPFIRE_FRAME_COUNT = 6;

/** Create a campfire decoration — always animating, stationary, blocks movement. */
export function createCampfire(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "campfire",
    position: { wx, wy },
    velocity: null,
    sprite: {
      sheetKey: "campfire",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: CAMPFIRE_FRAME_DURATION,
      frameCount: CAMPFIRE_FRAME_COUNT,
      direction: Direction.Down,
      moving: true,
      spriteWidth: CAMPFIRE_WIDTH,
      spriteHeight: CAMPFIRE_HEIGHT,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 12,
      height: 8,
    },
    wanderAI: null,
  };
}
