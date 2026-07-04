import { Direction, type Entity } from "./Entity.js";

const FISH_SPRITE_SIZE = 16;
const FISH_FRAME_DURATION = 200;
const FISH_SPEED = 12;

/** Create a swimming fish (variant 1). */
export function createFish1(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "fish1",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "fish1",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: FISH_FRAME_DURATION,
      frameCount: 4,
      direction: Direction.Down,
      moving: true,
      spriteWidth: FISH_SPRITE_SIZE,
      spriteHeight: FISH_SPRITE_SIZE,
    },
    collider: { offsetX: 0, offsetY: 0, width: 8, height: 6 },
    wanderAI: {
      state: "idle",
      timer: 1.0,
      dirX: 0,
      dirY: 0,
      idleMin: 1.0,
      idleMax: 3.0,
      walkMin: 2.0,
      walkMax: 5.0,
      speed: FISH_SPEED,
      directional: false,
    },
    noShadow: true,
    tags: new Set(["befriendable", "npc"]),
  };
}

/** Create a swimming fish (variant 2). */
export function createFish2(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "fish2",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "fish2",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: FISH_FRAME_DURATION,
      frameCount: 4,
      direction: Direction.Down,
      moving: true,
      spriteWidth: FISH_SPRITE_SIZE,
      spriteHeight: FISH_SPRITE_SIZE,
    },
    collider: { offsetX: 0, offsetY: 0, width: 8, height: 6 },
    wanderAI: {
      state: "idle",
      timer: 1.0,
      dirX: 0,
      dirY: 0,
      idleMin: 1.0,
      idleMax: 3.0,
      walkMin: 2.0,
      walkMax: 5.0,
      speed: FISH_SPEED,
      directional: false,
    },
    noShadow: true,
    tags: new Set(["befriendable", "npc"]),
  };
}

/** Create a swimming fish (variant 3). */
export function createFish3(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "fish3",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "fish3",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: FISH_FRAME_DURATION,
      frameCount: 4,
      direction: Direction.Down,
      moving: true,
      spriteWidth: FISH_SPRITE_SIZE,
      spriteHeight: FISH_SPRITE_SIZE,
    },
    collider: { offsetX: 0, offsetY: 0, width: 8, height: 6 },
    wanderAI: {
      state: "idle",
      timer: 1.0,
      dirX: 0,
      dirY: 0,
      idleMin: 1.0,
      idleMax: 3.0,
      walkMin: 2.0,
      walkMax: 5.0,
      speed: FISH_SPEED,
      directional: false,
    },
    noShadow: true,
    tags: new Set(["befriendable", "npc"]),
  };
}
