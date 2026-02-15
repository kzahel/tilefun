import { Direction, type Entity } from "./Entity.js";

const SEAGULL_SPEED = 18;
const SEAGULL_FRAME_DURATION = 160;
const SEAGULL_FRAME_COUNT = 6;

/** Create a seagull NPC at the given world position. */
export function createSeagull(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "seagull",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "seagull",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: SEAGULL_FRAME_DURATION,
      frameCount: SEAGULL_FRAME_COUNT,
      direction: Direction.Down,
      moving: false,
      spriteWidth: 32,
      spriteHeight: 32,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 6,
      physicalHeight: 12,
    },
    wanderAI: {
      state: "idle",
      timer: 2.0,
      dirX: 0,
      dirY: 0,
      idleMin: 1.5,
      idleMax: 5.0,
      walkMin: 0.5,
      walkMax: 2.5,
      speed: SEAGULL_SPEED,
      directional: true,
    },
    tags: new Set(["befriendable", "npc"]),
  };
}
