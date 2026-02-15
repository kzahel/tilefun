import { Direction, type Entity } from "./Entity.js";

export function createBall(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: "ball",
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "ball",
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      frameDuration: 100,
      frameCount: 1,
      direction: Direction.Down,
      moving: false,
      spriteWidth: 8,
      spriteHeight: 8,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 4,
      height: 4,
      solid: false,
      physicalHeight: 4,
    },
    wanderAI: null,
    tags: new Set(["projectile"]),
    weight: 0.5,
  };
}
