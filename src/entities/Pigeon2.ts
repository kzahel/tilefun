import { Direction, type Entity } from "./Entity.js";

const PIGEON2_SPRITE_SIZE = 16;
const PIGEON2_SPEED = 15;
const PIGEON2_FRAME_DURATION = 150;
const PIGEON2_FRAME_COUNT = 6;

/** Create a gray pigeon NPC at the given world position. */
export function createPigeon2(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "pigeon2",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "pigeon2",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: PIGEON2_FRAME_DURATION,
      frameCount: PIGEON2_FRAME_COUNT,
      direction: Direction.Down,
      moving: false,
      spriteWidth: PIGEON2_SPRITE_SIZE,
      spriteHeight: PIGEON2_SPRITE_SIZE,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 8,
      height: 6,
    },
    wanderAI: {
      state: "idle",
      timer: 2.0,
      dirX: 0,
      dirY: 0,
      idleMin: 1.5,
      idleMax: 5.0,
      walkMin: 0.5,
      walkMax: 2.0,
      speed: PIGEON2_SPEED,
    },
  };
}
