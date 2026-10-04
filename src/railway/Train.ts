import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import bank from "./rail-local-v1.json" with { type: "json" };
export const TRAIN_TYPE = "train-local-v1";
export const TRAIN_LENGTH = bank.width;
export const TRAIN_DEF: EntityDef = {
  sprite: {
    sheetKey: TRAIN_TYPE,
    spriteWidth: bank.width,
    spriteHeight: bank.height,
    frameCount: 1,
    frameDuration: 1000,
    drawOffsetY: 15,
  },
  collider: {
    offsetX: 0,
    offsetY: 12,
    width: bank.width - 8,
    height: 24,
    physicalHeight: 44,
    clientSolid: true,
  },
  wanderAI: null,
  hasVelocity: true,
  noShadow: true,
};
export function createTrain(wx: number, wy: number): Entity {
  return {
    id: 0,
    type: TRAIN_TYPE,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: TRAIN_DEF.sprite
      ? {
          ...TRAIN_DEF.sprite,
          frameCol: 0,
          frameRow: 0,
          direction: Direction.Right,
          moving: false,
          animTimer: 0,
        }
      : null,
    collider: TRAIN_DEF.collider ? { ...TRAIN_DEF.collider } : null,
    wanderAI: null,
    noShadow: true,
    wz: 0,
  };
}
