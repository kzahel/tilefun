import { Direction, type Entity } from "./Entity.js";

const COW_SPRITE_SIZE = 32;
const COW_SPEED = 12;
const COW_FRAME_DURATION = 250;
const COW_FRAME_COUNT = 3;

/** Create a cow NPC at the given world position. */
export function createCow(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "cow",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "cow",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: COW_FRAME_DURATION,
      frameCount: COW_FRAME_COUNT,
      direction: Direction.Down,
      moving: false,
      spriteWidth: COW_SPRITE_SIZE,
      spriteHeight: COW_SPRITE_SIZE,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 14,
      height: 8,
    },
    wanderAI: {
      state: "idle",
      timer: 3.0,
      dirX: 0,
      dirY: 0,
      idleMin: 2.0,
      idleMax: 5.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: COW_SPEED,
    },
  };
}
