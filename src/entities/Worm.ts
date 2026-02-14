import { Direction, type Entity } from "./Entity.js";

const WORM_SPEED = 8;
const WORM_FRAME_DURATION = 180;
const WORM_FRAME_COUNT = 6;

/** Create a worm NPC (variant 1-4) at the given world position. */
export function createWorm1(wx: number, wy: number): Entity {
  return makeWorm("worm1", wx, wy);
}

export function createWorm2(wx: number, wy: number): Entity {
  return makeWorm("worm2", wx, wy);
}

export function createWorm3(wx: number, wy: number): Entity {
  return makeWorm("worm3", wx, wy);
}

export function createWorm4(wx: number, wy: number): Entity {
  return makeWorm("worm4", wx, wy);
}

function makeWorm(type: string, wx: number, wy: number): Entity {
  return {
    id: 0,
    type,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: type,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: WORM_FRAME_DURATION,
      frameCount: WORM_FRAME_COUNT,
      direction: Direction.Down,
      moving: false,
      spriteWidth: 16,
      spriteHeight: 16,
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
      idleMin: 2.0,
      idleMax: 6.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: WORM_SPEED,
      directional: true,
    },
    tags: new Set(["npc"]),
  };
}
