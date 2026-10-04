import { required } from "../art/ArtCatalog.js";
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

/** Exact contiguous sections of the immutable 456px bank, relative to the middle car.
 * No new pixels, mirroring, rotation or rescaling. Flat assembly matches the bank. */
export const TRAIN_CARRIAGES = [
  { type: "train-carriage-v1:left", x: 0, width: 136, offset: -148, inset: 4, colliderOffset: 2 },
  { type: "train-carriage-v1:middle", x: 136, width: 160, offset: 0, inset: 0, colliderOffset: 0 },
  {
    type: "train-carriage-v1:right",
    x: 296,
    width: 160,
    offset: 160,
    inset: 4,
    colliderOffset: -2,
  },
] as const;
export const TRAIN_CARRIAGE_DEFS: Record<string, EntityDef> = Object.fromEntries(
  TRAIN_CARRIAGES.map((c) => [
    c.type,
    {
      ...TRAIN_DEF,
      sprite: { ...required(TRAIN_DEF.sprite), sheetKey: c.type, spriteWidth: c.width },
      collider: {
        ...required(TRAIN_DEF.collider),
        width: c.width - c.inset,
        offsetX: c.colliderOffset,
      },
    },
  ]),
);
export function isTrain(entity: { type: string }): boolean {
  return entity.type === TRAIN_TYPE || entity.type.startsWith("train-carriage-v1:");
}
export function createTrainCarriages(wx: number, wy: number, heights: readonly number[]): Entity[] {
  return TRAIN_CARRIAGES.map((c, i) => {
    const e = createTrain(wx + c.offset, wy),
      def = required(TRAIN_CARRIAGE_DEFS[c.type]);
    e.type = c.type;
    e.sprite = { ...required(e.sprite), ...required(def.sprite) };
    e.collider = { ...required(def.collider) };
    e.wz = e.groundZ = heights[i] ?? 0;
    return e;
  });
}
