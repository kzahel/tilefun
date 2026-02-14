import { Direction, type Entity } from "./Entity.js";

const GHOST_SPRITE_SIZE = 16;
const GHOST_SPEED = 15;
const GHOST_CHASE_SPEED = 35;
const GHOST_CHASE_RANGE = 80;
const GHOST_FRAME_DURATION = 200;
const GHOST_FRAME_COUNT = 4;

/** Create a friendly ghost — can be befriended as a buddy. */
export function createGhostFriendly(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "ghost-friendly",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "ghost-friendly",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: GHOST_FRAME_DURATION,
      frameCount: GHOST_FRAME_COUNT,
      direction: Direction.Down,
      moving: true,
      spriteWidth: GHOST_SPRITE_SIZE,
      spriteHeight: GHOST_SPRITE_SIZE,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 8,
      solid: false,
    },
    wanderAI: {
      state: "idle",
      timer: 2.0,
      dirX: 0,
      dirY: 0,
      idleMin: 1.0,
      idleMax: 3.0,
      walkMin: 1.0,
      walkMax: 2.5,
      speed: GHOST_SPEED,
      directional: false,
      befriendable: true,
      followDistance: 24,
    },
    tags: new Set(["befriendable"]),
  };
}

/** Create an angry ghost baddie — chases player, causes gem loss on contact. */
export function createGhostAngry(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "ghost-angry",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "ghost-angry",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: 150,
      frameCount: GHOST_FRAME_COUNT,
      direction: Direction.Down,
      moving: true,
      spriteWidth: GHOST_SPRITE_SIZE,
      spriteHeight: GHOST_SPRITE_SIZE,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 8,
      solid: false,
    },
    wanderAI: {
      state: "idle",
      timer: 2.0,
      dirX: 0,
      dirY: 0,
      idleMin: 0.5,
      idleMax: 2.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: GHOST_SPEED,
      directional: false,
      chaseRange: GHOST_CHASE_RANGE,
      chaseSpeed: GHOST_CHASE_SPEED,
      hostile: true,
    },
  };
}
