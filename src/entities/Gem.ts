import { Direction, type Entity } from "./Entity.js";

const GEM_SIZE = 16;
const GEM_FRAME_DURATION = 150;
const GEM_FRAME_COUNT = 4;

/** Create a collectible gem — always animating, non-solid (player walks through to collect). */
export function createGem(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "gem",
    position: { wx, wy },
    velocity: null,
    sprite: {
      sheetKey: "gem",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: GEM_FRAME_DURATION,
      frameCount: GEM_FRAME_COUNT,
      direction: Direction.Down,
      moving: true,
      spriteWidth: GEM_SIZE,
      spriteHeight: GEM_SIZE,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 10,
      solid: false,
    },
    wanderAI: null,
  };
}
