import { Direction, type Entity } from "./Entity.js";

const PIGEON_SPRITE_SIZE = 16;
const PIGEON_SPEED = 15;
const PIGEON_FRAME_DURATION = 150;
const PIGEON_FRAME_COUNT = 6;

/** Create a pigeon NPC at the given world position. */
export function createPigeon(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "pigeon",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "pigeon",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: PIGEON_FRAME_DURATION,
      frameCount: PIGEON_FRAME_COUNT,
      direction: Direction.Down,
      moving: false,
      spriteWidth: PIGEON_SPRITE_SIZE,
      spriteHeight: PIGEON_SPRITE_SIZE,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 8,
      height: 6,
      physicalHeight: 6,
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
      speed: PIGEON_SPEED,
      directional: false,
    },
    tags: new Set(["befriendable", "npc"]),
  };
}
