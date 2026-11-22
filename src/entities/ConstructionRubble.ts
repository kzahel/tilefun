import { Direction, type Entity } from "./Entity.js";
import type { EntityDef } from "./EntityDefs.js";

export const CONSTRUCTION_RUBBLE = "construction-rubble";
export const CONSTRUCTION_RUBBLE_DEF = {
  sprite: {
    sheetKey: CONSTRUCTION_RUBBLE,
    spriteWidth: 16,
    spriteHeight: 12,
    frameCount: 1,
    frameDuration: 1000,
    drawOffsetY: 3,
  },
  collider: { width: 9, height: 7, physicalHeight: 6, offsetX: 0, offsetY: 3.5 },
  wanderAI: null,
  hasVelocity: true,
} satisfies EntityDef;

export function createConstructionRubble(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: CONSTRUCTION_RUBBLE,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...CONSTRUCTION_RUBBLE_DEF.sprite,
      direction: Direction.Down,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      moving: false,
    },
    collider: { ...CONSTRUCTION_RUBBLE_DEF.collider },
    wanderAI: null,
  };
}
