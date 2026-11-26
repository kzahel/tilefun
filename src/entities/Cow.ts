import { type ColliderComponent, Direction, type Entity } from "./Entity.js";

const COW_SPRITE_SIZE = 32;
const COW_SPEED = 12;
const COW_FRAME_DURATION = 250;
const COW_FRAME_COUNT = 3;

// Nearby mounting and hunting use the classic cow's authored horizontal reach.
export const CLASSIC_COW_INTERACTION_FOOTPRINT = {
  offsetX: 0,
  offsetY: 0,
  width: 22,
  height: 10,
};

export const CLASSIC_COW_COLLIDER = {
  offsetX: 0,
  offsetY: 5,
  width: 10,
  height: 10,
  physicalHeight: 9,
} satisfies ColliderComponent;

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
      drawOffsetY: 3,
    },
    collider: { ...CLASSIC_COW_COLLIDER },
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
      directional: false,
      befriendable: true,
      followDistance: 24,
      rideSpeed: 30,
    },
    tags: new Set(["befriendable", "npc", "rideable"]),
    weight: 500,
  };
}
