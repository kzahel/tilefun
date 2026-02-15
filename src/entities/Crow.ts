import { Direction, type Entity } from "./Entity.js";

const CROW_SPEED = 22;
const CROW_FRAME_DURATION = 150;
const CROW_FRAME_COUNT = 6;

/** Create a crow NPC at the given world position (idle animation). */
export function createCrow(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "crow",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "crow",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: CROW_FRAME_DURATION,
      frameCount: CROW_FRAME_COUNT,
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
      idleMin: 1.0,
      idleMax: 4.0,
      walkMin: 0.5,
      walkMax: 2.0,
      speed: CROW_SPEED,
      directional: true,
    },
    tags: new Set(["befriendable", "npc"]),
  };
}
